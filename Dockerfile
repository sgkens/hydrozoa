FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
RUN apk add --no-cache ca-certificates git tini \
  && addgroup -S hydrozoa \
  && adduser -S -G hydrozoa -h /app hydrozoa
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force
COPY --from=build --chown=hydrozoa:hydrozoa /app/dist ./dist
COPY --from=build --chown=hydrozoa:hydrozoa /app/dist-server ./dist-server
USER hydrozoa
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist-server/server.js"]
