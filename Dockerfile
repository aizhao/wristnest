FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY companion/ ./companion/
COPY server/ ./server/
COPY watch/src/ ./watch/src/
COPY examples/ ./examples/
ENV HOST=0.0.0.0 PORT=8787 SYNC_DATA_DIR=/data
VOLUME /data
EXPOSE 8787
CMD ["node", "companion/server.mjs"]
