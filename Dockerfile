# ---------- Builder stage ----------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

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

COPY package*.json ./
RUN npm ci

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

# Copy app artifacts from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# Copy Prisma schema for migrations
COPY --from=builder /app/prisma ./prisma
# Copy tsconfig.json for path resolution
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Copy src directory for tsx to run with path aliases
COPY --from=builder /app/src ./src

EXPOSE 4000

# Use tsx from node_modules to run TypeScript source with path aliases
CMD ["npx", "tsx", "src/server.ts"]


