# Benefit Bridge — one image for the web app, the ingestion worker and migrations.
# Secrets are NOT baked in: they come from the server's .env.production at run time.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Full source + node_modules: the worker and migration scripts run TypeScript with tsx.
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# Web by default; docker-compose overrides the command for the worker and migrations.
CMD ["npx", "next", "start", "-p", "3000"]
