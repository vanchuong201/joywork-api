# syntax=docker/dockerfile:1

# ---------- Builder stage ----------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Build toolchain for native modules (bcrypt) — source-build fallback when a
# prebuilt binary can't be fetched. Builder stage is discarded; prod only copies
# the resulting node_modules (compiled .node binary).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Resilient installs when registry or network is flaky (e.g. CI Docker builds)
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000

# Install dependencies
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci

# Generate Prisma client
COPY prisma ./prisma
RUN npm run db:generate

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Remove dev dependencies to reduce size
RUN npm prune --omit=dev


# ---------- Development stage ----------
FROM node:20-bookworm-slim AS dev

WORKDIR /app

ENV NODE_ENV=development
ENV PORT=4000

# Build toolchain for native modules (bcrypt) source-build fallback.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci

COPY prisma ./prisma
RUN npm run db:generate

COPY tsconfig.json ./
COPY src ./src

EXPOSE 4000

CMD ["npm", "run", "dev"]


# ---------- Production stage ----------
FROM node:20-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
# libuv threadpool size — native bcrypt hashing runs on this pool. Raise above the
# default (4) so concurrent password hashes don't queue behind each other.
ENV UV_THREADPOOL_SIZE=8

# Install wget for health checks and openssl for Prisma
RUN apt-get update && apt-get install -y wget openssl && rm -rf /var/lib/apt/lists/*

# Copy app artifacts from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# Copy Prisma schema for migrations (Prisma client already generated in builder stage and included in node_modules)
COPY --from=builder /app/prisma ./prisma
# Copy tsconfig.json for path resolution
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Copy src directory for tsx to run with path aliases
COPY --from=builder /app/src ./src
# Operational scripts (migrations backfill, reindex, etc.)
COPY scripts ./scripts

# Prisma client is already generated in builder stage and included in node_modules
# No need to regenerate to save disk space

EXPOSE 4000

# Use tsx from node_modules to run TypeScript source with path aliases
CMD ["npx", "tsx", "src/server.ts"]


