const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const QuestionLoader = require('../utils/QuestionLoader');
const { TIER_COLORS, TIER_NAMES, TIER_EMOJIS, TIER_DESCRIPTIONS, FALLBACK_QUESTIONS } = require('../utils/constants');
const path = require('path');
const fs = require('fs');

class QuizManager {
    constructor(client, databaseManager, redisManager) {
        this.client = client;
        this.db = databaseManager;
        this.redis = redisManager;
        this.questionLoader = new QuestionLoader();
        
        // In-memory fallback for active quizzes
        this.activeQuizzes = new Map();
        
        // Time limit intervals
        this.timeIntervals = new Map();
        
        // Preloaded questions cache
        this.preloadedQuestions = new Map();
        
        // GIF path for consistent usage
        this.gifPath = path.join(process.cwd(), 'assets', 'anime.gif');
    }

    // Check if user already completed quiz today
    async hasCompletedToday(userId, guildId) {
        try {
            // Check Redis first
            if (this.redis?.connected) {
                const completion = await this.redis.getQuizCompletion(userId, guildId);
                if (completion) {
                    return completion;
                }
            }
            
            // Fallback to database
            const completion = await this.db.getQuizCompletion(userId, guildId);
            return completion;
            
        } catch (error) {
            console.error('Error checking quiz completion:', error);
            return null;
        }
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
            const questions = await this.questionLoader.loadQuestions(recentQuestions, 13);
            
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
                
                // Improved, organized logging with actual answers shown
                console.log(`\n🌸 Nico Robin's Library - Questions Preloaded for User ${userId}`);
                console.log('═══════════════════════════════════════════════════════════════════');
                questions.forEach((question, index) => {
                    console.log(`\x1b[36mQuestion ${(index + 1).toString().padStart(2, '0')}\x1b[0m: ${question.question}`);
                    console.log(`\x1b[32mAnswer ${(index + 1).toString().padStart(2, '0')}\x1b[0m:   ${question.answer}`);
                    console.log('───────────────────────────────────────────────────────────────────');
                });
                console.log(`\x1b[35m✅ Quiz ready with ${questions.length} questions - All answers logged above\x1b[0m\n`);
                
                return questions;
            }

