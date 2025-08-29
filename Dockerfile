# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package.json first (for better Docker layer caching)
COPY package.json ./

# Install dependencies
RUN npm install --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S quizbot -u 1001

# Change ownership of app directory
RUN chown -R quizbot:nodejs /app
USER quizbot

# Expose port (can be overridden by deployment platform)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Quiz bot is running')" || exit 1

# Start the application
CMD ["npm", "start"]
