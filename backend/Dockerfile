# Образ backend (Node.js / Express / Socket.IO).
# Node 22 вместо 18 из методички: зависимости проекта (mongoose 9, express 5) требуют современный Node.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
