#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
base_dir=/opt/treat-tracker-expo
service_user=$(id -un)
service_group=$(id -gn)
service_home=$(getent passwd "$service_user" | cut -d: -f6)
node_binary=$(command -v node)
node_directory=$(dirname "$node_binary")
release_id=$(date -u +%Y%m%dT%H%M%SZ)-$(git -C "$repo_dir" rev-parse --short HEAD)
release_dir="$base_dir/releases/$release_id"
unit_file=$(mktemp)
trap 'rm -f "$unit_file"' EXIT

if [[ -z "$service_home" || ! -x "$node_binary" ]]; then
  echo 'A service user home and Node.js executable are required.' >&2
  exit 1
fi

sudo -n install -d -o "$service_user" -g "$service_group" "$base_dir" "$base_dir/releases"
install -d "$release_dir"

# Copy only runtime inputs. A stable copy keeps in-progress repository edits
# from changing what the phone loads between deliberate deployments.
rsync -a \
  "$repo_dir/app/" "$release_dir/app/"
rsync -a \
  "$repo_dir/assets/" "$release_dir/assets/"
rsync -a \
  "$repo_dir/src/" "$release_dir/src/"
install -m 0644 \
  "$repo_dir/package.json" "$repo_dir/package-lock.json" \
  "$repo_dir/app.config.ts" "$repo_dir/babel.config.js" \
  "$repo_dir/metro.config.js" "$repo_dir/tsconfig.json" \
  "$release_dir/"

(cd "$release_dir" && npm_config_userconfig=/dev/null npm ci)

sed \
  -e "s|@SERVICE_USER@|$service_user|g" \
  -e "s|@SERVICE_HOME@|$service_home|g" \
  -e "s|@NODE_DIRECTORY@|$node_directory|g" \
  -e "s|@NODE_BINARY@|$node_binary|g" \
  "$repo_dir/deploy/treat-tracker-expo.service.in" > "$unit_file"

sudo -n install -m 0644 "$unit_file" /etc/systemd/system/treat-tracker-expo.service
ln -sfn "$release_dir" "$base_dir/current-next"
mv -Tf "$base_dir/current-next" "$base_dir/current"
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now treat-tracker-expo.service
sudo -n systemctl restart treat-tracker-expo.service
sudo -n systemctl --no-pager --full status treat-tracker-expo.service

echo "Installed Treat Tracker Expo Go release $release_id"
