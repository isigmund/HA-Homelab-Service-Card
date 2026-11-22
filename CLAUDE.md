# CLAUDE.md

## Purpose

A custom Home Assistant dashboard (Lovelace) card that shows one service running in
the owner's homelab: icon, name, an Up/Down status pill, and extra entity rows
(e.g. response time). The goal is to publish it in the HACS default store
(category **plugin**, shown as "Dashboard" in HACS).

## Requirements (from the owner)

- **Fully configurable in the visual editor.** YAML must never be the only way to set an option.
  Every new option needs an entry in `EDITOR_SCHEMA`, `EDITOR_LABELS` and (if useful) `EDITOR_HELPERS`.
- Options: service URL, icon URL (e.g. selfh.st icons), icon size in px (square),
  status entity (Up/Down), and any number of additional entities.
- Clicking the icon or the name navigates to the service URL.
- Below a divider, one row per line: the status row is always first, then the additional entities
  (name + value).
- Status is a **green "Up" or red "Down" pill**.
- Visual reference: icon left, bold name right of it, divider, rows with label and value right-aligned.
  `images/preview.png` shows the current look.

## Architecture

- Single dependency-free ES module: `dist/homelab-service-card.js`. **No build step**: Node.js
  isn't installed on the dev machine, and HACS serves the file directly. Don't add a bundler or
  npm dependencies without asking.
- Plain `HTMLElement` + shadow DOM (no Lit). Rendering is template strings; **always pass user or
  entity data through `escapeHtml`, and URLs through `safeUrl`**.
- Two elements: `homelab-service-card` and `homelab-service-card-editor`. The editor wraps Home
  Assistant's built-in `ha-form` with selectors.
- `entities` items may be strings or `{ entity, name }`. The editor uses a multi-entity selector
  (strings) and keeps existing object entries so YAML-only names aren't lost.

## HACS constraints

- `hacs.json` must keep `"filename": "homelab-service-card.js"`, because the repo name would
  otherwise make HACS look for `ha-homelab-service-card.js`.
- The card file stays in `dist/`. The release workflow attaches it to every GitHub release.
- Keep `README.md`, `LICENSE` and `.github/workflows/validate.yml` (HACS action) in place.
  HACS default submission also needs a public repo with description, topics and at least one release.
- On release: bump `CARD_VERSION` in the JS file and tag `vX.Y.Z`.

## Testing

- No Home Assistant instance is available here. Preview with `demo/index.html` (stubs `ha-card`,
  fake `hass`). Render it headlessly with Edge:
  `msedge --headless=new --allow-file-access-from-files --screenshot=out.png --window-size=1032,224 file:///.../demo/index.html`
- The editor needs `ha-form`, which only exists in Home Assistant; test its logic with a stub
  `ha-form` element and `--dump-dom`.
- When writing Windows paths into JSON inside Bash commands, `\\` collapses to `\`; build test
  JSON with forward slashes or `jq -n`.
