#!/bin/sh
set -eu
if [ "${1:-}" = "--help" ]; then
  echo 'stayhub Linux installer: sudo sh install.sh'
  echo 'Downloads and verifies the pinned v0.3.0 release, then installs its systemd service.'
  exit 0
fi
[ "$(id -u)" -eq 0 ] || { echo 'Run: sudo sh install.sh' >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo 'Install curl first: sudo apt install curl' >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo 'sha256sum is required.' >&2; exit 1; }
temp_dir=$(mktemp -d)
trap 'rm -rf -- "$temp_dir"' EXIT HUP INT TERM
archive=stayhub-linux-v0.3.0.tar.gz
url="https://github.com/Maxnum357/StayHub/releases/download/linux-v0.3.0/$archive"
curl --fail --show-error --location --proto '=https' --tlsv1.2 "$url" -o "$temp_dir/$archive"
printf '%s  %s\n' '81e12cf7f479f5ddd7923470f2880c6cdf6c184f699065024655cfd8d5e96df9' "$temp_dir/$archive" | sha256sum -c -
mkdir "$temp_dir/package"
tar -xzf "$temp_dir/$archive" -C "$temp_dir/package"
sh "$temp_dir/package/install.sh"
