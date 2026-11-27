# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-27

### Added

- Secondary links (`links` option): any number of extra navigation targets, each with a name
  and URL, shown in a ☰ menu at the top right of the card. Configurable in the visual editor
  under "Secondary links". ([#1](https://github.com/isigmund/ha-homelab-service-card/issues/1))

### Changed

- Entity state updates now only redraw the entity rows instead of the whole card.
- The README now describes installing from the default HACS store (with a "My Home Assistant"
  button) instead of adding a custom repository.

## [0.1.1] - 2026-11-22

### Changed

- Default icon size is now 32px (was 48px). Cards edited in the visual editor may have
  `icon_size: 48` saved in their config; change the size in the editor or remove that line
  to use the new default.
- More compact layout: less space between entity rows (2px) and around the separator.

## [0.1.0] - 2026-11-22

### Added

- First release.
- Service icon (image URL, e.g. from [selfh.st/icons](https://selfh.st/icons/), or `mdi:` icon)
  with configurable square size.
- Service name; icon and name link to the service URL (new tab by default, paths starting
  with `/` stay inside Home Assistant).
- Status entity shown as a green **Up** or red **Down** pill.
- Any number of additional entities, one per line, with optional display names.
- Long entity names stay on one line (ellipsis, full name on hover).
- Full section width by default in sections dashboards.
- Fully configurable in the visual editor.

[Unreleased]: https://github.com/isigmund/ha-homelab-service-card/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/isigmund/ha-homelab-service-card/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/isigmund/ha-homelab-service-card/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/isigmund/ha-homelab-service-card/releases/tag/v0.1.0
