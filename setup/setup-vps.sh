#!/usr/bin/env bash
# Setup VPS untuk Kantor Virtual (Tahap 0).
# Jalankan SEKALI sebagai root di VPS Ubuntu 24.04 yang baru:  bash setup-vps.sh
# Script ini TIDAK login ke akun apa pun. Login Claude, Codex, dan Multica dilakukan pemilik akun sendiri.
set -euo pipefail

USER_NAME=kantor
PLAYWRIGHT_VERSION=1.48.2
export DEBIAN_FRONTEND=noninteractive

step(){ printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

step "Update sistem dan paket dasar"
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git jq ufw fail2ban unattended-upgrades ca-certificates gnupg

step "Swap 2 GB (supaya tidak kehabisan memori saat agen + browser jalan bersamaan)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

step "User '$USER_NAME' (agen tidak berjalan sebagai root)"
id "$USER_NAME" &>/dev/null || adduser --disabled-password --gecos "" "$USER_NAME"
usermod -aG sudo "$USER_NAME"
echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$USER_NAME"
chmod 440 "/etc/sudoers.d/90-$USER_NAME"
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "/home/$USER_NAME/.ssh"
cp /root/.ssh/authorized_keys "/home/$USER_NAME/.ssh/authorized_keys"
chown "$USER_NAME:$USER_NAME" "/home/$USER_NAME/.ssh/authorized_keys"
chmod 600 "/home/$USER_NAME/.ssh/authorized_keys"

step "Keamanan: SSH hanya dengan key, firewall, fail2ban, update keamanan otomatis"
cat > /etc/ssh/sshd_config.d/90-kantor.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
EOF
systemctl reload ssh
ufw allow OpenSSH
ufw --force enable
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

step "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

step "Codex CLI (runtime untuk worker GPT)"
npm install -g @openai/codex

step "Chromium headless untuk skill browser (Playwright $PLAYWRIGHT_VERSION)"
npx -y "playwright@$PLAYWRIGHT_VERSION" install-deps chromium
sudo -u "$USER_NAME" -H npx -y "playwright@$PLAYWRIGHT_VERSION" install chromium

step "Claude Code (runtime untuk worker Claude)"
sudo -u "$USER_NAME" -H bash -lc 'curl -fsSL https://claude.ai/install.sh | bash'

step "Multica CLI + daemon"
sudo -u "$USER_NAME" -H bash -lc 'curl -fsSL https://raw.githubusercontent.com/multica-ai/multica/main/scripts/install.sh | bash'

step "PATH untuk user $USER_NAME, dan izinkan daemon tetap jalan setelah logout/reboot"
grep -q 'kantor-virtual PATH' "/home/$USER_NAME/.bashrc" || \
  echo 'export PATH="$HOME/.local/bin:$PATH"  # kantor-virtual PATH' >> "/home/$USER_NAME/.bashrc"
loginctl enable-linger "$USER_NAME"

step "Cek versi"
sudo -u "$USER_NAME" -H bash -lc 'export PATH="$HOME/.local/bin:$PATH"; echo "node   $(node --version)"; echo "claude $(claude --version 2>/dev/null || echo BELUM ADA)"; echo "codex  $(codex --version 2>/dev/null || echo BELUM ADA)"; echo "multica $(multica version 2>/dev/null || multica --version 2>/dev/null || echo BELUM ADA)"'

printf '\n\033[1mSelesai.\033[0m Berikutnya: login Claude Code, Codex, dan Multica sebagai user %s (lihat TAHAP-0.md, langkah 5).\n' "$USER_NAME"
