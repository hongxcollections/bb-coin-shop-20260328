FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Copy patches directory if it exists
COPY patches/ ./patches/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application (Vite frontend + esbuild server bundle)
RUN pnpm build

# Remove dev dependencies after build
RUN pnpm prune --prod

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "dist/index.js"]
