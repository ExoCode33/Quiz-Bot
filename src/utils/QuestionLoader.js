const { FALLBACK_QUESTIONS, ANIME_KEYWORDS, BAD_KEYWORDS, ANIME_TITLES } = require('./constants');

class QuestionLoader {
    constructor() {
        // Question pool targets
        this.questionPoolTargets = {
            easy: 50,
            medium: 75,
            hard: 75
        };
        
        // Minimum thresholds to trigger regeneration
        this.questionPoolMinimums = {
            easy: 20,
            medium: 30,
            hard: 30
        };
        
        // Current pool status
        this.questionPools = {
            easy: [],
            medium: [],
            hard: []
        };
        
        // API endpoints with better rate limiting
        this.apiEndpoints = [
            {
                url: 'https://opentdb.com/api.php?amount=10&category=31&type=multiple&difficulty=easy',
                name: 'OpenTDB-Easy',
                priority: 1,
                maxRetries: 3,
                delay: 3000,
                timeout: 15000,
                difficulty: 'easy'
            },
            {
                url: 'https://opentdb.com/api.php?amount=10&category=31&type=multiple&difficulty=medium',
                name: 'OpenTDB-Medium', 
                priority: 1,
                maxRetries: 3,
                delay: 3500,
                timeout: 15000,
                difficulty: 'medium'
            },
            {
                url: 'https://opentdb.com/api.php?amount=10&category=31&type=multiple&difficulty=hard',
                name: 'OpenTDB-Hard',
                priority: 1,
                maxRetries: 3,
                delay: 4000,
                timeout: 15000,
                difficulty: 'hard'
            },
            {
                url: 'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=15&difficulty=easy',
                name: 'TriviaAPI-Easy',
                priority: 2,
                maxRetries: 2,
                delay: 2000,
                timeout: 12000,
                difficulty: 'easy'
            },
            {
                url: 'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=15&difficulty=medium',
                name: 'TriviaAPI-Medium',
                priority: 2,
                maxRetries: 2,
                delay: 2500,
                timeout: 12000,
                difficulty: 'medium'
            },
            {
                url: 'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=15&difficulty=hard',
                name: 'TriviaAPI-Hard',
                priority: 2,
                maxRetries: 2,
                delay: 3000,
                timeout: 12000,
                difficulty: 'hard'
            }
        ];
        
        // Global request queue for rate limiting
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.globalLastRequest = 0;
        this.globalMinDelay = 4000; // 4 seconds between requests
        
        // Pool generation status
        this.isGeneratingPools = false;
        this.poolGenerationInterval = null;
        
        // Redis manager reference
        this.redis = null;
        
        // Session stats
        this.sessionStats = {
            totalCalls: 0,
            successfulCalls: 0,
            totalQuestions: 0,
            validQuestions: 0
        };
        
        // Preloaded questions cache
        this.preloadedQuestions = new Map();
        
        // Start systems
        this.startQueueProcessor();
        
        console.log('🏊 Question Pool System initialized');
        console.log(`📊 Targets: Easy: ${this.questionPoolTargets.easy}, Medium: ${this.questionPoolTargets.medium}, Hard: ${this.questionPoolTargets.hard}`);
    }

    // Initialize QuestionLoader with Redis - MAIN ENTRY POINT
    async initializeWithRedis(redisManager) {
        this.redis = redisManager;
        console.log('🔄 Initializing QuestionLoader with Redis...');
        
        try {
            // Initialize pools immediately
            await this.initializeQuestionPools();
            
            // Start pool monitoring
            this.startPoolMonitoring();
            
            console.log('✅ QuestionLoader Redis initialization complete');
        } catch (error) {
            console.error('❌ QuestionLoader Redis initialization failed:', error);
            // Fallback initialization
            this.loadFallbackIntoPools();
            this.startPoolMonitoring();
        }
    }

