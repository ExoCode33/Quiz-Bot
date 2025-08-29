const { FALLBACK_QUESTIONS, ANIME_KEYWORDS, BAD_KEYWORDS, ANIME_TITLES } = require('./constants');

class QuestionLoader {
    constructor() {
        // Optimized API endpoints with better error handling
        this.apiEndpoints = [
            {
                url: 'https://opentdb.com/api.php?amount=5&category=31&type=multiple&difficulty=easy',
                name: 'OpenTDB-Easy',
                priority: 1,
                maxRetries: 3,
                delay: 1000,
                timeout: 12000
            },
            {
                url: 'https://opentdb.com/api.php?amount=5&category=31&type=multiple&difficulty=medium',
                name: 'OpenTDB-Medium', 
                priority: 1,
                maxRetries: 3,
                delay: 1200,
                timeout: 12000
            },
            {
                url: 'https://opentdb.com/api.php?amount=5&category=31&type=multiple&difficulty=hard',
                name: 'OpenTDB-Hard',
                priority: 1,
                maxRetries: 3,
                delay: 1400,
                timeout: 12000
            },
            {
                url: 'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=8&difficulty=easy',
                name: 'TriviaAPI-Easy',
                priority: 2,
                maxRetries: 2,
                delay: 800,
                timeout: 10000
            },
            {
                url: 'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=8&difficulty=medium',
                name: 'TriviaAPI-Medium',
                priority: 2,
                maxRetries: 2,
                delay: 1000,
                timeout: 10000
            },
            {
                url: 'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=8&difficulty=hard',
                name: 'TriviaAPI-Hard',
                priority: 2,
                maxRetries: 2,
                delay: 1200,
                timeout: 10000
            }
        ];
        
        // Rate limiting configuration
        this.lastApiCall = new Map();
        this.minDelayBetweenCalls = 1500; // Increased delay
        
        // Simple stats tracking
        this.sessionStats = {
            totalCalls: 0,
            successfulCalls: 0,
            totalQuestions: 0,
            validQuestions: 0
        };
    }

    async loadQuestions(avoidQuestions = new Set(), targetCount = 13) {
        try {
            // Reset session stats
            this.sessionStats = { totalCalls: 0, successfulCalls: 0, totalQuestions: 0, validQuestions: 0 };
            
            console.log(`🔄 Loading ${targetCount} anime quiz questions with improved system...`);
            
            // Load questions from APIs first with better error handling
            const apiQuestions = await this.fetchFromAllAPIs(avoidQuestions);
            console.log(`📡 Received ${apiQuestions.length} total questions from all APIs`);
            
            // Log simple stats
            this.logSimpleStats();
            
            // Always supplement with fallbacks for reliability
            let allQuestions = [...apiQuestions];
            
            console.log(`📚 Adding fallback questions for reliability...`);
            
            const fallbacksNeeded = Math.max(targetCount - allQuestions.length + 8, 20); // Ensure we have extras
            const fallbackQuestions = this.getFallbackQuestions(avoidQuestions, new Set(), fallbacksNeeded);
            
            allQuestions = [...allQuestions, ...fallbackQuestions];
            console.log(`📚 Total questions after adding fallbacks: ${allQuestions.length}`);
            
            // Separate questions by difficulty
            const questionsByDifficulty = this.separateQuestionsByDifficulty(allQuestions, avoidQuestions);
            
            // Build quiz with proper progression: 2 easy, 4 medium, 4 hard, 3 extra
            const quizQuestions = [];
            const usedQuestions = new Set();
            
            // Add 2 easy questions (Q1-Q2)
            this.addQuestionsFromPool(quizQuestions, questionsByDifficulty.easy, usedQuestions, 2, 'Easy');
            
            // Add 4 medium questions (Q3-Q6)
            this.addQuestionsFromPool(quizQuestions, questionsByDifficulty.medium, usedQuestions, 4, 'Medium');
            
            // Add 4 hard questions (Q7-Q10)
            this.addQuestionsFromPool(quizQuestions, questionsByDifficulty.hard, usedQuestions, 4, 'Hard');
            
            // Add 3 extra questions for rerolls
            const allRemaining = [
                ...questionsByDifficulty.easy.filter(q => !usedQuestions.has(q.question.toLowerCase().trim())),
                ...questionsByDifficulty.medium.filter(q => !usedQuestions.has(q.question.toLowerCase().trim())),
                ...questionsByDifficulty.hard.filter(q => !usedQuestions.has(q.question.toLowerCase().trim()))
            ];
            this.shuffleArray(allRemaining);
            this.addQuestionsFromPool(quizQuestions, allRemaining, usedQuestions, 3, 'Mixed');
            
            // If we still don't have enough, fill with any available
            if (quizQuestions.length < targetCount) {
                const remainingNeeded = targetCount - quizQuestions.length;
                console.log(`⚠️ Still need ${remainingNeeded} more questions, filling with any available...`);
                
                const anyRemaining = allQuestions.filter(q => 
                    !usedQuestions.has(q.question.toLowerCase().trim())
                );
                
                this.shuffleArray(anyRemaining);
                this.addQuestionsFromPool(quizQuestions, anyRemaining, usedQuestions, remainingNeeded, 'Fill');
            }
            
            console.log(`✅ Loaded ${quizQuestions.length} questions with difficulty progression:`);
            console.log(`   Q1-Q2:  Easy (${Math.min(2, quizQuestions.length)})`);
            console.log(`   Q3-Q6:  Medium (${Math.min(4, Math.max(0, quizQuestions.length - 2))})`);
            console.log(`   Q7-Q10: Hard (${Math.min(4, Math.max(0, quizQuestions.length - 6))})`);
            console.log(`   Extra:  Rerolls (${Math.max(0, quizQuestions.length - 10)})`);
            
            this.logDifficultyStats(quizQuestions);
            
            return quizQuestions.slice(0, targetCount);
            
        } catch (error) {
            console.error('❌ Error loading questions:', error);
            
            // Log simple stats even on error
            this.logSimpleStats();
            
            return this.buildFallbackQuestionsWithProgression(avoidQuestions, targetCount);
        }
    }

