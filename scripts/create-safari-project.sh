#!/usr/bin/env bash
# [INPUT]: 依赖完整 Xcode 提供的 xcrun safari-web-extension-converter
# [OUTPUT]: 对外生成 SafariApp Xcode 工程包装 extension/ WebExtension 源码
# [POS]: scripts 的 Safari 打包入口，被 npm run safari:project 调用
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_DIR="$ROOT_DIR/extension"
PROJECT_DIR="$ROOT_DIR/SafariApp"
APP_NAME="Netflix Dual Subtitles"
BUNDLE_ID="${BUNDLE_ID:-com.chinnsenn.netflix-dual-subtitles-safari}"
PBXPROJ="$PROJECT_DIR/$APP_NAME/$APP_NAME.xcodeproj/project.pbxproj"

if ! xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  for candidate in /Applications/Xcode.app /Applications/Xcode-*.app; do
    if [[ -x "$candidate/Contents/Developer/usr/bin/safari-web-extension-converter" ]]; then
      export DEVELOPER_DIR="$candidate/Contents/Developer"
      break
    fi
  done
fi

if ! xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  echo "safari-web-extension-converter is unavailable."
  echo "Install full Xcode, then run:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  echo "Or set DEVELOPER_DIR to an installed Xcode:"
  echo "  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer"
  exit 1
fi

xcrun safari-web-extension-converter "$EXTENSION_DIR" \
  --project-location "$PROJECT_DIR" \
  --app-name "$APP_NAME" \
  --bundle-identifier "$BUNDLE_ID" \
  --macos-only \
  --force

if [[ -f "$PBXPROJ" ]]; then
  export BUNDLE_ID
  /usr/bin/perl -0pi -e 's/PRODUCT_BUNDLE_IDENTIFIER = "com\.chinnsenn\.Netflix-Dual-Subtitles";/PRODUCT_BUNDLE_IDENTIFIER = "$ENV{BUNDLE_ID}";/g' "$PBXPROJ"
fi

echo "Safari project generated at $PROJECT_DIR"
