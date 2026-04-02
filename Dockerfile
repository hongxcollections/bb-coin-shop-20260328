FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy ALL files at once (including pre-built dist/)
COPY . .

# Install production dependencies only (skip build - using pre-built dist)
RUN pnpm install --frozen-lockfile

# Remove dev dependencies
RUN pnpm prune --prod

# Expose port
EXPOSE 3000

# Start the application (dist is pre-built and committed)
CMD ["node", "dist/index.js"]