    logSimpleStats() {
        const successRate = this.sessionStats.totalCalls > 0 ? 
            ((this.sessionStats.successfulCalls / this.sessionStats.totalCalls) * 100).toFixed(1) : '0.0';
        const validationRate = this.sessionStats.totalQuestions > 0 ? 
            ((this.sessionStats.validQuestions / this.sessionStats.totalQuestions) * 100).toFixed(1) : '0.0';

        console.log(`📊 Session Summary: ${this.sessionStats.successfulCalls}/${this.sessionStats.totalCalls} API calls successful (${successRate}%)`);
        console.log(`📚 Question Quality: ${this.sessionStats.validQuestions}/${this.sessionStats.totalQuestions} questions valid (${validationRate}%)`);
    }

    separateQuestionsByDifficulty(questions, avoidQuestions) {
        const separated = {
            easy: [],
            medium: [],
            hard: []
        };
        
        const usedQuestions = new Set();
        
        for (const question of questions) {
            const questionKey = question.question.toLowerCase().trim();
            
            if (usedQuestions.has(questionKey) || avoidQuestions.has(questionKey)) {
                continue;
            }
            
            usedQuestions.add(questionKey);
            
            const difficulty = (question.difficulty || 'medium').toLowerCase();
            
            if (difficulty === 'easy' || difficulty === 'beginner') {
                separated.easy.push(question);
            } else if (difficulty === 'hard' || difficulty === 'expert' || difficulty === 'difficult') {
                separated.hard.push(question);
            } else {
                separated.medium.push(question);
            }
        }
        
        this.shuffleArray(separated.easy);
        this.shuffleArray(separated.medium);
        this.shuffleArray(separated.hard);
        
        console.log(`📊 Questions by Difficulty: Easy: ${separated.easy.length}, Medium: ${separated.medium.length}, Hard: ${separated.hard.length}`);
        
        return separated;
    }

    addQuestionsFromPool(quizQuestions, pool, usedQuestions, needed, difficultyLabel) {
        let added = 0;
        
        for (const question of pool) {
            if (added >= needed) break;
            
            const questionKey = question.question.toLowerCase().trim();
            
            if (!usedQuestions.has(questionKey)) {
                quizQuestions.push(question);
                usedQuestions.add(questionKey);
                added++;
            }
        }
        
        if (added < needed) {
            console.warn(`⚠️ Could only add ${added}/${needed} ${difficultyLabel} questions`);
        }
        
        return added;
    }

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

