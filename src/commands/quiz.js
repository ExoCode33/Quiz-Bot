const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('⚔️ Embark on the Grand Line anime quiz challenge to earn legendary powers!'),

    async execute(interaction) {
        try {
            // Check if quiz is restricted to specific channel
            const quizChannelId = process.env.QUIZ_CHANNEL_ID;
            if (quizChannelId && interaction.channel.id !== quizChannelId) {
                const channelMention = `<#${quizChannelId}>`;
                
                return await interaction.reply({
                    content: `⚓ **Wrong Waters, Pirate!**\n\n🌊 The Grand Line anime quiz can only be challenged in ${channelMention}\n\n🏴‍☠️ Set sail to the correct channel to begin your legendary journey!`,
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
                    content: '⚔️ **Active Grand Line Quest Detected**\n\n🌊 You already have an ongoing adventure on the Grand Line!\n\n*Complete your current journey before starting another, brave pirate!*',
                    ephemeral: true
                });
            }

            // Show quiz introduction
            const introEmbed = new EmbedBuilder()
                .setColor('#FF6B35')
                .setTitle('🏴‍☠️ GRAND LINE ANIME CHALLENGE')
                .setDescription(`**Welcome to the treacherous Grand Line, future Pirate King!** ⚔️\n\n🌊 The most dangerous sea awaits your anime knowledge!\n\n*Test your mastery of anime to earn legendary powers that will make even the Yonko tremble!*`)
                .addFields(
                    {
                        name: '⚔️ How the Challenge Works',
                        value: `🗺️ Navigate through **10 perilous anime questions**\n⚡ Each victory brings you closer to legendary status\n🏆 Your final battle score determines your earned power\n🌅 Powers reset daily for fresh Grand Line adventures`,
                        inline: false
                    },
                    {
                        name: '🏴‍☠️ Power Hierarchy (Devil Fruit System)',
                        value: `⚪ **1 victory**: Common Buff - *A humble pirate's blessing*\n🟢 **2 victories**: Uncommon Buff - *Growing power flows through you*\n🔵 **3 victories**: Rare Buff - *Grand Line treasures enhance your abilities*\n🟣 **4 victories**: Epic Buff - *Supernova-level might*\n🟡 **5-6 victories**: Legendary Buff - *Rivaling the Yonko themselves*\n🟠 **7-8 victories**: Mythical Buff - *Transcending mortal limits*\n🔴 **9-10 victories**: Divine Buff - *Achieving Pirate King status*`,
                        inline: false
                    },
                    {
                        name: '⚓ Grand Line Rules',
                        value: `⏰ **${process.env.QUESTION_TIME_LIMIT || 20} seconds** per question - *The sea waits for no one*\n🗓️ **One adventure per day** - *Even pirates need rest*\n🌊 **Questions span all anime seas** - *From East Blue to New World*\n🌅 **Daily reset at ${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT** - *Fresh challenges await*`,
                        inline: false
                    }
                )
                .setFooter({ text: '🏴‍☠️ Are you ready to conquer the Grand Line and claim your destiny?' })
                .setTimestamp();

            await interaction.reply({
                embeds: [introEmbed],
                components: [{
                    type: 1,
                    components: [{
                        type: 2,
                        style: 3,
                        label: '⚔️ SET SAIL NOW!',
                        custom_id: `start_quiz_${interaction.user.id}`,
                        emoji: { name: '🏴‍☠️' }
                    }]
                }]
            });

            // Handle start quiz button
            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && i.customId === `start_quiz_${interaction.user.id}`,
                time: 90000, // 1.5 minutes
                max: 1
            });

            collector.on('collect', async (buttonInteraction) => {
                await buttonInteraction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FF9500')
                            .setTitle('🌊 Charting Course Through the Grand Line...')
                            .setDescription(`**Preparing Your Legendary Adventure** ⚔️\n\n🗺️ Gathering the most treacherous anime challenges from across all seas...\n⚡ Loading questions that would make even Whitebeard sweat...\n🏴‍☠️ Calibrating your Devil Fruit powers...\n\n*This may take a moment as we prepare only the finest Grand Line trials!*`)
                            .addFields(
                                {
                                    name: '🌊 Current Status',
                                    value: '`████████░░` 80% - Almost ready to sail!',
                                    inline: false
                                }
                            )
                            .setFooter({ text: 'Get ready to prove your anime mastery, future Pirate King!' })
                            .setTimestamp()
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
                                    .setTitle('⚓ Adventure Invitation Expired')
                                    .setDescription('🌊 **The tides have changed, pirate...**\n\nYou didn\'t set sail in time for your Grand Line adventure.\n\n*The sea is patient, but not forever. Use `/quiz` again when your spirit burns for adventure!*')
                                    .setFooter({ text: '🏴‍☠️ The Grand Line awaits your return, brave soul!' })
                                    .setTimestamp()
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
                content: '💀 **Navigation Error on the Grand Line**\n\n🌊 A terrible storm has struck! Something went wrong while preparing your legendary adventure.\n\n⚔️ *Please try setting sail again, brave pirate!*',
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
            .setTitle('📋 Today\'s Grand Line Adventure Complete')
            .setDescription('**Your legendary journey is already complete for today, pirate!** 🏴‍☠️\n\nYou\'ve already conquered today\'s Grand Line challenges and proven your anime mastery!')
            .addFields(
                {
                    name: '⚔️ Your Battle Results',
                    value: `**Victories Claimed:** ${completion.score}/10 battles won\n**Power Earned:** ${tier > 0 ? `${TIER_EMOJIS[tier]} ${TIER_NAMES[tier]}` : '💀 No power gained'}`,
                    inline: true
                },
                {
                    name: '🌅 Next Grand Line Adventure',
                    value: `**Available:** <t:${nextReset.unix}:R>\n**Reset Time:** ${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT`,
                    inline: true
                },
                {
                    name: '🏆 Current Power Status',
                    value: tier > 0 ? `⚡ **You currently wield the ${TIER_NAMES[tier]}!**\n\n*Your legendary power resonates across all seas! Even the Marines recognize your strength!*` : '💀 *No Devil Fruit powers today - train harder tomorrow, aspiring pirate!*\n\n*Remember: Even Luffy started from the bottom!*',
                    inline: false
                }
            )
            .setFooter({ text: '🏴‍☠️ Return tomorrow for a new legendary Grand Line challenge!' })
            .setTimestamp();
        
        return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
