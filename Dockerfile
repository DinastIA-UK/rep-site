FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund
COPY server/*.js ./server/
COPY index.html ./
COPY brand/img/ ./brand/img/
COPY brand/video/hero_jade_scrub.mp4 brand/video/hero_jade_mobile.mp4 ./brand/video/
COPY img/guilherme.jpeg img/market-scale-jade.webp img/sectors-grid-jade.webp img/og-cover.jpg ./img/
ENV PUBLIC_DIR=/app DATA_DIR=/data PORT=3000
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server/server.js"]
