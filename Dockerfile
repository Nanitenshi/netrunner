FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@10.11.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=5173 HOST=0.0.0.0 DATABASE_PATH=/app/data/nexus.sqlite
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY server ./server
COPY shared ./shared
COPY src/cards.json ./src/cards.json
COPY scripts/backup.mjs scripts/check-production.ts ./scripts/
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:5173/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/main.ts"]
