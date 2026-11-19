# ---- build: install deps, build the React app ----
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- run: one Node process serves the API, the built frontend and /uploads ----
FROM node:22-bookworm-slim
# Fonts are used only to draw the demo product images in the seed script.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core fontconfig && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/client/dist ./client/dist
COPY package.json ./
COPY server ./server
EXPOSE 3000
# /data must be a persistent volume: it holds shuka.db, uploads/ and backups/
CMD ["node", "server/index.js"]
