FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
RUN npm ci

# Copy source
COPY packages/core packages/core
COPY packages/server packages/server
# Build shared types first, then server
RUN npm run build -w packages/core
RUN npm run build -w packages/server

# ── Production image ──
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache tini

COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000 5055

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