    // Initialize question pools - checks Redis first, then fallback
    async initializeQuestionPools() {
        try {
            console.log('🚀 Initializing question pools...');
            
            // First check if pools exist in Redis
            let poolsExist = false;
            if (this.redis?.connected) {
                poolsExist = await this.loadPoolsFromRedis();
            }
            
            if (!poolsExist) {
                console.log('📚 No existing pools found, creating fresh pools...');
                
                // Clear memory pools
                this.questionPools.easy = [];
                this.questionPools.medium = [];
                this.questionPools.hard = [];
                
                // Load fallback questions into memory pools
                this.loadFallbackIntoPools();
                
                // Save initial pools to Redis
                if (this.redis?.connected) {
                    await this.savePoolsToRedis();
                    console.log('💾 Initial pools saved to Redis');
                }
                
                // Log pool status
                this.logPoolStatus();
                
                // Start background API generation
                setTimeout(() => {
                    this.generateAllPoolsAsync().catch(console.error);
                }, 5000); // Wait 5 seconds before starting API calls
                
                console.log('🏭 Background API generation scheduled...');
            } else {
                console.log('📥 Loaded existing pools from Redis');
                this.logPoolStatus();
                
                // Still check if we need more questions
                setTimeout(() => {
                    this.checkAndReplenishPools().catch(console.error);
                }, 10000); // Wait 10 seconds
            }
            
        } catch (error) {
            console.error('❌ Error initializing question pools:', error);
            
            // Fallback: at least load memory pools
            this.loadFallbackIntoPools();
            console.log('🛡️ Fallback initialization completed');
        }
    }

    // Load pools from Redis with validation
    async loadPoolsFromRedis() {
        if (!this.redis?.connected) {
            console.log('⚠️ Redis not connected, skipping pool load');
            return false;
        }
        
        try {
            console.log('📡 Checking Redis for existing question pools...');
            
            const [easyData, mediumData, hardData] = await Promise.all([
                this.redis.client.get(this.redis.key('question_pool:easy')),
                this.redis.client.get(this.redis.key('question_pool:medium')),
                this.redis.client.get(this.redis.key('question_pool:hard'))
            ]);
            
            let loaded = false;
            
            if (easyData) {
                try {
                    this.questionPools.easy = JSON.parse(easyData);
                    console.log(`✅ Loaded ${this.questionPools.easy.length} easy questions from Redis`);
                    loaded = true;
                } catch (err) {
                    console.warn('⚠️ Failed to parse easy questions from Redis');
                    this.questionPools.easy = [];
                }
            }
            
            if (mediumData) {
                try {
                    this.questionPools.medium = JSON.parse(mediumData);
                    console.log(`✅ Loaded ${this.questionPools.medium.length} medium questions from Redis`);
                    loaded = true;
                } catch (err) {
                    console.warn('⚠️ Failed to parse medium questions from Redis');
                    this.questionPools.medium = [];
                }
            }
            
            if (hardData) {
                try {
                    this.questionPools.hard = JSON.parse(hardData);
                    console.log(`✅ Loaded ${this.questionPools.hard.length} hard questions from Redis`);
                    loaded = true;
                } catch (err) {
                    console.warn('⚠️ Failed to parse hard questions from Redis');
                    this.questionPools.hard = [];
                }
            }
            
            if (loaded) {
                const totalLoaded = this.questionPools.easy.length + 
                                 this.questionPools.medium.length + 
                                 this.questionPools.hard.length;
                console.log(`📊 Total questions loaded from Redis: ${totalLoaded}`);
            }
            
            return loaded;
            
        } catch (error) {
            console.error('❌ Error loading pools from Redis:', error);
            return false;
        }
    }

    // Save pools to Redis with error handling
    async savePoolsToRedis() {
        if (!this.redis?.connected) {
            console.log('⚠️ Redis not connected, skipping pool save');
            return false;
        }
        
        try {
            const savePromises = [];
            
            if (this.questionPools.easy.length > 0) {
                savePromises.push(
                    this.redis.client.setEx(
                        this.redis.key('question_pool:easy'),
                        24 * 60 * 60, // 24 hours
                        JSON.stringify(this.questionPools.easy)
                    )
                );
            }
            
            if (this.questionPools.medium.length > 0) {
                savePromises.push(
                    this.redis.client.setEx(
                        this.redis.key('question_pool:medium'),
                        24 * 60 * 60,
                        JSON.stringify(this.questionPools.medium)
                    )
                );
            }
            
            if (this.questionPools.hard.length > 0) {
                savePromises.push(
                    this.redis.client.setEx(
                        this.redis.key('question_pool:hard'),
                        24 * 60 * 60,
                        JSON.stringify(this.questionPools.hard)
                    )
                );
            }
            
            await Promise.all(savePromises);
            
            const totalSaved = this.questionPools.easy.length + 
                              this.questionPools.medium.length + 
                              this.questionPools.hard.length;
            
            console.log(`💾 Saved ${totalSaved} questions to Redis across all difficulties`);
            return true;
            
        } catch (error) {
            console.error('❌ Error saving pools to Redis:', error);
            return false;
        }
    }

