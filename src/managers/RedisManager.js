const { createClient } = require('redis');

class RedisManager {
    constructor() {
        this.client = null;
        this.connected = false;
        this.prefix = process.env.REDIS_KEY_PREFIX || 'Quiz-Bot:';
    }

    async connect() {
        try {
            if (!process.env.REDISHOST) {
                throw new Error('Redis host not configured');
            }

            const redisConfig = {
                socket: {
                    host: process.env.REDISHOST,
                    port: parseInt(process.env.REDISPORT) || 6379,
                    connectTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT) || 10000
                },
                database: parseInt(process.env.REDIS_DB) || 1
            };

            if (process.env.REDIS_PASSWORD) {
                redisConfig.password = process.env.REDIS_PASSWORD;
            }

            this.client = createClient(redisConfig);

            this.client.on('error', (err) => {
                console.error('Redis Client Error:', err);
                this.connected = false;
            });

            this.client.on('connect', () => {
                console.log('📡 Redis connecting...');
            });

            this.client.on('ready', () => {
                console.log('✅ Redis ready');
                this.connected = true;
            });

            this.client.on('end', () => {
                console.log('📡 Redis connection ended');
                this.connected = false;
            });

            await this.client.connect();
            
            // Test connection
            await this.client.ping();
            
        } catch (error) {
            console.error('❌ Redis: Error caching guild leaderboard:', error);
            return false;
        }
    }

    async getCachedGuildLeaderboard(guildId) {
        if (!this.connected) return null;
        
        try {
            const key = this.key(`leaderboard:${guildId}:${this.getCurrentDate()}`);
            const data = await this.client.get(key);
            
            if (data) {
                return JSON.parse(data);
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Redis: Error getting cached guild leaderboard:', error);
            return null;
        }
    }

    // Daily reset methods
    async markResetCompleted(date) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`reset:${date}`);
            
            // Set with 48 hours expiry
            await this.client.setEx(key, 48 * 60 * 60, 'completed');
            
            return true;
            
        } catch (error) {
            console.error('❌ Redis: Error marking reset completed:', error);
            return false;
        }
    }

    async wasResetCompleted(date) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`reset:${date}`);
            const result = await this.client.get(key);
            
            return result === 'completed';
            
        } catch (error) {
            console.error('❌ Redis: Error checking reset status:', error);
            return false;
        }
    }

    // Cleanup methods
    async cleanupExpiredKeys() {
        if (!this.connected) return 0;
        
        try {
            // Get all keys with our prefix
            const keys = await this.client.keys(`${this.prefix}*`);
            let deletedCount = 0;
            
            // Delete keys in batches
            const batchSize = 100;
            for (let i = 0; i < keys.length; i += batchSize) {
                const batch = keys.slice(i, i + batchSize);
                
                for (const key of batch) {
                    const ttl = await this.client.ttl(key);
                    
                    // If key has expired or is about to expire in 1 minute
                    if (ttl <= 60) {
                        await this.client.del(key);
                        deletedCount++;
                    }
                }
            }
            
            if (deletedCount > 0) {
                console.log(`🧹 Redis: Cleaned up ${deletedCount} expired keys`);
            }
            
            return deletedCount;
            
        } catch (error) {
            console.error('❌ Redis: Error during cleanup:', error);
            return 0;
        }
    }

    // Utility methods
    getCurrentDate() {
        const resetHour = parseInt(process.env.DAILY_RESET_HOUR_EDT) || 0;
        const resetMinute = parseInt(process.env.DAILY_RESET_MINUTE_EDT) || 30;
        
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
        if (this.client) {
            await this.client.quit();
            this.connected = false;
            console.log('📡 Redis connection closed');
        }
    }
}

