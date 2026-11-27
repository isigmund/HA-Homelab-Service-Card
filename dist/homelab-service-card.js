/**
 * Homelab Service Card
 * A Home Assistant Lovelace card showing a homelab service with its icon,
 * a link to the service, an Up/Down status pill and additional entity rows.
 *
 * No build step required: this file is loaded directly by Home Assistant.
 */

const CARD_VERSION = "0.2.0-beta.1";
const CARD_TYPE = "homelab-service-card";
const EDITOR_TYPE = "homelab-service-card-editor";

const DEFAULTS = {
  icon_size: 32,
  status_label: "Status",
  open_in_new_tab: true,
};

// Entity states that count as "Up". Everything else (incl. unavailable) is "Down".
const UP_STATES = new Set([
  "on", "up", "online", "connected", "running", "ok", "true", "home", "available", "1",
]);

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

/** Blocks script URLs. Images may additionally use data:image/... URLs. */
const safeUrl = (value, { allowDataImage = false } = {}) => {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (allowDataImage && /^data:image\//i.test(url)) return url;
  if (/^\s*(javascript|vbscript|data):/i.test(url)) return "";
  return url;
};

const normalizeEntities = (entities) =>
  (Array.isArray(entities) ? entities : [])
    .map((e) => (typeof e === "string" ? { entity: e } : e))
    .filter((e) => e && typeof e.entity === "string" && e.entity);

/** Reads the `links` option. Items may be URL strings or { name, url }. Keeps blank items. */
const readLinks = (links) =>
  (Array.isArray(links) ? links : [])
    .map((l) => (typeof l === "string" ? { url: l } : l))
    .filter((l) => l && typeof l === "object")
    .map((l) => ({ name: l.name ?? "", url: l.url ?? "" }));

/** Links the card can show: only items with a usable URL. */
const normalizeLinks = (links) =>
  readLinks(links)
    .map((l) => ({ name: String(l.name ?? ""), url: safeUrl(l.url) }))
    .filter((l) => l.url);

// Popover API: the menu is shown in the top layer, so the card can't clip it.
const SUPPORTS_POPOVER =
  typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

// Material Design Icons path (mdi:menu).
const MDI_MENU = "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z";

const fireEvent = (node, type, detail) => {
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
};

const STYLES = `
  :host { display: block; }
  ha-card { padding: 16px; height: 100%; box-sizing: border-box; }
  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    min-height: 40px;
  }
  .service-link {
    color: inherit;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
  .service-link[href] { cursor: pointer; }
  .service-link[href]:hover .name { text-decoration: underline; }
  .icon {
    flex: none;
    object-fit: contain;
    display: block;
  }
  ha-icon.icon { color: var(--state-icon-color, var(--primary-color)); }
  .name {
    font-size: 1.2em;
    font-weight: 600;
    line-height: 1.3;
    color: var(--primary-text-color);
    overflow-wrap: anywhere;
  }
  .divider {
    height: 1px;
    background: var(--divider-color, rgba(0, 0, 0, 0.12));
    margin: 6px 0 4px;
  }
  .rows {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(80px, auto);
    column-gap: 24px;
    row-gap: 2px;
    align-items: center;
  }
  .row {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    cursor: pointer;
  }
  .label, .value { font-size: 12px; }
  .label {
    justify-self: end;
    text-align: right;
    color: var(--primary-text-color);
    /* Long names stay on one line and are truncated with an ellipsis. */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    max-width: 100%;
  }
  .value {
    justify-self: end;
    text-align: right;
    color: var(--primary-text-color);
    white-space: nowrap;
  }
  .row:focus-visible .label { text-decoration: underline; }
  .row { outline: none; }
  .pill {
    display: inline-block;
    padding: 2px 12px;
    border-radius: 999px;
    font-size: 0.85em;
    font-weight: 600;
    line-height: 1.5;
    color: #fff;
  }
  .pill.up { background: var(--success-color, #2e7d32); }
  .pill.down { background: var(--error-color, #c62828); }
  .warning { color: var(--warning-color, #f57c00); white-space: normal; }
  .menu-wrap { margin-left: auto; position: relative; flex: none; }
  .menu-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--secondary-text-color, #727272);
    cursor: pointer;
  }
  .menu-button:hover, .menu-button:focus-visible, .menu-button[aria-expanded="true"] {
    background: rgba(127, 127, 127, 0.15);
    outline: none;
  }
  .menu-button svg { width: 24px; height: 24px; fill: currentColor; }
  .menu {
    margin: 0;
    padding: 4px 0;
    min-width: 160px;
    max-width: min(320px, calc(100vw - 16px));
    border: none;
    border-radius: 8px;
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    box-sizing: border-box;
  }
  .menu[popover] { position: fixed; inset: auto; }
  .menu:not([popover]) {
    display: none;
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 10;
  }
  .menu-wrap.open .menu:not([popover]) { display: block; }
  .menu-item {
    display: block;
    padding: 8px 16px;
    font-size: 14px;
    color: var(--primary-text-color);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .menu-item:hover, .menu-item:focus-visible {
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.12));
    outline: none;
  }
`;

class HomelabServiceCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._closeMenu = this._closeMenu.bind(this);
    this._onDocumentClick = (ev) => {
      if (!ev.composedPath().includes(this._menuWrap)) this._closeMenu();
    };
    this.shadowRoot.addEventListener("click", (ev) => this._handleClick(ev));
    this.shadowRoot.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") this._closeMenu();
      if (ev.key === "Enter" || ev.key === " ") {
        const row = ev.target.closest?.("[data-entity]");
        if (row) {
          ev.preventDefault();
          this._openMoreInfo(row.dataset.entity);
        }
      }
    });
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TYPE);
  }

  static getStubConfig(hass) {
    const states = hass?.states ?? {};
    const status = Object.keys(states).find((id) => id.startsWith("binary_sensor.")) ?? "";
    return {
      name: "Home Assistant",
      url: "https://www.home-assistant.io",
      icon: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/home-assistant.svg",
      icon_size: DEFAULTS.icon_size,
      status_entity: status,
      entities: [],
    };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Invalid configuration");
    }
    if (config.icon_size !== undefined && !(Number(config.icon_size) > 0)) {
      throw new Error("icon_size must be a positive number");
    }
    this._config = {
      ...DEFAULTS,
      ...config,
      entities: normalizeEntities(config.entities),
      links: normalizeLinks(config.links),
    };
    this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (!old || this._watchedEntities().some((id) => old.states[id] !== hass.states[id])) {
      // Only the rows depend on entity states; keeping the header keeps the menu open.
      this._renderRows();
    }
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    const rows = (this._config?.status_entity ? 1 : 0) + (this._config?.entities?.length ?? 0);
    return 2 + Math.ceil(rows / 2);
  }

  getGridOptions() {
    // Full section width (12 of 12 columns) by default: twice a regular card.
    return { columns: 12, min_columns: 6 };
  }

  _watchedEntities() {
    const ids = this._config.entities.map((e) => e.entity);
    if (this._config.status_entity) ids.push(this._config.status_entity);
    return ids;
  }

  _isInternalUrl(url) {
    return url.startsWith("/") && !url.startsWith("//");
  }

  /** `attrs` is extra, already escaped HTML attributes for the link. */
  _renderLink(content, url, extraClass = "", attrs = "") {
    if (!url) return `<span class="service-link ${extraClass}">${content}</span>`;
    const internal = this._isInternalUrl(url);
    const target = !internal && this._config.open_in_new_tab
      ? ' target="_blank" rel="noopener noreferrer"'
      : "";
    return `<a class="service-link ${extraClass}" href="${escapeHtml(url)}"${target}
      data-internal="${internal}" ${attrs}>${content}</a>`;
  }

  _renderIcon() {
    const { icon, icon_size: size } = this._config;
    const px = Number(size) || DEFAULTS.icon_size;
    if (!icon) return "";
    if (/^mdi:/i.test(icon)) {
      return `<ha-icon class="icon" icon="${escapeHtml(icon)}"
        style="--mdc-icon-size:${px}px;width:${px}px;height:${px}px"></ha-icon>`;
    }
    const src = safeUrl(icon, { allowDataImage: true });
    if (!src) return "";
    return `<img class="icon" src="${escapeHtml(src)}" alt="" width="${px}" height="${px}"
      style="width:${px}px;height:${px}px" loading="lazy">`;
  }

  _renderStatusRow() {
    const id = this._config.status_entity;
    if (!id) return "";
    const stateObj = this._hass?.states[id];
    let value;
    if (!stateObj) {
      value = this._hass
        ? `<span class="warning">Entity not found: ${escapeHtml(id)}</span>`
        : "";
    } else {
      const up = UP_STATES.has(String(stateObj.state).toLowerCase());
      value = `<span class="pill ${up ? "up" : "down"}">${up ? "Up" : "Down"}</span>`;
    }
    return this._renderRow(id, escapeHtml(this._config.status_label), value);
  }

  _renderEntityRow(entityConf) {
    const id = entityConf.entity;
    const stateObj = this._hass?.states[id];
    if (!stateObj) {
      const value = this._hass
        ? `<span class="warning">Entity not found: ${escapeHtml(id)}</span>`
        : "";
      return this._renderRow(id, escapeHtml(entityConf.name ?? id), value);
    }
    const name = entityConf.name ?? stateObj.attributes.friendly_name ?? id;
    return this._renderRow(id, escapeHtml(name), escapeHtml(this._formatState(stateObj)));
  }

  _renderRow(entityId, label, value) {
    return `<div class="row" data-entity="${escapeHtml(entityId)}" role="button" tabindex="0">
      <div class="label" title="${label}">${label}</div>
      <div class="value">${value}</div>
    </div>`;
  }

  _formatState(stateObj) {
    if (typeof this._hass?.formatEntityState === "function") {
      return this._hass.formatEntityState(stateObj);
    }
    const { state } = stateObj;
    if (state === "unavailable" || state === "unknown") {
      return state.charAt(0).toUpperCase() + state.slice(1);
    }
    const unit = stateObj.attributes.unit_of_measurement;
    return unit ? `${state} ${unit}` : state;
  }

  _renderMenu() {
    const { links } = this._config;
    if (!links.length) return "";
    const items = links
      .map((l) => {
        const label = escapeHtml(l.name || l.url);
        return this._renderLink(label, l.url, "menu-item", `role="menuitem" title="${label}"`);
      })
      .join("");
    const popover = SUPPORTS_POPOVER;
    return `<div class="menu-wrap">
      <button class="menu-button" type="button" aria-label="More links" title="More links"
        aria-haspopup="menu" aria-expanded="false"${popover ? ' popovertarget="menu"' : ""}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${MDI_MENU}"></path></svg>
      </button>
      <div class="menu" id="menu" role="menu"${popover ? ' popover="auto"' : ""}>${items}</div>
    </div>`;
  }

  _render() {
    if (!this._config) return;
    this._closeMenu();
    const url = safeUrl(this._config.url);
    const iconHtml = this._renderIcon();
    const hasRows = Boolean(this._config.status_entity) || this._config.entities.length > 0;

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card>
        <div class="header">
          ${iconHtml ? this._renderLink(iconHtml, url, "icon-link") : ""}
          ${this._renderLink(`<span class="name">${escapeHtml(this._config.name ?? "")}</span>`, url, "name-link")}
          ${this._renderMenu()}
        </div>
        ${hasRows ? `<div class="divider"></div><div class="rows"></div>` : ""}
      </ha-card>
    `;
    this._setupMenu();
    this._renderRows();
  }

  _renderRows() {
    const container = this.shadowRoot.querySelector(".rows");
    if (!container) return;
    container.innerHTML =
      this._renderStatusRow() + this._config.entities.map((e) => this._renderEntityRow(e)).join("");
  }

  _setupMenu() {
    this._menuWrap = this.shadowRoot.querySelector(".menu-wrap");
    this._menuButton = this._menuWrap?.querySelector(".menu-button");
    this._menu = this._menuWrap?.querySelector(".menu");
    if (!this._menu || !SUPPORTS_POPOVER) return;
    this._menu.addEventListener("beforetoggle", (ev) => {
      if (ev.newState !== "open") return;
      // Align the menu's right edge with the button, just below it.
      const rect = this._menuButton.getBoundingClientRect();
      const viewport = document.documentElement.clientWidth;
      this._menu.style.top = `${Math.round(rect.bottom + 4)}px`;
      this._menu.style.right = `${Math.max(8, Math.round(viewport - rect.right))}px`;
    });
    this._menu.addEventListener("toggle", (ev) => {
      const open = ev.newState === "open";
      this._menuButton.setAttribute("aria-expanded", String(open));
      // A fixed-position menu would drift away from the card when the page scrolls.
      if (open) window.addEventListener("scroll", this._closeMenu, { capture: true, passive: true });
      else window.removeEventListener("scroll", this._closeMenu, { capture: true });
    });
  }

  _toggleFallbackMenu() {
    if (this._menuWrap.classList.contains("open")) {
      this._closeMenu();
      return;
    }
    this._menuWrap.classList.add("open");
    this._menuButton.setAttribute("aria-expanded", "true");
    document.addEventListener("click", this._onDocumentClick, true);
  }

  _closeMenu() {
    if (!this._menu) return;
    if (SUPPORTS_POPOVER) {
      if (this._menu.matches(":popover-open")) this._menu.hidePopover();
      return;
    }
    this._menuWrap.classList.remove("open");
    this._menuButton.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", this._onDocumentClick, true);
  }

  disconnectedCallback() {
    this._closeMenu();
  }

  _handleClick(ev) {
    const row = ev.target.closest?.("[data-entity]");
    if (row) {
      this._openMoreInfo(row.dataset.entity);
      return;
    }
    if (!SUPPORTS_POPOVER && ev.target.closest?.(".menu-button")) {
      this._toggleFallbackMenu();
      return;
    }
    const link = ev.target.closest?.("a.service-link");
    if (link?.classList.contains("menu-item")) this._closeMenu();
    if (link && link.dataset.internal === "true") {
      // Navigate inside Home Assistant without a full page reload.
      ev.preventDefault();
      window.history.pushState(null, "", link.getAttribute("href"));
      fireEvent(window, "location-changed", { replace: false });
    }
  }

  _openMoreInfo(entityId) {
    if (entityId) fireEvent(this, "hass-more-info", { entityId });
  }
}

/* ------------------------------------------------------------------ */
/* Visual editor                                                       */
/* ------------------------------------------------------------------ */

const EDITOR_SCHEMA = [
  { name: "name", selector: { text: {} } },
  { name: "url", selector: { text: { type: "url" } } },
  { name: "open_in_new_tab", selector: { boolean: {} } },
  { name: "icon", selector: { text: {} } },
  {
    name: "icon_size",
    selector: { number: { min: 16, max: 256, step: 1, mode: "box", unit_of_measurement: "px" } },
  },
  { name: "status_entity", selector: { entity: {} } },
  { name: "status_label", selector: { text: {} } },
];

// One row per additional entity: entity picker + optional display name.
const ENTITY_ROW_SCHEMA = [
  {
    type: "grid",
    name: "",
    schema: [
      { name: "entity", selector: { entity: {} } },
      { name: "name", selector: { text: {} } },
    ],
  },
];

const ADD_ENTITY_SCHEMA = [{ name: "entity", selector: { entity: {} } }];

const EDITOR_LABELS = {
  name: "Service name",
  url: "Service URL",
  open_in_new_tab: "Open URL in a new tab",
  icon: "Icon (image URL or mdi:icon)",
  icon_size: "Icon size",
  status_entity: "Status entity (Up / Down)",
  status_label: "Status label",
};

const EDITOR_HELPERS = {
  url: "Opened when clicking the icon or the name. Paths starting with / stay inside Home Assistant.",
  icon: "For example https://cdn.jsdelivr.net/gh/selfhst/icons/svg/paperless-ngx.svg (see selfh.st/icons)",
  icon_size: "The icon is shown as a square of this size.",
  status_entity: "Shown as a green Up or red Down pill. States like on, up, online count as Up.",
};

const ENTITY_ROW_LABELS = { entity: "Entity", name: "Display name (optional)" };

// One row per secondary link: name + URL.
const LINK_ROW_SCHEMA = [
  {
    type: "grid",
    name: "",
    schema: [
      { name: "name", selector: { text: {} } },
      { name: "url", selector: { text: { type: "url" } } },
    ],
  },
];

const LINK_ROW_LABELS = { name: "Link name", url: "Link URL" };

// Material Design Icons paths (mdi:arrow-up, mdi:arrow-down, mdi:delete).
const MDI_ARROW_UP = "M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z";
const MDI_ARROW_DOWN = "M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z";
const MDI_DELETE =
  "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z";

const EDITOR_STYLES = `
  .hsc-list-title { font-weight: 500; margin: 24px 0 4px; }
  .hsc-list-help {
    color: var(--secondary-text-color);
    font-size: 0.875em;
    margin-bottom: 8px;
  }
  .hsc-list-row { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
  .hsc-list-row ha-form { flex: 1; min-width: 0; }
  .hsc-list-row ha-icon-button { color: var(--secondary-text-color); flex: none; }
`;

const toEntityEntry = ({ entity, name }) => (name ? { entity, name } : entity);
const toLinkEntry = ({ name, url }) => (name ? { name, url: url ?? "" } : { url: url ?? "" });

/**
 * Editable lists below the main form. Each row is its own ha-form with
 * move up / move down / remove buttons.
 * - read(config): the list items as objects
 * - toEntry(item): the item as stored in the config
 * - fromForm(value): the stored entry for a row's form value, or null to remove the row
 */
const LIST_SECTIONS = [
  {
    key: "entities",
    title: "Additional entities",
    help: "Each entity is shown on its own line. Leave the display name empty to use the entity name.",
    schema: ENTITY_ROW_SCHEMA,
    labels: ENTITY_ROW_LABELS,
    read: (config) => normalizeEntities(config.entities),
    toEntry: toEntityEntry,
    toForm: (item) => ({ entity: item.entity, name: item.name ?? "" }),
    // Clearing the entity picker removes the row.
    fromForm: (value) => (value.entity ? toEntityEntry(value) : null),
  },
  {
    key: "links",
    title: "Secondary links",
    help: "Shown in a menu (☰) at the top right of the card. Paths starting with / stay inside Home Assistant.",
    schema: LINK_ROW_SCHEMA,
    labels: LINK_ROW_LABELS,
    read: (config) => readLinks(config.links),
    toEntry: toLinkEntry,
    toForm: (item) => ({ name: item.name ?? "", url: item.url ?? "" }),
    fromForm: (value) => toLinkEntry(value),
    addLabel: "Add link",
    newItem: { url: "" },
  },
];

class HomelabServiceCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    for (const section of this._sections ?? []) {
      if (section.addForm) section.addForm.hass = hass;
      for (const row of section.rows) row.form.hass = hass;
    }
  }

  connectedCallback() {
    this._ensureFormLoaded().then(() => this._render());
  }

  /** ha-form is lazy-loaded by Home Assistant; force it to load if needed. */
  async _ensureFormLoaded() {
    if (customElements.get("ha-form")) return;
    try {
      const helpers = await window.loadCardHelpers?.();
      const card = await helpers?.createCardElement({ type: "entities", entities: [] });
      await card?.constructor?.getConfigElement?.();
    } catch (err) {
      // Ignore: ha-form is normally already available in the card editor.
    }
  }

  _render() {
    if (!this._config || !customElements.get("ha-form")) return;
    if (!this._form) this._build();

    const rest = { ...this._config };
    for (const def of LIST_SECTIONS) delete rest[def.key];
    this._form.hass = this._hass;
    this._form.data = { ...DEFAULTS, ...rest };
    for (const section of this._sections) this._renderRows(section);
  }

  _build() {
    const style = document.createElement("style");
    style.textContent = EDITOR_STYLES;

    this._form = document.createElement("ha-form");
    this._form.schema = EDITOR_SCHEMA;
    this._form.computeLabel = (s) => EDITOR_LABELS[s.name] ?? s.name;
    this._form.computeHelper = (s) => EDITOR_HELPERS[s.name];
    this._form.addEventListener("value-changed", (ev) => this._mainChanged(ev));
    this.append(style, this._form);

    this._sections = LIST_SECTIONS.map((def) => this._buildSection(def));
  }

  _buildSection(def) {
    const title = document.createElement("div");
    title.className = "hsc-list-title";
    title.textContent = def.title;
    const help = document.createElement("div");
    help.className = "hsc-list-help";
    help.textContent = def.help;
    const list = document.createElement("div");
    const section = { def, list, rows: [] };

    let add;
    if (def.key === "entities") {
      // Picking an entity adds it right away.
      add = document.createElement("ha-form");
      add.schema = ADD_ENTITY_SCHEMA;
      add.data = {};
      add.computeLabel = () => "Add entity";
      add.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const id = ev.detail.value?.entity;
        if (!id) return;
        this._setItems(section, [...this._items(section), id]);
        add.data = {};
      });
      section.addForm = add;
    } else {
      add = document.createElement(customElements.get("ha-button") ? "ha-button" : "button");
      add.textContent = def.addLabel;
      add.addEventListener("click", () => {
        this._setItems(section, [...this._items(section), { ...def.newItem }]);
      });
    }

    this.append(title, help, list, add);
    return section;
  }

  _items(section) {
    return section.def.read(this._config).map(section.def.toEntry);
  }

  _renderRows(section) {
    const { def } = section;
    const items = def.read(this._config);
    // Rows are only rebuilt when the count changes, so typing doesn't lose focus.
    if (section.rows.length !== items.length) {
      section.list.replaceChildren();
      section.rows = items.map((_, index) => this._createRow(section, index));
    }
    if (section.addForm) section.addForm.hass = this._hass;
    section.rows.forEach((row, i) => {
      row.form.hass = this._hass;
      row.form.data = def.toForm(items[i]);
      row.up.disabled = i === 0;
      row.down.disabled = i === items.length - 1;
    });
  }

  _createRow(section, index) {
    const { def } = section;
    const el = document.createElement("div");
    el.className = "hsc-list-row";

    const form = document.createElement("ha-form");
    form.schema = def.schema;
    form.computeLabel = (s) => def.labels[s.name] ?? s.name;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const list = this._items(section);
      const entry = def.fromForm(ev.detail.value ?? {});
      if (entry === null) list.splice(index, 1);
      else list[index] = entry;
      this._setItems(section, list);
    });

    const button = (path, label, onClick) => {
      const b = document.createElement("ha-icon-button");
      b.path = path;
      b.label = label;
      b.addEventListener("click", onClick);
      return b;
    };
    const move = (delta) => {
      const list = this._items(section);
      const target = index + delta;
      if (target < 0 || target >= list.length) return;
      [list[index], list[target]] = [list[target], list[index]];
      this._setItems(section, list);
    };
    const up = button(MDI_ARROW_UP, "Move up", () => move(-1));
    const down = button(MDI_ARROW_DOWN, "Move down", () => move(1));
    const remove = button(MDI_DELETE, "Remove", () => {
      const list = this._items(section);
      list.splice(index, 1);
      this._setItems(section, list);
    });

    el.append(form, up, down, remove);
    section.list.appendChild(el);
    return { form, up, down };
  }

  _setItems(section, items) {
    const config = { ...this._config, [section.def.key]: items };
    if (!items.length) delete config[section.def.key];
    this._config = config;
    this._fireChanged();
    this._renderRows(section);
  }

  _mainChanged(ev) {
    ev.stopPropagation();
    this._config = { ...this._config, ...ev.detail.value };
    this._fireChanged();
  }

  _fireChanged() {
    const config = { ...this._config };
    for (const key of Object.keys(config)) {
      if (config[key] === "" || config[key] === undefined) delete config[key];
    }
    this._config = config;
    fireEvent(this, "config-changed", { config });
  }
}

if (!customElements.get(CARD_TYPE)) customElements.define(CARD_TYPE, HomelabServiceCard);
if (!customElements.get(EDITOR_TYPE)) customElements.define(EDITOR_TYPE, HomelabServiceCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === CARD_TYPE)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: "Homelab Service Card",
    description: "Shows a homelab service with icon, links, Up/Down status and extra entities.",
    preview: true,
  });
}

console.info(
  `%c HOMELAB-SERVICE-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#2e7d32;font-weight:700;",
  "color:#2e7d32;background:#fff;font-weight:700;",
);
