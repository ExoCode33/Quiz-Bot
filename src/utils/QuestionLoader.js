const { FALLBACK_QUESTIONS, ANIME_KEYWORDS, BAD_KEYWORDS, ANIME_TITLES } = require('./constants');

class QuestionLoader {
    constructor() {
        this.apiEndpoints = [
            // Working APIs (increased amounts)
            'https://opentdb.com/api.php?amount=10&category=31&type=multiple',
            'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=10',
            
            // Fixed API endpoints
            'https://aniquizapi.vercel.app/api/quiz?difficulty=medium', // Single question endpoint
            'https://beta-trivia.bongobot.io/?category=entertainment&limit=8', // Fixed category name
            
            // Alternative working API instead of API Ninjas
            'https://opentdb.com/api.php?amount=5&category=31&type=multiple&difficulty=hard' // Second OpenTDB call for hard questions
        ];
    }

    async loadQuestions(avoidQuestions = new Set(), targetCount = 13) {
        try {
            console.log(`🔄 Loading ${targetCount} anime quiz questions with difficulty progression...`);
            
            // Load questions from APIs first
            const apiQuestions = await this.fetchFromAllAPIs(avoidQuestions);
            console.log(`📡 Received ${apiQuestions.length} total questions from all APIs`);
            
            // Separate questions by difficulty
            const questionsByDifficulty = this.separateQuestionsByDifficulty(apiQuestions, avoidQuestions);
            
            // Get fallback questions separated by difficulty
            const fallbacksByDifficulty = this.getFallbackQuestionsByDifficulty(avoidQuestions, new Set());
            
            // Combine API and fallback questions by difficulty
            const combinedEasy = [...questionsByDifficulty.easy, ...fallbacksByDifficulty.easy];
            const combinedMedium = [...questionsByDifficulty.medium, ...fallbacksByDifficulty.medium];
            const combinedHard = [...questionsByDifficulty.hard, ...fallbacksByDifficulty.hard];
            
            // Shuffle each difficulty pool
            this.shuffleArray(combinedEasy);
            this.shuffleArray(combinedMedium);
            this.shuffleArray(combinedHard);
            
            // Build quiz with proper progression: 2 easy, 4 medium, 4 hard, 3 extra (any difficulty)
            const quizQuestions = [];
            const usedQuestions = new Set();
            
            // Add 2 easy questions (Q1-Q2)
            this.addQuestionsFromPool(quizQuestions, combinedEasy, usedQuestions, 2, 'Easy');
            
            // Add 4 medium questions (Q3-Q6)
            this.addQuestionsFromPool(quizQuestions, combinedMedium, usedQuestions, 4, 'Medium');
            
            // Add 4 hard questions (Q7-Q10)
            this.addQuestionsFromPool(quizQuestions, combinedHard, usedQuestions, 4, 'Hard');
            
            // Add 3 extra questions for rerolls (any difficulty)
            const allRemaining = [
                ...combinedEasy.filter(q => !usedQuestions.has(q.question.toLowerCase().trim())),
                ...combinedMedium.filter(q => !usedQuestions.has(q.question.toLowerCase().trim())),
                ...combinedHard.filter(q => !usedQuestions.has(q.question.toLowerCase().trim()))
            ];
            this.shuffleArray(allRemaining);
            this.addQuestionsFromPool(quizQuestions, allRemaining, usedQuestions, 3, 'Mixed');
            
            console.log(`✅ Loaded ${quizQuestions.length} questions with difficulty progression:`);
            console.log(`   Q1-Q2:  Easy (${quizQuestions.slice(0, 2).length})`);
            console.log(`   Q3-Q6:  Medium (${quizQuestions.slice(2, 6).length})`);
            console.log(`   Q7-Q10: Hard (${quizQuestions.slice(6, 10).length})`);
            console.log(`   Extra:  Rerolls (${quizQuestions.slice(10).length})`);
            
            this.logDifficultyStats(quizQuestions);
            
            return quizQuestions;
            
        } catch (error) {
            console.error('❌ Error loading questions:', error);
            
            // Return fallback questions with proper difficulty progression
            return this.buildFallbackQuestionsWithProgression(avoidQuestions, targetCount);
        }
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
            
            // Skip if already used or should be avoided
            if (usedQuestions.has(questionKey) || avoidQuestions.has(questionKey)) {
                continue;
            }
            
            if (!this.isValidQuestion(question, avoidQuestions)) {
                continue;
            }
            
            usedQuestions.add(questionKey);
            
            // Normalize difficulty and categorize
            const difficulty = (question.difficulty || 'medium').toLowerCase();
            
            if (difficulty === 'easy' || difficulty === 'beginner') {
                separated.easy.push(question);
            } else if (difficulty === 'hard' || difficulty === 'expert' || difficulty === 'difficult') {
                separated.hard.push(question);
            } else {
                // Default to medium for 'medium', 'normal', or unknown difficulties
                separated.medium.push(question);
            }
        }
        