    // Enhanced fallback loading from separate file
    loadFallbackIntoPools() {
        // Load questions from the comprehensive fallback file
        this.questionPools.easy = [...FALLBACK_QUESTIONS.Easy];
        this.questionPools.medium = [...FALLBACK_QUESTIONS.Medium];
        this.questionPools.hard = [...FALLBACK_QUESTIONS.Hard];
        
        // Shuffle all pools
        this.shuffleArray(this.questionPools.easy);
        this.shuffleArray(this.questionPools.medium);
        this.shuffleArray(this.questionPools.hard);
        
        const totalLoaded = this.questionPools.easy.length + 
                           this.questionPools.medium.length + 
                           this.questionPools.hard.length;
        
        console.log(`📚 Loaded ${totalLoaded} fallback questions:`);
        console.log(`   Easy: ${this.questionPools.easy.length}`);
        console.log(`   Medium: ${this.questionPools.medium.length}`);
        console.log(`   Hard: ${this.questionPools.hard.length}`);
    }

    // Start pool monitoring
    startPoolMonitoring() {
        // Avoid duplicate intervals
        if (this.poolGenerationInterval) {
            clearInterval(this.poolGenerationInterval);
        }
        
        // Check pools every 30 seconds
        this.poolGenerationInterval = setInterval(async () => {
            await this.checkAndReplenishPools();
        }, 30000);
        
        console.log('👁️ Started pool monitoring (30s intervals)');
    }

    // Check pools and replenish if needed
    async checkAndReplenishPools() {
        try {
            const currentCounts = {
                easy: this.questionPools.easy.length,
                medium: this.questionPools.medium.length,
                hard: this.questionPools.hard.length
            };
            
            const needsReplenishment = {
                easy: currentCounts.easy < this.questionPoolMinimums.easy,
                medium: currentCounts.medium < this.questionPoolMinimums.medium,
                hard: currentCounts.hard < this.questionPoolMinimums.hard
            };
            
            if (needsReplenishment.easy || needsReplenishment.medium || needsReplenishment.hard) {
                console.log('🔄 Pool replenishment needed:');
                console.log(`   Easy: ${currentCounts.easy}/${this.questionPoolTargets.easy} ${needsReplenishment.easy ? '⚠️' : '✅'}`);
                console.log(`   Medium: ${currentCounts.medium}/${this.questionPoolTargets.medium} ${needsReplenishment.medium ? '⚠️' : '✅'}`);
                console.log(`   Hard: ${currentCounts.hard}/${this.questionPoolTargets.hard} ${needsReplenishment.hard ? '⚠️' : '✅'}`);
                
                this.generateAllPoolsAsync();
            }
        } catch (error) {
            console.error('❌ Error checking pools:', error);
        }
    }

    // Generate all pools asynchronously
    async generateAllPoolsAsync() {
        if (this.isGeneratingPools) {
            console.log('⏳ Pool generation already in progress, skipping...');
            return;
        }
        
        this.isGeneratingPools = true;
        console.log('🏭 Starting pool generation...');
        
        try {
            // Generate questions for each difficulty
            await this.generatePoolQuestions('easy');
            await this.generatePoolQuestions('medium');
            await this.generatePoolQuestions('hard');
            
            // Save updated pools
            await this.savePoolsToRedis();
            
            console.log('✅ Pool generation completed');
        } catch (error) {
            console.error('❌ Error in pool generation:', error);
        } finally {
            this.isGeneratingPools = false;
        }
    }

