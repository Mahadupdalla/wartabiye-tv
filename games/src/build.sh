#!/bin/sh
# Builds games/vendor/w3d.js (three.js subset + the shared 3D helpers) from games/src/w3d.js.
# Needs: npm i three@0.187.0 esbuild@0.25.0 (in any folder; pass it as NODE_DIR). Run from the repository root.
set -e
D=${NODE_DIR:-.}
NODE_PATH="$D/node_modules" "$D/node_modules/.bin/esbuild" games/src/w3d.js --bundle --format=esm --minify --target=es2019 \
  --legal-comments=eof --outfile=games/vendor/w3d.js --log-level=warning
echo "built games/vendor/w3d.js ($(wc -c < games/vendor/w3d.js) bytes)"
