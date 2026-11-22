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
    grid-template-columns: minmax(0, 1fr) minmax(80px, auto);
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

// Material Design Icons paths (mdi:arrow-up, mdi:arrow-down, mdi:delete).
const MDI_ARROW_UP = "M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z";
const MDI_ARROW_DOWN = "M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z";
const MDI_DELETE =
  "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z";

const EDITOR_STYLES = `
  .hsc-entities-title { font-weight: 500; margin: 24px 0 4px; }
  .hsc-entities-help {
    color: var(--secondary-text-color);
    font-size: 0.875em;
    margin-bottom: 8px;
  }
  .hsc-entity-row { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
  .hsc-entity-row ha-form { flex: 1; min-width: 0; }
  .hsc-entity-row ha-icon-button { color: var(--secondary-text-color); flex: none; }
`;

const toEntityEntry = ({ entity, name }) => (name ? { entity, name } : entity);

class HomelabServiceCardEditor extends HTMLElement {
  constructor() {
    super();
    this._rows = [];
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    if (this._addForm) this._addForm.hass = hass;
    for (const row of this._rows) row.form.hass = hass;
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

    const { entities, ...rest } = this._config;
    this._form.hass = this._hass;
    this._form.data = { ...DEFAULTS, ...rest };
    this._renderEntityRows();
  }

  _build() {
    const style = document.createElement("style");
    style.textContent = EDITOR_STYLES;

    this._form = document.createElement("ha-form");
    this._form.schema = EDITOR_SCHEMA;
    this._form.computeLabel = (s) => EDITOR_LABELS[s.name] ?? s.name;
    this._form.computeHelper = (s) => EDITOR_HELPERS[s.name];
    this._form.addEventListener("value-changed", (ev) => this._mainChanged(ev));

    const title = document.createElement("div");
    title.className = "hsc-entities-title";
    title.textContent = "Additional entities";
    const help = document.createElement("div");
    help.className = "hsc-entities-help";
    help.textContent =
      "Each entity is shown on its own line. Leave the display name empty to use the entity name.";

    this._list = document.createElement("div");

    this._addForm = document.createElement("ha-form");
    this._addForm.schema = ADD_ENTITY_SCHEMA;
    this._addForm.data = {};
    this._addForm.computeLabel = () => "Add entity";
    this._addForm.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const id = ev.detail.value?.entity;
      if (!id) return;
      this._setEntities([...this._entities(), id]);
      this._addForm.data = {};
    });

    this.append(style, this._form, title, help, this._list, this._addForm);
  }

  _entities() {
    return normalizeEntities(this._config.entities).map(toEntityEntry);
  }

  _renderEntityRows() {
    const entities = normalizeEntities(this._config.entities);
    if (this._rows.length !== entities.length) {
      this._list.replaceChildren();
      this._rows = entities.map((_, index) => this._createRow(index));
    }
    this._addForm.hass = this._hass;
    this._rows.forEach((row, i) => {
      row.form.hass = this._hass;
      row.form.data = { entity: entities[i].entity, name: entities[i].name ?? "" };
      row.up.disabled = i === 0;
      row.down.disabled = i === entities.length - 1;
    });
  }

  _createRow(index) {
    const el = document.createElement("div");
    el.className = "hsc-entity-row";

    const form = document.createElement("ha-form");
    form.schema = ENTITY_ROW_SCHEMA;
    form.computeLabel = (s) => ENTITY_ROW_LABELS[s.name] ?? s.name;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const list = this._entities();
      const value = ev.detail.value ?? {};
      if (value.entity) list[index] = toEntityEntry(value);
      else list.splice(index, 1); // Clearing the entity picker removes the row.
      this._setEntities(list);
    });

    const button = (path, label, onClick) => {
      const b = document.createElement("ha-icon-button");
      b.path = path;
      b.label = label;
      b.addEventListener("click", onClick);
      return b;
    };
    const move = (delta) => {
      const list = this._entities();
      const target = index + delta;
      if (target < 0 || target >= list.length) return;
      [list[index], list[target]] = [list[target], list[index]];
      this._setEntities(list);
    };
    const up = button(MDI_ARROW_UP, "Move up", () => move(-1));
    const down = button(MDI_ARROW_DOWN, "Move down", () => move(1));
    const remove = button(MDI_DELETE, "Remove", () => {
      const list = this._entities();
      list.splice(index, 1);
      this._setEntities(list);
    });

    el.append(form, up, down, remove);
    this._list.appendChild(el);
    return { form, up, down };
  }

  _setEntities(entities) {
    this._config = { ...this._config, entities };
    this._fireChanged();
    this._renderEntityRows();
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
    description: "Shows a homelab service with icon, link, Up/Down status and extra entities.",
    preview: true,
  });
}

console.info(
  `%c HOMELAB-SERVICE-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#2e7d32;font-weight:700;",
  "color:#2e7d32;background:#fff;font-weight:700;",
);
