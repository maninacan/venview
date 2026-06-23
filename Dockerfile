# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

# Copy all workspace manifests so npm ci installs every workspace's dependencies
COPY package*.json ./
COPY apps/venview-api/package.json ./apps/venview-api/
COPY apps/client/package.json ./apps/client/
COPY apps/marketing/package.json ./apps/marketing/
COPY apps/super-admin-portal/package.json ./apps/super-admin-portal/
COPY libs/common-components/package.json ./libs/common-components/
COPY libs/data/package.json ./libs/data/

RUN npm ci --legacy-peer-deps

COPY . .
RUN npx nx build venview-api --configuration=production

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app

# Install Doppler CLI
RUN apk add --no-cache curl gnupg && \
    curl -Ls https://cli.doppler.com/install.sh | sh

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/venview-api/dist ./dist

ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE 8080

CMD ["doppler", "run", "--", "node", "dist/main.js"]
