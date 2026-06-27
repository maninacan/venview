# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

# Copy workspace manifests first so the npm ci layer is cached unless deps change.
COPY package*.json .npmrc ./
COPY apps/venview-api/package.json ./apps/venview-api/
COPY apps/client/package.json ./apps/client/
COPY apps/marketing/package.json ./apps/marketing/
COPY apps/super-admin-portal/package.json ./apps/super-admin-portal/
COPY libs/common-components/package.json ./libs/common-components/
COPY libs/data/package.json ./libs/data/

RUN npm ci --legacy-peer-deps

COPY . .

# Astro static build → dist/apps/marketing (per apps/marketing/astro.config.mjs outDir).
RUN npx nx build marketing

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist/apps/marketing /usr/share/nginx/html
COPY deploy/nginx-static.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
