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
# Copy source code (including pre-built dist/public with VITE_GOOGLE_CLIENT_ID embedded)
COPY . .
# Build ONLY the server bundle using esbuild (skip Vite frontend rebuild)
# The dist/public/ directory already contains the frontend with VITE_GOOGLE_CLIENT_ID embedded
RUN pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
# Remove dev dependencies after build
RUN pnpm prune --prod
# Expose port
EXPOSE 3000
# Start the server
CMD ["node", "dist/index.js"]
