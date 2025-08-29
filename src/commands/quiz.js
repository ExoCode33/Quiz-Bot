const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('🏴‍☠️ Start the daily anime quiz challenge to earn powerful buffs!'),

    async execute(interaction) {
        try {
            // Check if quiz is restricted to specific channel
            const quizChannelId = process.env.QUIZ_CHANNEL_ID;
            if (quizChannelId && interaction.channel.id !== quizChannelId) {
                const channelMention = `<#${quizChannelId}>`;
                
                return await interaction.reply({
                    content: `❌ **Wrong Waters, Pirate!**\n\nThe anime quiz can only be used in ${channelMention}.\n\nSail to the correct channel to start your Grand Line challenge!`,
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
                    content: '❌ **Active Quest Detected**\n\nYou already have an active quiz session. Complete your current adventure first!',
                    ephemeral: true
                });
            }

            // Show quiz introduction
            const introEmbed = new EmbedBuilder()
                .setColor('#4A90E2')
                .setTitle('🏴‍☠️ Daily Anime Quiz Challenge')
                .setDescription('**Welcome to the Grand Line, future pirate!**\n\nTest your anime knowledge to earn powerful buffs for your journey!\n\n**How it works:**\n🗺️ Answer 10 challenging questions about anime\n⚔️ Each correct answer brings you closer to legendary power\n🎯 Your final score determines your buff tier\n🌅 Buffs reset daily for fresh adventures')
                .addFields(
                    {
                        name: '🎯 Buff System',
                        value: '⚪ **1 correct**: Common Buff\n🟢 **2 correct**: Uncommon Buff\n🔵 **3 correct**: Rare Buff\n🟣 **4 correct**: Epic Buff\n🟡 **5-6 correct**: Legendary Buff\n🟠 **7-8 correct**: Mythical Buff\n🔴 **9-10 correct**: Divine Buff',
                        inline: false
                    },
                    {
                        name: '⚔️ Quest Rules',
                        value: `⏰ ${process.env.QUESTION_TIME_LIMIT || 20} seconds per question\n🗓️ One challenge per day\n🌊 Questions span the vast seas of anime\n🌅 Buffs reset daily at ${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT`,
                        inline: false
                    }
                )
                .setFooter({ text: 'Ready to set sail on your anime adventure?' })
                .setTimestamp();

            await interaction.reply({
                embeds: [introEmbed],
                components: [{
                    type: 1,
                    components: [{
                        type: 2,
                        style: 3,
                        label: '🚀 Begin Quest',
                        custom_id: `start_quiz_${interaction.user.id}`,
                        emoji: { name: '🏴‍☠️' }
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
                            .setTitle('🏴‍☠️ Preparing Your Grand Line Adventure...')
                            .setDescription('🌊 Loading anime challenges from across the seas...\n\nThis may take a few moments as we gather the best questions!')
                            .setFooter({ text: 'Get ready to prove your anime mastery!' })
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
                                    .setTitle('⏰ Quest Invitation Expired')
                                    .setDescription('You didn\'t start your adventure in time. Use `/quiz` again when you\'re ready to set sail!')
                                    .setFooter({ text: 'The Grand Line awaits when you\'re ready!' })
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
                content: '❌ **Quest Error**\n\nSomething went wrong while preparing your adventure. Please try again, brave pirate!',
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
            .setTitle('📋 Today\'s Adventure Complete')
            .setDescription('You\'ve already completed today\'s Grand Line challenge, pirate!')
            .addFields(
                {
                    name: '📊 Your Results',
                    value: `**Score:** ${completion.score}/10 correct answers\n**Buff Earned:** ${tier > 0 ? `${TIER_EMOJIS[tier]} ${TIER_NAMES[tier]}` : 'No buff earned'}`,
                    inline: true
                },
                {
                    name: '🌅 Next Adventure',
                    value: `<t:${nextReset.unix}:R>\n(${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT)`,
                    inline: true
                },
                {
                    name: '⚔️ Current Power',
                    value: tier > 0 ? `You currently wield the **${TIER_NAMES[tier]}**!` : 'No power boost today - train harder tomorrow!',
                    inline: false
                }
            )
            .setFooter({ text: 'Return tomorrow for a new Grand Line challenge!' })
            .setTimestamp();
        
        return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
