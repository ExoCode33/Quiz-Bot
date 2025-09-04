const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const { Pool } = require('pg');
const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// Load environment variables
require('dotenv').config();

// Import managers
const DatabaseManager = require('./src/managers/DatabaseManager');
const RedisManager = require('./src/managers/RedisManager');
const QuizManager = require('./src/managers/QuizManager');
const ResetManager = require('./src/managers/ResetManager');

class AnimeQuizBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });

        this.databaseManager = null;
        this.redisManager = null;
        this.quizManager = null;
        this.resetManager = null;
        this.commands = new Map();
        this.isShuttingDown = false;
    }

    async initialize() {
        try {
            console.log('🎌 Initializing Anime Quiz Bot...');

            // Initialize database connections
            await this.initializeDatabase();
            
            // Initialize managers with proper Redis initialization
            await this.initializeManagers();
            
            // Load commands
            await this.loadCommands();
            
            // Register slash commands
            await this.registerSlashCommands();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Setup daily reset scheduler
            this.setupDailyReset();
            
            // Setup periodic cleanup
            this.setupPeriodicCleanup();
            
            // Login to Discord
            await this.client.login(process.env.DISCORD_TOKEN);
            
            console.log('✅ Anime Quiz Bot initialized successfully!');
            
        } catch (error) {
            console.error('❌ Failed to initialize bot:', error);
            process.exit(1);
        }
    }

    async initializeDatabase() {
        try {
            // Initialize Redis (Priority 1) with proper bot isolation
            try {
                this.redisManager = new RedisManager();
                await this.redisManager.connect();
                console.log('✅ Redis connected successfully (Primary storage)');
                
                // Verify Redis key isolation
                console.log(`📡 Redis using prefix: "${this.redisManager.prefix}" for key isolation`);
                
            } catch (redisError) {
                console.log('⚠️ Redis connection failed, falling back to PostgreSQL:', redisError.message);
            }

            // Initialize PostgreSQL (Fallback or primary if Redis fails)
            this.databaseManager = new DatabaseManager();
            await this.databaseManager.connect();
            console.log('✅ PostgreSQL connected successfully');

        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    async initializeManagers() {
        try {
            // Initialize Quiz Manager
            this.quizManager = new QuizManager(this.client, this.databaseManager, this.redisManager);
            
            // Initialize Reset Manager
            this.resetManager = new ResetManager(this.client, this.databaseManager, this.redisManager);
            
            // CRITICAL: Initialize QuestionLoader with Redis after Redis is connected
            if (this.quizManager.questionLoader && this.redisManager?.connected) {
                console.log('🔄 Initializing QuestionLoader with Redis connection...');
                await this.quizManager.questionLoader.initializeWithRedis(this.redisManager);
                console.log('✅ QuestionLoader Redis initialization completed');
            } else if (this.quizManager.questionLoader) {
                console.log('⚠️ Redis not available, initializing QuestionLoader without Redis...');
                await this.quizManager.questionLoader.initializeQuestionPools();
                console.log('✅ QuestionLoader fallback initialization completed');
            } else {
                console.warn('⚠️ QuestionLoader not found in QuizManager');
            }
            
            console.log('✅ All managers initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing managers:', error);
            throw error;
        }
    }

    async loadCommands() {
        // Load only the quiz command
        const quizCommand = require('./src/commands/quiz');
        
        if ('data' in quizCommand && 'execute' in quizCommand) {
            this.commands.set(quizCommand.data.name, quizCommand);
            console.log(`📋 Loaded command: ${quizCommand.data.name}`);
        } else {
            console.warn(`⚠️ Quiz command is missing required "data" or "execute" property.`);
        }
        
        // Load debug command if it exists (optional)
        try {
            const debugCommand = require('./src/commands/debug');
            if ('data' in debugCommand && 'execute' in debugCommand) {
                this.commands.set(debugCommand.data.name, debugCommand);
                console.log(`📋 Loaded command: ${debugCommand.data.name}`);
            }
        } catch (error) {
            console.log('ℹ️ Debug command not found (optional)');
        }
        
        console.log(`✅ Loaded ${this.commands.size} command(s)`);
    }

    async registerSlashCommands() {
        if (!process.env.CLIENT_ID) {
            console.warn('⚠️ CLIENT_ID not set, skipping slash command registration');
            return;
        }

        try {
            const commands = Array.from(this.commands.values()).map(command => command.data.toJSON());
            
            const rest = new REST().setToken(process.env.DISCORD_TOKEN);
            
            console.log('🔄 Started refreshing application (/) commands...');
            
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            
            console.log(`✅ Successfully reloaded ${commands.length} application (/) commands`);
        } catch (error) {
            console.error('❌ Error registering slash commands:', error);
        }
    }

    setupEventHandlers() {
        this.client.once('clientReady', async () => {
            console.log(`⚓ Logged in as ${this.client.user.tag}`);
            console.log(`🏴‍☠️ Serving ${this.client.guilds.cache.size} server(s)`);
            
            // Log Redis status
            if (this.redisManager?.connected) {
                console.log('📡 Redis optimization active - faster quiz loading enabled');
            }
            
            // Check system status after everything is ready
            setTimeout(async () => {
                await this.checkSystemStatus();
            }, 10000); // Wait 10 seconds for everything to initialize
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const command = this.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                // Pass managers to commands
                interaction.quizManager = this.quizManager;
                interaction.resetManager = this.resetManager;
                interaction.databaseManager = this.databaseManager;
                interaction.redisManager = this.redisManager;
                
                await command.execute(interaction);
            } catch (error) {
                console.error('Error executing command:', error);
                
                const errorMessage = {
                    content: 'There was an error while executing this command!',
                    ephemeral: true
                };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        });

        this.client.on('error', error => {
            console.error('Discord client error:', error);
        });

        this.client.on('warn', warning => {
            console.warn('Discord client warning:', warning);
        });
    }

    async checkSystemStatus() {
        try {
            console.log('\n🔍 SYSTEM STATUS CHECK');
            console.log('═══════════════════════════════════════');
            
            // Database status
            console.log(`Database: ${this.databaseManager?.connected ? '✅ Connected' : '❌ Disconnected'}`);
            
            // Redis status
            if (this.redisManager?.connected) {
                try {
                    const stats = await this.redisManager.getStats();
                    console.log(`Redis: ✅ Connected (${stats?.ourKeys || 0}/${stats?.totalKeysInRedis || 0} keys)`);
                    console.log(`Redis Prefix: "${this.redisManager.prefix}" (isolated from other bots)`);
                } catch (err) {
                    console.log('Redis: ✅ Connected (stats unavailable)');
                }
            } else {
                console.log('Redis: ❌ Disconnected');
            }
            
            // Question system status
            if (this.quizManager?.questionLoader) {
                await this.quizManager.questionLoader.getComprehensiveStatus();
            }
            
            console.log('═══════════════════════════════════════\n');
            
        } catch (error) {
            console.error('❌ Error checking system status:', error);
        }
    }

    setupDailyReset() {
        const resetHour = parseInt(process.env.DAILY_RESET_HOUR_EDT) || 0;
        const resetMinute = parseInt(process.env.DAILY_RESET_MINUTE_EDT) || 30;
        
        // Cron pattern: minute hour * * *
        const cronPattern = `${resetMinute} ${resetHour} * * *`;
        
        console.log(`⏰ Scheduling daily reset for ${resetHour}:${resetMinute.toString().padStart(2, '0')} EDT`);
        
        cron.schedule(cronPattern, async () => {
            if (this.isShuttingDown) return;
            
            try {
                console.log('🚨 Starting daily reset...');
                await this.resetManager.performDailyReset();
                console.log('✅ Daily reset completed successfully');
            } catch (error) {
                console.error('❌ Daily reset failed:', error);
            }
        }, {
            timezone: 'America/New_York'  // EDT timezone
        });
    }

    setupPeriodicCleanup() {
        // Run cleanup every 30 minutes
        cron.schedule('*/30 * * * *', async () => {
            if (this.isShuttingDown) return;
            
            try {
                console.log('🧹 Running periodic cleanup...');
                
                // Clean up expired preloaded questions from memory
                if (this.quizManager?.questionLoader) {
                    this.quizManager.questionLoader.cleanupPreloadedQuestions();
                }
                
                // Clean up Redis expired keys (only our bot's keys)
                if (this.redisManager?.connected) {
                    await this.redisManager.cleanupExpiredKeys();
                }
                
                console.log('✅ Periodic cleanup completed');
            } catch (error) {
                console.error('❌ Periodic cleanup failed:', error);
            }
        });

        // Run Redis optimization every 2 hours
        cron.schedule('0 */2 * * *', async () => {
            if (this.isShuttingDown) return;
            
            try {
                if (this.redisManager?.connected) {
                    console.log('🔧 Running Redis optimization...');
                    await this.redisManager.optimizeQuestionCache();
                    console.log('✅ Redis optimization completed');
                }
            } catch (error) {
                console.error('❌ Redis optimization failed:', error);
            }
        });

        console.log('⚙️ Scheduled periodic cleanup and optimization tasks');
    }

    async shutdown() {
        if (this.isShuttingDown) {
            console.log('⚠️ Shutdown already in progress...');
            return;
        }
        
        this.isShuttingDown = true;
        console.log('🛑 Shutting down Anime Quiz Bot...');
        
        try {
            // Stop question loader systems
            if (this.quizManager?.questionLoader) {
                this.quizManager.questionLoader.cleanup();
            }
            
            // Close database connections
            if (this.redisManager) {
                await this.redisManager.disconnect();
            }
            
            if (this.databaseManager) {
                await this.databaseManager.disconnect();
            }
            
            // Destroy Discord client
            this.client.destroy();
            
            console.log('👋 Bot shutdown complete!');
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
        }
        
        process.exit(0);
    }
}

// Create bot instance
const bot = new AnimeQuizBot();

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, initiating graceful shutdown...');
    bot.shutdown();
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, initiating graceful shutdown...');
    bot.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    bot.shutdown();
});

// Start the bot
bot.initialize().catch(error => {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
});
