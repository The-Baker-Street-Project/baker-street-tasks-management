FROM node:20-slim AS builder
WORKDIR /app

# Install build tools for better-sqlite3 native addon
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/mcp-server ./packages/mcp-server
COPY apps/web ./apps/web

RUN corepack enable && pnpm install --frozen-lockfile

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @baker-street/web build

FROM node:20-slim
WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
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
# Next.js requires an app directory to exist even in production standalone mode
RUN mkdir -p /app/apps/web/src/app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Create workspace symlinks so tsx can resolve @baker-street/* packages
RUN mkdir -p node_modules/@baker-street && \
    ln -s /app/packages/db node_modules/@baker-street/db && \
    ln -s /app/packages/mcp-server node_modules/@baker-street/mcp-server

# Ensure data directory exists for SQLite
RUN mkdir -p /data && chown 1000:1000 /data

# Next.js writes cache at runtime — ensure writable
RUN chown -R 1000:1000 /app

EXPOSE 3000 3100
ENV PORT=3000
ENV MCP_PORT=3100
ENV HOSTNAME=0.0.0.0
ENV SQLITE_DB_PATH=/data/tasks.db
CMD ["tsx", "apps/web/server.ts"]