        console.log(`📊 API Questions by Difficulty:`);
        console.log(`   Easy: ${separated.easy.length}`);
        console.log(`   Medium: ${separated.medium.length}`);
        console.log(`   Hard: ${separated.hard.length}`);
        
        return separated;
    }

    getFallbackQuestionsByDifficulty(avoidQuestions, usedQuestions) {
        const fallbacks = {
            easy: [...FALLBACK_QUESTIONS.Easy],
            medium: [...FALLBACK_QUESTIONS.Medium],
            hard: [...FALLBACK_QUESTIONS.Hard]
        };
        
        // Filter out avoided and used questions
        Object.keys(fallbacks).forEach(difficulty => {
            fallbacks[difficulty] = fallbacks[difficulty].filter(question => {
                const questionKey = question.question.toLowerCase().trim();
                return !avoidQuestions.has(questionKey) && !usedQuestions.has(questionKey);
            });
            
            // Shuffle each difficulty pool
            this.shuffleArray(fallbacks[difficulty]);
        });
        
        console.log(`📚 Fallback Questions by Difficulty:`);
        console.log(`   Easy: ${fallbacks.easy.length}`);
        console.log(`   Medium: ${fallbacks.medium.length}`);
        console.log(`   Hard: ${fallbacks.hard.length}`);
        
        return fallbacks;
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
        
        // Add questions with proper progression
        this.addQuestionsFromPool(quizQuestions, fallbacks.easy, usedQuestions, 2, 'Easy (Fallback)');
        this.addQuestionsFromPool(quizQuestions, fallbacks.medium, usedQuestions, 4, 'Medium (Fallback)');
        this.addQuestionsFromPool(quizQuestions, fallbacks.hard, usedQuestions, 4, 'Hard (Fallback)');
        
        // Add extra questions for rerolls
        const allRemaining = [
            ...fallbacks.easy.filter(q => !usedQuestions.has(q.question.toLowerCase().trim())),
            ...fallbacks.medium.filter(q => !usedQuestions.has(q.question.toLowerCase().trim())),
            ...fallbacks.hard.filter(q => !usedQuestions.has(q.question.toLowerCase().trim()))
        ];
        this.shuffleArray(allRemaining);
        this.addQuestionsFromPool(quizQuestions, allRemaining, usedQuestions, targetCount - quizQuestions.length, 'Extra (Fallback)');
        
        return quizQuestions;
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
        
        // Use Promise.allSettled for concurrent API calls
        const apiPromises = this.apiEndpoints.map((apiUrl, index) => 
            this.fetchFromSingleAPI(apiUrl, avoidQuestions, index + 1)
        );
        const results = await Promise.allSettled(apiPromises);
        
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'fulfilled' && result.value.length > 0) {
                console.log(`✅ API ${i + 1} (${this.getAPIName(this.apiEndpoints[i])}): ${result.value.length} questions`);
                allQuestions.push(...result.value);
            } else {
                console.log(`❌ API ${i + 1} (${this.getAPIName(this.apiEndpoints[i])}): Failed or no questions`);
            }
        }
        
        // Shuffle combined results
        this.shuffleArray(allQuestions);
        
        return allQuestions;
    }

    async fetchFromSingleAPI(apiUrl, avoidQuestions, apiNumber) {
        try {
            console.log(`📡 API ${apiNumber}: Fetching from ${this.getAPIName(apiUrl)}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout to 15 seconds
            
            // Special headers for different APIs
            const headers = {
                'User-Agent': 'AnimeQuizBot/1.0',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            };
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.warn(`⚠️ API ${apiNumber} (${this.getAPIName(apiUrl)}) returned status ${response.status}`);
                return [];
            }
            
            const data = await response.json();
            const questions = this.parseAPIResponse(data, apiUrl, apiNumber);
            
            // Filter and validate questions
            const validQuestions = questions.filter(q => this.isValidQuestion(q, avoidQuestions));
            
            console.log(`✅ API ${apiNumber}: Got ${validQuestions.length}/${questions.length} valid questions`);
            return validQuestions;
            
        } catch (error) {
            console.warn(`⚠️ API ${apiNumber} (${this.getAPIName(apiUrl)}) failed: ${error.message}`);
            return [];
        }
    }

    parseAPIResponse(data, apiUrl, apiNumber) {
        const questions = [];
        
        try {
            if (apiUrl.includes('opentdb.com')) {
                // OpenTDB format - these are from Entertainment/Anime category
                if (data.results && Array.isArray(data.results)) {
                    for (const item of data.results) {
                        const question = {
                            question: this.cleanText(item.question),
                            answer: this.cleanText(item.correct_answer),
                            options: [...item.incorrect_answers.map(opt => this.cleanText(opt)), this.cleanText(item.correct_answer)],
                            difficulty: item.difficulty || 'Medium',
                            source: 'OpenTDB'
                        };
                        
                        this.shuffleArray(question.options);
                        questions.push(question);
                    }
                }
            } else if (apiUrl.includes('trivia-api.com')) {
                // The Trivia API format - anime/manga category
                if (Array.isArray(data)) {
                    for (const item of data) {
                        const question = {
                            question: this.cleanText(item.question.text),
                            answer: this.cleanText(item.correctAnswer),
                            options: [...item.incorrectAnswers.map(opt => this.cleanText(opt)), this.cleanText(item.correctAnswer)],
                            difficulty: item.difficulty || 'medium',
                            source: 'TriviaAPI'
                        };
                        
                        this.shuffleArray(question.options);
                        questions.push(question);
                    }
                }
            } else if (apiUrl.includes('aniquizapi.vercel.app')) {
                // AniQuizAPI format - dedicated anime API
                if (data.question) {
                    const question = {
                        question: this.cleanText(data.question),
                        answer: this.cleanText(data.answer),
                        options: data.options ? data.options.map(opt => this.cleanText(opt)) : [],
                        difficulty: data.difficulty || 'Medium',
                        source: 'AniQuizAPI'
                    };
                    
                    // Ensure answer is in options
                    if (!question.options.includes(question.answer)) {
                        question.options.push(question.answer);
                    }
                    
                    // Pad with reasonable dummy options if needed
                    const dummyOptions = [
                        'Light Yagami', 'Edward Elric', 'Natsu Dragneel', 'Ichigo Kurosaki',
                        'Fire Magic', 'Water Magic', 'Ice Magic', 'Lightning Magic',
                        'Tokyo', 'Konoha', 'Soul Society', 'Grand Line'
                    ];
                    
                    while (question.options.length < 4) {
                        const availableDummy = dummyOptions.find(opt => !question.options.includes(opt));
                        if (availableDummy) {
                            question.options.push(availableDummy);
                        } else {
                            question.options.push(`Option ${question.options.length}`);
                        }
                    }
                    
                    this.shuffleArray(question.options);
                    questions.push(question);
                }
            } else if (apiUrl.includes('beta-trivia.bongobot.io')) {
                // Beta Trivia API format - entertainment category (more permissive)
                if (Array.isArray(data)) {
                    for (const item of data) {
                        const question = {
                            question: this.cleanText(item.question),
                            answer: this.cleanText(item.correct_answer),
                            options: [...item.incorrect_answers.map(opt => this.cleanText(opt)), this.cleanText(item.correct_answer)],
                            difficulty: item.difficulty || 'Medium',
                            source: 'BetaTrivia'
                        };
                        
                        this.shuffleArray(question.options);
                        questions.push(question);
                    }
                } else if (data.question) {
                    // Single question format
                    const question = {
                        question: this.cleanText(data.question),
                        answer: this.cleanText(data.correct_answer || data.answer),
                        options: data.incorrect_answers ? 
                            [...data.incorrect_answers.map(opt => this.cleanText(opt)), this.cleanText(data.correct_answer || data.answer)] :
                            [this.cleanText(data.correct_answer || data.answer), 'Option A', 'Option B', 'Option C'],
                        difficulty: data.difficulty || 'Medium',
                        source: 'BetaTrivia'
                    };
                    
                    this.shuffleArray(question.options);
                    questions.push(question);
                }
            }
            
            console.log(`📡 API ${apiNumber} parsed ${questions.length} raw questions`);
            
        } catch (error) {
            console.error(`❌ Error parsing API ${apiNumber} response:`, error);
        }
        
        return questions;
    }

    isValidQuestion(question, avoidQuestions) {
        try {
            // Basic validation
            if (!question.question || !question.answer) {
                return false;
            }
            
            // Ensure we have options
            if (!question.options || question.options.length < 2) {
                return false;
            }
            
            // Check if answer is in options
            if (!question.options.includes(question.answer)) {
                return false;
            }
            
            const questionLower = question.question.toLowerCase();
            const questionKey = questionLower.trim();
            
            // Check against avoid list
            if (avoidQuestions.has(questionKey)) {
                return false;
            }
            
            // Check question length
            if (question.question.length > 250) {
                return false;
            }
            
            // Check option lengths
            const hasLongOptions = question.options.some(opt => opt.length > 100);
            if (hasLongOptions) {
                return false;
            }
            
            // ==================== IMPROVED ANIME DETECTION ====================
            
            // 1. Check for explicit anime/manga keywords (strong indicators)
            const hasExplicitAnimeKeywords = [
                'anime', 'manga', 'otaku', 'cosplay', 'japanese animation',
                'seiyuu', 'voice actor', 'dub', 'sub', 'episode', 'season',
                'shounen', 'shoujo', 'seinen', 'josei', 'mecha', 'magical girl',
                'isekai', 'harem', 'tsundere', 'yandere', 'kuudere', 'dandere',
                'waifu', 'husbando', 'senpai', 'kouhai', 'sensei'
            ].some(keyword => questionLower.includes(keyword.toLowerCase()));

            // 2. Check for anime titles (very strong indicator)
            const hasAnimeTitles = ANIME_TITLES.some(title => 
                questionLower.includes(title.toLowerCase())
            );

            // 3. Check for anime-specific terms and concepts
            const hasAnimeTerms = [
                'devil fruit', 'chakra', 'jutsu', 'quirk', 'stand', 'titan',
                'soul reaper', 'hollow', 'bankai', 'shikai', 'zanpakuto',
                'guild', 'crew', 'nakama', 'pirate king', 'hokage', 'shinobi',
                'ninja', 'samurai', 'dojo', 'tournament', 'battle royale',
                'power level', 'transformation', 'ki', 'chi', 'aura',
                'demon slayer', 'dragon ball', 'one piece', 'naruto', 'bleach'
            ].some(term => questionLower.includes(term));

            // 4. Check for anime character naming patterns
            const hasAnimeNamePattern = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(question.question) && (
                questionLower.includes('character') || 
                questionLower.includes('protagonist') ||
                questionLower.includes('main') ||
                questionLower.includes('hero')
            );

            // 5. Check answer options for anime content
            const answersHaveAnime = question.options.some(option => {
                const optionLower = option.toLowerCase();
                return ANIME_TITLES.some(title => optionLower.includes(title.toLowerCase())) ||
                       [
                           'luffy', 'naruto', 'goku', 'ichigo', 'natsu', 'edward elric',
                           'light yagami', 'l lawliet', 'monkey d', 'uchiha', 'uzumaki',
                           'fire', 'water', 'earth', 'wind', 'lightning', 'ice', 'darkness'
                       ].some(name => optionLower.includes(name));
            });

            // 6. Check for anime-specific question patterns
            const hasAnimeQuestionPattern = [
                'which.*anime', 'in.*anime', 'from.*anime', 'anime.*series',
                'manga.*series', 'which.*character', 'protagonist.*of',
                'main.*character', 'hero.*academia', 'attack.*titan',
                'dragon.*ball', 'one.*piece', 'death.*note'
            ].some(pattern => new RegExp(pattern, 'i').test(questionLower));

            // STRONG ANIME INDICATORS - if any of these are true, likely anime
            const strongAnimeIndicators = 
                hasExplicitAnimeKeywords || 
                hasAnimeTitles || 
                hasAnimeTerms || 
                hasAnimeQuestionPattern;

            // WEAK ANIME INDICATORS - supporting evidence
            const weakAnimeIndicators = 
                hasAnimeNamePattern || 
                answersHaveAnime;

            // ==================== REJECTION FILTERS ====================
            
            // Reject obvious non-anime content
            const nonAnimeKeywords = [
                'call of duty', 'overwatch', 'pokemon go', 'minecraft', 'fortnite',
                'xbox', 'playstation', 'nintendo switch', 'pc game', 'mobile game',
                'hollywood', 'netflix', 'disney', 'marvel', 'dc comics',
                'american', 'british', 'french', 'german', 'spanish',
                'real life', 'historical', 'biography', 'documentary'
            ];
            
            const hasNonAnimeKeywords = nonAnimeKeywords.some(keyword => 
                questionLower.includes(keyword.toLowerCase())
            );

            // Reject pure gaming questions (unless they have strong anime indicators)
            const isPureGaming = [
                'video game', 'pc game', 'console game', 'mobile game',
                'game developer', 'game publisher', 'steam', 'epic games',
                'nintendo', 'sony', 'microsoft', 'valve'
            ].some(term => questionLower.includes(term)) && !strongAnimeIndicators;

            // Reject music questions unless anime-related
            const isPureMusicQuestion = [
                'billboard', 'grammy', 'album chart', 'recording studio',
                'music producer', 'record label', 'music video'
            ].some(term => questionLower.includes(term)) && !strongAnimeIndicators;

            // ==================== DECISION LOGIC ====================
            
            // Definitely reject non-anime content
            if (hasNonAnimeKeywords || isPureGaming || isPureMusicQuestion) {
                console.log(`❌ Rejecting non-anime content: ${question.question.substring(0, 60)}...`);
                return false;
            }

            // Accept if we have strong anime indicators
            if (strongAnimeIndicators) {
                console.log(`✅ Accepting anime question (strong): ${question.question.substring(0, 60)}...`);
                return true;
            }

            // Accept if we have weak indicators and it's from a trusted anime API
            if (weakAnimeIndicators && (question.source === 'OpenTDB' || question.source === 'TriviaAPI')) {
                console.log(`✅ Accepting anime question (weak + trusted): ${question.question.substring(0, 60)}...`);
                return true;
            }

            // Check for overly technical questions only after anime validation
            const isTooTechnical = BAD_KEYWORDS.some(keyword => 
                questionLower.includes(keyword.toLowerCase())
            );

            if (isTooTechnical) {
                // Allow some technical questions if they're clearly anime-related
                const allowedTechnicalPatterns = [
                    'voice.*actor.*anime', 'anime.*voice', 'seiyuu.*voice',
                    'anime.*air', 'when.*anime.*release', 'anime.*debut',
                    'anime.*character', 'character.*anime'
                ];
                
                const isAllowedTechnical = allowedTechnicalPatterns.some(pattern => 
                    new RegExp(pattern, 'i').test(questionLower)
                );
                
                if (!isAllowedTechnical) {
                    console.log(`❌ Rejecting technical question: ${question.question.substring(0, 60)}...`);
                    return false;
                }
            }

            // Final quality checks
            const numberCount = (question.question.match(/\d+/g) || []).length;
            if (numberCount > 4) {
                return false;
            }
            
            // Reject multiple choice artifacts in the question text
            if (/\b(a\)|b\)|c\)|d\)|\(a\)|\(b\)|\(c\)|\(d\))/i.test(questionLower)) {
                return false;
            }

            // If we get here, it's probably not anime-related enough
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
        
        const easyCount = Math.ceil(targetCount * 0.4);
        const mediumCount = Math.ceil(targetCount * 0.4);
        const hardCount = targetCount - easyCount - mediumCount;
        
        const balancedQuestions = [
            ...easyQuestions.slice(0, easyCount),
            ...mediumQuestions.slice(0, mediumCount),
            ...hardQuestions.slice(0, hardCount)
        ];
        
        const availableFallbacks = balancedQuestions.filter(question => {
            const questionKey = question.question.toLowerCase().trim();
            return !avoidQuestions.has(questionKey) && !usedQuestions.has(questionKey);
        });
        
        if (availableFallbacks.length < targetCount) {
            console.warn(`⚠️ Only ${availableFallbacks.length} unique fallback questions available, adding more...`);
            
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
            return 'OpenTDB';
        }
        if (url.includes('trivia-api.com')) return 'TriviaAPI';
        if (url.includes('aniquizapi.vercel.app')) return 'AniQuizAPI';
        if (url.includes('beta-trivia.bongobot.io')) return 'BetaTrivia';
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
}

module.exports = QuestionLoader;
