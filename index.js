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
    }

    async initialize() {
        try {
            console.log('🎌 Initializing Anime Quiz Bot...');

            // Initialize database connections
            await this.initializeDatabase();
            
            // Initialize managers
            await this.initializeManagers();
            
            // Load commands
            await this.loadCommands();
            
            // Register slash commands
            await this.registerSlashCommands();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Setup daily reset scheduler
            this.setupDailyReset();
            
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
            // Initialize Redis (Priority 1)
            try {
                this.redisManager = new RedisManager();
                await this.redisManager.connect();
                console.log('✅ Redis connected successfully (Primary storage)');
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
        // Initialize Quiz Manager
        this.quizManager = new QuizManager(this.client, this.databaseManager, this.redisManager);
        
        // Initialize Reset Manager
        this.resetManager = new ResetManager(this.client, this.databaseManager, this.redisManager);
        
        console.log('✅ Managers initialized successfully');
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
        this.client.once('ready', () => {
            console.log(`⚓ Logged in as ${this.client.user.tag}`);
            console.log(`🏴‍☠️ Serving ${this.client.guilds.cache.size} server(s)`);
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

    setupDailyReset() {
        const resetHour = parseInt(process.env.DAILY_RESET_HOUR_EDT) || 0;
        const resetMinute = parseInt(process.env.DAILY_RESET_MINUTE_EDT) || 30;
        
        // Cron pattern: minute hour * * *
        const cronPattern = `${resetMinute} ${resetHour} * * *`;
        
        console.log(`⏰ Scheduling daily reset for ${resetHour}:${resetMinute.toString().padStart(2, '0')} EDT`);
        
        cron.schedule(cronPattern, async () => {
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

    async shutdown() {
        console.log('🛑 Shutting down Anime Quiz Bot...');
        
        try {
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

// Handle process termination
process.on('SIGINT', () => bot.shutdown());
process.on('SIGTERM', () => bot.shutdown());

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Start the bot
bot.initialize();