    // Generate questions for specific difficulty pool
    async generatePoolQuestions(difficulty) {
        const currentCount = this.questionPools[difficulty].length;
        const target = this.questionPoolTargets[difficulty];
        const needed = Math.max(0, target - currentCount);
        
        if (needed === 0) {
            console.log(`✅ ${difficulty} pool is full (${currentCount}/${target})`);
            return;
        }
        
        console.log(`🔄 Generating ${needed} ${difficulty} questions...`);
        
        // Get APIs for this difficulty
        const difficultyAPIs = this.apiEndpoints.filter(api => api.difficulty === difficulty);
        
        const newQuestions = [];
        const existingQuestions = new Set(
            this.questionPools[difficulty].map(q => q.question.toLowerCase().trim())
        );
        
        // Try each API
        for (const apiConfig of difficultyAPIs) {
            if (newQuestions.length >= needed) break;
            
            try {
                console.log(`📡 Fetching from ${apiConfig.name}...`);
                const questions = await this.fetchFromSingleAPIWithRetry(apiConfig, existingQuestions, 1);
                
                for (const question of questions) {
                    const questionKey = question.question.toLowerCase().trim();
                    
                    if (!existingQuestions.has(questionKey) && newQuestions.length < needed) {
                        newQuestions.push(question);
                        existingQuestions.add(questionKey);
                    }
                }
                
                console.log(`✅ ${apiConfig.name}: Added ${questions.length} questions to ${difficulty} pool`);
                
            } catch (error) {
                console.warn(`⚠️ ${apiConfig.name} failed: ${error.message}`);
            }
        }
        
        // Add new questions to pool
        if (newQuestions.length > 0) {
            this.questionPools[difficulty].push(...newQuestions);
            this.shuffleArray(this.questionPools[difficulty]);
            console.log(`📈 ${difficulty} pool: ${currentCount} → ${this.questionPools[difficulty].length} (+${newQuestions.length})`);
        } else {
            console.log(`⚠️ No new ${difficulty} questions obtained from APIs`);
        }
    }

    // Main method to load questions (now instant!)
    async loadQuestions(avoidQuestions = new Set(), targetCount = 13) {
        try {
            console.log(`⚡ Loading ${targetCount} questions instantly from pools...`);
            
            // Ensure pools are loaded
            if (this.questionPools.easy.length === 0 && this.questionPools.medium.length === 0 && this.questionPools.hard.length === 0) {
                const loaded = await this.loadPoolsFromRedis();
                if (!loaded) {
                    console.warn('⚠️ No pools found in Redis, initializing fallbacks...');
                    this.loadFallbackIntoPools();
                    if (this.redis?.connected) {
                        await this.savePoolsToRedis();
                    }
                }
            }
            
            // Get questions from pools instantly
            const questions = this.getQuestionsFromPools(avoidQuestions, targetCount);
            
            console.log(`✅ Instantly loaded ${questions.length} questions!`);
            this.logDifficultyStats(questions);
            
            // Trigger background replenishment if pools are getting low
            setTimeout(() => this.checkAndReplenishPools(), 1000);
            
            return questions;
            
        } catch (error) {
            console.error('❌ Error loading questions from pools:', error);
            return this.getEmergencyFallbackQuestions(targetCount);
        }
    }

    // Get questions from pools with proper distribution
    getQuestionsFromPools(avoidQuestions, targetCount) {
        const questions = [];
        const usedQuestions = new Set();
        
        // Calculate distribution (2 easy, 4 medium, 4 hard, rest mixed)
        const distribution = {
            easy: Math.min(2, targetCount),
            medium: Math.min(4, Math.max(0, targetCount - 2)),
            hard: Math.min(4, Math.max(0, targetCount - 6)),
            extra: Math.max(0, targetCount - 10)
        };
        
        // Add easy questions
        this.addQuestionsFromPool(
            questions, 
            this.questionPools.easy.filter(q => 
                !avoidQuestions.has(q.question.toLowerCase().trim()) && 
                !usedQuestions.has(q.question.toLowerCase().trim())
            ), 
            usedQuestions, 
            distribution.easy, 
            'Easy'
        );
        
        // Add medium questions
        this.addQuestionsFromPool(
            questions, 
            this.questionPools.medium.filter(q => 
                !avoidQuestions.has(q.question.toLowerCase().trim()) && 
                !usedQuestions.has(q.question.toLowerCase().trim())
            ), 
            usedQuestions, 
            distribution.medium, 
            'Medium'
        );
        
        // Add hard questions
        this.addQuestionsFromPool(
            questions, 
            this.questionPools.hard.filter(q => 
                !avoidQuestions.has(q.question.toLowerCase().trim()) && 
                !usedQuestions.has(q.question.toLowerCase().trim())
            ), 
            usedQuestions, 
            distribution.hard, 
            'Hard'
        );
        
        // Add extra questions from any pool
        if (distribution.extra > 0) {
            const allAvailable = [
                ...this.questionPools.easy,
                ...this.questionPools.medium,
                ...this.questionPools.hard
            ].filter(q => 
                !avoidQuestions.has(q.question.toLowerCase().trim()) && 
                !usedQuestions.has(q.question.toLowerCase().trim())
            );
            
            this.shuffleArray(allAvailable);
            this.addQuestionsFromPool(questions, allAvailable, usedQuestions, distribution.extra, 'Extra');
        }
        
        return questions;
    }

