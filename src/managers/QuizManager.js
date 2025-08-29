const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const QuestionLoader = require('../utils/QuestionLoader');
const { TIER_COLORS, TIER_NAMES, FALLBACK_QUESTIONS } = require('../utils/constants');

class QuizManager {
    constructor(client, databaseManager, redisManager) {
        this.client = client;
        this.db = databaseManager;
        this.redis = redisManager;
        this.questionLoader = new QuestionLoader();
        
        // In-memory fallback for active quizzes
        this.activeQuizzes = new Map();
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
                    content: '❌ **Active Quiz Detected**\n\nYou already have an active quiz session. Please complete it first.',
                    components: []
                });
            }

            // Don't defer here - the interaction was already updated in the command
            // await interaction.deferReply(); // REMOVED - interaction already handled

            // Load questions
            const questions = await this.loadQuestions(userId, guildId);
            if (!questions || questions.length < 10) {
                return await interaction.editReply({
                    content: '❌ **Failed to Load Questions**\n\nUnable to prepare quiz questions. Please try again later.',
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
                startTime: Date.now()
            };

            // Save quiz session
            await this.saveQuizSession(userId, guildId, quizSession);

            // Start first question
            await this.askQuestion(interaction, quizSession);

        } catch (error) {
            console.error('Error starting quiz:', error);
            await interaction.editReply({
                content: '❌ **Error Starting Quiz**\n\nSomething went wrong. Please try again.',
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
            
            // Create question embed
            const embed = new EmbedBuilder()
                .setColor('#4A90E2')
                .setTitle(`🎌 Anime Quiz - Question ${questionNum}/10`)
                .setDescription(`**${question.question}**\n\n*Choose your answer below*`)
                .addFields(
                    {
                        name: '📊 Progress',
                        value: this.createProgressBar(session.currentQuestion, session.answers),
                        inline: false
                    },
                    {
                        name: '🎯 Current Score',
                        value: `${session.score}/10 correct`,
                        inline: true
                    },
                    {
                        name: '⏰ Time Limit',
                        value: `${process.env.QUESTION_TIME_LIMIT || 20} seconds`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `Difficulty: ${question.difficulty || 'Medium'} • Question ${questionNum}/${process.env.TOTAL_QUESTIONS || 10}` 
                })
                .setTimestamp();

            // Create answer buttons
            const buttons = question.options.map((option, index) => 
                new ButtonBuilder()
                    .setCustomId(`answer_${session.userId}_${index}_${option === question.answer}`)
                    .setLabel(option.substring(0, 80))
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(['1️⃣', '2️⃣', '3️⃣', '4️⃣'][index])
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

            // Set up collector
            const collector = message.createMessageComponentCollector({
                time: (parseInt(process.env.QUESTION_TIME_LIMIT) || 20) * 1000,
                filter: i => i.user.id === session.userId
            });

            collector.on('collect', async (buttonInteraction) => {
                await this.handleAnswerSelection(buttonInteraction, interaction, session);
                collector.stop();
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    await this.handleTimeout(interaction, session);
                }
            });

        } catch (error) {
            console.error('Error asking question:', error);
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
                await this.endQuiz(originalInteraction, session);
            } else {
                // Update session and continue
                await this.saveQuizSession(session.userId, session.guildId, session);
                
                setTimeout(async () => {
                    await this.askQuestion(originalInteraction, session);
                }, 3000);
            }
            
        } catch (error) {
            console.error('Error handling answer selection:', error);
        }
    }

    async handleTimeout(interaction, session) {
        try {
            // Record as incorrect
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
                .setFooter({ text: 'Moving to next question...' });
            
            await interaction.followUp({ embeds: [embed] });
            
            // Move to next question
            session.currentQuestion++;
            
            if (session.currentQuestion >= 10) {
                setTimeout(async () => {
                    await this.endQuiz(interaction, session);
                }, 3000);
            } else {
                await this.saveQuizSession(session.userId, session.guildId, session);
                
                setTimeout(async () => {
                    await this.askQuestion(interaction, session);
                }, 3000);
            }
            
        } catch (error) {
            console.error('Error handling timeout:', error);
        }
    }

    async showAnswerResult(interaction, session, isCorrect, selectedAnswer, correctAnswer) {
        try {
            const embed = new EmbedBuilder()
                .setColor(isCorrect ? '#00FF00' : '#FF0000')
                .setTitle(isCorrect ? '✅ Correct!' : '❌ Incorrect')
                .setDescription(
                    isCorrect ? 
                        `Great job! **${selectedAnswer}** is correct!` :
                        `**Your Answer:** ${selectedAnswer}\n**Correct Answer:** ${correctAnswer}`
                )
                .addFields({
                    name: '🎯 Current Score',
                    value: `${session.score}/10 correct`,
                    inline: true
                })
                .setFooter({ 
                    text: session.currentQuestion < 9 ? 'Next question in 3 seconds...' : 'Calculating final results...' 
                });
            
            await interaction.editReply({ embeds: [embed], components: [] });
            
        } catch (error) {
            console.error('Error showing answer result:', error);
        }
    }

    async endQuiz(interaction, session) {
        try {
            const tier = session.score;
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
            if (tier === 0) return; // No role for 0 score
            
            const member = await guild.members.fetch(userId);
            if (!member) return;
            
            // Remove all existing tier roles
            for (let i = 1; i <= 10; i++) {
                const roleId = process.env[`TIER_${i}_ROLE`];
                if (roleId && member.roles.cache.has(roleId)) {
                    const role = guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.remove(role, 'Removing old tier role');
                    }
                }
            }
            
            // Apply new tier role
            const newRoleId = process.env[`TIER_${tier}_ROLE`];
            if (newRoleId) {
                const newRole = guild.roles.cache.get(newRoleId);
                if (newRole) {
                    await member.roles.add(newRole, `Quiz completion - Tier ${tier}`);
                    console.log(`✅ Applied Tier ${tier} role to user ${userId}`);
                } else {
                    console.warn(`⚠️ Tier ${tier} role not found: ${newRoleId}`);
                }
            }
            
        } catch (error) {
            console.error('Error applying tier role:', error);
        }
    }

    async cleanupQuizSession(userId, guildId) {
        try {
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
                .setColor(tier > 0 ? TIER_COLORS[tier] || '#4A90E2' : '#FF0000')
                .setTitle(tier > 0 ? `🏆 Quiz Complete - ${TIER_NAMES[tier]}!` : '📝 Quiz Complete')
                .setDescription(
                    tier > 0 ? 
                        `Congratulations! You've earned **${TIER_NAMES[tier]}** tier!` :
                        'Better luck next time! Try again tomorrow.'
                )
                .addFields(
                    {
                        name: '📊 Final Score',
                        value: `${session.score}/10 correct answers`,
                        inline: true
                    },
                    {
                        name: '⏱️ Completion Time',
                        value: timeText,
                        inline: true
                    },
                    {
                        name: '🎯 Tier Earned',
                        value: tier > 0 ? `Tier ${tier} - ${TIER_NAMES[tier]}` : 'No tier earned',
                        inline: true
                    },
                    {
                        name: '📋 Answer Summary',
                        value: this.createAnswerSummary(session.answers),
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Next quiz available tomorrow • Completed at ${new Date().toLocaleTimeString()}` 
                })
                .setTimestamp();
            
            await interaction.followUp({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error showing final results:', error);
        }
    }

    async showAlreadyCompleted(interaction, completion) {
        const tier = completion.tier || completion.score;
        
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('📋 Quiz Already Completed Today')
            .setDescription(`You've already completed today's anime quiz!`)
            .addFields(
                {
                    name: '📊 Your Results',
                    value: `**Score:** ${completion.score}/10\n**Tier:** ${tier > 0 ? `${tier} - ${TIER_NAMES[tier]}` : 'No tier earned'}`,
                    inline: true
                },
                {
                    name: '🕐 Next Quiz',
                    value: `Available tomorrow at ${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT`,
                    inline: true
                }
            )
            .setFooter({ text: 'Come back tomorrow for a new challenge!' })
            .setTimestamp();
        
        return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    createProgressBar(currentQuestion, answers) {
        const total = 10;
        let bar = '';
        
        for (let i = 0; i < total; i++) {
            if (i < answers.length) {
                bar += answers[i].isCorrect ? '🟩' : '🟥';
            } else if (i === currentQuestion) {
                bar += '⬜';
            } else {
                bar += '⬛';
            }
        }
        
        return bar;
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
