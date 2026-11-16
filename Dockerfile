# Multi-stage build for Agriculture E-Commerce Platform (Havestra)
FROM node:20-alpine AS builder

WORKDIR /app

# Enable Corepack for pnpm support
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy package manifests and patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install all dependencies (including devDependencies needed for build)
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Build frontend and bundle server
RUN pnpm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy package files and install only production dependencies
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --prod --frozen-lockfile

# Copy compiled bundles from builder stage
COPY --from=builder /app/dist ./dist

# Create storage directories
RUN mkdir -p /app/uploads /root/.havestra/id-documents

EXPOSE 5000

CMD ["node", "dist/index.js"]
