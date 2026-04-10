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
# VITE_GOOGLE_CLIENT_ID must be available at build time for Vite to embed it.
# Google Client ID is a public value (embedded in frontend JS), not a secret.
ARG VITE_GOOGLE_CLIENT_ID=118094605532-c2chr1g86nfifj25h1sqj0407iv8gfrq.apps.googleusercontent.com
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
# Build both frontend and backend
RUN pnpm run build
# Remove dev dependencies after build
RUN pnpm prune --prod
# Expose port
EXPOSE 3000
# Start the server
CMD ["node", "dist/index.js"]
