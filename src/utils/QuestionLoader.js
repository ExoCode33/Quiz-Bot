const { FALLBACK_QUESTIONS, ANIME_KEYWORDS, BAD_KEYWORDS, ANIME_TITLES } = require('./constants');

class QuestionLoader {
    constructor() {
        this.apiEndpoints = [
            'https://opentdb.com/api.php?amount=8&category=31&type=multiple', // Increased from 5 to 8
            'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=8' // Increased from 5 to 8
        ];
    }

    async loadQuestions(avoidQuestions = new Set(), targetCount = 13) {
        try {
            console.log(`🔄 Loading ${targetCount} anime quiz questions...`);
            
            const questions = [];
            const usedQuestions = new Set();
            
            // Try to get questions from APIs first
            const apiQuestions = await this.fetchFromAPIs(avoidQuestions);
            
            // Add valid API questions
            for (const question of apiQuestions) {
                if (questions.length >= targetCount) break;
                
                const questionKey = question.question.toLowerCase().trim();
                if (!usedQuestions.has(questionKey) && !avoidQuestions.has(questionKey)) {
                    questions.push(question);
                    usedQuestions.add(questionKey);
                }
            }
            
            // Fill remaining slots with fallback questions
            if (questions.length < targetCount) {
                console.log(`🛡️ Using fallback questions to fill remaining ${targetCount - questions.length} slots`);
                
                const fallbackQuestions = this.getFallbackQuestions(avoidQuestions, usedQuestions, targetCount - questions.length);
                
                for (const question of fallbackQuestions) {
                    if (questions.length >= targetCount) break;
                    
                    const questionKey = question.question.toLowerCase().trim();
                    if (!usedQuestions.has(questionKey)) {
                        questions.push(question);
                        usedQuestions.add(questionKey);
                    }
                }
            }
            
            // Shuffle the final question order
            this.shuffleArray(questions);
            
            console.log(`✅ Loaded ${questions.length} questions (${apiQuestions.length} from API, ${questions.length - apiQuestions.length} fallback)`);
            
            return questions;
            
        } catch (error) {
            console.error('❌ Error loading questions:', error);
            
            // Return fallback questions only
            return this.getFallbackQuestions(avoidQuestions, new Set(), targetCount);
        }
    }

    async fetchFromAPIs(avoidQuestions) {
        const allQuestions = [];
        
        // Use Promise.allSettled for concurrent API calls
        const apiPromises = this.apiEndpoints.map(apiUrl => this.fetchFromSingleAPI(apiUrl, avoidQuestions));
        const results = await Promise.allSettled(apiPromises);
        
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                allQuestions.push(...result.value);
            }
        }
        
        // Shuffle combined results
        this.shuffleArray(allQuestions);
        
        return allQuestions;
    }

    async fetchFromSingleAPI(apiUrl, avoidQuestions) {
        try {
            console.log(`📡 Fetching from API: ${this.getAPIName(apiUrl)}`);
            
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
                console.warn(`⚠️ API ${this.getAPIName(apiUrl)} returned status ${response.status}`);
                return [];
            }
            
            const data = await response.json();
            const questions = this.parseAPIResponse(data, apiUrl);
            
            // Filter and validate questions
            const validQuestions = questions.filter(q => this.isValidQuestion(q, avoidQuestions));
            
            console.log(`✅ Got ${validQuestions.length} valid questions from ${this.getAPIName(apiUrl)}`);
            return validQuestions;
            
        } catch (error) {
            console.warn(`⚠️ API ${this.getAPIName(apiUrl)} failed: ${error.message}`);
            return [];
        }
    }

    parseAPIResponse(data, apiUrl) {
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
                        
                        // Shuffle options
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
                        
                        // Shuffle options
                        this.shuffleArray(question.options);
                        questions.push(question);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error parsing API response:', error);
        }
        
        return questions;
    }

    isValidQuestion(question, avoidQuestions) {
        try {
            // Basic validation
            if (!question.question || !question.answer || !question.options || question.options.length < 2) {
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
            
            // Check question length (avoid too long questions for Discord)
            if (question.question.length > 200) {
                return false;
            }
            
            // Check if options are reasonable length
            const hasLongOptions = question.options.some(opt => opt.length > 80);
            if (hasLongOptions) {
                return false;
            }
            
            // Filter out bad keywords (production/technical questions)
            const hasBadKeyword = BAD_KEYWORDS.some(keyword => 
                questionLower.includes(keyword.toLowerCase())
            );
            
            if (hasBadKeyword) {
                // Check if it has allowed patterns (like voice actor questions)
                const hasAllowedPattern = [
                    'voice.*actor', 'voiced by', 'seiyuu', 'dub.*actor',
                    'year.*air', 'when.*air', 'what year.*release'
                ].some(pattern => new RegExp(pattern, 'i').test(questionLower));
                
                if (!hasAllowedPattern) {
                    return false;
                }
            }
            
            // Require anime content
            const hasAnimeContent = ANIME_KEYWORDS.some(keyword => 
                questionLower.includes(keyword.toLowerCase())
            ) || ANIME_TITLES.some(title => 
                questionLower.includes(title.toLowerCase())
            );
            
            if (!hasAnimeContent) {
                return false;
            }
            
            // Additional quality checks
            
            // Avoid questions with too many numbers (usually statistics)
            const numberCount = (question.question.match(/\d+/g) || []).length;
            if (numberCount > 2) {
                return false;
            }
            
            // Avoid questions with multiple choice indicators in the question text
            if (/\b(a\)|b\)|c\)|d\)|\(a\)|\(b\)|\(c\)|\(d\))/i.test(questionLower)) {
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Error validating question:', error);
            return false;
        }
    }

    getFallbackQuestions(avoidQuestions, usedQuestions, targetCount = 13) {
        // Combine all fallback questions with balanced difficulty
        const easyQuestions = [...FALLBACK_QUESTIONS.Easy];
        const mediumQuestions = [...FALLBACK_QUESTIONS.Medium];
        const hardQuestions = [...FALLBACK_QUESTIONS.Hard];
        
        // Shuffle each difficulty category
        this.shuffleArray(easyQuestions);
        this.shuffleArray(mediumQuestions);
        this.shuffleArray(hardQuestions);
        
        // Create balanced mix: 40% easy, 40% medium, 20% hard
        const easyCount = Math.ceil(targetCount * 0.4);
        const mediumCount = Math.ceil(targetCount * 0.4);
        const hardCount = targetCount - easyCount - mediumCount;
        
        const balancedQuestions = [
            ...easyQuestions.slice(0, easyCount),
            ...mediumQuestions.slice(0, mediumCount),
            ...hardQuestions.slice(0, hardCount)
        ];
        
        // Filter out avoided and already used questions
        const availableFallbacks = balancedQuestions.filter(question => {
            const questionKey = question.question.toLowerCase().trim();
            return !avoidQuestions.has(questionKey) && !usedQuestions.has(questionKey);
        });
        
        // If we don't have enough unique questions, add more from any category
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
        
        // Final shuffle and limit to target count
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
        if (url.includes('opentdb.com')) return 'OpenTDB';
        if (url.includes('trivia-api.com')) return 'TriviaAPI';
        return 'Unknown';
    }

    // Get question statistics
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
