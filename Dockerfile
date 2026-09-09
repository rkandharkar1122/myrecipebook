# syntax=docker/dockerfile:1

# ---- build the SPA ----
FROM node:26.7.0-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build            # -> /app/dist

# ---- runtime: Express serving dist/ + /api ----
FROM node:26.7.0-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 3001
USER node
WORKDIR /app/server
CMD ["node", "index.js"]
