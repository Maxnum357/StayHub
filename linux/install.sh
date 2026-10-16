#!/bin/sh
set -eu

if [ "${1:-}" = "--help" ]; then
  echo 'Usage: sudo sh linux/install.sh'
  echo 'Ubuntu 22.04+ / Debian 12+, systemd, x86_64 or aarch64.'
  echo 'Installs /opt/stayhub; keeps records and secrets in /var/lib/stayhub.'
  exit 0
fi
[ "$(id -u)" -eq 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
[ -d /run/systemd/system ] || { echo 'A running systemd Linux host is required.' >&2; exit 1; }
. /etc/os-release
case "$ID" in ubuntu|debian) ;; *) echo 'Supported distributions: Ubuntu and Debian.' >&2; exit 1;; esac
case "$(uname -m)" in x86_64) arch=x64;; aarch64|arm64) arch=arm64;; *) echo 'Use 64-bit x86_64 or ARM64 Linux.' >&2; exit 1;; esac
source_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
[ -f "$source_dir/app/server.js" ] || { echo 'Clone the complete repository before installing.' >&2; exit 1; }
(cd "$source_dir" && sha256sum -c SHA256SUMS >/dev/null)
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl xz-utils python3 python3-venv rsync
node_version=v22.23.3
archive="node-$node_version-linux-$arch.tar.xz"
temp_dir=$(mktemp -d)
trap 'rm -rf -- "$temp_dir"' EXIT HUP INT TERM
curl --fail --show-error --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/$node_version/$archive" -o "$temp_dir/$archive"
curl --fail --show-error --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/$node_version/SHASUMS256.txt" -o "$temp_dir/SHASUMS256.txt"
(cd "$temp_dir" && grep "  $archive\$" SHASUMS256.txt > selected.sha256 && sha256sum -c selected.sha256)
install -d -m 755 /opt/stayhub/releases /opt/stayhub/runtime /etc/stayhub
if [ ! -x "/opt/stayhub/runtime/node-$node_version-linux-$arch/bin/node" ]; then
  tar -xJf "$temp_dir/$archive" -C /opt/stayhub/runtime
fi
ln -sfn "/opt/stayhub/runtime/node-$node_version-linux-$arch" /opt/stayhub/node
id stayhub >/dev/null 2>&1 || useradd --system --home-dir /var/lib/stayhub --shell /usr/sbin/nologin stayhub
install -d -m 700 -o stayhub -g stayhub /var/lib/stayhub /var/lib/stayhub/templates /var/lib/stayhub/backups
release="0.3.0-$(date -u +%Y%m%d%H%M%S)-$$"
release_dir="/opt/stayhub/releases/$release"
install -d -m 755 "$release_dir"
rsync -a --exclude='__pycache__' --exclude='*.pyc' "$source_dir/app/" "$release_dir/app/"
python3 -m venv "$release_dir/venv"
"$release_dir/venv/bin/python" -m pip install --disable-pip-version-check -r "$release_dir/app/requirements.txt"
for kind in daily monthly; do
  if [ ! -f "/var/lib/stayhub/templates/$kind-canva.pdf" ]; then
    install -m 600 -o stayhub -g stayhub "$release_dir/app/assets/$kind-canva.pdf" "/var/lib/stayhub/templates/$kind-canva.pdf"
  fi
done
install -m 644 "$source_dir/stayhub.service" /etc/systemd/system/stayhub.service
install -m 755 "$source_dir/stayhubctl" /usr/local/bin/stayhubctl
if [ ! -f /etc/stayhub/stayhub.env ]; then
  printf '%s\n' 'STAYHUB_HOST=0.0.0.0' 'STAYHUB_PORT=8787' > /etc/stayhub/stayhub.env
  chmod 600 /etc/stayhub/stayhub.env
fi
previous=$(readlink /opt/stayhub/current 2>/dev/null || true)
ln -sfn "$release_dir" /opt/stayhub/current
systemctl daemon-reload
systemctl enable stayhub.service
systemctl restart stayhub.service
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --fail --silent http://127.0.0.1:8787/healthz >/dev/null; then ready=1; break; fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo 'Startup failed; inspect: sudo journalctl -u stayhub -n 60' >&2
  if [ -n "$previous" ]; then ln -sfn "$previous" /opt/stayhub/current; systemctl restart stayhub.service; fi
  exit 1
fi
echo 'StayHub installed. Existing records/settings were preserved.'
echo 'Run: sudo stayhubctl links'
echo 'For setup on another computer: ssh -L 8787:127.0.0.1:8787 USER@SERVER_IP'
echo 'No firewall rules were changed. Allow TCP 8787 only from your private LAN.'
