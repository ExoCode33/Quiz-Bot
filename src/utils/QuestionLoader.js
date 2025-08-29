const { FALLBACK_QUESTIONS, ANIME_KEYWORDS, BAD_KEYWORDS, ANIME_TITLES } = require('./constants');

class QuestionLoader {
    constructor() {
        // Improved API endpoints with better anime content and rate limiting
        this.apiEndpoints = [
            // OpenTDB with smaller requests to avoid rate limiting
            'https://opentdb.com/api.php?amount=5&category=31&type=multiple',
            
            // Alternative anime-focused APIs
            'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=5',
            
            // Try different OpenTDB difficulties in separate calls
            'https://opentdb.com/api.php?amount=3&category=31&type=multiple&difficulty=easy',
            'https://opentdb.com/api.php?amount=3&category=31&type=multiple&difficulty=medium',
            'https://opentdb.com/api.php?amount=3&category=31&type=multiple&difficulty=hard',
            
            // Single question APIs (less likely to be rate limited)
            'https://aniquizapi.vercel.app/api/quiz?difficulty=medium',
            'https://aniquizapi.vercel.app/api/quiz?difficulty=easy',
            'https://aniquizapi.vercel.app/api/quiz?difficulty=hard',
        ];
    }

    async loadQuestions(avoidQuestions = new Set(), targetCount = 13) {
        try {
            console.log(`🔄 Loading ${targetCount} anime quiz questions with difficulty progression...`);
            
            // Load questions from APIs first
            const apiQuestions = await this.fetchFromAllAPIs(avoidQuestions);
            console.log(`📡 Received ${apiQuestions.length} total questions from all APIs`);
            
            // If we don't have enough API questions, heavily supplement with fallbacks
            let allQuestions = [...apiQuestions];
            
            if (allQuestions.length < targetCount) {
                console.log(`⚠️ Only ${allQuestions.length} API questions available, adding fallbacks...`);
                
                // Get fallback questions to fill the gap
                const fallbacksNeeded = targetCount - allQuestions.length + 5; // Extra buffer
                const fallbackQuestions = this.getFallbackQuestions(avoidQuestions, new Set(), fallbacksNeeded);
                
                allQuestions = [...allQuestions, ...fallbackQuestions];
                console.log(`📚 Total questions after adding fallbacks: ${allQuestions.length}`);
            }
            
            // Separate questions by difficulty
            const questionsByDifficulty = this.separateQuestionsByDifficulty(allQuestions, avoidQuestions);
            
            // Build quiz with proper progression: 2 easy, 4 medium, 4 hard, 3 extra (any difficulty)
            const quizQuestions = [];
            const usedQuestions = new Set();
            
            // Add 2 easy questions (Q1-Q2)
            this.addQuestionsFromPool(quizQuestions, questionsByDifficulty.easy, usedQuestions, 2, 'Easy');
            
            // Add 4 medium questions (Q3-Q6)
            this.addQuestionsFromPool(quizQuestions, questionsByDifficulty.medium, usedQuestions, 4, 'Medium');
            
            // Add 4 hard questions (Q7-Q10)
            this.addQuestionsFromPool(quizQuestions, questionsByDifficulty.hard, usedQuestions, 4, 'Hard');
            
            // Add 3 extra questions for rerolls (any difficulty)
            const allRemaining = [
                ...questionsByDifficulty.easy.filter(q => !usedQuestions.has(q.question.toLowerCase().trim())),
                ...questionsByDifficulty.medium.filter(q => !usedQuestions.has(q.question.toLowerCase().trim())),
                ...questionsByDifficulty.hard.filter(q => !usedQuestions.has(q.question.toLowerCase().trim()))
            ];
            this.shuffleArray(allRemaining);
            this.addQuestionsFromPool(quizQuestions, allRemaining, usedQuestions, 3, 'Mixed');
            
            // If we still don't have enough questions, fill with any available
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
            
            return quizQuestions.slice(0, targetCount); // Ensure we don't exceed target
            
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
        
        // Shuffle each pool
        this.shuffleArray(separated.easy);
        this.shuffleArray(separated.medium);
        this.shuffleArray(separated.hard);
        
        console.log(`📊 Questions by Difficulty (after validation):`);
        console.log(`   Easy: ${separated.easy.length}`);
        console.log(`   Medium: ${separated.medium.length}`);
        console.log(`   Hard: ${separated.hard.length}`);
        
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
        
        // Add delays between API calls to avoid rate limiting
        for (let i = 0; i < this.apiEndpoints.length; i++) {
            const apiUrl = this.apiEndpoints[i];
            
            try {
                const questions = await this.fetchFromSingleAPI(apiUrl, avoidQuestions, i + 1);
                if (questions.length > 0) {
                    console.log(`✅ API ${i + 1} (${this.getAPIName(apiUrl)}): ${questions.length} questions`);
                    allQuestions.push(...questions);
                } else {
                    console.log(`❌ API ${i + 1} (${this.getAPIName(apiUrl)}): No valid questions`);
                }
                
                // Add delay between API calls to avoid rate limiting
                if (i < this.apiEndpoints.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
                }
                
            } catch (error) {
                console.log(`❌ API ${i + 1} (${this.getAPIName(apiUrl)}): Failed - ${error.message}`);
                
                // Add delay even on failure
                if (i < this.apiEndpoints.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay on failure
                }
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
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'AnimeQuizBot/1.0',
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                if (response.status === 429) {
                    console.warn(`⚠️ API ${apiNumber} rate limited (429), will use fallbacks`);
                } else {
                    console.warn(`⚠️ API ${apiNumber} returned status ${response.status}`);
                }
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
                // OpenTDB format
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
                // The Trivia API format
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
                // AniQuizAPI format
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
                    
                    // Pad with anime-themed dummy options if needed
                    const animeDummies = [
                        'Monkey D. Luffy', 'Naruto Uzumaki', 'Edward Elric', 'Light Yagami',
                        'Ichigo Kurosaki', 'Natsu Dragneel', 'Eren Yeager', 'Goku',
                        'Fire Magic', 'Water Technique', 'Lightning Style', 'Wind Blade'
                    ];
                    
                    while (question.options.length < 4) {
                        const availableDummy = animeDummies.find(opt => !question.options.includes(opt));
                        if (availableDummy) {
                            question.options.push(availableDummy);
                        } else {
                            question.options.push(`Option ${question.options.length}`);
                        }
                    }
                    
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
            
            // ==================== ANIME DETECTION ====================
            
            // Strong anime indicators
            const strongAnimeIndicators = [
                // Explicit anime keywords
                'anime', 'manga', 'otaku', 'japanese animation',
                // Anime-specific terms
                'devil fruit', 'chakra', 'jutsu', 'quirk', 'stand', 'titan',
                'soul reaper', 'hollow', 'bankai', 'shikai', 'zanpakuto',
                'hokage', 'shinobi', 'ninja village', 'pirate king',
                // Character types
                'tsundere', 'yandere', 'kuudere', 'dandere', 'waifu', 'husbando',
                // Cultural terms
                'senpai', 'kouhai', 'sensei', 'chan', 'kun', 'sama',
                // Series-specific
                'dragon ball', 'one piece', 'naruto', 'bleach', 'attack on titan',
                'my hero academia', 'death note', 'fullmetal alchemist'
            ];

            const hasStrongIndicators = strongAnimeIndicators.some(indicator => 
                questionLower.includes(indicator.toLowerCase())
            );

            // Anime titles check
            const hasAnimeTitles = ANIME_TITLES.some(title => 
                questionLower.includes(title.toLowerCase())
            );

            // Question pattern check
            const hasAnimePattern = [
                'which.*anime', 'in.*anime', 'anime.*series', 'manga.*series',
                'which.*character', 'protagonist.*of', 'main.*character'
            ].some(pattern => new RegExp(pattern, 'i').test(questionLower));

            // Answer options contain anime content
            const answersHaveAnime = question.options.some(option => {
                const optionLower = option.toLowerCase();
                return ANIME_TITLES.some(title => optionLower.includes(title.toLowerCase())) ||
                       [
                           'luffy', 'naruto', 'goku', 'ichigo', 'natsu', 'edward',
                           'light yagami', 'monkey d', 'uchiha', 'uzumaki'
                       ].some(name => optionLower.includes(name));
            });

            // ==================== REJECTION FILTERS ====================
            
            // Reject obvious non-anime content
            const nonAnimeContent = [
                'call of duty', 'minecraft', 'fortnite', 'overwatch',
                'xbox', 'playstation', 'nintendo switch', 'pc game',
                'hollywood', 'netflix', 'disney', 'marvel', 'dc comics',
                'billboard', 'grammy', 'album chart', 'music producer'
            ].some(keyword => questionLower.includes(keyword.toLowerCase()));

            if (nonAnimeContent) {
                console.log(`❌ Rejecting non-anime content: ${question.question.substring(0, 60)}...`);
                return false;
            }

            // ==================== DECISION LOGIC ====================
            
            // Accept if we have strong anime indicators
            if (hasStrongIndicators || hasAnimeTitles || hasAnimePattern) {
                console.log(`✅ Accepting anime question (strong): ${question.question.substring(0, 60)}...`);
                return true;
            }

            // Accept if answers contain anime content and it's from a trusted source
            if (answersHaveAnime && (question.source === 'OpenTDB' || question.source === 'TriviaAPI' || question.source === 'AniQuizAPI')) {
                console.log(`✅ Accepting anime question (weak + trusted): ${question.question.substring(0, 60)}...`);
                return true;
            }

            // Final quality checks
            const numberCount = (question.question.match(/\d+/g) || []).length;
            if (numberCount > 4) {
                return false;
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
        
        // Calculate balanced distribution
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
            // Add more questions from all categories
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
            if (url.includes('difficulty=medium')) return 'OpenTDB-Medium';
            if (url.includes('difficulty=easy')) return 'OpenTDB-Easy';
            return 'OpenTDB';
        }
        if (url.includes('trivia-api.com')) return 'TriviaAPI';
        if (url.includes('aniquizapi.vercel.app')) {
            if (url.includes('difficulty=hard')) return 'AniQuizAPI-Hard';
            if (url.includes('difficulty=easy')) return 'AniQuizAPI-Easy';
            return 'AniQuizAPI-Medium';
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
}

module.exports = QuestionLoader;