    logDifficultyStats(questions) {
        console.log('\n🎯 Final Quiz Difficulty Progression:');
        
        questions.forEach((question, index) => {
            const questionNum = (index + 1).toString().padStart(2, '0');
            const difficulty = (question.difficulty || 'Medium').padEnd(6);
            const source = (question.source || 'Fallback').padEnd(10);
            
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

    async fetchFromAllAPIs(avoidQuestions) {
        const allQuestions = [];
        let successfulCalls = 0;
        let totalAttempts = 0;
        
        console.log(`🚀 Starting optimized API fetching strategy...`);
        
        // Sort APIs by priority
        const sortedApis = this.apiEndpoints.sort((a, b) => a.priority - b.priority);
        
        // Try each API with proper spacing and retries
        for (const apiConfig of sortedApis) {
            totalAttempts++;
            
            try {
                // Enforce minimum delay between API calls
                await this.enforceRateLimit(apiConfig.name);
                
                console.log(`📡 Attempting ${apiConfig.name} (Priority ${apiConfig.priority})...`);
                
                const questions = await this.fetchFromSingleAPIWithRetry(apiConfig, avoidQuestions, totalAttempts);
                
                if (questions.length > 0) {
                    console.log(`✅ ${apiConfig.name}: ${questions.length} valid questions retrieved`);
                    allQuestions.push(...questions);
                    successfulCalls++;
                    
                    await new Promise(resolve => setTimeout(resolve, apiConfig.delay));
                } else {
                    console.log(`⚠️ ${apiConfig.name}: No valid questions found`);
                    await new Promise(resolve => setTimeout(resolve, apiConfig.delay * 1.5));
                }
                
                // Stop early if we have enough questions
                if (allQuestions.length >= 20) {
                    console.log(`🎯 Early stop: Got ${allQuestions.length} questions (target met)`);
                    break;
                }
                
            } catch (error) {
                console.warn(`❌ ${apiConfig.name} failed after retries: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, apiConfig.delay * 2));
            }
        }
        
        console.log(`📊 API Fetch Summary: ${successfulCalls}/${totalAttempts} successful calls, ${allQuestions.length} total questions`);
        
        // Update session stats
        this.sessionStats.totalCalls = totalAttempts;
        this.sessionStats.successfulCalls = successfulCalls;
        
        this.shuffleArray(allQuestions);
        return allQuestions;
    }

    async fetchFromSingleAPIWithRetry(apiConfig, avoidQuestions, attemptNumber) {
        let lastError;
        
        for (let retry = 0; retry < apiConfig.maxRetries; retry++) {
            try {
                const questions = await this.fetchFromSingleAPI(apiConfig.url, avoidQuestions, attemptNumber, apiConfig.name);
                return questions;
                
            } catch (error) {
                lastError = error;
                
                if (error.message.includes('429') || error.message.includes('rate')) {
                    console.warn(`⚠️ Rate limited on ${apiConfig.name}, retry ${retry + 1}/${apiConfig.maxRetries}`);
                    const backoffDelay = Math.min(apiConfig.delay * Math.pow(2, retry), 10000);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503') || error.message.includes('timeout')) {
                    console.warn(`⚠️ Server/timeout error on ${apiConfig.name}, retry ${retry + 1}/${apiConfig.maxRetries}`);
                    const backoffDelay = Math.min(apiConfig.delay * (retry + 2), 8000);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                } else {
                    console.warn(`⚠️ ${apiConfig.name} error (no retry): ${error.message}`);
                    break;
                }
            }
        }
        
        throw lastError || new Error(`Failed after ${apiConfig.maxRetries} retries`);
    }

    async enforceRateLimit(apiName) {
        const now = Date.now();
        const lastCall = this.lastApiCall.get(apiName) || 0;
        const timeSinceLastCall = now - lastCall;
        
        if (timeSinceLastCall < this.minDelayBetweenCalls) {
            const waitTime = this.minDelayBetweenCalls - timeSinceLastCall;
            console.log(`⏳ Rate limiting: waiting ${waitTime}ms for ${apiName}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastApiCall.set(apiName, Date.now());
    }

    async fetchFromSingleAPI(apiUrl, avoidQuestions, apiNumber, apiName = null) {
        try {
            const displayName = apiName || this.getAPIName(apiUrl);
            
            const controller = new AbortController();
            const timeoutMs = 15000; // Increased timeout
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AnimeQuizBot/1.0)',
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
                } else if (response.status === 404) {
                    throw new Error(`404 Not Found - API endpoint may have changed`);
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
            
            // Filter and validate questions
            const validQuestions = questions.filter(q => this.isValidQuestion(q, avoidQuestions));
            
            // Update session stats
            this.sessionStats.totalQuestions += questions.length;
            this.sessionStats.validQuestions += validQuestions.length;
            
            console.log(`📊 ${displayName}: ${validQuestions.length}/${questions.length} questions passed validation`);
            return validQuestions;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    parseAPIResponse(data, apiUrl, apiNumber) {
        const questions = [];
        
        try {
            if (apiUrl.includes('opentdb.com')) {
                if (data.response_code !== 0) {
                    console.warn(`⚠️ OpenTDB API returned code ${data.response_code}`);
                    if (data.response_code === 1) {
                        console.warn(`⚠️ OpenTDB: No results found for this query`);
                    } else if (data.response_code === 2) {
                        console.warn(`⚠️ OpenTDB: Invalid parameter`);
                    } else if (data.response_code === 5) {
                        console.warn(`⚠️ OpenTDB: Rate limit exceeded`);
                    }
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
            
            console.log(`📝 Parsed ${questions.length} valid questions from API response`);
            
        } catch (error) {
            console.error(`❌ Error parsing API response:`, error);
        }
        
        return questions;
    }

    isValidQuestion(question, avoidQuestions) {
        try {
            // Basic validation
            if (!question.question || !question.answer) {
                return false;
            }
            
            if (!question.options || question.options.length < 2) {
                return false;
            }
            
            if (!question.options.includes(question.answer)) {
                return false;
            }
            
            const questionLower = question.question.toLowerCase();
            const questionKey = questionLower.trim();
            
            if (avoidQuestions.has(questionKey)) {
                return false;
            }
            
            if (question.question.length > 300) {
                return false;
            }
            
            const hasLongOptions = question.options.some(opt => opt.length > 120);
            if (hasLongOptions) {
                return false;
            }

            // Check for invalid characters or encoding issues
            if (questionLower.includes('�') || questionLower.includes('&amp;')) {
                return false;
            }
            
            // ==================== IMPROVED ANIME DETECTION ====================
            
            // Strong anime indicators
            const strongAnimeIndicators = [
                'anime', 'manga', 'otaku', 'japanese animation',
                'devil fruit', 'chakra', 'jutsu', 'quirk', 'stand', 'titan',
                'soul reaper', 'hollow', 'bankai', 'shikai', 'zanpakuto',
                'hokage', 'shinobi', 'ninja village', 'pirate king',
                'tsundere', 'yandere', 'kuudere', 'dandere', 'waifu', 'husbando',
                'senpai', 'kouhai', 'sensei', 'chan', 'kun', 'sama',
                'dragon ball', 'one piece', 'naruto', 'bleach', 'attack on titan',
                'my hero academia', 'death note', 'fullmetal alchemist',
                'studio ghibli', 'miyazaki', 'mecha', 'gundam'
            ];

            const hasStrongIndicators = strongAnimeIndicators.some(indicator => 
                questionLower.includes(indicator.toLowerCase())
            );

            // Anime titles check (expanded)
            const hasAnimeTitles = ANIME_TITLES.some(title => 
                questionLower.includes(title.toLowerCase())
            );

            // Question pattern check (improved)
            const hasAnimePattern = [
                'which.*anime', 'in.*anime', 'anime.*series', 'manga.*series',
                'which.*character', 'protagonist.*of', 'main.*character',
                'voice actor', 'voice actress', 'voiced by'
            ].some(pattern => new RegExp(pattern, 'i').test(questionLower));

            // Answer options contain anime content (expanded check)
            const answersHaveAnime = question.options.some(option => {
                const optionLower = option.toLowerCase();
                return ANIME_TITLES.some(title => optionLower.includes(title.toLowerCase())) ||
                       [
                           'luffy', 'naruto', 'goku', 'ichigo', 'natsu', 'edward',
                           'light yagami', 'monkey d', 'uchiha', 'uzumaki',
                           'elric', 'kurosaki', 'dragneel', 'midoriya', 'todoroki',
                           'bakugo', 'aizawa', 'allmight', 'deku'
                       ].some(name => optionLower.includes(name));
            });

            // ==================== STRICT REJECTION FILTERS ====================
            
            const nonAnimeContent = [
                'call of duty', 'minecraft', 'fortnite', 'overwatch', 'league of legends',
                'xbox', 'playstation', 'nintendo switch', 'pc game', 'steam',
                'hollywood', 'netflix', 'disney', 'marvel', 'dc comics',
                'billboard', 'grammy', 'album chart', 'music producer',
                'tv show', 'television', 'live action', 'sitcom',
                'american', 'british', 'european', 'western animation'
            ].some(keyword => questionLower.includes(keyword.toLowerCase()));

            if (nonAnimeContent) {
                console.log(`❌ Rejecting non-anime content: ${question.question.substring(0, 60)}...`);
                return false;
            }

            // Reject questions with too many numbers (likely statistics)
            const numberCount = (question.question.match(/\d+/g) || []).length;
            if (numberCount > 3) {
                console.log(`❌ Rejecting question with too many numbers: ${question.question.substring(0, 60)}...`);
                return false;
            }

            // ==================== DECISION LOGIC ====================
            
            // Accept if has strong anime indicators
            if (hasStrongIndicators || hasAnimeTitles) {
                console.log(`✅ Accepting anime question (strong): ${question.question.substring(0, 60)}...`);
                return true;
            }

            // Accept if has anime pattern and trusted source
            if (hasAnimePattern && (question.source === 'OpenTDB' || question.source === 'TriviaAPI')) {
                console.log(`✅ Accepting anime question (pattern + trusted): ${question.question.substring(0, 60)}...`);
                return true;
            }

            // Accept if answers contain anime content and from anime category
            if (answersHaveAnime && (questionLower.includes('character') || questionLower.includes('series'))) {
                console.log(`✅ Accepting anime question (answers + context): ${question.question.substring(0, 60)}...`);
                return true;
            }

            console.log(`❌ Rejecting question (insufficient anime content): ${question.question.substring(0, 60)}...`);
            return false;
            
        } catch (error) {
            console.error('❌ Error validating question:', error);
            return false;
        }
    }

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

    logAPIStats(questions) {
        const stats = {
            total: questions.length,
            bySource: {}
        };
        
        questions.forEach(q => {
            const source = q.source || 'Unknown';
            stats.bySource[source] = (stats.bySource[source] || 0) + 1;
        });
        
        console.log('\n📊 API Statistics:');
        console.log(`Total Questions: ${stats.total}`);
        Object.entries(stats.bySource).forEach(([source, count]) => {
            console.log(`  ${source}: ${count} questions`);
        });
        console.log('');
    }

    getQuestionStats(questions) {
        const stats = {
            total: questions.length,
            byDifficulty: {
                easy: 0,
                medium: 0,
                hard: 0
            },
            bySource: {
                api: 0,
                fallback: 0
            }
        };
        
        questions.forEach(q => {
            const difficulty = (q.difficulty || 'medium').toLowerCase();
            if (stats.byDifficulty[difficulty] !== undefined) {
                stats.byDifficulty[difficulty]++;
            }
            
            if (q.source) {
                stats.bySource.api++;
            } else {
                stats.bySource.fallback++;
            }
        });
        
        return stats;
    }

    // Emergency fallback method - guarantees questions even if all else fails
    getEmergencyFallbackQuestions(targetCount = 13) {
        console.log('🚨 Using emergency fallback questions...');
        
        const emergencyQuestions = [
            {
                question: "Who is the main protagonist of One Piece?",
                options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"],
                answer: "Monkey D. Luffy",
                difficulty: "Easy"
            },
            {
                question: "What is Naruto's favorite food?",
                options: ["Ramen", "Sushi", "Rice balls", "Tempura"],
                answer: "Ramen",
                difficulty: "Easy"
            },
            {
                question: "In Dragon Ball, how many Dragon Balls are there?",
                options: ["7", "5", "9", "12"],
                answer: "7",
                difficulty: "Easy"
            },
            {
                question: "What is the name of Light's notebook in Death Note?",
                options: ["Death Note", "Kill Book", "Murder Diary", "Dark Journal"],
                answer: "Death Note",
                difficulty: "Medium"
            },
            {
                question: "In Attack on Titan, what are the giant creatures called?",
                options: ["Titans", "Giants", "Colossi", "Monsters"],
                answer: "Titans",
                difficulty: "Medium"
            },
            {
                question: "What is Luffy's Devil Fruit power?",
                options: ["Rubber abilities", "Fire powers", "Ice powers", "Lightning"],
                answer: "Rubber abilities",
                difficulty: "Medium"
            },
            {
                question: "In Fullmetal Alchemist, what is the first law of equivalent exchange?",
                options: ["To obtain something, something of equal value must be lost", "Energy cannot be destroyed", "Matter cannot be created", "All is one"],
                answer: "To obtain something, something of equal value must be lost",
                difficulty: "Hard"
            },
            {
                question: "What is the name of Ichigo's sword in Bleach?",
                options: ["Zangetsu", "Senbonzakura", "Hyorinmaru", "Zabimaru"],
                answer: "Zangetsu",
                difficulty: "Hard"
            },
            {
                question: "In One Piece, what is Nico Robin's Devil Fruit called?",
                options: ["Hana Hana no Mi", "Gomu Gomu no Mi", "Mera Mera no Mi", "Yami Yami no Mi"],
                answer: "Hana Hana no Mi",
                difficulty: "Hard"
            },
            {
                question: "What village is Naruto from?",
                options: ["Hidden Leaf Village", "Hidden Sand Village", "Hidden Mist Village", "Hidden Cloud Village"],
                answer: "Hidden Leaf Village",
                difficulty: "Easy"
            },
            {
                question: "In My Hero Academia, what is Deku's real name?",
                options: ["Izuku Midoriya", "Katsuki Bakugo", "Shoto Todoroki", "Tenya Iida"],
                answer: "Izuku Midoriya",
                difficulty: "Medium"
            },
            {
                question: "What type of Pokemon is Pikachu?",
                options: ["Electric", "Fire", "Water", "Grass"],
                answer: "Electric",
                difficulty: "Easy"
            },
            {
                question: "In JoJo's Bizarre Adventure, what are Stands?",
                options: ["Supernatural abilities", "Weapons", "Locations", "Organizations"],
                answer: "Supernatural abilities",
                difficulty: "Hard"
            }
        ];

        this.shuffleArray(emergencyQuestions);
        
        // Ensure we have enough questions by duplicating if necessary
        while (emergencyQuestions.length < targetCount) {
            const additionalQuestions = [...emergencyQuestions];
            this.shuffleArray(additionalQuestions);
            emergencyQuestions.push(...additionalQuestions.slice(0, targetCount - emergencyQuestions.length));
        }

        console.log(`🛡️ Emergency fallback provided ${Math.min(targetCount, emergencyQuestions.length)} questions`);
        return emergencyQuestions.slice(0, targetCount);
    }

    // Method to validate and fix question data
    validateAndFixQuestion(question) {
        if (!question || typeof question !== 'object') {
            return null;
        }

        // Ensure required fields exist
        if (!question.question || !question.answer || !question.options) {
            return null;
        }

        // Clean and validate question text
        question.question = this.cleanText(question.question);
        question.answer = this.cleanText(question.answer);
        
        if (!question.question || question.question.length < 10) {
            return null;
        }

        // Clean and validate options
        question.options = question.options.map(opt => this.cleanText(opt)).filter(opt => opt && opt.length > 0);
        
        if (question.options.length < 2) {
            return null;
        }

        // Ensure answer is in options
        if (!question.options.includes(question.answer)) {
            question.options.push(question.answer);
        }

        // Ensure we have at least 4 options
        while (question.options.length < 4) {
            question.options.push(`Option ${question.options.length + 1}`);
        }

        // Set default difficulty if missing
        if (!question.difficulty) {
            question.difficulty = 'Medium';
        }

        return question;
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
                    method: 'HEAD', // Use HEAD request for health check
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                healthResults[apiConfig.name] = {
                    status: response.ok ? 'healthy' : 'unhealthy',
                    statusCode: response.status,
                    responseTime: Date.now()
                };
                
                console.log(`${response.ok ? '✅' : '❌'} ${apiConfig.name}: ${response.status}`);
                
            } catch (error) {
                healthResults[apiConfig.name] = {
                    status: 'error',
                    error: error.message
                };
                
                console.log(`❌ ${apiConfig.name}: ${error.message}`);
            }
            
            // Small delay between health checks
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        return healthResults;
    }
}

module.exports = QuestionLoader;
