#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  Sarvam Bot — EC2 One-Shot Setup & Deploy
#  OS: Ubuntu 22.04 LTS
#  Run: chmod +x ec2-deploy.sh && sudo bash ec2-deploy.sh
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════
#  STEP 1 — FILL IN YOUR VALUES BEFORE RUNNING
# ═══════════════════════════════════════════════════════════════════════

REPO_URL="https://github.com/VishnuNandury/Sarv_Edge_Bot.git"

# Domain name (e.g. "bot.yourdomain.com")
# Leave empty "" if you don't have one yet — app will run on HTTP port 80
# WebRTC mic access REQUIRES HTTPS, so add a domain when you have one
DOMAIN=""

# Your email — only used by Let's Encrypt for SSL cert expiry notices
SSL_EMAIL="Vishnunandury@gmail.com"

# ── API Keys & Config ──────────────────────────────────────────────────
DATABASE_URL=""          # postgresql+asyncpg://user:pass@host/dbname  (Neon URL)
SARVAM_API_KEY=""
GROQ_API_KEY=""
OPENAI_API_KEY=""        # optional — only needed if using OpenAI LLM

# TURN server — get a Mumbai TURN from https://dashboard.metered.ca/
# Leave empty to use Google STUN only (direct P2P, may not work behind strict NAT)
TURN_URL=""              # e.g. turn:mumbai.relay.metered.ca:80
TURN_USERNAME=""
TURN_CREDENTIAL=""

SECRET_KEY="$(openssl rand -hex 32)"   # auto-generated, keep the quotes

# ═══════════════════════════════════════════════════════════════════════
#  END OF CONFIG — do not edit below unless you know what you're doing
# ═══════════════════════════════════════════════════════════════════════

APP_DIR="/opt/sarvam-bot"
CONTAINER_NAME="sarvam-bot"
ENV_FILE="/opt/sarvam-bot.env"
APP_PORT=8000

# ── Colours ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✔]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✘]${NC} $1"; exit 1; }
step()  { echo -e "\n${CYAN}──────────────────────────────────────${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}──────────────────────────────────────${NC}"; }

# ── Validate required config ───────────────────────────────────────────
[[ -z "$DATABASE_URL" ]]    && error "DATABASE_URL is not set. Edit the CONFIG section and re-run."
[[ -z "$SARVAM_API_KEY" ]]  && error "SARVAM_API_KEY is not set."
[[ -z "$GROQ_API_KEY" ]]    && error "GROQ_API_KEY is not set."

step "1 / 8 — System update"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
apt-get install -y -qq git curl ca-certificates gnupg openssl
info "System up to date"

step "2 / 8 — Install Docker"
if command -v docker &>/dev/null; then
  info "Docker already installed: $(docker --version)"
else
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io
  systemctl enable docker
  systemctl start docker
  info "Docker installed: $(docker --version)"
fi

step "3 / 8 — Install Nginx"
if ! command -v nginx &>/dev/null; then
  apt-get install -y -qq nginx
  systemctl enable nginx
  info "Nginx installed"
else
  info "Nginx already installed"
fi

step "4 / 8 — Clone / update repository"
if [[ -d "$APP_DIR/.git" ]]; then
  info "Repo exists — pulling latest..."
  git -C "$APP_DIR" pull
else
  info "Cloning $REPO_URL → $APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

step "5 / 8 — Write environment file"
cat > "$ENV_FILE" <<EOF
DATABASE_URL=${DATABASE_URL}
SARVAM_API_KEY=${SARVAM_API_KEY}
GROQ_API_KEY=${GROQ_API_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
TURN_URL=${TURN_URL}
TURN_USERNAME=${TURN_USERNAME}
TURN_CREDENTIAL=${TURN_CREDENTIAL}
SECRET_KEY=${SECRET_KEY}
APP_ENV=production
EOF
chmod 600 "$ENV_FILE"
info "Environment file written to $ENV_FILE (permissions: 600)"

step "6 / 8 — Build Docker image"
info "Building image — first run takes ~5 minutes..."
docker build -t "$CONTAINER_NAME" "$APP_DIR"
info "Image built"

step "7 / 8 — Start container"
# Stop/remove any existing container
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  info "Stopping old container..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm   "$CONTAINER_NAME" 2>/dev/null || true
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p 127.0.0.1:${APP_PORT}:8000 \
  "$CONTAINER_NAME"

# Wait and verify
sleep 6
if docker ps --filter "name=^${CONTAINER_NAME}$" --filter "status=running" | grep -q "$CONTAINER_NAME"; then
  info "Container is running"
else
  error "Container failed to start. Debug: docker logs $CONTAINER_NAME"
fi

step "8 / 8 — Configure Nginx + SSL"

if [[ -n "$DOMAIN" ]]; then
  # ── Domain mode: HTTP first, then upgrade to HTTPS via Certbot ────────
  NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
  cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    # Increase timeouts for long-running WebSocket/WebRTC sessions
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;

    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }
}
NGINX

  rm -f /etc/nginx/sites-enabled/default
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  info "Nginx configured for $DOMAIN"

  # Install Certbot and get SSL cert
  apt-get install -y -qq certbot python3-certbot-nginx
  certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    -m "$SSL_EMAIL" \
    --redirect
  info "SSL certificate issued for https://${DOMAIN}"

  # Auto-renew cron (certbot installs its own timer, this is a belt+suspenders backup)
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet") | sort -u | crontab -

else
  # ── IP-only mode: HTTP on port 80 ─────────────────────────────────────
  warn "No DOMAIN set — running HTTP only."
  warn "Browsers block microphone access on plain HTTP."
  warn "For production: point a domain at this IP, set DOMAIN=, and re-run."

  cat > /etc/nginx/sites-available/sarvam-bot <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    proxy_read_timeout 86400;
    proxy_send_timeout 86400;

    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
    }
}
NGINX

  rm -f /etc/nginx/sites-enabled/default
  ln -sf /etc/nginx/sites-available/sarvam-bot /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
fi

# ── Final summary ──────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s --max-time 5 http://checkip.amazonaws.com 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Sarvam Bot — Deployed Successfully       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
if [[ -n "$DOMAIN" ]]; then
  echo -e "  ${GREEN}URL:${NC}      https://${DOMAIN}"
else
  echo -e "  ${YELLOW}URL:${NC}      http://${PUBLIC_IP}  ← HTTP only (no mic access)"
  echo -e "  ${YELLOW}Direct:${NC}   http://${PUBLIC_IP}:8000"
fi
echo ""
echo -e "  ${CYAN}Useful commands:${NC}"
echo -e "    docker logs -f ${CONTAINER_NAME}      # live app logs"
echo -e "    docker restart ${CONTAINER_NAME}      # restart app"
echo -e "    docker stats ${CONTAINER_NAME}        # CPU / memory usage"
echo -e "    sudo bash ec2-deploy.sh               # redeploy after a git push"
echo ""
echo -e "  ${CYAN}To update app after pushing to GitHub:${NC}"
echo -e "    cd /opt/sarvam-bot && git pull"
echo -e "    docker build -t sarvam-bot ."
echo -e "    docker stop sarvam-bot && docker rm sarvam-bot"
echo -e "    docker run -d --name sarvam-bot --restart unless-stopped"
echo -e "      --env-file /opt/sarvam-bot.env -p 127.0.0.1:8000:8000 sarvam-bot"
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
