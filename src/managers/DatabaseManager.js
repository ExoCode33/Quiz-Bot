const { Pool } = require('pg');

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.connected = false;
    }

    async connect() {
        try {
            if (!process.env.DATABASE_URL) {
                throw new Error('DATABASE_URL is required');
            }

            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.connected = true;
            
            // Initialize tables
            await this.initializeTables();
            
            console.log('✅ PostgreSQL connected and tables initialized');
            
        } catch (error) {
            console.error('❌ PostgreSQL connection failed:', error);
            throw error;
        }
    }

    async initializeTables() {
        try {
            // Quiz completions table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS "Quiz-Bot_completions" (
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    date DATE NOT NULL,
                    score INTEGER NOT NULL,
                    tier INTEGER NOT NULL,
                    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, guild_id, date)
                )
            `);

            // Question history table (to avoid repeating questions)
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS "Quiz-Bot_question_history" (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    question_hash VARCHAR(64) NOT NULL,
                    question_text TEXT NOT NULL,
                    asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create indexes
            await this.pool.query('CREATE INDEX IF NOT EXISTS idx_completions_date ON "Quiz-Bot_completions"(date)');
            await this.pool.query('CREATE INDEX IF NOT EXISTS idx_question_history_user ON "Quiz-Bot_question_history"(user_id, guild_id)');
            
            console.log('✅ Database tables initialized');
            
        } catch (error) {
            console.error('❌ Error initializing database tables:', error);
            throw error;
        }
    }

    async saveQuizCompletion(userId, guildId, score, tier) {
        if (!this.connected) throw new Error('Database not connected');
        
        try {
            const currentDate = this.getCurrentDate();
            
            await this.pool.query(`
                INSERT INTO "Quiz-Bot_completions" (user_id, guild_id, date, score, tier, completed_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET
                    score = $4,
                    tier = $5,
                    completed_at = CURRENT_TIMESTAMP
            `, [userId, guildId, currentDate, score, tier]);
            
            console.log(`✅ Saved quiz completion: User ${userId}, Score ${score}, Tier ${tier}`);
            
        } catch (error) {
            console.error('❌ Error saving quiz completion:', error);
            throw error;
        }
    }

    async getQuizCompletion(userId, guildId, date = null) {
        if (!this.connected) throw new Error('Database not connected');
        
        try {
            const currentDate = date || this.getCurrentDate();
            
            const result = await this.pool.query(
                'SELECT * FROM "Quiz-Bot_completions" WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDate]
            );
            
            return result.rows[0] || null;
            
        } catch (error) {
            console.error('❌ Error getting quiz completion:', error);
            throw error;
        }
    }

    async saveQuestionHistory(userId, guildId, questionHash, questionText) {
        if (!this.connected) throw new Error('Database not connected');
        
        try {
            await this.pool.query(`
                INSERT INTO "Quiz-Bot_question_history" (user_id, guild_id, question_hash, question_text, asked_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            `, [userId, guildId, questionHash, questionText]);
            
        } catch (error) {
            console.error('❌ Error saving question history:', error);
            // Don't throw - this is not critical
        }
    }

    async getRecentQuestions(userId, guildId, days = 30) {
        if (!this.connected) return [];
        
        try {
            const result = await this.pool.query(`
                SELECT question_hash, question_text 
                FROM "Quiz-Bot_question_history" 
                WHERE user_id = $1 AND guild_id = $2 
                AND asked_at > NOW() - INTERVAL '${days} days'
                ORDER BY asked_at DESC
            `, [userId, guildId]);
            
            return result.rows;
            
        } catch (error) {
            console.error('❌ Error getting recent questions:', error);
            return [];
        }
    }

    async getGuildCompletionsToday(guildId) {
        if (!this.connected) throw new Error('Database not connected');
        
        try {
            const currentDate = this.getCurrentDate();
            
            const result = await this.pool.query(
                'SELECT * FROM "Quiz-Bot_completions" WHERE guild_id = $1 AND date = $2 ORDER BY tier DESC, completed_at ASC',
                [guildId, currentDate]
            );
            
            return result.rows;
            
        } catch (error) {
            console.error('❌ Error getting guild completions:', error);
            throw error;
        }
    }

    async cleanupOldData(daysToKeep = 30) {
        if (!this.connected) throw new Error('Database not connected');
        
        try {
            const completionsResult = await this.pool.query(
                'DELETE FROM "Quiz-Bot_completions" WHERE date < CURRENT_DATE - INTERVAL \'$1 days\'',
                [daysToKeep]
            );

            const historyResult = await this.pool.query(
                'DELETE FROM "Quiz-Bot_question_history" WHERE asked_at < NOW() - INTERVAL \'$1 days\'',
                [daysToKeep * 2] // Keep question history longer
            );

            const completionsDeleted = completionsResult.rowCount || 0;
            const historyDeleted = historyResult.rowCount || 0;

            console.log(`🧹 Database cleanup: ${completionsDeleted} completions, ${historyDeleted} question history records deleted`);

            return {
                completionsDeleted,
                historyDeleted,
                totalDeleted: completionsDeleted + historyDeleted
            };

        } catch (error) {
            console.error('❌ Error during database cleanup:', error);
            throw error;
        }
    }

    getCurrentDate() {
        const resetHour = parseInt(process.env.DAILY_RESET_HOUR_EDT) || 0;
        const resetMinute = parseInt(process.env.DAILY_RESET_MINUTE_EDT) || 30;
        
        // Convert EDT to UTC for database storage
        const now = new Date();
        const edtOffset = this.isEDT(now) ? -4 : -5;
        const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
        
        const currentTimeInMinutes = (edtTime.getHours() * 60) + edtTime.getMinutes();
        const resetTimeInMinutes = (resetHour * 60) + resetMinute;
        
        // If it's before reset time, use previous day
        if (currentTimeInMinutes < resetTimeInMinutes) {
            edtTime.setDate(edtTime.getDate() - 1);
        }
        
        return edtTime.toISOString().split('T')[0];
    }

    isEDT(date) {
        const year = date.getFullYear();
        
        // Second Sunday in March at 2:00 AM
        const marchSecondSunday = new Date(year, 2, 1);
        marchSecondSunday.setDate(1 + (14 - marchSecondSunday.getDay()) % 7);
        marchSecondSunday.setDate(marchSecondSunday.getDate() + 7);
        marchSecondSunday.setHours(2, 0, 0, 0);
        
        // First Sunday in November at 2:00 AM
        const novemberFirstSunday = new Date(year, 10, 1);
        novemberFirstSunday.setDate(1 + (7 - novemberFirstSunday.getDay()) % 7);
        novemberFirstSunday.setHours(2, 0, 0, 0);
        
        return date >= marchSecondSunday && date < novemberFirstSunday;
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.connected = false;
            console.log('🗄️ PostgreSQL connection closed');
        }
    }
}

module.exports = DatabaseManager;
