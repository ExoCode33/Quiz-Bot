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
                    content: '⚔️ **Active Quiz Detected**\n\nYou already have an ongoing quiz!\n\n*Complete your current quiz first.*',
                    ephemeral: true
                });
            }

            // Preload questions immediately for instant quiz start
            console.log(`🔄 Preloading questions for user ${interaction.user.id}...`);
            interaction.quizManager.preloadQuestions(interaction.user.id, interaction.guild.id).catch(console.error);

            // Show quiz introduction
            const introEmbed = new EmbedBuilder()
                .setColor('#FF6B35')
                .setTitle('⚔️ Daily Anime Quiz')
                .setDescription(`**Test your anime knowledge to earn powerful buffs!**`)
                .addFields(
                    {
                        name: '📋 How it Works',
                        value: `🎯 Answer **10 anime questions**\n⏱️ **${process.env.QUESTION_TIME_LIMIT || 20} seconds** per question\n🏆 **Score determines your buff tier**\n🌅 **Resets daily** <t:${this.getNextResetTimestamp()}:t>`,
                        inline: false
                    },
                    {
                        name: '🎯 Buff Tiers',
                        value: `⚪ **1**: Common Buff\n🟢 **2**: Uncommon Buff\n🔵 **3**: Rare Buff\n🟣 **4**: Epic Buff\n🟡 **5-6**: Legendary Buff\n🟠 **7-8**: Mythical Buff\n🔴 **9-10**: Divine Buff`,
                        inline: false
                    },
                    {
                        name: '🎲 Special Features',
                        value: `🔄 **3 Rerolls** per quiz\n⚡ **Instant Start** - questions preloaded\n📊 **Live Progress** tracking`,
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
                            .setTitle('🚀 Starting Quiz...')
                            .setDescription(`**Loading your anime quiz**\n\nQuestions are ready! Starting immediately...\n\n*Let's test your knowledge!*`)
                            .setFooter({ text: 'Get ready to prove your anime expertise!' })
                    ],
                    components: []
                });

                // Start the quiz immediately with preloaded questions
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
                content: '💀 **Error**\n\nSomething went wrong while preparing your quiz.\n\n*Please try again!*',
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },

    getNextResetTimestamp() {
        const resetHour = parseInt(process.env.DAILY_RESET_HOUR_EDT) || 0;
        const resetMinute = parseInt(process.env.DAILY_RESET_MINUTE_EDT) || 30;
        
        const now = new Date();
        const edtOffset = this.isEDT(now) ? -4 : -5;
        const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
        
        let nextReset = new Date(edtTime);
        nextReset.setHours(resetHour, resetMinute, 0, 0);
        
        const currentTimeInMinutes = (edtTime.getHours() * 60) + edtTime.getMinutes();
        const resetTimeInMinutes = (resetHour * 60) + resetMinute;
        
        // If it's already past reset time today, set for tomorrow
        if (currentTimeInMinutes >= resetTimeInMinutes) {
            nextReset.setDate(nextReset.getDate() + 1);
        }
        
        // Convert back to UTC
        const utcReset = new Date(nextReset.getTime() - (edtOffset * 60 * 60 * 1000));
        
        return Math.floor(utcReset.getTime() / 1000);
    },

    isEDT(date) {
        const year = date.getFullYear();
        
        // Second Sunday in March at 2:00 AM
        const marchSecondSunday = new Date(year, 2, 1);
        marchSecondSunday.setDate(1 + (14 - marchSecondSunday.getDay()) % 7);
        marchSecondSunday.setDate(marchSecondSunday.getDate() + 7);
        marchSecondSunday.setHours(2, 0, 0, 0);
        
        // First Sunday in November at 2:00 AM
        const novemberFirstSunday = new Date(year, 10, 1);
        novemberFirstSunday.setDate(1 + (7 - novemberFirstSunday.getDay()) % 7);
        novemberFirstSunday.setHours(2, 0, 0, 0);
        
        return date >= marchSecondSunday && date < novemberFirstSunday;
    },

    async showAlreadyCompleted(interaction, completion) {
        const tier = completion.tier || completion.score;
        const { TIER_NAMES, TIER_COLORS, TIER_EMOJIS } = require('../utils/constants');
        
        // Get next reset time
        const nextReset = interaction.resetManager.getNextResetTime();
        
        const embed = new EmbedBuilder()
            .setColor(tier > 0 ? TIER_COLORS[tier] || '#4A90E2' : '#808080')
            .setTitle('📋 Today\'s Quiz Complete')
            .setDescription('**You\'ve already completed today\'s quiz!**')
            .addFields(
                {
                    name: '⚔️ Your Results',
                    value: `**Score:** ${completion.score}/10\n**Buff:** ${tier > 0 ? `${TIER_EMOJIS[tier]} ${TIER_NAMES[tier]}` : 'None'}`,
                    inline: true
                },
                {
                    name: '🌅 Next Quiz',
                    value: `**Available:** <t:${nextReset.unix}:R>\n**Reset:** ${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT`,
                    inline: true
                },
                {
                    name: '🏆 Current Status',
                    value: tier > 0 ? `You currently wield the **${TIER_NAMES[tier]}**!` : '*Train harder tomorrow!*',
                    inline: false
                }
            )
            .setFooter({ text: 'Return tomorrow for a new quiz!' })
            .setTimestamp();
        
        return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
