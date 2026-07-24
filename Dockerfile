FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN bun install --no-save

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN bun run build

FROM oven/bun:1-alpine AS runtime

ARG VERSION=dev

LABEL org.opencontainers.image.title="Hydrozoa" \
      org.opencontainers.image.version="${VERSION}"

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

RUN apk add --no-cache git openssh-client

COPY package.json package-lock.json ./
RUN bun install --production --no-save

COPY server.ts ./
COPY --from=build /app/dist ./dist

EXPOSE 3000

USER bun

CMD ["bun", "run", "server.ts"]
