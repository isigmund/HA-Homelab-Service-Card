/**
 * Homelab Service Card
 * A Home Assistant Lovelace card showing a homelab service with its icon,
 * a link to the service, an Up/Down status pill and additional entity rows.
 *
 * No build step required: this file is loaded directly by Home Assistant.
 */

const CARD_VERSION = "0.1.0";
const CARD_TYPE = "homelab-service-card";
const EDITOR_TYPE = "homelab-service-card-editor";

const DEFAULTS = {
  icon_size: 48,
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
    margin: 12px 0 8px;
  }
  .rows {
    display: grid;
    grid-template-columns: 1fr minmax(80px, auto);
    column-gap: 24px;
    row-gap: 6px;
    align-items: center;
  }
  .row {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    cursor: pointer;
  }
  .label, .value { font-size: 0.95em; }
  .label {
    justify-self: end;
    text-align: right;
    color: var(--primary-text-color);
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
`;

class HomelabServiceCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.addEventListener("click", (ev) => this._handleClick(ev));
    this.shadowRoot.addEventListener("keydown", (ev) => {
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
    };
    this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (!old || this._watchedEntities().some((id) => old.states[id] !== hass.states[id])) {
      this._render();
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
    return { columns: 6, min_columns: 3 };
  }

  _watchedEntities() {
    const ids = this._config.entities.map((e) => e.entity);
    if (this._config.status_entity) ids.push(this._config.status_entity);
    return ids;
  }

  _isInternalUrl(url) {
    return url.startsWith("/") && !url.startsWith("//");
  }

  _renderLink(content, url, extraClass = "") {
    if (!url) return `<span class="service-link ${extraClass}">${content}</span>`;
    const internal = this._isInternalUrl(url);
    const target = !internal && this._config.open_in_new_tab
      ? ' target="_blank" rel="noopener noreferrer"'
      : "";
    return `<a class="service-link ${extraClass}" href="${escapeHtml(url)}"${target}
      data-internal="${internal}">${content}</a>`;
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
      <div class="label">${label}</div>
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

  _render() {
    if (!this._config) return;
    const url = safeUrl(this._config.url);
    const rows = this._renderStatusRow() + this._config.entities.map((e) => this._renderEntityRow(e)).join("");
    const iconHtml = this._renderIcon();

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card>
        <div class="header">
          ${iconHtml ? this._renderLink(iconHtml, url, "icon-link") : ""}
          ${this._renderLink(`<span class="name">${escapeHtml(this._config.name ?? "")}</span>`, url, "name-link")}
        </div>
        ${rows ? `<div class="divider"></div><div class="rows">${rows}</div>` : ""}
      </ha-card>
    `;
  }

  _handleClick(ev) {
    const row = ev.target.closest?.("[data-entity]");
    if (row) {
      this._openMoreInfo(row.dataset.entity);
      return;
    }
    const link = ev.target.closest?.("a.service-link");
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
  { name: "entities", selector: { entity: { multiple: true } } },
];

const EDITOR_LABELS = {
  name: "Service name",
  url: "Service URL",
  open_in_new_tab: "Open URL in a new tab",
  icon: "Icon (image URL or mdi:icon)",
  icon_size: "Icon size",
  status_entity: "Status entity (Up / Down)",
  status_label: "Status label",
  entities: "Additional entities",
};

const EDITOR_HELPERS = {
  url: "Opened when clicking the icon or the name. Paths starting with / stay inside Home Assistant.",
  icon: "For example https://cdn.jsdelivr.net/gh/selfhst/icons/svg/paperless-ngx.svg (see selfh.st/icons)",
  icon_size: "The icon is shown as a square of this size.",
  status_entity: "Shown as a green Up or red Down pill. States like on, up, online count as Up.",
  entities: "Each entity is shown on its own line with its name and value.",
};

class HomelabServiceCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
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
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.schema = EDITOR_SCHEMA;
      this._form.computeLabel = (s) => EDITOR_LABELS[s.name] ?? s.name;
      this._form.computeHelper = (s) => EDITOR_HELPERS[s.name];
      this._form.addEventListener("value-changed", (ev) => this._valueChanged(ev));
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = {
      ...DEFAULTS,
      ...this._config,
      entities: normalizeEntities(this._config.entities).map((e) => e.entity),
    };
  }

  _valueChanged(ev) {
    ev.stopPropagation();
    const value = ev.detail.value;
    // Keep per-entity options (e.g. a name set in YAML) for entities still in the list.
    const existing = new Map(normalizeEntities(this._config.entities).map((e) => [e.entity, e]));
    const entities = (value.entities ?? []).map((id) => {
      const prev = existing.get(id);
      return prev && Object.keys(prev).length > 1 ? prev : id;
    });

    const config = { ...this._config, ...value, entities };
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
    description: "Shows a homelab service with icon, link, Up/Down status and extra entities.",
    preview: true,
  });
}

console.info(
  `%c HOMELAB-SERVICE-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#2e7d32;font-weight:700;",
  "color:#2e7d32;background:#fff;font-weight:700;",
);