    // Add questions from a specific pool
    addQuestionsFromPool(questionsList, pool, usedQuestions, needed, difficultyLabel) {
        let added = 0;
        
        for (const question of pool) {
            if (added >= needed) break;
            
            const questionKey = question.question.toLowerCase().trim();
            
            if (!usedQuestions.has(questionKey)) {
                questionsList.push(question);
                usedQuestions.add(questionKey);
                added++;
            }
        }
        
        if (added < needed) {
            console.warn(`⚠️ Could only add ${added}/${needed} ${difficultyLabel} questions from pool`);
        }
        
        return added;
    }

    // Preload questions for instant quiz start
    async preloadQuestions(userId, guildId) {
        try {
            const userKey = `${userId}_${guildId}`;
            
            // Check if already preloaded
            if (this.preloadedQuestions.has(userKey)) {
                const cached = this.preloadedQuestions.get(userKey);
                // Check if cache is still valid (less than 5 minutes old)
                if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
                    console.log(`📋 Using preloaded questions for user ${userId}`);
                    return cached.questions;
                }
            }
            
            // Check Redis cache
            if (this.redis?.connected) {
                const cachedQuestions = await this.redis.getCachedQuestions(userId, guildId);
                if (cachedQuestions && cachedQuestions.length >= 13) {
                    console.log(`📡 Using Redis cached questions for user ${userId}`);
                    // Cache in memory for faster access
                    this.preloadedQuestions.set(userKey, {
                        questions: cachedQuestions,
                        timestamp: Date.now()
                    });
                    return cachedQuestions;
                }
            }

            // Get recent questions to avoid
            const recentQuestions = await this.getRecentQuestions(userId, guildId);
            
            // Load 13 questions (10 + 3 for rerolls)
            const questions = await this.loadQuestions(recentQuestions, 13);
            
            if (questions.length >= 10) {
                // Cache in Redis
                if (this.redis?.connected) {
                    await this.redis.cacheQuestions(userId, guildId, questions, 15 * 60); // 15 minutes cache
                }
                
                // Cache in memory
                this.preloadedQuestions.set(userKey, {
                    questions: questions,
                    timestamp: Date.now()
                });
                
                // Save question hashes to history (async)
                this.saveQuestionsToHistory(userId, guildId, questions).catch(console.error);
                
                return questions;
            }

            return [];
            
        } catch (error) {
            console.error('Error preloading questions:', error);
            return [];
        }
    }

    // Save questions to history asynchronously
    async saveQuestionsToHistory(userId, guildId, questions) {
        for (const question of questions) {
            try {
                const questionHash = this.createQuestionHash(question.question);
                await this.saveQuestionToHistory(userId, guildId, questionHash, question.question);
            } catch (error) {
                console.error('Error saving question to history:', error);
            }
        }
    }

    async getRecentQuestions(userId, guildId) {
        try {
            const recentSet = new Set();
            
            // Get from Redis (faster)
            if (this.redis?.connected) {
                const redisRecent = await this.redis.getRecentQuestions(userId, guildId);
                redisRecent.forEach(hash => recentSet.add(hash));
            }
            
            return recentSet;
            
        } catch (error) {
            console.error('Error getting recent questions:', error);
            return new Set();
        }
    }

    async saveQuestionToHistory(userId, guildId, questionHash, questionText) {
        try {
            // Save to Redis (async, don't wait)
            if (this.redis?.connected) {
                this.redis.addRecentQuestion(userId, guildId, questionHash).catch(console.error);
            }
            
        } catch (error) {
            console.error('Error saving question to history:', error);
        }
    }

    createQuestionHash(questionText) {
        let hash = 0;
        const cleanText = questionText.toLowerCase().trim().replace(/[^\w\s]/g, '');
        
        for (let i = 0; i < cleanText.length; i++) {
            const char = cleanText.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return Math.abs(hash).toString(16);
    }

    // Start global request queue processor
    startQueueProcessor() {
        setInterval(async () => {
            if (this.requestQueue.length > 0 && !this.isProcessingQueue) {
                this.isProcessingQueue = true;
                
                const { resolve, reject, apiConfig, avoidQuestions, attemptNumber } = this.requestQueue.shift();
                
                try {
                    // Ensure global delay between requests
                    const now = Date.now();
                    const timeSinceLastRequest = now - this.globalLastRequest;
                    
                    if (timeSinceLastRequest < this.globalMinDelay) {
                        const waitTime = this.globalMinDelay - timeSinceLastRequest;
                        console.log(`⏳ Global rate limiting: waiting ${waitTime}ms`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                    
                    const questions = await this.fetchFromSingleAPIDirectly(apiConfig, avoidQuestions, attemptNumber);
                    this.globalLastRequest = Date.now();
                    resolve(questions);
                    
                } catch (error) {
                    reject(error);
                } finally {
                    this.isProcessingQueue = false;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }, 500);
    }

    // Queue API requests to avoid rate limits
    async fetchFromSingleAPIWithRetry(apiConfig, avoidQuestions, attemptNumber) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                resolve,
                reject,
                apiConfig,
                avoidQuestions,
                attemptNumber
            });
            
            console.log(`📋 Queued ${apiConfig.name} (position: ${this.requestQueue.length})`);
        });
    }

    // Direct API execution with retries
    async fetchFromSingleAPIDirectly(apiConfig, avoidQuestions, attemptNumber) {
        let lastError;
        
        for (let retry = 0; retry < apiConfig.maxRetries; retry++) {
            try {
                const questions = await this.fetchFromSingleAPI(apiConfig.url, avoidQuestions, attemptNumber, apiConfig.name);
                return questions;
                
            } catch (error) {
                lastError = error;
                
                if (error.message.includes('429') || error.message.includes('rate')) {
                    const backoffDelay = Math.min(apiConfig.delay * Math.pow(3, retry), 20000);
                    console.warn(`⚠️ Rate limited on ${apiConfig.name}, retry ${retry + 1}/${apiConfig.maxRetries}, waiting ${backoffDelay}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503') || error.message.includes('timeout')) {
                    const backoffDelay = Math.min(apiConfig.delay * (retry + 3), 15000);
                    console.warn(`⚠️ Server error on ${apiConfig.name}, retry ${retry + 1}/${apiConfig.maxRetries}, waiting ${backoffDelay}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                } else {
                    console.warn(`⚠️ ${apiConfig.name} error (no retry): ${error.message}`);
                    break;
                }
            }
        }
        
        throw lastError || new Error(`Failed after ${apiConfig.maxRetries} retries`);
    }

    // Fetch from single API
    async fetchFromSingleAPI(apiUrl, avoidQuestions, apiNumber, apiName = null) {
        try {
            const displayName = apiName || this.getAPIName(apiUrl);
            
            const controller = new AbortController();
            const timeoutMs = 20000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AnimeQuizBot/2.0)',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Accept-Encoding': 'gzip, deflate'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(`429 Rate Limited`);
                } else if (response.status >= 500) {
                    throw new Error(`${response.status} Server Error`);
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            }
            
            const data = await response.json();
            const questions = this.parseAPIResponse(data, apiUrl, apiNumber);
            
            if (!questions || questions.length === 0) {
                console.log(`⚠️ ${displayName}: API returned no questions`);
                return [];
            }
