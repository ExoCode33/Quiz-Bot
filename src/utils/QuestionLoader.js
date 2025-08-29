const { FALLBACK_QUESTIONS, ANIME_KEYWORDS, BAD_KEYWORDS, ANIME_TITLES } = require('./constants');

class QuestionLoader {
    constructor() {
        // Question pool targets
        this.questionPoolTargets = {
            easy: 25,
            medium: 50,
            hard: 50
        };
        
        // Minimum thresholds to trigger regeneration
        this.questionPoolMinimums = {
            easy: 10,
            medium: 20,
            hard: 20
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
        
        // Redis manager reference (will be set externally)
        this.redis = null;
        
        // Session stats
        this.sessionStats = {
            totalCalls: 0,
            successfulCalls: 0,
            totalQuestions: 0,
            validQuestions: 0
        };
        
        // Start systems
        this.startQueueProcessor();
        this.startPoolMonitoring();
        
        console.log('🏊 Question Pool System initialized');
        console.log(`📊 Targets: Easy: ${this.questionPoolTargets.easy}, Medium: ${this.questionPoolTargets.medium}, Hard: ${this.questionPoolTargets.hard}`);
    }

    // Set Redis manager reference
    setRedisManager(redisManager) {
        this.redis = redisManager;
    }

    // Initialize question pools on bot startup
    async initializeQuestionPools() {
        try {
            console.log('🚀 Initializing question pools...');
            
            // Clear any existing pools in Redis on restart
            if (this.redis?.connected) {
                await this.redis.client.del(this.redis.key('question_pool:easy'));
                await this.redis.client.del(this.redis.key('question_pool:medium'));
                await this.redis.client.del(this.redis.key('question_pool:hard'));
                console.log('🧹 Cleared existing question pools from Redis');
            }
            
            // Load fallback questions into pools immediately
            this.loadFallbackIntoPools();
            
            // Save initial pools to Redis
            await this.savePoolsToRedis();
            
            // Start generating API questions in background
            this.generateAllPoolsAsync();
            
            console.log('✅ Question pools initialized with fallbacks');
            console.log('🏭 Starting background API generation...');
            
        } catch (error) {
            console.error('❌ Error initializing question pools:', error);
        }
    }

    // Load fallback questions into pools
    loadFallbackIntoPools() {
        // Add all fallback questions to pools
        this.questionPools.easy = [...FALLBACK_QUESTIONS.Easy];
        this.questionPools.medium = [...FALLBACK_QUESTIONS.Medium];
        this.questionPools.hard = [...FALLBACK_QUESTIONS.Hard];
        
        // Shuffle pools
        this.shuffleArray(this.questionPools.easy);
        this.shuffleArray(this.questionPools.medium);
        this.shuffleArray(this.questionPools.hard);
        
        console.log(`📚 Loaded fallbacks: Easy: ${this.questionPools.easy.length}, Medium: ${this.questionPools.medium.length}, Hard: ${this.questionPools.hard.length}`);
    }

    // Save pools to Redis
    async savePoolsToRedis() {
        if (!this.redis?.connected) return;
        
        try {
            await Promise.all([
                this.redis.client.setEx(
                    this.redis.key('question_pool:easy'),
                    24 * 60 * 60, // 24 hours
                    JSON.stringify(this.questionPools.easy)
                ),
                this.redis.client.setEx(
                    this.redis.key('question_pool:medium'),
                    24 * 60 * 60,
                    JSON.stringify(this.questionPools.medium)
                ),
                this.redis.client.setEx(
                    this.redis.key('question_pool:hard'),
                    24 * 60 * 60,
                    JSON.stringify(this.questionPools.hard)
                )
            ]);
            
            console.log('💾 Saved question pools to Redis');
        } catch (error) {
            console.error('❌ Error saving pools to Redis:', error);
        }
    }

    // Load pools from Redis
    async loadPoolsFromRedis() {
        if (!this.redis?.connected) return false;
        
        try {
            const [easyData, mediumData, hardData] = await Promise.all([
                this.redis.client.get(this.redis.key('question_pool:easy')),
                this.redis.client.get(this.redis.key('question_pool:medium')),
                this.redis.client.get(this.redis.key('question_pool:hard'))
            ]);
            
            if (easyData) this.questionPools.easy = JSON.parse(easyData);
            if (mediumData) this.questionPools.medium = JSON.parse(mediumData);
            if (hardData) this.questionPools.hard = JSON.parse(hardData);
            
            console.log(`📥 Loaded pools from Redis: Easy: ${this.questionPools.easy.length}, Medium: ${this.questionPools.medium.length}, Hard: ${this.questionPools.hard.length}`);
            return true;
        } catch (error) {
            console.error('❌ Error loading pools from Redis:', error);
            return false;
        }
    }

    // Start pool monitoring
    startPoolMonitoring() {
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
            
            // Load pools from Redis if empty
            if (this.questionPools.easy.length === 0 && this.questionPools.medium.length === 0 && this.questionPools.hard.length === 0) {
                const loaded = await this.loadPoolsFromRedis();
                if (!loaded) {
                    console.warn('⚠️ No pools found in Redis, initializing fallbacks...');
                    this.loadFallbackIntoPools();
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
            
            const validQuestions = questions.filter(q => this.isValidQuestion(q, avoidQuestions));
            
            console.log(`📊 ${displayName}: ${validQuestions.length}/${questions.length} questions passed validation`);
            return validQuestions;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    // Parse API responses
    parseAPIResponse(data, apiUrl, apiNumber) {
        const questions = [];
        
        try {
            if (apiUrl.includes('opentdb.com')) {
                if (data.response_code !== 0) {
                    console.warn(`⚠️ OpenTDB API returned code ${data.response_code}`);
                    return [];
                }
                
                if (data.results && Array.isArray(data.results)) {
                    for (const item of data.results) {
                        if (!item.question || !item.correct_answer) continue;
                        
                        const question = {
                            question: this.cleanText(item.question),
                            answer: this.cleanText(item.correct_answer),
                            options: [...item.incorrect_answers.map(opt => this.cleanText(opt)), this.cleanText(item.correct_answer)],
                            difficulty: item.difficulty || 'Medium',
                            source: 'OpenTDB'
                        };
                        
                        if (question.question.length > 0 && question.answer.length > 0 && question.options.length >= 4) {
                            this.shuffleArray(question.options);
                            questions.push(question);
                        }
                    }
                }
            } else if (apiUrl.includes('trivia-api.com')) {
                if (Array.isArray(data)) {
                    for (const item of data) {
                        if (!item.question?.text || !item.correctAnswer) continue;
                        
                        const question = {
                            question: this.cleanText(item.question.text),
                            answer: this.cleanText(item.correctAnswer),
                            options: [...item.incorrectAnswers.map(opt => this.cleanText(opt)), this.cleanText(item.correctAnswer)],
                            difficulty: item.difficulty || 'medium',
                            source: 'TriviaAPI'
                        };
                        
                        if (question.question.length > 0 && question.answer.length > 0 && question.options.length >= 4) {
                            this.shuffleArray(question.options);
                            questions.push(question);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error(`❌ Error parsing API response:`, error);
        }
        
        return questions;
    }

    // Enhanced question validation
    isValidQuestion(question, avoidQuestions) {
        try {
            if (!question.question || !question.answer || !question.options) return false;
            if (question.options.length < 2) return false;
            if (!question.options.includes(question.answer)) return false;
            
            const questionLower = question.question.toLowerCase();
            const questionKey = questionLower.trim();
            
            if (avoidQuestions.has && avoidQuestions.has(questionKey)) return false;
            if (question.question.length > 300) return false;
            if (question.options.some(opt => opt.length > 120)) return false;
            if (questionLower.includes('�') || questionLower.includes('&amp;')) return false;
            
            // Strong anime indicators
            const strongIndicators = [
                'anime', 'manga', 'otaku', 'japanese animation',
                'devil fruit', 'chakra', 'jutsu', 'quirk', 'stand', 'titan',
                'soul reaper', 'hollow', 'bankai', 'shikai', 'zanpakuto',
                'hokage', 'shinobi', 'ninja village', 'pirate king',
                'tsundere', 'yandere', 'senpai', 'kouhai', 'sensei',
                'dragon ball', 'one piece', 'naruto', 'bleach', 'attack on titan',
                'my hero academia', 'death note', 'fullmetal alchemist',
                'studio ghibli', 'miyazaki', 'mecha', 'gundam'
            ];
            
            const hasStrongIndicators = strongIndicators.some(indicator => 
                questionLower.includes(indicator.toLowerCase())
            );
            
            const hasAnimeTitles = ANIME_TITLES.some(title => 
                questionLower.includes(title.toLowerCase())
            );
            
            const hasAnimePattern = [
                'which.*anime', 'in.*anime', 'anime.*series', 'manga.*series',
                'which.*character', 'protagonist.*of', 'main.*character'
            ].some(pattern => new RegExp(pattern, 'i').test(questionLower));
            
            const answersHaveAnime = question.options.some(option => {
                const optionLower = option.toLowerCase();
                return ANIME_TITLES.some(title => optionLower.includes(title.toLowerCase())) ||
                       ['luffy', 'naruto', 'goku', 'ichigo', 'natsu', 'edward', 'light yagami', 'monkey d', 'uchiha', 'uzumaki'].some(name => optionLower.includes(name));
            });
            
            // Reject non-anime content
            const nonAnimeContent = [
                'call of duty', 'minecraft', 'fortnite', 'overwatch',
                'xbox', 'playstation', 'pc game', 'hollywood', 'netflix', 'disney'
            ].some(keyword => questionLower.includes(keyword.toLowerCase()));
            
            if (nonAnimeContent) return false;
            
            const numberCount = (question.question.match(/\d+/g) || []).length;
            if (numberCount > 3) return false;
            
            return hasStrongIndicators || hasAnimeTitles || hasAnimePattern || answersHaveAnime;
            
        } catch (error) {
            console.error('❌ Error validating question:', error);
            return false;
        }
    }

    // Emergency fallback questions
    getEmergencyFallbackQuestions(targetCount = 13) {
        console.log('🚨 Using emergency fallback questions...');
        
        const emergency = [
            { question: "Who is the main protagonist of One Piece?", options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"], answer: "Monkey D. Luffy", difficulty: "Easy" },
            { question: "What is Naruto's favorite food?", options: ["Ramen", "Sushi", "Rice balls", "Tempura"], answer: "Ramen", difficulty: "Easy" },
            { question: "In Dragon Ball, how many Dragon Balls are there?", options: ["7", "5", "9", "12"], answer: "7", difficulty: "Easy" },
            { question: "What is the name of Light's notebook in Death Note?", options: ["Death Note", "Kill Book", "Murder Diary", "Dark Journal"], answer: "Death Note", difficulty: "Medium" },
            { question: "In Attack on Titan, what are the giant creatures called?", options: ["Titans", "Giants", "Colossi", "Monsters"], answer: "Titans", difficulty: "Medium" },
            { question: "What is Luffy's Devil Fruit power?", options: ["Rubber abilities", "Fire powers", "Ice powers", "Lightning"], answer: "Rubber abilities", difficulty: "Medium" },
            { question: "In Fullmetal Alchemist, what is the first law of equivalent exchange?", options: ["To obtain something, something of equal value must be lost", "Energy cannot be destroyed", "Matter cannot be created", "All is one"], answer: "To obtain something, something of equal value must be lost", difficulty: "Hard" },
            { question: "What is the name of Ichigo's sword in Bleach?", options: ["Zangetsu", "Senbonzakura", "Hyorinmaru", "Zabimaru"], answer: "Zangetsu", difficulty: "Hard" },
            { question: "In One Piece, what is Nico Robin's Devil Fruit called?", options: ["Hana Hana no Mi", "Gomu Gomu no Mi", "Mera Mera no Mi", "Yami Yami no Mi"], answer: "Hana Hana no Mi", difficulty: "Hard" },
            { question: "What village is Naruto from?", options: ["Hidden Leaf Village", "Hidden Sand Village", "Hidden Mist Village", "Hidden Cloud Village"], answer: "Hidden Leaf Village", difficulty: "Easy" },
            { question: "In My Hero Academia, what is Deku's real name?", options: ["Izuku Midoriya", "Katsuki Bakugo", "Shoto Todoroki", "Tenya Iida"], answer: "Izuku Midoriya", difficulty: "Medium" },
            { question: "What type of Pokemon is Pikachu?", options: ["Electric", "Fire", "Water", "Grass"], answer: "Electric", difficulty: "Easy" },
            { question: "In JoJo's Bizarre Adventure, what are Stands?", options: ["Supernatural abilities", "Weapons", "Locations", "Organizations"], answer: "Supernatural abilities", difficulty: "Hard" }
        ];

        this.shuffleArray(emergency);
        
        while (emergency.length < targetCount) {
            const additional = [...emergency];
            this.shuffleArray(additional);
            emergency.push(...additional.slice(0, targetCount - emergency.length));
        }

        console.log(`🛡️ Emergency fallback provided ${Math.min(targetCount, emergency.length)} questions`);
        return emergency.slice(0, targetCount);
    }

    // Utility methods
    cleanText(text) {
        if (!text) return '';
        
        return text
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ')
            .replace(/&#x([0-9A-Fa-f]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
            .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)))
            .replace(/&apos;/g, "'")
            .replace(/&ldquo;/g, '"')
            .replace(/&rdquo;/g, '"')
            .replace(/&lsquo;/g, "'")
            .replace(/&rsquo;/g, "'")
            .replace(/&hellip;/g, '...')
            .replace(/&mdash;/g, '—')
            .replace(/&ndash;/g, '–')
            .trim();
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    getAPIName(url) {
        if (url.includes('opentdb.com')) {
            if (url.includes('difficulty=hard')) return 'OpenTDB-Hard';
            if (url.includes('difficulty=medium')) return 'OpenTDB-Medium';
            if (url.includes('difficulty=easy')) return 'OpenTDB-Easy';
            return 'OpenTDB';
        }
        if (url.includes('trivia-api.com')) {
            if (url.includes('difficulty=hard')) return 'TriviaAPI-Hard';
            if (url.includes('difficulty=medium')) return 'TriviaAPI-Medium';
            if (url.includes('difficulty=easy')) return 'TriviaAPI-Easy';
            return 'TriviaAPI';
        }
        return 'Unknown';
    }

    logDifficultyStats(questions) {
        console.log('\n🎯 Quiz Question Distribution:');
        
        questions.forEach((question, index) => {
            const questionNum = (index + 1).toString().padStart(2, '0');
            const difficulty = (question.difficulty || 'Medium').padEnd(6);
            const source = (question.source || 'Pool').padEnd(8);
            
            let expectedDifficulty = 'Mixed';
            if (index < 2) expectedDifficulty = 'Easy';
            else if (index < 6) expectedDifficulty = 'Medium';
            else if (index < 10) expectedDifficulty = 'Hard';
            
            const status = expectedDifficulty === 'Mixed' ? '🔄' : 
                         (question.difficulty || 'Medium').toLowerCase() === expectedDifficulty.toLowerCase() ? '✅' : '⚠️';
            
            console.log(`Q${questionNum}: ${status} ${difficulty} | ${source} | ${question.question.substring(0, 50)}...`);
        });
        
        console.log('');
    }

    // Pool status methods
    getPoolStatus() {
        return {
            easy: {
                current: this.questionPools.easy.length,
                target: this.questionPoolTargets.easy,
                minimum: this.questionPoolMinimums.easy,
                status: this.questionPools.easy.length >= this.questionPoolMinimums.easy ? 'healthy' : 'low'
            },
            medium: {
                current: this.questionPools.medium.length,
                target: this.questionPoolTargets.medium,
                minimum: this.questionPoolMinimums.medium,
                status: this.questionPools.medium.length >= this.questionPoolMinimums.medium ? 'healthy' : 'low'
            },
            hard: {
                current: this.questionPools.hard.length,
                target: this.questionPoolTargets.hard,
                minimum: this.questionPoolMinimums.hard,
                status: this.questionPools.hard.length >= this.questionPoolMinimums.hard ? 'healthy' : 'low'
            },
            isGenerating: this.isGeneratingPools,
            queueLength: this.requestQueue.length
        };
    }

    logPoolStatus() {
        const status = this.getPoolStatus();
        console.log('\n🏊 Question Pool Status:');
        console.log(`Easy:   ${status.easy.current}/${status.easy.target} ${status.easy.status === 'healthy' ? '✅' : '⚠️'}`);
        console.log(`Medium: ${status.medium.current}/${status.medium.target} ${status.medium.status === 'healthy' ? '✅' : '⚠️'}`);
        console.log(`Hard:   ${status.hard.current}/${status.hard.target} ${status.hard.status === 'healthy' ? '✅' : '⚠️'}`);
        console.log(`Queue:  ${status.queueLength} requests pending`);
        console.log(`Status: ${status.isGenerating ? 'Generating 🏭' : 'Ready ⚡'}\n`);
    }

    // Health check for APIs
    async checkAPIHealth() {
        console.log('🔍 Checking API health...');
        
        const healthResults = {};
        
        for (const apiConfig of this.apiEndpoints) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch(apiConfig.url, {
                    method: 'HEAD',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                healthResults[apiConfig.name] = {
                    status: response.ok ? 'healthy' : 'unhealthy',
                    statusCode: response.status,
                    difficulty: apiConfig.difficulty
                };
                
                console.log(`${response.ok ? '✅' : '❌'} ${apiConfig.name}: ${response.status}`);
                
            } catch (error) {
                healthResults[apiConfig.name] = {
                    status: 'error',
                    error: error.message,
                    difficulty: apiConfig.difficulty
                };
                
                console.log(`❌ ${apiConfig.name}: ${error.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        return healthResults;
    }

    // Force regenerate specific pool
    async forceRegeneratePool(difficulty) {
        if (!['easy', 'medium', 'hard'].includes(difficulty)) {
            throw new Error('Invalid difficulty. Use: easy, medium, hard');
        }
        
        console.log(`🔄 Force regenerating ${difficulty} pool...`);
        
        // Clear current pool
        this.questionPools[difficulty] = [];
        
        // Add fallbacks for this difficulty
        if (difficulty === 'easy') {
            this.questionPools.easy = [...FALLBACK_QUESTIONS.Easy];
        } else if (difficulty === 'medium') {
            this.questionPools.medium = [...FALLBACK_QUESTIONS.Medium];
        } else if (difficulty === 'hard') {
            this.questionPools.hard = [...FALLBACK_QUESTIONS.Hard];
        }
        
        // Generate new questions
        await this.generatePoolQuestions(difficulty);
        
        // Save to Redis
        await this.savePoolsToRedis();
        
        console.log(`✅ ${difficulty} pool regenerated: ${this.questionPools[difficulty].length} questions`);
    }

    // Cleanup method
    cleanup() {
        if (this.poolGenerationInterval) {
            clearInterval(this.poolGenerationInterval);
            this.poolGenerationInterval = null;
            console.log('🧹 Pool monitoring stopped');
        }
        
        // Clear request queue
        this.requestQueue = [];
        this.isProcessingQueue = false;
        
        console.log('🧹 QuestionLoader cleanup completed');
    }

    // Get statistics
    getStatistics() {
        const poolStatus = this.getPoolStatus();
        const totalQuestions = poolStatus.easy.current + poolStatus.medium.current + poolStatus.hard.current;
        const totalTarget = poolStatus.easy.target + poolStatus.medium.target + poolStatus.hard.target;
        
        return {
            pools: poolStatus,
            totals: {
                current: totalQuestions,
                target: totalTarget,
                percentage: Math.round((totalQuestions / totalTarget) * 100)
            },
            system: {
                isGenerating: this.isGeneratingPools,
                queueLength: this.requestQueue.length,
                redisConnected: this.redis?.connected || false
            }
        };
    }

    // Get fallback questions with proper distribution
    getFallbackQuestions(avoidQuestions, usedQuestions, targetCount = 13) {
        const easyQuestions = [...FALLBACK_QUESTIONS.Easy];
        const mediumQuestions = [...FALLBACK_QUESTIONS.Medium];
        const hardQuestions = [...FALLBACK_QUESTIONS.Hard];
        
        this.shuffleArray(easyQuestions);
        this.shuffleArray(mediumQuestions);
        this.shuffleArray(hardQuestions);
        
        const easyCount = Math.min(6, Math.ceil(targetCount * 0.3));
        const mediumCount = Math.min(6, Math.ceil(targetCount * 0.4));
        const hardCount = targetCount - easyCount - mediumCount;
        
        const balancedQuestions = [
            ...easyQuestions.slice(0, easyCount),
            ...mediumQuestions.slice(0, mediumCount),
            ...hardQuestions.slice(0, Math.max(hardCount, 0))
        ];
        
        const availableFallbacks = balancedQuestions.filter(question => {
            const questionKey = question.question.toLowerCase().trim();
            return !avoidQuestions.has(questionKey) && !usedQuestions.has(questionKey);
        });
        
        if (availableFallbacks.length < targetCount) {
            const allFallbacks = [...easyQuestions, ...mediumQuestions, ...hardQuestions];
            this.shuffleArray(allFallbacks);
            
            for (const question of allFallbacks) {
                if (availableFallbacks.length >= targetCount) break;
                
                const questionKey = question.question.toLowerCase().trim();
                const isAlreadyIncluded = availableFallbacks.some(q => 
                    q.question.toLowerCase().trim() === questionKey
                );
                
                if (!isAlreadyIncluded) {
                    availableFallbacks.push(question);
                }
            }
        }
        
        this.shuffleArray(availableFallbacks);
        return availableFallbacks.slice(0, targetCount);
    }

    // Build fallback questions with progression
    buildFallbackQuestionsWithProgression(avoidQuestions, targetCount) {
        console.log('🛡️ Building fallback questions with difficulty progression...');
        
        const fallbacks = this.getFallbackQuestionsByDifficulty(avoidQuestions, new Set());
        const quizQuestions = [];
        const usedQuestions = new Set();
        
        this.addQuestionsFromPool(quizQuestions, fallbacks.easy, usedQuestions, 2, 'Easy (Fallback)');
        this.addQuestionsFromPool(quizQuestions, fallbacks.medium, usedQuestions, 4, 'Medium (Fallback)');
        this.addQuestionsFromPool(quizQuestions, fallbacks.hard, usedQuestions, 4, 'Hard (Fallback)');
        
        const allRemaining = [
            ...fallbacks.easy.filter(q => !usedQuestions.has(q.question.toLowerCase().trim())),
            ...fallbacks.medium.filter(q => !usedQuestions.has(q.question.toLowerCase().trim())),
            ...fallbacks.hard.filter(q => !usedQuestions.has(q.question.toLowerCase().trim()))
        ];
        this.shuffleArray(allRemaining);
        this.addQuestionsFromPool(quizQuestions, allRemaining, usedQuestions, targetCount - quizQuestions.length, 'Extra (Fallback)');
        
        return quizQuestions;
    }

    // Get fallback questions by difficulty
    getFallbackQuestionsByDifficulty(avoidQuestions, usedQuestions) {
        const fallbacks = {
            easy: [...FALLBACK_QUESTIONS.Easy],
            medium: [...FALLBACK_QUESTIONS.Medium],
            hard: [...FALLBACK_QUESTIONS.Hard]
        };
        
        Object.keys(fallbacks).forEach(difficulty => {
            fallbacks[difficulty] = fallbacks[difficulty].filter(question => {
                const questionKey = question.question.toLowerCase().trim();
                return !avoidQuestions.has(questionKey) && !usedQuestions.has(questionKey);
            });
            
            this.shuffleArray(fallbacks[difficulty]);
        });
        
        console.log(`📚 Fallback Questions: Easy: ${fallbacks.easy.length}, Medium: ${fallbacks.medium.length}, Hard: ${fallbacks.hard.length}`);
        
        return fallbacks;
    }

    // Log simple session stats
    logSimpleStats() {
        const successRate = this.sessionStats.totalCalls > 0 ? 
            ((this.sessionStats.successfulCalls / this.sessionStats.totalCalls) * 100).toFixed(1) : '0.0';
        const validationRate = this.sessionStats.totalQuestions > 0 ? 
            ((this.sessionStats.validQuestions / this.sessionStats.totalQuestions) * 100).toFixed(1) : '0.0';

        console.log(`📊 Session Summary: ${this.sessionStats.successfulCalls}/${this.sessionStats.totalCalls} API calls successful (${successRate}%)`);
        console.log(`📚 Question Quality: ${this.sessionStats.validQuestions}/${this.sessionStats.totalQuestions} questions valid (${validationRate}%)`);
    }
}

module.exports = QuestionLoader;
