# ---- build: install deps, build the React app ----
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ fonts-dejavu-core fontconfig && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Render the 90 demo product images once here, so a fresh start takes seconds instead of ~80 s.
RUN npm run build && node server/seed.js --images && npm prune --omit=dev

# ---- run: one Node process serves the API, the built frontend and /uploads ----
FROM node:22-bookworm-slim
# Fonts are a fallback for drawing demo images if seed-images/ is ever missing.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core fontconfig && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/seed-images ./seed-images
COPY package.json ./
COPY server ./server
EXPOSE 3000
# /data must be a persistent volume: it holds shuka.db, uploads/ and backups/
CMD ["node", "server/index.js"]