            return [];
            
        } catch (error) {
            console.error('Error preloading questions:', error);
            return [];
        }
    }

    // Helper method to create and manage GIF attachment
    createGifAttachment() {
        try {
            if (fs.existsSync(this.gifPath)) {
                // Create a new attachment each time to ensure GIF restarts
                return new AttachmentBuilder(this.gifPath, { name: `anime_${Date.now()}.gif` });
            }
        } catch (error) {
            console.warn('⚠️ Error loading anime.gif:', error.message);
        }
        return null;
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

    // Start a new quiz
    async startQuiz(interaction, userId, guildId) {
        try {
            // Check if already completed today
            const existingCompletion = await this.hasCompletedToday(userId, guildId);
            if (existingCompletion) {
                return await this.showAlreadyCompleted(interaction, existingCompletion);
            }

            // Check if already has active quiz
            if (this.hasActiveQuiz(userId, guildId)) {
                return await interaction.editReply({
                    content: '❌ **Active Quiz Detected**\n\nYou already have an active quiz. Complete it first!',
                    components: []
                });
            }

            // Use preloaded questions for instant start
            const questions = await this.preloadQuestions(userId, guildId);
            if (!questions || questions.length < 10) {
                return await interaction.editReply({
                    content: '❌ **Failed to Load Questions**\n\nUnable to prepare your quiz. Please try again later!',
                    components: []
                });
            }

            // Display all questions in Railway logs only
            this.logAllQuestionsToConsole(questions, userId);

            // Initialize quiz session with first 10 questions
            const quizSession = {
                userId,
                guildId,
                questions: questions.slice(0, 10), // Use first 10 for quiz
                extraQuestions: questions.slice(10), // Keep extras for rerolls
                currentQuestion: 0,
                score: 0,
                answers: [],
                startTime: Date.now(),
                timeRemaining: parseInt(process.env.QUESTION_TIME_LIMIT) || 20,
                rerollsUsed: 0
            };

            // Save quiz session
            await this.saveQuizSession(userId, guildId, quizSession);

            // Start first question immediately
            await this.askQuestion(interaction, quizSession);

        } catch (error) {
            console.error('Error starting quiz:', error);
            await interaction.editReply({
                content: '❌ **Error**\n\nSomething went wrong. Please try again!',
                components: []
            });
        }
    }

    // Log all questions and answers to Railway console only
    logAllQuestionsToConsole(questions, userId) {
        console.log(`\n🎯 ═══════════════════════════════════════════════════════════════`);
        console.log(`🎯 QUIZ DEBUG - ALL ${questions.length} QUESTIONS FOR USER ${userId}`);
        console.log(`🎯 ═══════════════════════════════════════════════════════════════`);
        
        questions.forEach((question, index) => {
            const questionNum = (index + 1).toString().padStart(2, '0');
            console.log(`\x1b[36mQ${questionNum}: ${question.question}\x1b[0m`);
            console.log(`\x1b[32mA${questionNum}: ${question.answer}\x1b[0m`);
            console.log(`${'─'.repeat(65)}`);
        });
        
        console.log(`🎯 ═══════════════════════════════════════════════════════════════`);
        console.log(`🎯 QUIZ STARTING NOW FOR USER ${userId}`);
        console.log(`🎯 ═══════════════════════════════════════════════════════════════\n`);
    }

    async loadQuestions(userId, guildId) {
        // This method is kept for backward compatibility but now uses preloadQuestions
        return await this.preloadQuestions(userId, guildId);
    }

    async getRecentQuestions(userId, guildId) {
        try {
            const recentSet = new Set();
            
            // Get from Redis (faster)
            if (this.redis?.connected) {
                const redisRecent = await this.redis.getRecentQuestions(userId, guildId);
                redisRecent.forEach(hash => recentSet.add(hash));
            }
            
            // Get from database (more comprehensive)
            const dbRecent = await this.db.getRecentQuestions(userId, guildId);
            dbRecent.forEach(row => {
                recentSet.add(row.question_hash);
                recentSet.add(row.question_text.toLowerCase().trim());
            });
            
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
            
            // Save to database (async, don't wait)
            this.db.saveQuestionHistory(userId, guildId, questionHash, questionText).catch(console.error);
            
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

    async saveQuizSession(userId, guildId, session) {
        try {
            // Save to Redis with shorter expiry for faster access
            if (this.redis?.connected) {
                await this.redis.setActiveQuiz(userId, guildId, session, 20 * 60); // 20 minutes
            }
            
            // Fallback to memory
            this.activeQuizzes.set(`${userId}_${guildId}`, session);
            
        } catch (error) {
            console.error('Error saving quiz session:', error);
        }
    }

    async getQuizSession(userId, guildId) {
        try {
            // Check memory first (fastest)
            const memorySession = this.activeQuizzes.get(`${userId}_${guildId}`);
            if (memorySession) {
                return memorySession;
            }
            
            // Check Redis
            if (this.redis?.connected) {
                const session = await this.redis.getActiveQuiz(userId, guildId);
                if (session) {
                    // Cache in memory
                    this.activeQuizzes.set(`${userId}_${guildId}`, session);
                    return session;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('Error getting quiz session:', error);
            return null;
        }
    }

    hasActiveQuiz(userId, guildId) {
        // Check memory first (faster)
        return this.activeQuizzes.has(`${userId}_${guildId}`);
    }

    async askQuestion(interaction, session) {
        try {
            const question = session.questions[session.currentQuestion];
            const questionNum = session.currentQuestion + 1;
            
            // Reset time remaining
            session.timeRemaining = parseInt(process.env.QUESTION_TIME_LIMIT) || 20;
            
            // Dynamic color based on progress
            let embedColor = '#4A90E2';
            if (session.score >= 7) embedColor = '#FF9800';
            else if (session.score >= 4) embedColor = '#9C27B0';
            else if (session.score >= 2) embedColor = '#2196F3';

            // Create GIF attachment that restarts each time
            const gifAttachment = this.createGifAttachment();
            
            // Create question embed with Nico Robin theme + GIF at the top
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`⚔️ Question ${questionNum}/10`)
                .setDescription(`**"Let me read this passage for you..."**\n\n${question.question}`)
                .addFields(
                    {
                        name: '🗺️ Progress',
                        value: this.createProgressBar(session.currentQuestion, session.answers),
                        inline: false
                    },
                    {
                        name: '⏱️ Time Remaining',
                        value: this.createTimeBar(session.timeRemaining),
                        inline: false
                    },
                    {
                        name: '🏆 Score',
                        value: `${session.score}/${session.currentQuestion + 1}`,
                        inline: true
                    },
                    {
                        name: '⚡ Difficulty',
                        value: `${this.getDifficultyEmoji(question.difficulty)} ${question.difficulty || 'Medium'}`,
                        inline: true
                    },
                    {
                        name: '🎯 Current Buff',
                        value: session.score > 0 ? `${TIER_EMOJIS[session.score]} ${TIER_NAMES[session.score]}` : '💀 None',
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `Choose wisely • ${questionNum}/${process.env.TOTAL_QUESTIONS || 10}`
                })
                .setTimestamp();

            // Add GIF at the top of the embed (main image position)
            if (gifAttachment) {
                embed.setImage(`attachment://${gifAttachment.name}`);
            }

            // Create answer buttons
            const buttonEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
            const buttons = question.options.map((option, index) => 
                new ButtonBuilder()
                    .setCustomId(`answer_${session.userId}_${index}_${option === question.answer}`)
                    .setLabel(option.substring(0, 65))
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(buttonEmojis[index])
            );

            // Add reroll button if rerolls available and extra questions exist
            const components = [
                new ActionRowBuilder().addComponents(buttons.slice(0, 2)),
                new ActionRowBuilder().addComponents(buttons.slice(2, 4))
            ];

            if (session.rerollsUsed < 3 && session.extraQuestions && session.extraQuestions.length > 0) {
                const rerollButton = new ButtonBuilder()
                    .setCustomId(`reroll_${session.userId}`)
                    .setLabel(`Reroll Question (${session.rerollsUsed}/3)`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🎲');
                
                components.push(new ActionRowBuilder().addComponents(rerollButton));
            }

            let message;
            const messageData = { embeds: [embed], components };
            if (gifAttachment) {
                messageData.files = [gifAttachment];
            }

            if (session.currentQuestion === 0) {
                await interaction.editReply(messageData);
                message = await interaction.fetchReply();
            } else {
                message = await interaction.followUp(messageData);
            }

            // Enhanced logging with actual question and answer details
            console.log(`\n🎯 Quiz Question Asked - User ${session.userId}`);
            console.log(`Question ${questionNum}: ${question.question}`);
            console.log(`✅ Correct Answer: ${question.answer}`);
            console.log(`📋 All Options: ${question.options.join(' | ')}`);
            console.log(`⏱️ Time Limit: ${session.timeRemaining} seconds\n`);

            // Start time countdown
            await this.startTimeCountdown(interaction, session, message);

            // Set up collector
            const collector = message.createMessageComponentCollector({
                time: (parseInt(process.env.QUESTION_TIME_LIMIT) || 20) * 1000,
                filter: i => i.user.id === session.userId && (i.customId.startsWith('answer_') || i.customId.startsWith('reroll_'))
            });

            collector.on('collect', async (buttonInteraction) => {
                this.clearTimeInterval(session.userId, session.guildId);
                
                if (buttonInteraction.customId.startsWith('reroll_')) {
                    await this.handleReroll(buttonInteraction, interaction, session);
                } else {
                    await this.handleAnswerSelection(buttonInteraction, interaction, session);
                }
                collector.stop();
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    this.clearTimeInterval(session.userId, session.guildId);
                    await this.handleTimeout(interaction, session);
                }
            });

        } catch (error) {
            console.error('Error asking question:', error);
        }
    }

    getDifficultyEmoji(difficulty) {
        switch ((difficulty || 'Medium').toLowerCase()) {
            case 'easy': return '🟢';
            case 'medium': return '🟡';
            case 'hard': return '🔴';
            default: return '🟡';
        }
    }

    async startTimeCountdown(interaction, session, message) {
        const timeLimit = parseInt(process.env.QUESTION_TIME_LIMIT) || 20;
        session.timeRemaining = timeLimit;
        
        const intervalKey = `${session.userId}_${session.guildId}`;
        
        // Clear any existing interval
        this.clearTimeInterval(session.userId, session.guildId);
        
        // Start new interval
        const interval = setInterval(async () => {
            session.timeRemaining -= 2;
            
            if (session.timeRemaining <= 0) {
                this.clearTimeInterval(session.userId, session.guildId);
                return;
            }
            
            try {
                const question = session.questions[session.currentQuestion];
                const questionNum = session.currentQuestion + 1;
                
                // Dynamic color based on time remaining
                let embedColor = '#4A90E2';
                if (session.timeRemaining <= 6) {
                    embedColor = '#FF0000';
                } else if (session.timeRemaining <= 12) {
                    embedColor = '#FFA500';
                } else {
                    if (session.score >= 7) embedColor = '#FF9800';
                    else if (session.score >= 4) embedColor = '#9C27B0';
                    else if (session.score >= 2) embedColor = '#2196F3';
                }
                
                // Create fresh GIF attachment to ensure restart
                const gifAttachment = this.createGifAttachment();
                
                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(`⚔️ Question ${questionNum}/10`)
                    .setDescription(`**"Let me read this passage for you..."**\n\n${question.question}`)
                    .addFields(
                        {
                            name: '🗺️ Progress',
                            value: this.createProgressBar(session.currentQuestion, session.answers),
                            inline: false
                        },
                        {
                            name: '⏱️ Time Remaining',
                            value: this.createTimeBar(session.timeRemaining),
                            inline: false
                        },
                        {
                            name: '🏆 Score',
                            value: `${session.score}/${session.currentQuestion + 1}`,
                            inline: true
                        },
                        {
                            name: '⚡ Difficulty',
                            value: `${this.getDifficultyEmoji(question.difficulty)} ${question.difficulty || 'Medium'}`,
                            inline: true
                        },
                        {
                            name: '🎯 Current Buff',
                            value: session.score > 0 ? `${TIER_EMOJIS[session.score]} ${TIER_NAMES[session.score]}` : '💀 None',
                            inline: true
                        }
                    )
                    .setFooter({ 
                        text: session.timeRemaining <= 6 ? 
                            '⚠️ "Time is running out, archaeologist!"' : 
                            `Choose wisely • ${questionNum}/${process.env.TOTAL_QUESTIONS || 10}`
                    })
                    .setTimestamp();
                
                // Keep GIF at the top during countdown
                if (gifAttachment) {
                    embed.setImage(`attachment://${gifAttachment.name}`);
                }
                
                const updateData = { embeds: [embed] };
                if (gifAttachment) {
                    updateData.files = [gifAttachment];
                }
                
                await message.edit(updateData);
                
            } catch (error) {
                this.clearTimeInterval(session.userId, session.guildId);
            }
        }, 2000);
        
        this.timeIntervals.set(intervalKey, interval);
    }

    async handleReroll(buttonInteraction, originalInteraction, session) {
        try {
            await buttonInteraction.deferUpdate();
            
            // Check if extra questions are available
            if (!session.extraQuestions || session.extraQuestions.length === 0) {
                return await buttonInteraction.followUp({
                    content: '❌ No more questions available for reroll!',
                    ephemeral: true
                });
            }
            
            // Use next extra question
            const newQuestion = session.extraQuestions.shift();
            session.questions[session.currentQuestion] = newQuestion;
            session.rerollsUsed++;
            
            console.log(`🎲 Rerolled question ${session.currentQuestion + 1} for user ${session.userId} (${session.rerollsUsed}/3)`);
            console.log(`New Question: ${newQuestion.question}`);
            console.log(`New Answer: ${newQuestion.answer}`);
            
            // Update session
            await this.saveQuizSession(session.userId, session.guildId, session);
            
            // Restart the question with new question
            await this.askQuestion(originalInteraction, session);
            
        } catch (error) {
            console.error('Error handling reroll:', error);
        }
    }

    clearTimeInterval(userId, guildId) {
        const intervalKey = `${userId}_${guildId}`;
        const interval = this.timeIntervals.get(intervalKey);
        
        if (interval) {
            clearInterval(interval);
            this.timeIntervals.delete(intervalKey);
        }
    }

    async handleAnswerSelection(buttonInteraction, originalInteraction, session) {
        try {
            await buttonInteraction.deferUpdate();
            
            const customId = buttonInteraction.customId;
            const parts = customId.split('_');
            const selectedIndex = parseInt(parts[2]);
            const isCorrect = parts[3] === 'true';
            
            const question = session.questions[session.currentQuestion];
            const selectedAnswer = question.options[selectedIndex];
            
            // Record answer
            session.answers.push({
                questionIndex: session.currentQuestion,
                selectedAnswer,
                correctAnswer: question.answer,
                isCorrect
            });
            
            if (isCorrect) {
                session.score++;
            }

            // Enhanced answer logging
            console.log(`\n🎯 Answer Received - Question ${session.currentQuestion + 1}`);
            console.log(`User: ${session.userId} | ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
            console.log(`Question: ${question.question}`);
            console.log(`Selected: ${selectedAnswer}`);
            console.log(`Correct:  ${question.answer}`);
            console.log(`Score: ${session.score}/${session.currentQuestion + 1}\n`);
            
            // Move to next question or end quiz
            session.currentQuestion++;
            
            if (isCorrect) {
                // For correct answers, go straight to continuation or end quiz
                if (session.currentQuestion >= 10) {
                    await this.endQuiz(originalInteraction, session);
                } else {
                    await this.askContinuation(originalInteraction, session);
                }
            } else {
                // For incorrect answers, show the answer reveal first
                await this.showAnswerReveal(buttonInteraction, session, isCorrect, selectedAnswer, question.answer);
                
                setTimeout(async () => {
                    if (session.currentQuestion >= 10) {
                        await this.endQuiz(originalInteraction, session);
                    } else {
                        await this.askContinuation(originalInteraction, session);
                    }
                }, 5000);
            }
            
        } catch (error) {
            console.error('Error handling answer selection:', error);
        }
    }

    async showAnswerReveal(interaction, session, isCorrect, selectedAnswer, correctAnswer) {
        try {
            const questionNum = session.currentQuestion + 1;
            
            // Create fresh GIF attachment for answer reveal
            const gifAttachment = this.createGifAttachment();
            
            const embed = new EmbedBuilder()
                .setColor(isCorrect ? '#00FF00' : '#FF0000')
                .setTitle('🌸 Continue Your Studies?')
                .setDescription(`**Ancient Text ${questionNum} Deciphered!**\n\n${isCorrect ? '📚 **"Excellent translation!"**' : '💀 **"Let me correct that for you..."**'}\n${isCorrect ? `**Your Answer:** ${selectedAnswer}` : `**Your Translation:** ${selectedAnswer}\n**Correct Reading:** ${correctAnswer}`}`)
                .addFields(
                    {
                        name: '📊 Research Progress',
                        value: `**${questionNum}/10** texts studied • **${session.score}** correct translations • **${Math.round((session.score / questionNum) * 100)}%** accuracy`,
                        inline: false
                    },
                    {
                        name: '🔍 Archaeological Journey',
                        value: this.createProgressBar(session.currentQuestion + 1, session.answers),
                        inline: false
                    },
                    {
                        name: '🏺 Current Ancient Power',
                        value: session.score > 0 ? 
                            `${TIER_EMOJIS[session.score]} **${TIER_NAMES[session.score]}**` : 
                            '💀 **No Ancient Knowledge Yet**',
                        inline: true
                    },
                    {
                        name: '📜 Texts Remaining',
                        value: `**${10 - questionNum}** ancient texts left to study`,
                        inline: true
                    }
                )
                .setFooter({ text: '⚠️ "Preparing the next ancient text..."' })
                .setTimestamp();

            // Keep GIF at the top for answer reveal
            if (gifAttachment) {
                embed.setImage(`attachment://${gifAttachment.name}`);
            }

            const updateData = { embeds: [embed], components: [] };
            if (gifAttachment) {
                updateData.files = [gifAttachment];
            }

            await interaction.editReply(updateData);
            
        } catch (error) {
            console.error('Error showing answer reveal:', error);
        }
    }

    async askContinuation(interaction, session) {
        try {
            const questionNum = session.currentQuestion + 1;
            
            // Determine embed color based on current performance
            let embedColor = '#FF9800';
            if (session.score >= 7) embedColor = '#4CAF50';
            else if (session.score >= 4) embedColor = '#2196F3';
            else if (session.score >= 2) embedColor = '#FFC107';
            else embedColor = '#FF5722';
            
            // Get rarity information for current score
            const { TIER_RARITIES } = require('../utils/constants');
            const currentRarity = session.score > 0 ? TIER_RARITIES[session.score] : 'No Rarity';
            
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle('🌊 Continue Quiz?')
                .setDescription(`**Question ${questionNum} Complete!**`)
                .addFields(
                    {
                        name: '📊 Progress',
                        value: `**${questionNum}/10** completed • **${session.score}** correct • **${Math.round((session.score / questionNum) * 100)}%** success`,
                        inline: false
                    },
                    {
                        name: '🗺️ Journey',
                        value: this.createProgressBar(session.currentQuestion, session.answers),
                        inline: false
                    },
                    {
                        name: '🏆 Current Power',
                        value: session.score > 0 ? 
                            `**${currentRarity}**\n${TIER_EMOJIS[session.score]} **${TIER_NAMES[session.score]}**` : 
                            '**No Rarity**\n💀 **No Buff Yet**',
                        inline: true
                    },
                    {
                        name: '⚔️ Remaining',
                        value: `**${10 - questionNum}** questions left`,
                        inline: true
                    }
                )
                .setFooter({ text: '⚠️ 60 seconds to decide • No response = Quiz abandoned' })
                .setTimestamp();

            // NO GIF on continuation screen
            const buttons = [
                new ButtonBuilder()
                    .setCustomId(`continue_${session.userId}`)
                    .setLabel('Continue')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('⚔️'),
                new ButtonBuilder()
                    .setCustomId(`abandon_${session.userId}`)
                    .setLabel('Abandon')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🏳️')
            ];

            const row = new ActionRowBuilder().addComponents(buttons);
            
            const messageData = { embeds: [embed], components: [row] };
            
            const message = await interaction.followUp(messageData);

            const collector = message.createMessageComponentCollector({
                time: 60000,
                filter: i => i.user.id === session.userId && (i.customId === `continue_${session.userId}` || i.customId === `abandon_${session.userId}`)
            });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.customId === `continue_${session.userId}`) {
                    // Remove the "Onward!" loading screen, go directly to next question
                    await this.saveQuizSession(session.userId, session.guildId, session);
                    await this.askQuestion(interaction, session);
                    
                } else {
                    await this.handleAbandon(buttonInteraction, session);
                }
                collector.stop();
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    await this.handleTimeout(interaction, session, true);
                }
            });

        } catch (error) {
            console.error('Error asking continuation:', error);
        }
    }

    async handleAbandon(interaction, session) {
        try {
            // NO GIF for abandon screen
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🏳️ Quiz Abandoned')
                .setDescription(`**Quiz End**\n\nYou've decided to end your quiz here.\n\n**Final Progress:** ${session.score}/${session.currentQuestion} correct\n\n*No role will be granted for incomplete quizzes.*`)
                .setFooter({ text: 'Return tomorrow for a new quiz!' })
                .setTimestamp();
            
            await interaction.update({ embeds: [embed], components: [] });
            
            // Clean up session
            await this.cleanupQuizSession(session.userId, session.guildId);
            
            console.log(`🏳️ Quiz abandoned by user ${session.userId} at question ${session.currentQuestion + 1}`);
            
        } catch (error) {
            console.error('Error handling abandon:', error);
        }
    }

    async handleTimeout(interaction, session, isContinuation = false) {
        try {
            // Create fresh GIF for timeout screen
            const gifAttachment = this.createGifAttachment();
            
            if (!isContinuation) {
                // Question timeout
                const question = session.questions[session.currentQuestion];
                session.answers.push({
                    questionIndex: session.currentQuestion,
                    selectedAnswer: 'No answer (timeout)',
                    correctAnswer: question.answer,
                    isCorrect: false
                });
                
                console.log(`⏰ TIMEOUT - Question ${session.currentQuestion + 1} for user ${session.userId}`);
                console.log(`Correct Answer: ${question.answer}`);
                
                // Show timeout message
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('⏰ Time\'s Up!')
                    .setDescription(`**Correct Answer:** ${question.answer}`)
                    .setFooter({ text: 'Next question...' });
                
                // Keep GIF at the top for timeout message
                if (gifAttachment) {
                    embed.setImage(`attachment://${gifAttachment.name}`);
                }
                
                const messageData = { embeds: [embed] };
                if (gifAttachment) {
                    messageData.files = [gifAttachment];
                }
                
                await interaction.followUp(messageData);
                
                // Move to next question
                session.currentQuestion++;
                
                if (session.currentQuestion >= 10) {
                    setTimeout(async () => {
                        await this.endQuiz(interaction, session);
                    }, 3000);
                } else {
                    setTimeout(async () => {
                        await this.askContinuation(interaction, session);
                    }, 3000);
                }
            } else {
                // Continuation timeout
                const embed = new EmbedBuilder()
                    .setColor('#808080')
                    .setTitle('⏰ Quiz Abandoned')
                    .setDescription(`**No response received**\n\nYour quiz ends here due to inactivity.\n\n**Final Progress:** ${session.score}/${session.currentQuestion} correct\n\n*No role will be granted for incomplete quizzes.*`)
                    .setFooter({ text: 'Return tomorrow for a new quiz!' })
                    .setTimestamp();
                
                // Keep GIF at the top for continuation timeout
                if (gifAttachment) {
                    embed.setImage(`attachment://${gifAttachment.name}`);
                }
                
                const messageData = { embeds: [embed] };
                if (gifAttachment) {
                    messageData.files = [gifAttachment];
                }
                
                await interaction.followUp(messageData);
                
                // Clean up session
                await this.cleanupQuizSession(session.userId, session.guildId);
                
                console.log(`⏰ Quiz abandoned due to inactivity - user ${session.userId}`);
            }
            
        } catch (error) {
            console.error('Error handling timeout:', error);
        }
    }

    async endQuiz(interaction, session) {
        try {
            const tier = session.score;
            const completionTime = Date.now() - session.startTime;
            
            console.log(`\n🏁 Quiz Completed - User ${session.userId}`);
            console.log(`Final Score: ${session.score}/10`);
            console.log(`Tier Achieved: ${tier}`);
            console.log(`Completion Time: ${Math.floor(completionTime / 60000)}:${Math.floor((completionTime % 60000) / 1000).toString().padStart(2, '0')}`);
            
            // Save completion
            await this.saveCompletion(session.userId, session.guildId, session.score, tier);
            
            // Apply tier role
            await this.applyTierRole(interaction.guild, session.userId, tier);
            
            // Clean up quiz session
            await this.cleanupQuizSession(session.userId, session.guildId);
            
            // Show final results
            await this.showFinalResults(interaction, session, tier, completionTime);
            
        } catch (error) {
            console.error('Error ending quiz:', error);
        }
    }

    async saveCompletion(userId, guildId, score, tier) {
        try {
            // Save to Redis
            if (this.redis?.connected) {
                await this.redis.setQuizCompletion(userId, guildId, score, tier);
            }
            
            // Save to database
            await this.db.saveQuizCompletion(userId, guildId, score, tier);
            
        } catch (error) {
            console.error('Error saving completion:', error);
        }
    }

    async applyTierRole(guild, userId, tier) {
        try {
            if (tier === 0) {
                console.log(`⚠️ No role applied for user ${userId} - score was 0`);
                return;
            }
            
            const member = await guild.members.fetch(userId);
            if (!member) {
                console.warn(`⚠️ Member not found: ${userId}`);
                return;
            }
            
            // Remove all existing tier roles
            for (let i = 1; i <= 10; i++) {
                const roleId = process.env[`TIER_${i}_ROLE`];
                if (roleId && member.roles.cache.has(roleId)) {
                    const role = guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.remove(role, 'Removing old tier role');
                        console.log(`✅ Removed old Tier ${i} role from ${member.user.username}`);
                    }
                }
            }
            
            // Apply new tier role
            const newRoleId = process.env[`TIER_${tier}_ROLE`];
            if (newRoleId) {
                const newRole = guild.roles.cache.get(newRoleId);
                if (newRole) {
                    await member.roles.add(newRole, `Quiz completion - Tier ${tier} (${tier}/10 correct)`);
                    console.log(`✅ Applied Tier ${tier} role to user ${userId} for ${tier}/10 correct answers`);
                } else {
                    console.warn(`⚠️ Tier ${tier} role not found in guild: ${newRoleId}`);
                }
            } else {
                console.warn(`⚠️ Tier ${tier} role not configured in environment`);
            }
            
        } catch (error) {
            console.error(`❌ Error applying tier role for user ${userId}:`, error);
        }
    }

    async cleanupQuizSession(userId, guildId) {
        try {
            // Clear time intervals
            this.clearTimeInterval(userId, guildId);
            
            // Remove from Redis
            if (this.redis?.connected) {
                await this.redis.deleteActiveQuiz(userId, guildId);
                await this.redis.deleteCachedQuestions(userId, guildId);
            }
            
            // Remove from memory
            this.activeQuizzes.delete(`${userId}_${guildId}`);
            this.preloadedQuestions.delete(`${userId}_${guildId}`);
            
        } catch (error) {
            console.error('Error cleaning up quiz session:', error);
        }
    }

    async showFinalResults(interaction, session, tier, completionTime) {
        try {
            const minutes = Math.floor(completionTime / 60000);
            const seconds = Math.floor((completionTime % 60000) / 1000);
            const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Get rarity information
            const { TIER_RARITIES, TIER_RARITY_COLORS } = require('../utils/constants');
            const rarity = tier > 0 ? TIER_RARITIES[tier] : 'No Rarity';
            const rarityColor = tier > 0 ? TIER_RARITY_COLORS[tier] : '#808080';
            
            // Create fresh GIF for final results
            const gifAttachment = this.createGifAttachment();
            
            const embed = new EmbedBuilder()
                .setColor(rarityColor) // Use rarity color instead of tier color
                .setTitle(tier > 0 ? `${TIER_EMOJIS[tier]} Quiz Complete!` : '📝 Quiz Complete')
                .setDescription(
                    tier > 0 ? 
                        `**You've earned the ${TIER_NAMES[tier]}!**\n\n*${TIER_DESCRIPTIONS[tier]}*` :
                        '**Better luck tomorrow!**\n\n*Even the strongest warriors face defeat sometimes.*'
                )
                .addFields(
                    {
                        name: '⚔️ Final Score',
                        value: `${session.score}/10 correct`,
                        inline: true
                    },
                    {
                        name: '⏱️ Time',
                        value: timeText,
                        inline: true
                    },
                    {
                        name: '🏆 Buff Earned',
                        value: tier > 0 ? 
                            `**${rarity}**\n${TIER_EMOJIS[tier]} ${TIER_NAMES[tier]}` : 
                            '**No Rarity**\nNone',
                        inline: true
                    },
                    {
                        name: '🗺️ Results',
                        value: this.createAnswerSummary(session.answers),
                        inline: false
                    }
                )
                .setFooter({ text: `Next quiz tomorrow • Completed ${new Date().toLocaleTimeString()}` })
                .setTimestamp();
            
            // Keep GIF at the top for final results
            if (gifAttachment) {
                embed.setImage(`attachment://${gifAttachment.name}`);
            }
            
            const messageData = { embeds: [embed] };
            if (gifAttachment) {
                messageData.files = [gifAttachment];
            }
            
            await interaction.followUp(messageData);
            
        } catch (error) {
            console.error('Error showing final results:', error);
        }
    }

    async showAlreadyCompleted(interaction, completion) {
        const tier = completion.tier || completion.score;
        const { TIER_NAMES, TIER_RARITY_COLORS, TIER_EMOJIS, TIER_RARITIES } = require('../utils/constants');
        
        // Get next reset time
        const nextReset = interaction.resetManager.getNextResetTime();
        
        // Get rarity information
        const rarity = tier > 0 ? TIER_RARITIES[tier] : 'No Rarity';
        const rarityColor = tier > 0 ? TIER_RARITY_COLORS[tier] : '#808080';
        
        // Create fresh GIF for already completed message
        const gifAttachment = this.createGifAttachment();
        
        const embed = new EmbedBuilder()
            .setColor(rarityColor) // Use rarity color
            .setTitle('📋 Today\'s Quiz Complete')
            .setDescription('**You\'ve already completed today\'s quiz!**')
            .addFields(
                {
                    name: '⚔️ Your Results',
                    value: `**Score:** ${completion.score}/10\n**Buff:** ${tier > 0 ? `**${rarity}**\n${TIER_EMOJIS[tier]} ${TIER_NAMES[tier]}` : '**No Rarity**\nNone'}`,
                    inline: true
                },
                {
                    name: '🌅 Next Quiz',
                    value: `<t:${nextReset.unix}:R>`,
                    inline: true
                },
                {
                    name: '🏆 Current Power',
                    value: tier > 0 ? `You wield the **${rarity} ${TIER_NAMES[tier]}**!` : '*Train harder tomorrow!*',
                    inline: false
                }
            )
            .setFooter({ text: 'Return tomorrow for a new quiz!' })
            .setTimestamp();
        
        // Keep GIF at the top for already completed message
        if (gifAttachment) {
            embed.setImage(`attachment://${gifAttachment.name}`);
        }
        
        const messageData = { embeds: [embed], ephemeral: true };
        if (gifAttachment) {
            messageData.files = [gifAttachment];
        }
        
        return await interaction.reply(messageData);
    }

    createProgressBar(currentQuestion, answers) {
        const total = 10;
        let bar = '';
        
        for (let i = 0; i < total; i++) {
            if (i < answers.length) {
                // Show the question number with result
                const questionNumber = i + 1;
                if (answers[i].isCorrect) {
                    bar += `${questionNumber}.✅ `;
                } else {
                    bar += `${questionNumber}.❌ `;
                }
            } else if (i === currentQuestion) {
                // Current active question
                const questionNumber = i + 1;
                bar += `${questionNumber}.⏹️ `;
            } else {
                // Future questions
                const questionNumber = i + 1;
                bar += `${questionNumber}.⬛ `;
            }
        }
        
        return bar.trim();
    }

    createTimeBar(timeRemaining) {
        const totalTime = parseInt(process.env.QUESTION_TIME_LIMIT) || 20;
        const percentage = (timeRemaining / totalTime) * 100;
        
        let timeBar = '';
        
        // Create 10 segments, countdown from right to left
        for (let i = 0; i < 10; i++) {
            const segmentPercentage = (i / 10) * 100;
            
            if (percentage > segmentPercentage) {
                if (percentage >= 66) {
                    timeBar += '🟩 ';
                } else if (percentage >= 33) {
                    timeBar += '🟨 ';
                } else {
                    timeBar += '🟥 ';
                }
            } else {
                timeBar += '⬛ ';
            }
        }
        
        return `${timeBar.trim()} \`${timeRemaining}s remaining\``;
    }

    createAnswerSummary(answers) {
        let summary = '';
        
        for (let i = 0; i < answers.length; i++) {
            const answer = answers[i];
            if (answer.isCorrect) {
                summary += `${i + 1}. ✅`;
            } else {
                summary += `${i + 1}. ❌`;
            }
            
            if ((i + 1) % 5 === 0) {
                summary += '\n';
            } else {
                summary += ' ';
            }
        }
        
        return summary.trim();
    }

    // Get guild leaderboard for today
    async getGuildLeaderboard(guildId) {
        try {
            // Check Redis cache first
            if (this.redis?.connected) {
                const cached = await this.redis.getCachedGuildLeaderboard(guildId);
                if (cached) {
                    return cached;
                }
            }
            
            // Get from database
            const completions = await this.db.getGuildCompletionsToday(guildId);
            
            // Cache for 1 hour
            if (this.redis?.connected) {
                await this.redis.cacheGuildLeaderboard(guildId, completions);
            }
            
            return completions;
            
        } catch (error) {
            console.error('Error getting guild leaderboard:', error);
            return [];
        }
    }

    // Clear expired preloaded questions from memory
    cleanupPreloadedQuestions() {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes
        
        let cleanedCount = 0;
        for (const [key, data] of this.preloadedQuestions.entries()) {
            if (now - data.timestamp > maxAge) {
                this.preloadedQuestions.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired preloaded question caches`);
        }
        
        return cleanedCount;
    }

    // Get performance statistics
    getPerformanceStats() {
        return {
            activeQuizzes: this.activeQuizzes.size,
            preloadedQuestions: this.preloadedQuestions.size,
            timeIntervals: this.timeIntervals.size,
            redisConnected: this.redis?.connected || false,
            databaseConnected: this.db?.connected || false
        };
    }

    // Preload questions for multiple users (batch operation)
    async preloadQuestionsForUsers(userGuildPairs) {
        const results = [];
        
        for (const { userId, guildId } of userGuildPairs) {
            try {
                const questions = await this.preloadQuestions(userId, guildId);
                results.push({
                    userId,
                    guildId,
                    success: questions.length >= 10,
                    questionCount: questions.length
                });
            } catch (error) {
                console.error(`Error preloading questions for user ${userId}:`, error);
                results.push({
                    userId,
                    guildId,
                    success: false,
                    error: error.message
                });
            }
            
            // Small delay between preloads to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return results;
    }
}

module.exports = QuizManager;
