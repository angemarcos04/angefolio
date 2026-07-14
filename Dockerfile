FROM node:22-alpine AS dependencies

ENV ASTRO_TELEMETRY_DISABLED=1

WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV ASTRO_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm build:search

FROM node:22-alpine AS runtime

ENV ASTRO_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

WORKDIR /app

COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/drizzle ./drizzle
COPY --chown=node:node package.json pnpm-lock.yaml drizzle.config.ts ./
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node src/lib/server/db/schema.ts ./src/lib/server/db/schema.ts

RUN mkdir -p /app/data && chown node:node /app/data

USER node

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4321/ > /dev/null || exit 1

CMD ["sh", "-c", "./node_modules/.bin/drizzle-kit migrate && node scripts/start.mjs"]
