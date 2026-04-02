FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy ALL files at once (including patches/)
COPY . .

# Install all dependencies (patches/ is already present)
RUN pnpm install --frozen-lockfile

# Build the application
RUN pnpm build

# Remove dev dependencies
RUN pnpm prune --prod

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
