FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir -p /app/data && chown node:node /app/data
COPY --from=builder /app/dist ./dist
COPY server.js ./
COPY lib ./lib
COPY src/curriculum.js ./src/curriculum.js
USER node
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "server.js"]
