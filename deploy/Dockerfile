FROM node:22-bookworm-slim AS frontend

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM caddy:2-alpine

COPY --from=frontend /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443
