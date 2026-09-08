#!/usr/bin/env bash
set -euo pipefail

# Native Linux libraries required to run Electron in Codespaces/Ubuntu/Debian.
export DEBIAN_FRONTEND=noninteractive

sudo apt-get update
sudo apt-get install -y \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnss3 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxshmfence1 \
  libxss1 \
  libxtst6 \
  libasound2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libfreetype6 \
  libglib2.0-0 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libcairo2 \
  libwayland-client0 \
  libwayland-egl1 \
  libwayland-cursor0 \
  libwayland-server0 \
  libxkbcommon0

# Electron's Chromium sandbox needs the SUID helper configured after npm install.
SANDBOX="node_modules/electron/dist/chrome-sandbox"
if [ -f "$SANDBOX" ]; then
  sudo chown root:root "$SANDBOX"
  sudo chmod 4755 "$SANDBOX"
fi

sudo ldconfig
