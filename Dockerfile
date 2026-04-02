FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application (frontend + server bundle)
RUN pnpm build

# Remove dev dependencies
RUN pnpm prune --prod

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
