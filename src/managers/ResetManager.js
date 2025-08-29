const { EmbedBuilder } = require('discord.js');

class ResetManager {
    constructor(client, databaseManager, redisManager) {
        this.client = client;
        this.db = databaseManager;
        this.redis = redisManager;
    }

    async performDailyReset() {
        try {
            const currentDate = this.getCurrentDate();
            
            // Check if reset already performed today
            if (this.redis?.connected) {
                const wasReset = await this.redis.wasResetCompleted(currentDate);
                if (wasReset) {
                    console.log(`⏭️ Daily reset already completed for ${currentDate}`);
                    return { success: true, alreadyCompleted: true };
                }
            }
            
            console.log(`🚨 Starting daily reset for ${currentDate}...`);
            
            let totalRolesRemoved = 0;
            let guildsProcessed = 0;
            let errors = 0;
            
            // Process each guild
            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    const rolesRemoved = await this.resetGuildTierRoles(guild);
                    totalRolesRemoved += rolesRemoved;
                    guildsProcessed++;
                    
                    console.log(`✅ Reset completed for guild ${guild.name}: ${rolesRemoved} roles removed`);
                    
                    // Small delay between guilds to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`❌ Error resetting guild ${guild.name}:`, error);
                    errors++;
                }
            }
            
            // Cleanup old data
            await this.cleanupOldData();
            
            // Mark reset as completed
            if (this.redis?.connected) {
                await this.redis.markResetCompleted(currentDate);
            }
            
            const resetResult = {
                success: true,
                date: currentDate,
                guildsProcessed,
                totalRolesRemoved,
                errors
            };
            
            console.log(`✅ Daily reset completed:`, resetResult);
            
            // Send reset notifications
            await this.sendResetNotifications(resetResult);
            
