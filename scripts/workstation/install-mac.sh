#!/usr/bin/env bash
# Builds an unsigned Workstation.app for this Mac and replaces /Applications/Workstation.app.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
output_dir="$repo_root/release/workstation"
install_path="/Applications/Workstation.app"
bundle_id="com.rodrigofez.workstation"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Workstation installs only on macOS." >&2
  exit 1
fi

# Replacing the bundle under a running app corrupts it, so ask instead of quitting it.
if [[ "$(osascript -e "application id \"$bundle_id\" is running" 2>/dev/null)" == "true" ]]; then
  echo "Quit Workstation, then run this again." >&2
  exit 1
fi

rm -rf "$output_dir"
node "$repo_root/scripts/build-desktop-artifact.ts" \
  --platform mac --target zip --output-dir "$output_dir"

zip_path="$(find "$output_dir" -maxdepth 1 -name 'Workstation-*.zip' | head -n 1)"
if [[ -z "$zip_path" ]]; then
  echo "No Workstation zip was produced in $output_dir." >&2
  exit 1
fi

unpack_dir="$(mktemp -d)"
trap 'rm -rf "$unpack_dir"' EXIT
ditto -x -k "$zip_path" "$unpack_dir"

rm -rf "$install_path"
ditto "$unpack_dir/Workstation.app" "$install_path"
# The rebranded Info.plist invalidates Electron's stock signature; arm64 refuses to launch unsigned code.
codesign --force --deep --sign - "$install_path"
xattr -dr com.apple.quarantine "$install_path" 2>/dev/null || true

echo "Installed $install_path"
