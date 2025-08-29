const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('⚔️ Take the daily anime quiz to earn powerful buffs!'),

    async execute(interaction) {
        try {
            // Check if quiz is restricted to specific channel
            const quizChannelId = process.env.QUIZ_CHANNEL_ID;
            if (quizChannelId && interaction.channel.id !== quizChannelId) {
                const channelMention = `<#${quizChannelId}>`;
                
                return await interaction.reply({
                    content: `⚓ **Wrong Channel!**\n\nThe anime quiz is only available in ${channelMention}\n\nHead there to start your challenge!`,
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
                    content: '⚔️ **Active Quest Detected**\n\nYou already have an ongoing challenge!\n\n*Complete your current quest first.*',
                    ephemeral: true
                });
            }

            // Show quiz introduction
            const introEmbed = new EmbedBuilder()
                .setColor('#FF6B35')
                .setTitle('⚔️ Daily Anime Quiz')
                .setDescription(`**Test your anime knowledge to earn powerful buffs!**`)
                .addFields(
                    {
                        name: '📋 How it Works',
                        value: `🎯 Answer **10 anime questions**\n⏱️ **${process.env.QUESTION_TIME_LIMIT || 20} seconds** per question\n🏆 **Score determines your buff tier**\n🌅 **Resets daily** at ${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT`,
                        inline: false
                    },
                    {
                        name: '🎯 Buff Tiers',
                        value: `⚪ **1**: Common Buff\n🟢 **2**: Uncommon Buff\n🔵 **3**: Rare Buff\n🟣 **4**: Epic Buff\n🟡 **5-6**: Legendary Buff\n🟠 **7-8**: Mythical Buff\n🔴 **9-10**: Divine Buff`,
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
                        label: '⚔️ START QUIZ',
                        custom_id: `start_quiz_${interaction.user.id}`,
                        emoji: { name: '🎯' }
                    }]
                }]
            });

            // Handle start quiz button
            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && i.customId === `start_quiz_${interaction.user.id}`,
                time: 90000,
                max: 1
            });

            collector.on('collect', async (buttonInteraction) => {
                await buttonInteraction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FF9500')
                            .setTitle('🌊 Loading Questions...')
                            .setDescription(`**Preparing your anime challenge**\n\nGathering questions from across all anime series...\n\n*This may take a moment!*`)
                            .setFooter({ text: 'Get ready to prove your anime knowledge!' })
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
                                    .setColor('#708090')
                                    .setTitle('⏰ Quiz Invitation Expired')
                                    .setDescription('**Time\'s up!**\n\nYou didn\'t start the quiz in time.\n\n*Use `/quiz` again when you\'re ready!*')
                                    .setFooter({ text: 'Challenge awaits when you return!' })
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
                content: '💀 **Error**\n\nSomething went wrong while preparing your challenge.\n\n*Please try again!*',
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
                    value: `**Available:** <t:${nextReset.unix}:R>\n**Reset:** ${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT`,
                    inline: true
                },
                {
                    name: '🏆 Current Status',
                    value: tier > 0 ? `You currently wield the **${TIER_NAMES[tier]}**!` : '*Train harder tomorrow!*',
                    inline: false
                }
            )
            .setFooter({ text: 'Return tomorrow for a new challenge!' })
            .setTimestamp();
        
        return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
