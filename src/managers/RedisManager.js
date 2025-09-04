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

    // SAFE cleanup that only touches our bot's keys
    async cleanupExpiredKeys() {
        if (!this.connected) return 0;
        
        try {
            let deletedCount = 0;
            const batchSize = 100;
            let cursor = 0;
            
            console.log(`🧹 Starting cleanup for keys with prefix: "${this.prefix}"`);
            
            do {
                // CRITICAL: Only scan keys with OUR prefix to avoid other bots
                const result = await this.client.scan(cursor, {
                    MATCH: `${this.prefix}*`,  // Only our keys
                    COUNT: batchSize
                });
                
                cursor = result.cursor;
                const keys = result.keys;
                
                if (keys.length > 0) {
                    console.log(`🔍 Found ${keys.length} keys with our prefix to check`);
                    
                    // Check TTL in batch
                    const pipeline = this.client.multi();
                    
                    for (const key of keys) {
                        pipeline.ttl(key);
                    }
                    
                    const ttls = await pipeline.exec();
                    
                    // Delete expired or soon-to-expire keys (only ours)
                    const keysToDelete = [];
                    for (let i = 0; i < keys.length; i++) {
                        const ttl = ttls[i];
                        if (ttl !== null && ttl <= 60) { // Expires in 1 minute or less
                            keysToDelete.push(keys[i]);
                        }
                    }
                    
                    if (keysToDelete.length > 0) {
                        console.log(`🗑️ Deleting ${keysToDelete.length} expired keys (our bot only)`);
                        await this.client.del(keysToDelete);
                        deletedCount += keysToDelete.length;
                    }
                }
                
            } while (cursor !== 0);
            
            if (deletedCount > 0) {
                console.log(`🧹 Redis cleanup completed: ${deletedCount} expired keys deleted (our bot only)`);
                console.log(`🔒 Other bots' keys were not touched (prefix isolation working)`);
            } else {
                console.log(`✅ No expired keys found with our prefix "${this.prefix}"`);
            }
            
            return deletedCount;
            
        } catch (error) {
            console.error('❌ Redis: Error during safe cleanup:', error);
            return 0;
        }
    }

    // Safe optimization that only affects our question cache
    async optimizeQuestionCache() {
        if (!this.connected) return 0;
        
        try {
            let optimizedCount = 0;
            
            // CRITICAL: Only get question cache keys with our prefix
            const questionKeys = await this.client.keys(this.key('questions:*'));
            
            console.log(`🔧 Optimizing ${questionKeys.length} question cache keys (our bot only)`);
            
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
                console.log(`🔧 Redis optimization completed: ${optimizedCount} caches optimized (our bot only)`);
            } else {
                console.log(`✅ No question caches needed optimization`);
            }
            
            return optimizedCount;
            
        } catch (error) {
            console.error('❌ Redis: Error optimizing question cache:', error);
            return 0;
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
