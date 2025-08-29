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
                    content: '❌ **Active Adventure Detected**\n\nYou already have an active Grand Line quest. Complete your current journey first, brave pirate!',
                    components: []
                });
            }

            // Load questions
            const questions = await this.loadQuestions(userId, guildId);
            if (!questions || questions.length < 10) {
                return await interaction.editReply({
                    content: '❌ **Failed to Chart Course**\n\nUnable to prepare your Grand Line challenges. The seas are rough today - please try again later, pirate!',
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
                timeRemaining: parseInt(process.env.QUESTION_TIME_LIMIT) || 20
            };

            // Save quiz session
            await this.saveQuizSession(userId, guildId, quizSession);

            // Start first question
            await this.askQuestion(interaction, quizSession);

        } catch (error) {
            console.error('Error starting quiz:', error);
            await interaction.editReply({
                content: '❌ **Navigation Error**\n\nThe Grand Line currents are unstable. Please try setting sail again, pirate!',
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
        
        // For Redis, we'll check in the async methods
        return false;
    }

    async askQuestion(interaction, session) {
        try {
            const question = session.questions[session.currentQuestion];
            const questionNum = session.currentQuestion + 1;
            
            // Reset time remaining
            session.timeRemaining = parseInt(process.env.QUESTION_TIME_LIMIT) || 20;
            
            // Create question embed
            const embed = new EmbedBuilder()
                .setColor('#4A90E2')
                .setTitle(`⚔️ Grand Line Challenge - Question ${questionNum}/10`)
                .setDescription(`**${question.question}**\n\n🏴‍☠️ *Choose your answer wisely, pirate!*`)
                .addFields(
                    {
                        name: '🗺️ Journey Progress',
                        value: this.createProgressBar(session.currentQuestion, session.answers),
                        inline: false
                    },
                    {
                        name: '⏱️ Time Remaining',
                        value: this.createTimeBar(session.timeRemaining),
                        inline: false
                    },
                    {
                        name: '🏆 Current Score',
                        value: `${session.score}/${session.currentQuestion + 1} battles won`,
                        inline: true
                    },
                    {
                        name: '⚡ Difficulty',
                        value: `${question.difficulty || 'Medium'}`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `Navigate wisely • Question ${questionNum}/${process.env.TOTAL_QUESTIONS || 10}` 
                })
                .setTimestamp();

            // Create answer buttons with One Piece themed emojis
            const buttonEmojis = ['🥇', '🥈', '🥉', '🏅'];
            const buttons = question.options.map((option, index) => 
                new ButtonBuilder()
                    .setCustomId(`answer_${session.userId}_${index}_${option === question.answer}`)
                    .setLabel(option.substring(0, 75))
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(buttonEmojis[index])
            );

            const rows = [
                new ActionRowBuilder().addComponents(buttons.slice(0, 2)),
                new ActionRowBuilder().addComponents(buttons.slice(2, 4))
            ];

            let message;
            if (session.currentQuestion === 0) {
                await interaction.editReply({ embeds: [embed], components: rows });
                message = await interaction.fetchReply();
            } else {
                message = await interaction.followUp({ embeds: [embed], components: rows });
            }

            // Start time countdown
            await this.startTimeCountdown(interaction, session, message);

            // Set up collector
            const collector = message.createMessageComponentCollector({
                time: (parseInt(process.env.QUESTION_TIME_LIMIT) || 20) * 1000,
                filter: i => i.user.id === session.userId && i.customId.startsWith('answer_')
            });

            collector.on('collect', async (buttonInteraction) => {
                this.clearTimeInterval(session.userId, session.guildId);
                await this.handleAnswerSelection(buttonInteraction, interaction, session);
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
                
                const embed = new EmbedBuilder()
                    .setColor(session.timeRemaining <= 6 ? '#FF0000' : session.timeRemaining <= 12 ? '#FFA500' : '#4A90E2')
                    .setTitle(`⚔️ Grand Line Challenge - Question ${questionNum}/10`)
                    .setDescription(`**${question.question}**\n\n🏴‍☠️ *Choose your answer wisely, pirate!*`)
                    .addFields(
                        {
                            name: '🗺️ Journey Progress',
                            value: this.createProgressBar(session.currentQuestion, session.answers),
                            inline: false
                        },
                        {
                            name: '⏱️ Time Remaining',
                            value: this.createTimeBar(session.timeRemaining),
                            inline: false
                        },
                        {
                            name: '🏆 Current Score',
                            value: `${session.score}/${session.currentQuestion + 1} battles won`,
                            inline: true
                        },
                        {
                            name: '⚡ Difficulty',
                            value: `${question.difficulty || 'Medium'}`,
                            inline: true
                        }
                    )
                    .setFooter({ 
                        text: session.timeRemaining <= 6 ? 'Hurry up, pirate! ⚠️' : `Navigate wisely • Question ${questionNum}/${process.env.TOTAL_QUESTIONS || 10}` 
                    })
                    .setTimestamp();
                
                await message.edit({ embeds: [embed] });
                
            } catch (error) {
                // Ignore edit errors (message might be deleted)
                this.clearTimeInterval(session.userId, session.guildId);
            }
        }, 2000);
        
        this.timeIntervals.set(intervalKey, interval);
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
            
            // Show result
            await this.showAnswerResult(buttonInteraction, session, isCorrect, selectedAnswer, question.answer);
            
            // Move to next question or end quiz
            session.currentQuestion++;
            
            if (session.currentQuestion >= 10) {
                setTimeout(async () => {
                    await this.endQuiz(originalInteraction, session);
                }, 3000);
            } else {
                // Ask for continuation confirmation
                setTimeout(async () => {
                    await this.askContinuation(originalInteraction, session);
                }, 3000);
            }
            
        } catch (error) {
            console.error('Error handling answer selection:', error);
        }
    }

    async askContinuation(interaction, session) {
        try {
            const questionNum = session.currentQuestion + 1;
            
            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🌊 Continue Your Grand Line Journey?')
                .setDescription(`**Excellent work, pirate!** 🏴‍☠️\n\nYou've conquered another challenge on the Grand Line!\n\n**Current Progress:** Question ${questionNum}/10 complete\n**Battles Won:** ${session.score}/${questionNum}`)
                .addFields(
                    {
                        name: '🗺️ Journey Progress',
                        value: this.createProgressBar(session.currentQuestion, session.answers),
                        inline: false
                    },
                    {
                        name: '⚔️ What\'s Next?',
                        value: 'Ready to face the next challenge? The Grand Line awaits your decision!',
                        inline: false
                    }
                )
                .setFooter({ text: '⚠️ You have 1 minute to decide • No response = Abandon journey' })
                .setTimestamp();

            const buttons = [
                new ButtonBuilder()
                    .setCustomId(`continue_${session.userId}`)
                    .setLabel('Continue Journey')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('⚔️'),
                new ButtonBuilder()
                    .setCustomId(`abandon_${session.userId}`)
                    .setLabel('Abandon Quest')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🏳️')
            ];

            const row = new ActionRowBuilder().addComponents(buttons);
            
            const message = await interaction.followUp({ embeds: [embed], components: [row] });

            const collector = message.createMessageComponentCollector({
                time: 60000, // 1 minute
                filter: i => i.user.id === session.userId && (i.customId === `continue_${session.userId}` || i.customId === `abandon_${session.userId}`)
            });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.customId === `continue_${session.userId}`) {
                    await buttonInteraction.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('#00FF00')
                                .setTitle('⚔️ Sailing Forward!')
                                .setDescription('**Brave choice, pirate!** 🏴‍☠️\n\nPreparing your next Grand Line challenge...')
                                .setFooter({ text: 'Next question loading...' })
                        ],
                        components: []
                    });
                    
                    // Update session and continue
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
                    // Timeout - abandon
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
                        .setDescription(`**Journey End** 🏴‍☠️\n\nYou've decided to end your Grand Line adventure here.\n\n**Final Progress:** ${session.score}/${session.currentQuestion} battles won\n\nNo tier role will be granted for incomplete journeys.\n\n*Return tomorrow for a fresh adventure, pirate!*`)
                        .setFooter({ text: 'The Grand Line will remember your courage' })
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
                    .setTitle('⏰ Time\'s Up, Pirate!')
                    .setDescription(`**The seas have claimed your chance!** 🌊\n\n**Correct Answer:** ${question.answer}\n\n*The Grand Line is unforgiving to those who hesitate...*`)
                    .setFooter({ text: 'Preparing next challenge...' });
                
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
                    .setTitle('⏰ Journey Abandoned - No Response')
                    .setDescription(`**The seas grew quiet...** 🌊\n\nYour Grand Line adventure ends here due to inactivity.\n\n**Final Progress:** ${session.score}/${session.currentQuestion} battles won\n\nNo tier role will be granted for incomplete journeys.\n\n*Return tomorrow for a fresh adventure, pirate!*`)
                    .setFooter({ text: 'The Grand Line remembers those who sail its waters' })
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
                .setTitle(isCorrect ? '⚔️ Victory in Battle!' : '💀 Defeated in Combat!')
                .setDescription(
                    isCorrect ? 
                        `**Excellent, pirate!** 🏴‍☠️\n\n**Your Answer:** ${selectedAnswer}\n\n*You've proven your knowledge of the Grand Line!*` :
                        `**The seas have bested you this time...** 🌊\n\n**Your Answer:** ${selectedAnswer}\n**Correct Answer:** ${correctAnswer}\n\n*Learn from this defeat, pirate!*`
                )
                .addFields({
                    name: '🏆 Battle Progress',
                    value: `${session.score}/${session.currentQuestion + 1} victories claimed`,
                    inline: true
                })
                .setFooter({ 
                    text: session.currentQuestion < 9 ? 'Preparing for next battle...' : 'Calculating final results...' 
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
                .setTitle(tier > 0 ? `${TIER_EMOJIS[tier]} Grand Line Conquered - ${TIER_NAMES[tier]}!` : '🗺️ Grand Line Journey Complete')
                .setDescription(
                    tier > 0 ? 
                        `🏴‍☠️ **Congratulations, Legendary Pirate!** 🏴‍☠️\n\nYou've earned the mighty **${TIER_NAMES[tier]}**!\n\n*${TIER_DESCRIPTIONS[tier]}*\n\n⚔️ Your prowess on the Grand Line is now recognized across all seas!` :
                        '🌊 **Your Grand Line Adventure Ends** 🌊\n\nEven the greatest pirates face defeat sometimes.\n\n*Train harder and return tomorrow for redemption, brave soul!*'
                )
                .addFields(
                    {
                        name: '⚔️ Battle Results',
                        value: `${session.score}/10 victories claimed`,
                        inline: true
                    },
                    {
                        name: '⏱️ Journey Time',
                        value: timeText,
                        inline: true
                    },
                    {
                        name: '🏆 Power Gained',
                        value: tier > 0 ? `${TIER_EMOJIS[tier]} ${TIER_NAMES[tier]}` : 'No power gained',
                        inline: true
                    },
                    {
                        name: '🗺️ Battle Summary',
                        value: this.createAnswerSummary(session.answers),
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Next Grand Line adventure tomorrow • Completed at ${new Date().toLocaleTimeString()}` 
                })
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
            .setTitle('📋 Today\'s Grand Line Adventure Complete')
            .setDescription(`**Your journey is already complete for today, pirate!** 🏴‍☠️\n\nYou've proven your worth on today's Grand Line challenges.`)
            .addFields(
                {
                    name: '⚔️ Your Battle Results',
                    value: `**Victories:** ${completion.score}/10 battles won\n**Power Earned:** ${tier > 0 ? `${TIER_EMOJIS[tier]} ${TIER_NAMES[tier]}` : 'No power gained'}`,
                    inline: true
                },
                {
                    name: '🌅 Next Adventure',
                    value: `<t:${nextReset.unix}:R>\n(${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT)`,
                    inline: true
                },
                {
                    name: '🏆 Current Status',
                    value: tier > 0 ? `You currently wield the **${TIER_NAMES[tier]}**!\n\n*Your power resonates across the Grand Line!*` : '⚔️ *No power boost today - train harder tomorrow, pirate!*',
                    inline: false
                }
            )
            .setFooter({ text: 'Return tomorrow for a new Grand Line challenge!' })
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
        for (let i = 0; i < 10; i++) {
            const segmentPercentage = ((9 - i) / 9) * 100;
            
            if (percentage > segmentPercentage) {
                if (percentage >= 66) {
                    timeBar += '🟩';
                } else if (percentage >= 33) {
                    timeBar += '🟨';
                } else {
                    timeBar += '🟥';
                }
            } else {
                timeBar += '⬛';
            }
        }
        
        return `${timeBar} \`${timeRemaining}s\``;
    }

    createAnswerSummary(answers) {
        let summary = '';
        let correct = 0;
        
        for (let i = 0; i < answers.length; i++) {
            const answer = answers[i];
            if (answer.isCorrect) {
                correct++;
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
