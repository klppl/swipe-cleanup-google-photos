#!/usr/bin/env bash
# Builds the zip to upload to the Chrome Web Store: dist/swipe-photos-<version>.zip
# Only files the extension needs at runtime go in; docs, store assets and SVG sources stay out.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
out="dist/swipe-photos-${version}.zip"

mkdir -p dist
rm -f "$out"
zip -X -r "$out" \
  manifest.json \
  content/*.js content/*.css \
  popup/*.html popup/*.css popup/*.js \
  demo/*.html demo/*.css demo/*.js demo/photos/*.svg \
  icons/*.png \
  LICENSE
echo "Built $out"
unzip -l "$out"
