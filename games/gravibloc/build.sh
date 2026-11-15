#!/usr/bin/env bash
# Builds one upload-ready zip per portal into dist/.
#   ./build.sh                 -> all portals
#   GD_ID=xxxx ./build.sh      -> also bakes the GameDistribution game id in
set -euo pipefail
cd "$(dirname "$0")"
NAME=gravibloc
rm -rf dist && mkdir -p dist
for portal in itch crazygames poki gamedistribution; do
  out="dist/$portal"; mkdir -p "$out"
  cp game.js ads.js "$out/"
  sdk=$portal; [ "$portal" = itch ] && sdk=none
  sed -e "s/data-portal=\"none\"/data-portal=\"$sdk\"/" \
      -e "s/data-gd-id=\"\"/data-gd-id=\"${GD_ID:-}\"/" index.html > "$out/index.html"
  (cd "$out" && zip -qr "../$NAME-$portal.zip" .)
  echo "dist/$NAME-$portal.zip"
done
