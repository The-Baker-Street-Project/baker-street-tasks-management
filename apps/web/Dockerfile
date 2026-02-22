FROM node:20-alpine AS builder
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/db ./packages/db
COPY apps/web ./apps/web

RUN corepack enable && pnpm install --frozen-lockfile

ENV NEXT_TELEMETRY_DISABLED=1
# Provide a build-time DATABASE_URL (not used at build for dynamic pages, but needed for module resolution)
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN pnpm --filter @baker-street/web build

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
