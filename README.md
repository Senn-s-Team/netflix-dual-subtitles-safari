# Netflix Dual Subtitles Safari

macOS Safari Web Extension project for showing a second subtitle track on Netflix Web.

## Status

This is a build-free WebExtension source project. `scripts/create-safari-project.sh` auto-detects installed Xcode apps under `/Applications`.

## Structure

- `extension/`: browser extension source consumed by Safari's converter.
- `extension/src/page/`: page-world bridge that observes Netflix player metadata and subtitle requests.
- `extension/src/content/`: isolated content script, subtitle loading, parsing, timing, and overlay rendering.
- `extension/src/popup/`: extension popup for language and display settings.
- `scripts/`: local validation and Safari conversion helpers.

## Develop

```bash
npm run check
```

## Generate Safari Project

Use the installed Xcode:

```bash
npm run safari:project
```

For a global Xcode switch:

```bash
sudo xcode-select -s /Applications/Xcode-26.5.0.app/Contents/Developer
```

Open the generated Xcode project under `SafariApp/`, enable the extension in Safari Settings, then test on `https://www.netflix.com/watch/...`.

## MVP Scope

- Detect Netflix timed text metadata from page requests.
- Load one secondary subtitle language.
- Render the second subtitle line above Netflix's native subtitle.
- Persist language, enabled state, font size, vertical offset, and timing offset.