module.exports = RedisManager;console.error('❌ Redis connection failed:', error);
            throw error;
        }
    }

    // Generate prefixed key
    key(suffix) {
        return `${this.prefix}${suffix}`;
    }

    // Quiz completion methods
    async setQuizCompletion(userId, guildId, score, tier) {
        if (!this.connected) return false;
        
        try {
            const currentDate = this.getCurrentDate();
            const key = this.key(`completion:${userId}:${guildId}:${currentDate}`);
            
            const data = {
                userId,
                guildId,
                date: currentDate,
                score,
                tier,
                completedAt: new Date().toISOString()
            };
            
            // Set with 25 hours expiry (just over a day)
            await this.client.setEx(key, 25 * 60 * 60, JSON.stringify(data));
            
            console.log(`📡 Redis: Saved quiz completion for user ${userId}`);
            return true;
            
        } catch (error) {
            console.error('❌ Redis: Error setting quiz completion:', error);
            return false;
        }
    }

    async getQuizCompletion(userId, guildId, date = null) {
        if (!this.connected) return null;
        
        try {
            const currentDate = date || this.getCurrentDate();
            const key = this.key(`completion:${userId}:${guildId}:${currentDate}`);
            
            const data = await this.client.get(key);
            
            if (data) {
                return JSON.parse(data);
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Redis: Error getting quiz completion:', error);
            return null;
        }
    }

    // Active quiz session methods
    async setActiveQuiz(userId, guildId, quizData) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`active_quiz:${userId}:${guildId}`);
            
            // Set with 30 minutes expiry
            await this.client.setEx(key, 30 * 60, JSON.stringify(quizData));
            
            return true;
            
        } catch (error) {
            console.error('❌ Redis: Error setting active quiz:', error);
            return false;
        }
    }

    async getActiveQuiz(userId, guildId) {
        if (!this.connected) return null;
        
        try {
            const key = this.key(`active_quiz:${userId}:${guildId}`);
            const data = await this.client.get(key);
            
            if (data) {
                return JSON.parse(data);
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Redis: Error getting active quiz:', error);
            return null;
        }
    }

    async deleteActiveQuiz(userId, guildId) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`active_quiz:${userId}:${guildId}`);
            await this.client.del(key);
            
            return true;
            
        } catch (error) {
            console.error('❌ Redis: Error deleting active quiz:', error);
            return false;
        }
    }

    // Question caching methods
    async cacheQuestions(userId, guildId, questions) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`questions:${userId}:${guildId}`);
            
            // Set with 1 hour expiry
            await this.client.setEx(key, 60 * 60, JSON.stringify(questions));
            
            return true;
            
        } catch (error) {
            console.error('❌ Redis: Error caching questions:', error);
            return false;
        }
    }

    async getCachedQuestions(userId, guildId) {
        if (!this.connected) return null;
        
        try {
            const key = this.key(`questions:${userId}:${guildId}`);
            const data = await this.client.get(key);
            
            if (data) {
                return JSON.parse(data);
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Redis: Error getting cached questions:', error);
            return null;
        }
    }

    async deleteCachedQuestions(userId, guildId) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`questions:${userId}:${guildId}`);
            await this.client.del(key);
            
            return true;
            
        } catch (error) {
            console.error('❌ Redis: Error deleting cached questions:', error);
            return false;
        }
    }

    // Recent questions tracking
    async addRecentQuestion(userId, guildId, questionHash) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`recent:${userId}:${guildId}`);
            
            // Add to set with 7 days expiry
            await this.client.sAdd(key, questionHash);
            await this.client.expire(key, 7 * 24 * 60 * 60);
            
            return true;
            
        } catch (error) {
            console.error('❌ Redis: Error adding recent question:', error);
            return false;
        }
    }

    async getRecentQuestions(userId, guildId) {
        if (!this.connected) return new Set();
        
        try {
            const key = this.key(`recent:${userId}:${guildId}`);
            const questions = await this.client.sMembers(key);
            
            return new Set(questions);
            
        } catch (error) {
            console.error('❌ Redis: Error getting recent questions:', error);
            return new Set();
        }
    }

    // Guild leaderboard caching
    async cacheGuildLeaderboard(guildId, leaderboard) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`leaderboard:${guildId}:${this.getCurrentDate()}`);
            
            // Set with 1 hour expiry
            await this.client.setEx(key, 60 * 60, JSON.stringify(leaderboard));
            
            return true;
            
        } catch (error) {
