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
            console.error('❌ Redis connection failed:', error);
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

    // Active quiz session methods - optimized for faster access
    async setActiveQuiz(userId, guildId, quizData, ttlSeconds = 30 * 60) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`active_quiz:${userId}:${guildId}`);
            
            // Serialize and compress data for faster storage
            const serializedData = JSON.stringify(quizData);
            await this.client.setEx(key, ttlSeconds, serializedData);
            
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

    // Question caching methods - optimized for 13 questions with custom TTL
    async cacheQuestions(userId, guildId, questions, ttlSeconds = 60 * 60) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`questions:${userId}:${guildId}`);
            
            // Cache with custom TTL and compression
            const questionsData = {
                questions,
                timestamp: Date.now(),
                count: questions.length
            };
            
            await this.client.setEx(key, ttlSeconds, JSON.stringify(questionsData));
            
            console.log(`📡 Redis: Cached ${questions.length} questions for user ${userId} (TTL: ${ttlSeconds}s)`);
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
                const parsedData = JSON.parse(data);
                
                // Validate cache freshness (additional check)
                if (parsedData.timestamp && Date.now() - parsedData.timestamp < 20 * 60 * 1000) { // 20 minutes
                    console.log(`📡 Redis: Retrieved ${parsedData.count} cached questions for user ${userId}`);
                    return parsedData.questions;
                }
                
                // Cache is stale, delete it
                await this.client.del(key);
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

    // Recent questions tracking - optimized with sets for faster lookups
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

    // Batch operations for better performance
    async addRecentQuestionsBatch(userId, guildId, questionHashes) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`recent:${userId}:${guildId}`);
            
            if (questionHashes.length > 0) {
                // Add all hashes in one operation
                await this.client.sAdd(key, questionHashes);
                await this.client.expire(key, 7 * 24 * 60 * 60);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Redis: Error adding recent questions batch:', error);
            return false;
        }
    }

    // Guild leaderboard caching - with faster access
    async cacheGuildLeaderboard(guildId, leaderboard) {
        if (!this.connected) return false;
        
        try {
            const key = this.key(`leaderboard:${guildId}:${this.getCurrentDate()}`);
            
            // Set with 1 hour expiry
            await this.client.setEx(key, 60 * 60, JSON.stringify(leaderboard));
            
            return true;
            
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

    // Performance monitoring methods
    async getConnectionStatus() {
        if (!this.connected) return { connected: false };
        
        try {
            const info = await this.client.info();
            const keyCount = await this.client.dbSize();
            
            return {
                connected: true,
                keyCount,
                info: info.split('\r\n').reduce((acc, line) => {
                    if (line.includes(':')) {
                        const [key, value] = line.split(':');
                        if (['used_memory_human', 'connected_clients', 'total_commands_processed'].includes(key)) {
                            acc[key] = value;
                        }
                    }
                    return acc;
                }, {})
            };
            
        } catch (error) {
            console.error('❌ Redis: Error getting connection status:', error);
            return { connected: false, error: error.message };
        }
    }

    // Optimized cleanup methods
    async cleanupExpiredKeys() {
        if (!this.connected) return 0;
        
        try {
            let deletedCount = 0;
            const batchSize = 100;
            let cursor = 0;
            
            do {
                // Use SCAN for better performance on large datasets
                const result = await this.client.scan(cursor, {
                    MATCH: `${this.prefix}*`,
                    COUNT: batchSize
                });
                
                cursor = result.cursor;
                const keys = result.keys;
                
                if (keys.length > 0) {
                    // Check TTL in batch
                    const pipeline = this.client.multi();
                    
                    for (const key of keys) {
                        pipeline.ttl(key);
                    }
                    
                    const ttls = await pipeline.exec();
                    
                    // Delete expired or soon-to-expire keys
                    const keysToDelete = [];
                    for (let i = 0; i < keys.length; i++) {
                        const ttl = ttls[i];
                        if (ttl !== null && ttl <= 60) { // Expires in 1 minute or less
                            keysToDelete.push(keys[i]);
                        }
                    }
                    
                    if (keysToDelete.length > 0) {
                        await this.client.del(keysToDelete);
                        deletedCount += keysToDelete.length;
                    }
                }
                
            } while (cursor !== 0);
            
            if (deletedCount > 0) {
                console.log(`🧹 Redis: Cleaned up ${deletedCount} expired keys`);
            }
            
            return deletedCount;
            
        } catch (error) {
            console.error('❌ Redis: Error during cleanup:', error);
            return 0;
        }
    }

    // Bulk operations for better performance during quiz sessions
    async preloadUserData(userId, guildId) {
        if (!this.connected) return {};
        
        try {
            const keys = [
                this.key(`completion:${userId}:${guildId}:${this.getCurrentDate()}`),
                this.key(`active_quiz:${userId}:${guildId}`),
                this.key(`questions:${userId}:${guildId}`),
                this.key(`recent:${userId}:${guildId}`)
            ];
            
            const pipeline = this.client.multi();
            pipeline.get(keys[0]); // completion
            pipeline.get(keys[1]); // active quiz
            pipeline.get(keys[2]); // questions
            pipeline.sMembers(keys[3]); // recent questions
            
            const results = await pipeline.exec();
            
            return {
                completion: results[0] ? JSON.parse(results[0]) : null,
                activeQuiz: results[1] ? JSON.parse(results[1]) : null,
                questions: results[2] ? JSON.parse(results[2])?.questions : null,
                recentQuestions: new Set(results[3] || [])
            };
            
        } catch (error) {
            console.error('❌ Redis: Error preloading user data:', error);
            return {};
        }
    }

    // Memory optimization for large question sets
    async optimizeQuestionCache() {
        if (!this.connected) return 0;
        
        try {
            let optimizedCount = 0;
            const questionKeys = await this.client.keys(this.key('questions:*'));
            
            for (const key of questionKeys) {
                const data = await this.client.get(key);
                
                if (data) {
                    const parsedData = JSON.parse(data);
                    
                    // If cache is older than 30 minutes or has too many questions, optimize
                    if (parsedData.timestamp && 
                        (Date.now() - parsedData.timestamp > 30 * 60 * 1000 || 
                         parsedData.questions?.length > 20)) {
                        
                        // Keep only first 13 questions and update timestamp
                        if (parsedData.questions?.length > 13) {
                            parsedData.questions = parsedData.questions.slice(0, 13);
                            parsedData.count = 13;
                            parsedData.timestamp = Date.now();
                            
                            await this.client.setEx(key, 15 * 60, JSON.stringify(parsedData)); // 15 min TTL
                            optimizedCount++;
                        }
                    }
                }
            }
            
            if (optimizedCount > 0) {
                console.log(`🔧 Redis: Optimized ${optimizedCount} question caches`);
            }
            
            return optimizedCount;
            
        } catch (error) {
            console.error('❌ Redis: Error optimizing question cache:', error);
            return 0;
        }
    }

    // Advanced caching methods for better performance
    async setWithExpiry(key, value, ttlSeconds) {
        if (!this.connected) return false;
        
        try {
            await this.client.setEx(this.key(key), ttlSeconds, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('❌ Redis: Error setting value with expiry:', error);
            return false;
        }
    }

    async getWithDefault(key, defaultValue = null) {
        if (!this.connected) return defaultValue;
        
        try {
            const data = await this.client.get(this.key(key));
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('❌ Redis: Error getting value:', error);
            return defaultValue;
        }
    }

    // Batch get operation for multiple keys
    async getBatch(keys) {
        if (!this.connected) return [];
        
        try {
            const prefixedKeys = keys.map(key => this.key(key));
            const values = await this.client.mGet(prefixedKeys);
            
            return values.map(value => {
                try {
                    return value ? JSON.parse(value) : null;
                } catch {
                    return value;
                }
            });
            
        } catch (error) {
            console.error('❌ Redis: Error getting batch values:', error);
            return new Array(keys.length).fill(null);
        }
    }

    // Batch set operation for multiple key-value pairs
    async setBatch(keyValuePairs, ttlSeconds = 3600) {
        if (!this.connected) return false;
        
        try {
            const pipeline = this.client.multi();
            
            for (const [key, value] of keyValuePairs) {
                pipeline.setEx(this.key(key), ttlSeconds, JSON.stringify(value));
            }
            
            await pipeline.exec();
            return true;
            
        } catch (error) {
            console.error('❌ Redis: Error setting batch values:', error);
            return false;
        }
    }

    // Health check method
    async healthCheck() {
        if (!this.connected) {
            return {
                status: 'disconnected',
                connected: false,
                error: 'Redis not connected'
            };
        }
        
        try {
            const start = Date.now();
            await this.client.ping();
            const latency = Date.now() - start;
            
            const info = await this.client.info('server');
            const keyCount = await this.client.dbSize();
            
            return {
                status: 'healthy',
                connected: true,
                latency: `${latency}ms`,
                keyCount,
                serverInfo: info.split('\r\n').reduce((acc, line) => {
                    if (line.includes(':')) {
                        const [key, value] = line.split(':');
                        acc[key] = value;
                    }
                    return acc;
                }, {})
            };
            
        } catch (error) {
            return {
                status: 'error',
                connected: false,
                error: error.message
            };
        }
    }

    // Get Redis statistics
    async getStats() {
        if (!this.connected) return null;
        
        try {
            const info = await this.client.info();
            const keyCount = await this.client.dbSize();
            
            // Count keys by pattern
            const patterns = {
                completions: `${this.prefix}completion:*`,
                activeQuizzes: `${this.prefix}active_quiz:*`,
                questions: `${this.prefix}questions:*`,
                recentQuestions: `${this.prefix}recent:*`,
                leaderboards: `${this.prefix}leaderboard:*`,
                resets: `${this.prefix}reset:*`
            };
            
            const patternCounts = {};
            for (const [name, pattern] of Object.entries(patterns)) {
                const keys = await this.client.keys(pattern);
                patternCounts[name] = keys.length;
            }
            
            return {
                connected: true,
                totalKeys: keyCount,
                keysByType: patternCounts,
                memoryUsage: info.match(/used_memory_human:(.+)/)?.[1]?.trim(),
                connectedClients: info.match(/connected_clients:(\d+)/)?.[1],
                commandsProcessed: info.match(/total_commands_processed:(\d+)/)?.[1]
            };
            
        } catch (error) {
            console.error('❌ Redis: Error getting statistics:', error);
            return null;
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

module.exports = RedisManager;
