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
- `entities` items may be strings or `{ entity, name }` (`name` = optional display name). The editor
  has its own entity list: one `ha-form` per row (entity picker + display name) with move up/down
  and remove buttons (`ha-icon-button`), plus an "Add entity" picker. Rows are only rebuilt when the
  count changes, so typing a name doesn't lose focus.
- `links` items may be URL strings or `{ name, url }` (secondary navigation targets). The card shows
  them in a ☰ menu in the header, using the Popover API (top layer, not clipped by the card) with an
  absolutely positioned fallback for browsers without it. The editor's list sections (entities, links)
  share one implementation driven by `LIST_SECTIONS`.
- `setConfig` re-renders the whole card; `hass` updates only re-render the `.rows` container, so an
  open menu survives entity state changes.
- Layout owner preferences: rows use 12px text; entity labels never wrap (ellipsis + tooltip);
  the card defaults to full section width (`getGridOptions` → 12 columns).

## HACS constraints

- `hacs.json` must keep `"filename": "homelab-service-card.js"`, because the repo name would
  otherwise make HACS look for `ha-homelab-service-card.js`.
- The card file stays in `dist/`. The release workflow attaches it to every GitHub release.
- Keep `README.md`, `LICENSE` and `.github/workflows/validate.yml` (HACS action) in place.
  HACS default submission also needs a public repo with description, topics and at least one release.

## Release checklist

Versioning follows SemVer: `0.1.x` fixes / small tweaks, `0.x.0` new features, breaking config
changes bump minor before 1.0 (major after 1.0). Releases are made directly from `main`.

1. While working, add every user-visible change to `## [Unreleased]` in `CHANGELOG.md`
   (Keep a Changelog sections: Added / Changed / Deprecated / Removed / Fixed).
2. Pick the version, then:
   - bump `CARD_VERSION` in `dist/homelab-service-card.js`
   - in `CHANGELOG.md`, rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`, add a fresh empty
     `[Unreleased]` section, and update the compare links at the bottom
   - re-render `images/preview.png` if the look changed
3. Commit (`... (vX.Y.Z)`), push, then
   `gh release create vX.Y.Z --target main --title vX.Y.Z --notes "..."`.
   Release notes = that version's CHANGELOG section. HACS shows them in its update dialog.
4. Breaking changes (changed defaults, renamed/removed options) go first in the notes under
   **⚠ Breaking change**, with what the user has to change (YAML before/after).
5. Check that the Release workflow attached `homelab-service-card.js` and Validate passed.

`gh` lives at `C:\Program Files\GitHub CLI\gh.exe` (may not be on PATH in older shells).
Pushing or publishing needs the owner's explicit go-ahead.

## Testing

- No Home Assistant instance is available here. Preview with `demo/index.html` (stubs `ha-card`,
  fake `hass`). Render it headlessly with Edge:
  `msedge --headless=new --allow-file-access-from-files --screenshot=out.png --window-size=1032,224 file:///.../demo/index.html`
- The editor needs `ha-form`, which only exists in Home Assistant; test its logic with a stub
  `ha-form` element and `--dump-dom`.
- When writing Windows paths into JSON inside Bash commands, `\\` collapses to `\`; build test
  JSON with forward slashes or `jq -n`.
