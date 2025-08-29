const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const QuestionLoader = require('../utils/QuestionLoader');
const { TIER_COLORS, TIER_NAMES, TIER_EMOJIS, TIER_DESCRIPTIONS, FALLBACK_QUESTIONS } = require('../utils/constants');

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
                    content: '❌ **Active Quest Detected**\n\nYou already have an active challenge. Complete it first!',
                    components: []
                });
            }

            // Load questions
            const questions = await this.loadQuestions(userId, guildId);
            if (!questions || questions.length < 10) {
                return await interaction.editReply({
                    content: '❌ **Failed to Load Questions**\n\nUnable to prepare your challenge. Please try again later!',
                    components: []
                });
            }

            // Initialize quiz session
            const quizSession = {
                userId,
                guildId,
                questions,
                currentQuestion: 0,
                score: 0,
                answers: [],
                startTime: Date.now(),
                timeRemaining: parseInt(process.env.QUESTION_TIME_LIMIT) || 20,
                rerollsUsed: 0 // Track total rerolls used across all questions
            };

            // Save quiz session
            await this.saveQuizSession(userId, guildId, quizSession);

            // Start first question
            await this.askQuestion(interaction, quizSession);

        } catch (error) {
            console.error('Error starting quiz:', error);
            await interaction.editReply({
                content: '❌ **Error**\n\nSomething went wrong. Please try again!',
                components: []
            });
        }
    }

    async loadQuestions(userId, guildId) {
        try {
            // Check cache first
            if (this.redis?.connected) {
                const cachedQuestions = await this.redis.getCachedQuestions(userId, guildId);
                if (cachedQuestions) {
                    console.log(`📡 Using cached questions for user ${userId}`);
                    return cachedQuestions;
                }
            }

            // Get recent questions to avoid
            const recentQuestions = await this.getRecentQuestions(userId, guildId);
            
            // Load new questions
            const questions = await this.questionLoader.loadQuestions(recentQuestions);
            
            if (questions.length >= 10) {
                // Cache questions
                if (this.redis?.connected) {
                    await this.redis.cacheQuestions(userId, guildId, questions);
                }
                
                // Save question hashes to history
                for (const question of questions) {
                    const questionHash = this.createQuestionHash(question.question);
                    await this.saveQuestionToHistory(userId, guildId, questionHash, question.question);
                }
            }

            return questions;
            
        } catch (error) {
            console.error('Error loading questions:', error);
            return [];
        }
    }

    async getRecentQuestions(userId, guildId) {
        try {
            const recentSet = new Set();
            
            // Get from Redis
            if (this.redis?.connected) {
                const redisRecent = await this.redis.getRecentQuestions(userId, guildId);
                redisRecent.forEach(hash => recentSet.add(hash));
            }
            
            // Get from database
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
            // Save to Redis
            if (this.redis?.connected) {
                await this.redis.addRecentQuestion(userId, guildId, questionHash);
            }
            
            // Save to database
            await this.db.saveQuestionHistory(userId, guildId, questionHash, questionText);
            
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
            // Save to Redis
            if (this.redis?.connected) {
                await this.redis.setActiveQuiz(userId, guildId, session);
            }
            
            // Fallback to memory
            this.activeQuizzes.set(`${userId}_${guildId}`, session);
            
        } catch (error) {
            console.error('Error saving quiz session:', error);
        }
    }

    async getQuizSession(userId, guildId) {
        try {
            // Check Redis first
            if (this.redis?.connected) {
                const session = await this.redis.getActiveQuiz(userId, guildId);
                if (session) {
                    return session;
                }
            }
            
            // Fallback to memory
            return this.activeQuizzes.get(`${userId}_${guildId}`) || null;
            
        } catch (error) {
            console.error('Error getting quiz session:', error);
            return null;
        }
    }

    hasActiveQuiz(userId, guildId) {
        // Check memory first (faster)
        if (this.activeQuizzes.has(`${userId}_${guildId}`)) {
            return true;
        }
        
        return false;
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
            
            // Create question embed
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`⚔️ Question ${questionNum}/10`)
                .setDescription(`**${question.question}**`)
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

            // Create answer buttons
            const buttonEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
            const buttons = question.options.map((option, index) => 
                new ButtonBuilder()
                    .setCustomId(`answer_${session.userId}_${index}_${option === question.answer}`)
                    .setLabel(option.substring(0, 65))
                    .setStyle(ButtonStyle.Success) // All green buttons
                    .setEmoji(buttonEmojis[index])
            );

            // Add reroll button if rerolls available
            const components = [
                new ActionRowBuilder().addComponents(buttons.slice(0, 2)),
                new ActionRowBuilder().addComponents(buttons.slice(2, 4))
            ];

            if (session.rerollsUsed < 3) {
                const rerollButton = new ButtonBuilder()
                    .setCustomId(`reroll_${session.userId}`)
                    .setLabel(`Reroll Question (${session.rerollsUsed}/3)`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🎲');
                
                components.push(new ActionRowBuilder().addComponents(rerollButton));
            }

            let message;
            if (session.currentQuestion === 0) {
                await interaction.editReply({ embeds: [embed], components });
                message = await interaction.fetchReply();
            } else {
                message = await interaction.followUp({ embeds: [embed], components });
            }

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
                
                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(`⚔️ Question ${questionNum}/10`)
                    .setDescription(`**${question.question}**`)
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
                            '⚠️ Time running out!' : 
                            `Choose wisely • ${questionNum}/${process.env.TOTAL_QUESTIONS || 10}`
                    })
                    .setTimestamp();
                
                await message.edit({ embeds: [embed] });
                
            } catch (error) {
                this.clearTimeInterval(session.userId, session.guildId);
            }
        }, 2000);
        
        this.timeIntervals.set(intervalKey, interval);
    }

    async handleReroll(buttonInteraction, originalInteraction, session) {
        try {
            await buttonInteraction.deferUpdate();
            
            // Increment reroll counter
            session.rerollsUsed++;
            
            console.log(`Reroll used by ${session.userId}: ${session.rerollsUsed}/3`);
            
            // Get a new question to replace the current one
            const newQuestion = await this.getNewQuestion(session);
            if (newQuestion) {
                session.questions[session.currentQuestion] = newQuestion;
                console.log(`✅ Rerolled question ${session.currentQuestion + 1} for user ${session.userId}`);
            } else {
                console.warn(`⚠️ Could not find new question for reroll, keeping original`);
            }
            
            // Update session and restart the question
            await this.saveQuizSession(session.userId, session.guildId, session);
            
            // Restart the question with new/same question
            await this.askQuestion(originalInteraction, session);
            
        } catch (error) {
            console.error('Error handling reroll:', error);
        }
    }

    async getNewQuestion(session) {
        try {
            // Get recent questions to avoid (including current session questions)
            const recentQuestions = await this.getRecentQuestions(session.userId, session.guildId);
            
            // Add current session questions to avoid list
            session.questions.forEach(q => {
                recentQuestions.add(q.question.toLowerCase().trim());
                recentQuestions.add(this.createQuestionHash(q.question));
            });
            
            // Load new questions
            const newQuestions = await this.questionLoader.loadQuestions(recentQuestions);
            
            if (newQuestions && newQuestions.length > 0) {
                // Return a random question from the new batch
                const randomIndex = Math.floor(Math.random() * newQuestions.length);
                return newQuestions[randomIndex];
            }
            
            return null;
            
        } catch (error) {
            console.error('Error getting new question for reroll:', error);
            return null;
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
            
            console.log(`Quiz Q${session.currentQuestion + 1}: ${isCorrect ? '✅' : '❌'} User ${session.userId} - "${selectedAnswer}" (Correct: "${question.answer}")`);
            
            // Show answer reveal in the same embed for 5 seconds
            await this.showAnswerReveal(buttonInteraction, session, isCorrect, selectedAnswer, question.answer);
            
            // Move to next question or end quiz
            session.currentQuestion++;
            
            setTimeout(async () => {
                if (session.currentQuestion >= 10) {
                    await this.endQuiz(originalInteraction, session);
                } else {
                    await this.askContinuation(originalInteraction, session);
                }
            }, 5000); // Wait 5 seconds before continuing
            
        } catch (error) {
            console.error('Error handling answer selection:', error);
        }
    }

    async showAnswerReveal(interaction, session, isCorrect, selectedAnswer, correctAnswer) {
        try {
            const questionNum = session.currentQuestion + 1;
            
            const embed = new EmbedBuilder()
                .setColor(isCorrect ? '#00FF00' : '#FF0000')
                .setTitle('🌊 Continue Quest?')
                .setDescription(`**Battle ${questionNum} Complete!**\n\n${isCorrect ? '⚔️ **Correct!**' : '💀 **Wrong!**'}\n${isCorrect ? `**${selectedAnswer}**` : `**Your Answer:** ${selectedAnswer}\n**Correct Answer:** ${correctAnswer}`}`)
                .addFields(
                    {
                        name: '📊 Progress',
                        value: `**${questionNum}/10** completed • **${session.score}** correct • **${Math.round((session.score / questionNum) * 100)}%** success`,
                        inline: false
                    },
                    {
                        name: '🗺️ Journey',
                        value: this.createProgressBar(session.currentQuestion + 1, session.answers), // +1 because we just answered
                        inline: false
                    },
                    {
                        name: '🏆 Current Power',
                        value: session.score > 0 ? 
                            `${TIER_EMOJIS[session.score]} **${TIER_NAMES[session.score]}**` : 
                            '💀 **No Buff Yet**',
                        inline: true
                    },
                    {
                        name: '⚔️ Remaining',
                        value: `**${10 - questionNum}** challenges left`,
                        inline: true
                    }
                )
                .setFooter({ text: '⚠️ Loading next challenge...' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], components: [] });
            
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
            
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle('🌊 Continue Quest?')
                .setDescription(`**Battle ${questionNum} Complete!**`)
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
                            `${TIER_EMOJIS[session.score]} **${TIER_NAMES[session.score]}**` : 
                            '💀 **No Buff Yet**',
                        inline: true
                    },
                    {
                        name: '⚔️ Remaining',
                        value: `**${10 - questionNum}** challenges left`,
                        inline: true
                    }
                )
                .setFooter({ text: '⚠️ 60 seconds to decide • No response = Quest abandoned' })
                .setTimestamp();

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
            
            const message = await interaction.followUp({ embeds: [embed], components: [row] });

            const collector = message.createMessageComponentCollector({
                time: 60000,
                filter: i => i.user.id === session.userId && (i.customId === `continue_${session.userId}` || i.customId === `abandon_${session.userId}`)
            });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.customId === `continue_${session.userId}`) {
                    await buttonInteraction.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('#00FF00')
                                .setTitle('⚔️ Onward!')
                                .setDescription('**Loading next challenge...**')
                                .setFooter({ text: 'Preparing question...' })
                        ],
                        components: []
                    });
                    
                    await this.saveQuizSession(session.userId, session.guildId, session);
                    
                    setTimeout(async () => {
                        await this.askQuestion(interaction, session);
                    }, 2000);
                    
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
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('🏳️ Quest Abandoned')
                        .setDescription(`**Journey End**\n\nYou've decided to end your challenge here.\n\n**Final Progress:** ${session.score}/${session.currentQuestion} correct\n\n*No role will be granted for incomplete quests.*`)
                        .setFooter({ text: 'Return tomorrow for a new challenge!' })
                        .setTimestamp()
                ],
                components: []
            });
            
            // Clean up session
            await this.cleanupQuizSession(session.userId, session.guildId);
            
        } catch (error) {
            console.error('Error handling abandon:', error);
        }
    }

    async handleTimeout(interaction, session, isContinuation = false) {
        try {
            if (!isContinuation) {
                // Question timeout
                const question = session.questions[session.currentQuestion];
                session.answers.push({
                    questionIndex: session.currentQuestion,
                    selectedAnswer: 'No answer (timeout)',
                    correctAnswer: question.answer,
                    isCorrect: false
                });
                
                console.log(`Quiz Q${session.currentQuestion + 1}: ⏰ TIMEOUT User ${session.userId} - Correct: "${question.answer}"`);
                
                // Show timeout message
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('⏰ Time\'s Up!')
                    .setDescription(`**Correct Answer:** ${question.answer}`)
                    .setFooter({ text: 'Next question...' });
                
                await interaction.followUp({ embeds: [embed] });
                
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
                    .setTitle('⏰ Quest Abandoned')
                    .setDescription(`**No response received**\n\nYour quest ends here due to inactivity.\n\n**Final Progress:** ${session.score}/${session.currentQuestion} correct\n\n*No role will be granted for incomplete quests.*`)
                    .setFooter({ text: 'Return tomorrow for a new challenge!' })
                    .setTimestamp();
                
                await interaction.followUp({ embeds: [embed] });
                
                // Clean up session
                await this.cleanupQuizSession(session.userId, session.guildId);
            }
            
        } catch (error) {
            console.error('Error handling timeout:', error);
        }
    }

    async showAnswerResult(interaction, session, isCorrect, selectedAnswer, correctAnswer) {
        try {
            const embed = new EmbedBuilder()
                .setColor(isCorrect ? '#00FF00' : '#FF0000')
                .setTitle(isCorrect ? '⚔️ Correct!' : '💀 Wrong!')
                .setDescription(
                    isCorrect ? 
                        `**${selectedAnswer}**` :
                        `**Your Answer:** ${selectedAnswer}\n**Correct:** ${correctAnswer}`
                )
                .addFields({
                    name: '🏆 Score',
                    value: `${session.score}/${session.currentQuestion + 1}`,
                    inline: true
                })
                .setFooter({ 
                    text: session.currentQuestion < 9 ? 'Next question...' : 'Final results...' 
                })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed], components: [] });
            
        } catch (error) {
            console.error('Error showing answer result:', error);
        }
    }

    async endQuiz(interaction, session) {
        try {
            const tier = session.score; // Fixed: Use score directly as tier (7/10 = tier 7)
            const completionTime = Date.now() - session.startTime;
            
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
            
        } catch (error) {
            console.error('Error cleaning up quiz session:', error);
        }
    }

    async showFinalResults(interaction, session, tier, completionTime) {
        try {
            const minutes = Math.floor(completionTime / 60000);
            const seconds = Math.floor((completionTime % 60000) / 1000);
            const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            const embed = new EmbedBuilder()
                .setColor(tier > 0 ? TIER_COLORS[tier] || '#4A90E2' : '#808080')
                .setTitle(tier > 0 ? `${TIER_EMOJIS[tier]} Quest Complete!` : '📝 Quest Complete')
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
                        value: tier > 0 ? `${TIER_EMOJIS[tier]} ${TIER_NAMES[tier]}` : 'None',
                        inline: true
                    },
                    {
                        name: '🗺️ Results',
                        value: this.createAnswerSummary(session.answers),
                        inline: false
                    }
                )
                .setFooter({ text: `Next quest tomorrow • Completed ${new Date().toLocaleTimeString()}` })
                .setTimestamp();
            
            await interaction.followUp({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error showing final results:', error);
        }
    }

    async showAlreadyCompleted(interaction, completion) {
        const tier = completion.tier || completion.score;
        const { TIER_NAMES, TIER_COLORS, TIER_EMOJIS } = require('../utils/constants');
        
        // Get next reset time
        const nextReset = interaction.resetManager.getNextResetTime();
        
        const embed = new EmbedBuilder()
            .setColor(tier > 0 ? TIER_COLORS[tier] || '#4A90E2' : '#808080')
            .setTitle('📋 Today\'s Quest Complete')
            .setDescription('**You\'ve already completed today\'s challenge!**')
            .addFields(
                {
                    name: '⚔️ Your Results',
                    value: `**Score:** ${completion.score}/10\n**Buff:** ${tier > 0 ? `${TIER_EMOJIS[tier]} ${TIER_NAMES[tier]}` : 'None'}`,
                    inline: true
                },
                {
                    name: '🌅 Next Quest',
                    value: `<t:${nextReset.unix}:R>`,
                    inline: true
                },
                {
                    name: '🏆 Current Power',
                    value: tier > 0 ? `You wield the **${TIER_NAMES[tier]}**!` : '*Train harder tomorrow!*',
                    inline: false
                }
            )
            .setFooter({ text: 'Return tomorrow for a new challenge!' })
            .setTimestamp();
        
        return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    createProgressBar(currentQuestion, answers) {
        const total = 10;
        let bar = '';
        
        for (let i = 0; i < total; i++) {
            if (i < answers.length) {
                bar += answers[i].isCorrect ? '🟩 ' : '🟥 ';
            } else if (i === currentQuestion) {
                bar += '⏹️ '; // Active question
            } else {
                bar += '⬛ '; // Not reached yet
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
}

module.exports = QuizManager;
