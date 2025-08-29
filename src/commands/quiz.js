const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('🎌 Start the daily anime quiz challenge!'),

    async execute(interaction) {
        try {
            // Check if quiz is restricted to specific channel
            const quizChannelId = process.env.QUIZ_CHANNEL_ID;
            if (quizChannelId && interaction.channel.id !== quizChannelId) {
                const channelMention = `<#${quizChannelId}>`;
                
                return await interaction.reply({
                    content: `❌ **Wrong Channel**\n\nThe anime quiz can only be used in ${channelMention}.\n\nPlease go to the correct channel to start your challenge!`,
                    ephemeral: true
                });
            }

            // Check if user already completed quiz today
            const existingCompletion = await interaction.quizManager.hasCompletedToday(
                interaction.user.id, 
                interaction.guild.id
            );
            
            if (existingCompletion) {
                return await this.showAlreadyCompleted(interaction, existingCompletion);
            }

            // Check if user has active quiz
            if (interaction.quizManager.hasActiveQuiz(interaction.user.id, interaction.guild.id)) {
                return await interaction.reply({
                    content: '❌ **Active Quiz Detected**\n\nYou already have an active quiz session. Please complete it first before starting a new one.',
                    ephemeral: true
                });
            }

            // Show quiz introduction
            const introEmbed = new EmbedBuilder()
                .setColor('#4A90E2')
                .setTitle('🎌 Daily Anime Quiz Challenge')
                .setDescription('Test your anime knowledge with 10 challenging questions!\n\n**How it works:**\n• Answer 10 multiple choice questions\n• Each correct answer earns you 1 point\n• Your final score determines your tier role\n• Roles reset daily for fresh challenges')
                .addFields(
                    {
                        name: '🎯 Scoring System',
                        value: '• **1-3 correct**: Bronze-Gold tiers\n• **4-6 correct**: Platinum-Master tiers\n• **7-9 correct**: Legendary-Divine tiers\n• **10 correct**: Ultimate Otaku tier!',
                        inline: false
                    },
                    {
                        name: '⏰ Rules',
                        value: `• ${process.env.QUESTION_TIME_LIMIT || 20} seconds per question\n• One quiz attempt per day\n• Questions cover various anime series\n• Roles reset daily at ${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT`,
                        inline: false
                    }
                )
                .setFooter({ text: 'Ready to test your anime knowledge?' })
                .setTimestamp();

            await interaction.reply({
                embeds: [introEmbed],
                components: [{
                    type: 1,
                    components: [{
                        type: 2,
                        style: 3,
                        label: '🚀 Start Quiz',
                        custom_id: `start_quiz_${interaction.user.id}`,
                        emoji: { name: '🎌' }
                    }]
                }]
            });

            // Handle start quiz button
            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && i.customId === `start_quiz_${interaction.user.id}`,
                time: 60000,
                max: 1
            });

            collector.on('collect', async (buttonInteraction) => {
                await buttonInteraction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FFA500')
                            .setTitle('🎌 Preparing Your Quiz...')
                            .setDescription('🔄 Loading anime questions...\n\nThis may take a few moments.')
                            .setFooter({ text: 'Get ready for the challenge!' })
                    ],
                    components: []
                });

                // Start the quiz
                await interaction.quizManager.startQuiz(buttonInteraction, interaction.user.id, interaction.guild.id);
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    try {
                        await interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('#808080')
                                    .setTitle('⏰ Quiz Invitation Expired')
                                    .setDescription('You didn\'t start the quiz in time. Use `/quiz` again when you\'re ready!')
                                    .setFooter({ text: 'Take your time and come back when ready!' })
                            ],
                            components: []
                        });
                    } catch (error) {
                        // Ignore errors when editing expired interactions
                    }
                }
            });

        } catch (error) {
            console.error('Error in quiz command:', error);
            
            const errorMessage = {
                content: '❌ **Quiz Error**\n\nSomething went wrong while starting the quiz. Please try again.',
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },

    async showAlreadyCompleted(interaction, completion) {
        const tier = completion.tier || completion.score;
        const { TIER_NAMES, TIER_COLORS } = require('../utils/constants');
        
        // Get next reset time
        const nextReset = interaction.resetManager.getNextResetTime();
        
        const embed = new EmbedBuilder()
            .setColor(tier > 0 ? TIER_COLORS[tier] || '#4A90E2' : '#808080')
            .setTitle('📋 Quiz Already Completed Today')
            .setDescription('You\'ve already completed today\'s anime quiz!')
            .addFields(
                {
                    name: '📊 Your Results',
                    value: `**Score:** ${completion.score}/10 correct answers\n**Tier Earned:** ${tier > 0 ? `${tier} - ${TIER_NAMES[tier]}` : 'No tier earned'}`,
                    inline: true
                },
                {
                    name: '🕐 Next Quiz',
                    value: `<t:${nextReset.unix}:R>\n(${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT)`,
                    inline: true
                },
                {
                    name: '🏆 Current Status',
                    value: tier > 0 ? `You currently have the **${TIER_NAMES[tier]}** role!` : 'No role earned today',
                    inline: false
                }
            )
            .setFooter({ text: 'Come back tomorrow for a new challenge!' })
            .setTimestamp();
        
        return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
