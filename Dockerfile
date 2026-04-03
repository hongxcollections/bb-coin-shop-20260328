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
# Build argument for VITE_GOOGLE_CLIENT_ID (passed at build time)
ARG VITE_GOOGLE_CLIENT_ID
# Build frontend with VITE_GOOGLE_CLIENT_ID if provided, otherwise use pre-built dist/public
RUN if [ -n "$VITE_GOOGLE_CLIENT_ID" ]; then \
      VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID pnpm exec vite build; \
    fi
# Build server bundle
RUN pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
# Remove dev dependencies after build
RUN pnpm prune --prod
# Expose port
EXPOSE 3000
# Start the server
CMD ["node", "dist/index.js"]
