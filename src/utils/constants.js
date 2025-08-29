const { FALLBACK_QUESTIONS, ANIME_KEYWORDS, BAD_KEYWORDS, ANIME_TITLES } = require('./constants');

class QuestionLoader {
    constructor() {
        this.apiEndpoints = [
            'https://opentdb.com/api.php?amount=5&category=31&type=multiple',
            'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=5'
        ];
    }

    async loadQuestions(avoidQuestions = new Set()) {
        try {
            console.log('🔄 Loading anime quiz questions...');
            
            const questions = [];
            const usedQuestions = new Set();
            
            // Try to get questions from APIs
            const apiQuestions = await this.fetchFromAPIs(avoidQuestions);
            
            // Add valid API questions
            for (const question of apiQuestions) {
                if (questions.length >= 10) break;
                
                const questionKey = question.question.toLowerCase().trim();
                if (!usedQuestions.has(questionKey) && !avoidQuestions.has(questionKey)) {
                    questions.push(question);
                    usedQuestions.add(questionKey);
                }
            }
            
            // Fill remaining slots with fallback questions
            if (questions.length < 10) {
                console.log(`🛡️ Using fallback questions to fill remaining ${10 - questions.length} slots`);
                
                const fallbackQuestions = this.getFallbackQuestions(avoidQuestions, usedQuestions);
                
                for (const question of fallbackQuestions) {
                    if (questions.length >= 10) break;
                    
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
            return this.getFallbackQuestions(avoidQuestions, new Set());
        }
    }

    async fetchFromAPIs(avoidQuestions) {
        const allQuestions = [];
        
        for (const apiUrl of this.apiEndpoints) {
            try {
                console.log(`📡 Fetching from API: ${this.getAPIName(apiUrl)}`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
                
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
                    continue;
                }
                
                const data = await response.json();
                const questions = this.parseAPIResponse(data, apiUrl);
                
                // Filter and validate questions
                const validQuestions = questions.filter(q => this.isValidQuestion(q, avoidQuestions));
                
                allQuestions.push(...validQuestions);
                
                console.log(`✅ Got ${validQuestions.length} valid questions from ${this.getAPIName(apiUrl)}`);
                
            } catch (error) {
                console.warn(`⚠️ API ${this.getAPIName(apiUrl)} failed: ${error.message}`);
            }
        }
        
        return allQuestions;
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
            
            return true;
            
        } catch (error) {
            console.error('❌ Error validating question:', error);
            return false;
        }
    }

    getFallbackQuestions(avoidQuestions, usedQuestions) {
        const allFallbacks = [
            ...FALLBACK_QUESTIONS.Easy,
            ...FALLBACK_QUESTIONS.Medium,
            ...FALLBACK_QUESTIONS.Hard
        ];
        
        // Filter out avoided and already used questions
        const availableFallbacks = allFallbacks.filter(question => {
            const questionKey = question.question.toLowerCase().trim();
            return !avoidQuestions.has(questionKey) && !usedQuestions.has(questionKey);
        });
        
        if (availableFallbacks.length === 0) {
            console.warn('⚠️ All fallback questions have been used, resetting...');
            return allFallbacks.slice(0, 10);
        }
        
        // Shuffle and return up to 10 questions
        this.shuffleArray(availableFallbacks);
        return availableFallbacks.slice(0, 10);
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
            .trim();
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    getAPIName(url) {
        if (url.includes('opentdb.com')) return 'OpenTDB';
        if (url.includes('trivia-api.com')) return 'TriviaAPI';
        return 'Unknown';
    }
}

module.exports = QuestionLoader;
