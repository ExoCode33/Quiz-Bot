const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('📚 Take the daily anime quiz with Nico Robin to unlock ancient knowledge!'),

    async execute(interaction) {
        try {
            // Check if quiz is restricted to specific channel
            const quizChannelId = process.env.QUIZ_CHANNEL_ID;
            if (quizChannelId && interaction.channel.id !== quizChannelId) {
                const channelMention = `<#${quizChannelId}>`;
                
                return await interaction.reply({
                    content: `🌸 **Wrong Library!**\n\nThe ancient knowledge quiz is only available in ${channelMention}\n\n*Head there to begin your scholarly journey!*`,
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
                    content: '📖 **Active Study Session**\n\nYou already have an ongoing quiz with me!\n\n*Complete your current session first, archaeologist.*',
                    ephemeral: true
                });
            }

            // Preload questions immediately for instant quiz start
            console.log(`🔄 Preloading questions for user ${interaction.user.id}...`);
            interaction.quizManager.preloadQuestions(interaction.user.id, interaction.guild.id).catch(console.error);

            // Prepare the anime.gif attachment
            let attachment = null;
            const gifPath = path.join(process.cwd(), 'assets', 'anime.gif');
            
            try {
                if (fs.existsSync(gifPath)) {
                    attachment = new AttachmentBuilder(gifPath, { name: 'anime.gif' });
                } else {
                    console.warn('⚠️ anime.gif not found at:', gifPath);
                }
            } catch (error) {
                console.warn('⚠️ Error loading anime.gif:', error.message);
            }

            // Show quiz introduction with Nico Robin theme
            const introEmbed = new EmbedBuilder()
                .setColor('#6B4E8D') // Nico Robin's purple theme
                .setTitle('📚 Ancient Knowledge Quiz')
                .setDescription(`**"Knowledge is a weapon. Are you ready to wield it?"**\n\n*Test your anime wisdom to unlock the secrets of ancient power!*`)
                .addFields(
                    {
                        name: '🔍 Archaeological Rules',
                        value: `📜 Answer **10 anime questions** carefully\n⏳ **${process.env.QUESTION_TIME_LIMIT || 20} seconds** per question\n🏺 **Score determines ancient power gained**\n🌅 **Resets daily** <t:${this.getNextResetTimestamp()}:t>`,
                        inline: false
                    },
                    {
                        name: '🏺 Ancient Power Tiers',
                        value: `⚪ **1**: Novice Scholar\n🟢 **2**: Apprentice Historian\n🔵 **3**: Skilled Archaeologist\n🟣 **4**: Expert Researcher\n🟡 **5-6**: Master of Poneglyphs\n🟠 **7-8**: Devil Child Wisdom\n🔴 **9-10**: Ohara's Legacy`,
                        inline: false
                    },
                    {
                        name: '📖 Special Abilities',
                        value: `🎲 **3 Rerolls** per quiz\n⚡ **Instant Start** - knowledge preloaded\n📊 **Live Progress** - watch your growth\n🌸 **Hana Hana no Mi** enhancement`,
                        inline: false
                    }
                )
                .setFooter({ text: '"The desire to know is what makes us human." - Nico Robin' });

            // Add image if available
            if (attachment) {
                introEmbed.setImage('attachment://anime.gif');
            }

            const embedData = { embeds: [introEmbed] };
            if (attachment) {
                embedData.files = [attachment];
            }

            embedData.components = [{
                type: 1,
                components: [{
                    type: 2,
                    style: 1, // Primary style (blue)
                    label: '📚 BEGIN QUIZ',
                    custom_id: `start_quiz_${interaction.user.id}`,
                    emoji: { name: '🌸' }
                }]
            }];

            await interaction.reply(embedData);

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
                            .setColor('#8B4B9C')
                            .setTitle('🌸 Hana Hana no Mi: Activate!')
                            .setDescription(`**"Let me bloom your knowledge..."**\n\nNico Robin is preparing your anime quiz questions with care.\n\n*The ancient texts are ready for your examination!*`)
                            .setFooter({ text: '"I want to live!" - Show me your determination!' })
                    ],
                    components: [],
                    files: attachment ? [attachment] : []
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
                                    .setTitle('⏰ Study Session Expired')
                                    .setDescription('**"Time has passed like the sands of Alabasta..."**\n\nYou didn\'t begin your quiz in time.\n\n*Use `/quiz` again when you\'re ready to learn!*')
                                    .setFooter({ text: '"History repeats itself." - Try again when ready!' })
                            ],
                            components: [],
                            files: []
                        });
                    } catch (error) {
                        // Ignore errors when editing expired interactions
                    }
                }
            });

        } catch (error) {
            console.error('Error in quiz command:', error);
            
            const errorMessage = {
                content: '💀 **"Something went wrong in the library..."**\n\nNico Robin encountered an error while preparing your quiz.\n\n*Please try again, archaeologist!*',
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
        
        // Prepare the anime.gif attachment
        let attachment = null;
        const gifPath = path.join(process.cwd(), 'assets', 'anime.gif');
        
        try {
            if (fs.existsSync(gifPath)) {
                attachment = new AttachmentBuilder(gifPath, { name: 'anime.gif' });
            }
        } catch (error) {
            console.warn('⚠️ Error loading anime.gif for completion message:', error.message);
        }
        
        const embed = new EmbedBuilder()
            .setColor(tier > 0 ? TIER_COLORS[tier] || '#6B4E8D' : '#808080')
            .setTitle('📚 Today\'s Knowledge Acquired')
            .setDescription('**"You\'ve already studied with me today, archaeologist."**\n\n*Your wisdom has been recorded in the ancient texts.*')
            .addFields(
                {
                    name: '🔍 Your Archaeological Results',
                    value: `**Knowledge Score:** ${completion.score}/10\n**Ancient Power:** ${tier > 0 ? `${TIER_EMOJIS[tier]} ${this.getNicoRobinTierName(tier)}` : 'None'}`,
                    inline: true
                },
                {
                    name: '🌅 Next Study Session',
                    value: `**Available:** <t:${nextReset.unix}:R>\n**Library Opens:** ${process.env.DAILY_RESET_HOUR_EDT || 0}:${(process.env.DAILY_RESET_MINUTE_EDT || 30).toString().padStart(2, '0')} EDT`,
                    inline: true
                },
                {
                    name: '🏺 Current Wisdom Level',
                    value: tier > 0 ? 
                        `You currently possess **${this.getNicoRobinTierName(tier)}**!\n\n*"Knowledge is never a burden."*` : 
                        '*Continue studying to unlock ancient powers!*\n\n*"Even a small mistake can lead to great discoveries."*',
                    inline: false
                }
            )
            .setFooter({ text: '"The books I read in my childhood were my treasures." - Return tomorrow!' });

        // Add image if available
        if (attachment) {
            embed.setImage('attachment://anime.gif');
        }

        const replyData = { embeds: [embed], ephemeral: true };
        if (attachment) {
            replyData.files = [attachment];
        }
        
        return await interaction.reply(replyData);
    },

    getNicoRobinTierName(tier) {
        const nicoRobinTiers = {
            0: 'No Ancient Knowledge',
            1: 'Novice Scholar',
            2: 'Apprentice Historian', 
            3: 'Skilled Archaeologist',
            4: 'Expert Researcher',
            5: 'Master of Poneglyphs',
            6: 'Master of Poneglyphs',
            7: 'Devil Child Wisdom',
            8: 'Devil Child Wisdom',
            9: 'Ohara\'s Legacy',
            10: 'Ohara\'s Legacy'
        };
        
        return nicoRobinTiers[tier] || 'Unknown Power';
    }
};
