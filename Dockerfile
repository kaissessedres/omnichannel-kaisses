FROM node:20-alpine

# build tools necessários para compilar better-sqlite3 (módulo nativo)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY src/ ./src/

EXPOSE 3000
CMD ["node", "src/index.js"]
