#!/usr/bin/env bash
set -e

APP_DIR=/opt/precision_viewer
PORT=3001
SERVICE=precision_viewer
USER=krishna

echo "==> Pulling latest code..."
cd "$APP_DIR"
git fetch origin
git reset --hard origin/main

echo "==> Patching next.config.ts for server (removing output/basePath/assetPrefix)..."
sed -i -E '/basePath:|assetPrefix:|output:/d' next.config.ts

echo "==> Installing dependencies..."
npm ci

echo "==> Building..."
npm run build

echo "==> Writing systemd service..."
sudo tee /etc/systemd/system/${SERVICE}.service > /dev/null <<EOF
[Unit]
Description=Precision Viewer (Next.js)
After=network.target

[Service]
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/npm start
Restart=on-failure
User=${USER}
Environment=NODE_ENV=production
Environment=PORT=${PORT}

[Install]
WantedBy=multi-user.target
EOF

echo "==> Enabling and (re)starting service..."
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE}
sudo systemctl restart ${SERVICE}
sudo systemctl status ${SERVICE} --no-pager

echo ""
echo "Done. Next.js is running on port ${PORT}."
echo "Add this to your Apache vhost if not already present:"
echo ""
echo "    ProxyPreserveHost On"
echo "    ProxyPass        / http://localhost:${PORT}/"
echo "    ProxyPassReverse / http://localhost:${PORT}/"
echo ""
echo "Then: sudo a2enmod proxy proxy_http && sudo systemctl reload apache2"
