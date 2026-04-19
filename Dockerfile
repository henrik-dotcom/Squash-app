# Stage 1: Build the React frontend
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline --no-audit
COPY frontend/src frontend/index.html frontend/vite.config.js frontend/tailwind.config.js frontend/postcss.config.js ./
RUN npm run build

# Stage 2: Python backend + built frontend static files
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copy built frontend into /app/static so FastAPI can serve it
COPY --from=frontend-build /frontend/dist ./static

ENV DB_PATH=/data/squash.db

RUN mkdir -p /data

EXPOSE 8000

CMD ["sh", "-c", "python migrate.py && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
