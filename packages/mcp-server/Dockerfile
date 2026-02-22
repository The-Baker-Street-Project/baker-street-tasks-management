FROM node:20-alpine AS builder
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/mcp-server ./packages/mcp-server

RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @baker-street/mcp-server build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3100
CMD ["node", "packages/mcp-server/dist/server.js"]
