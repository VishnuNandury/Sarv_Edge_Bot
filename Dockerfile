# ─── Stage 1: Build Next.js frontend ────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# API URL is empty — frontend calls /api/* on the same host
ENV NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_WS_URL=""

RUN npm run build
# Output is in /app/frontend/out


# ─── Stage 2: Python backend + serve frontend static files ───────────────────
FROM python:3.11-slim

# System deps for aiortc/audio processing
RUN apt-get update && apt-get install -y \
    gcc \
    libsrtp2-dev \
    libopus-dev \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Install Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Copy built frontend into backend/static
COPY --from=frontend-builder /app/frontend/out ./static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