            return resetResult;
            
        } catch (error) {
            console.error('❌ Daily reset failed:', error);
            return { 
                success: false, 
                error: error.message,
                date: this.getCurrentDate()
            };
        }
    }

    async resetGuildTierRoles(guild) {
        try {
            let rolesRemoved = 0;
            
            // Process each tier role
            for (let tier = 1; tier <= 10; tier++) {
                const roleId = process.env[`TIER_${tier}_ROLE`];
                
                if (!roleId) {
                    console.warn(`⚠️ Tier ${tier} role not configured`);
                    continue;
                }
                
                const role = guild.roles.cache.get(roleId);
                if (!role) {
                    console.warn(`⚠️ Tier ${tier} role not found in guild ${guild.name}: ${roleId}`);
                    continue;
                }
                
                if (role.members.size === 0) {
                    continue; // No members to remove
                }
                
                console.log(`🔄 Removing Tier ${tier} role from ${role.members.size} members in ${guild.name}`);
                
                // Remove role from all members
                const memberArray = Array.from(role.members.values());
                const batchSize = 5; // Process in small batches to avoid rate limits
                
                for (let i = 0; i < memberArray.length; i += batchSize) {
                    const batch = memberArray.slice(i, i + batchSize);
                    
                    await Promise.allSettled(
                        batch.map(async (member) => {
                            try {
                                await member.roles.remove(role, `Daily reset - removing tier ${tier} role`);
                                rolesRemoved++;
                                console.log(`✅ Removed Tier ${tier} from ${member.user.username}`);
                            } catch (error) {
                                console.error(`❌ Failed to remove Tier ${tier} from ${member.user.username}:`, error.message);
                            }
                        })
                    );
                    
                    // Delay between batches to respect rate limits
                    if (i + batchSize < memberArray.length) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                
                // Additional delay between different tier roles
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            return rolesRemoved;
            
        } catch (error) {
            console.error(`❌ Error resetting roles in guild ${guild.name}:`, error);
            throw error;
        }
    }

    async cleanupOldData() {
        try {
            console.log('🧹 Starting data cleanup...');
            
            // Cleanup Redis expired keys
            let redisCleanup = 0;
            if (this.redis?.connected) {
                redisCleanup = await this.redis.cleanupExpiredKeys();
                
                // Also run Redis optimization
                await this.redis.optimizeQuestionCache();
            }
            
            // Cleanup old database records
            const dbCleanup = await this.db.cleanupOldData();
            
            console.log(`🧹 Cleanup completed: Redis ${redisCleanup} keys, Database ${dbCleanup.totalDeleted} records`);
            
            return {
                redis: redisCleanup,
                database: dbCleanup
            };
            
        } catch (error) {
            console.error('❌ Error during data cleanup:', error);
            return { redis: 0, database: { totalDeleted: 0 } };
        }
    }

    async sendResetNotifications(resetResult) {
        try {
            // This could be enhanced to send notifications to specific channels
            // For now, just log the completion
            
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🚨 Daily Reset Completed')
                .setDescription('All tier roles have been reset for the new day!')
                .addFields(
                    {
                        name: '📊 Reset Statistics',
                        value: `**Guilds Processed:** ${resetResult.guildsProcessed}\n**Roles Removed:** ${resetResult.totalRolesRemoved}\n**Errors:** ${resetResult.errors}`,
                        inline: true
                    },
                    {
                        name: '📅 Reset Date',
                        value: resetResult.date,
                        inline: true
                    }
                )
                .setFooter({ text: 'Quiz system ready for new challenges!' })
                .setTimestamp();
            
            // Could send to configured log channels here
            console.log('📢 Reset notification prepared (no channels configured)');
            
        } catch (error) {
            console.error('❌ Error sending reset notifications:', error);
        }
    }

    // Force manual reset
    async forceReset(triggeredBy = 'Manual') {
        try {
            console.log(`🚨 Force reset triggered by ${triggeredBy}`);
            
            // Perform reset regardless of previous completion
            const result = await this.performDailyReset();
            
            // Override any "already completed" status
            if (result.alreadyCompleted) {
                result.alreadyCompleted = false;
                result.forced = true;
                result.triggeredBy = triggeredBy;
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Force reset failed:', error);
            return {
                success: false,
                error: error.message,
                triggeredBy
            };
        }
    }

    // Check if reset is needed
    async isResetNeeded() {
        try {
            const currentDate = this.getCurrentDate();
            
            if (this.redis?.connected) {
                const wasReset = await this.redis.wasResetCompleted(currentDate);
                return !wasReset;
            }
            
            // Without Redis, we can't easily track if reset was completed
            // This could be enhanced with database tracking
            return false;
            
        } catch (error) {
            console.error('❌ Error checking reset status:', error);
            return false;
        }
    }

    // Get next reset time
    getNextResetTime() {
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
        
        return {
            utc: utcReset,
            edt: nextReset,
            unix: Math.floor(utcReset.getTime() / 1000),
            timeUntil: this.getTimeUntilReset(utcReset)
        };
    }

    getTimeUntilReset(resetTime) {
        const now = Date.now();
        const resetTimestamp = resetTime.getTime();
        const timeDiff = resetTimestamp - now;
        
        if (timeDiff <= 0) {
            return 'Reset time has passed';
        }
        
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    getCurrentDate() {
        const resetHour = parseInt(process.env.DAILY_RESET_HOUR_EDT) || 0;
        const resetMinute = parseInt(process.env.DAILY_RESET_MINUTE_EDT) || 30;
        
        const now = new Date();
        const edtOffset = this.isEDT(now) ? -4 : -5;
        const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
        
        const currentTimeInMinutes = (edtTime.getHours() * 60) + edtTime.getMinutes();
        const resetTimeInMinutes = (resetHour * 60) + resetMinute;
        
        // If it's before reset time, use previous day
        if (currentTimeInMinutes < resetTimeInMinutes) {
            edtTime.setDate(edtTime.getDate() - 1);
        }
        
        return edtTime.toISOString().split('T')[0];
    }

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
    }

    // Get reset status information
    async getResetStatus() {
        try {
            const currentDate = this.getCurrentDate();
            const nextReset = this.getNextResetTime();
            
            let wasResetToday = false;
            if (this.redis?.connected) {
                wasResetToday = await this.redis.wasResetCompleted(currentDate);
            }
            
            return {
                currentDate,
                wasResetToday,
                nextReset: nextReset,
                timeUntilReset: nextReset.timeUntil
            };
            
        } catch (error) {
            console.error('❌ Error getting reset status:', error);
            return {
                currentDate: this.getCurrentDate(),
                wasResetToday: false,
                error: error.message
            };
        }
    }
}

module.exports = ResetManager;
