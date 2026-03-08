FROM node:20-alpine AS builder
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/mcp-server ./packages/mcp-server
COPY apps/web ./apps/web

RUN corepack enable && pnpm install --frozen-lockfile

ENV NEXT_TELEMETRY_DISABLED=1
# PGlite build-time placeholder (not used at build, but needed for module resolution)
ENV PGLITE_DATA_DIR=/tmp/pglite-build
RUN pnpm --filter @baker-street/web build

FROM node:20-alpine
WORKDIR /app

RUN npm install -g tsx

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
# Copy MCP server source (imported by unified server)
COPY --from=builder /app/packages/mcp-server ./packages/mcp-server
# Copy DB package including drizzle migrations
COPY --from=builder /app/packages/db ./packages/db
# Copy unified server entrypoint
COPY --from=builder /app/apps/web/server.ts ./apps/web/server.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

EXPOSE 3000 3100
ENV PORT=3000
ENV MCP_PORT=3100
ENV HOSTNAME=0.0.0.0
ENV PGLITE_DATA_DIR=/data/pglite
CMD ["tsx", "apps/web/server.ts"]
