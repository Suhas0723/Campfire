FROM node:22-bookworm-slim AS frontend

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Build from the source just copied. A cached npm ci layer is fine;
# this step must follow the source copy or the image ships an older app.
RUN npm run build \
 && grep -q 'title:"Plans"' dist/assets/*.js

FROM caddy:2-alpine

COPY --from=frontend /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443
