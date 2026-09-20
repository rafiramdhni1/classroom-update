# Stage 1: Build Frontend (Vite)
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Runtime Unified Backend + Frontend
FROM node:20-alpine
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./public

RUN mkdir -p logs backups

ENV NODE_ENV=production
ENV PORT=5000
ENV FRONTEND_DIST=/app/public

EXPOSE 5000

CMD ["node", "server.js"]
