/*
 * SMPLWISE Lovelace card (T056) — a thin wrapper that shows a VMS screen inside a Home Assistant dashboard.
 *
 * It embeds the add-on's own Ingress page, so the person is who Home Assistant says they are and the VMS applies
 * its own roles; the card holds no secret, creates no entity and cannot bypass a permission. Views: camera, map,
 * events, health, wall (the same screens as the main interface, chrome hidden with embed=1).
 *
 *   type: custom:smplwise-card
 *   view: camera            # camera | map | events | health | wall
 *   camera: <camera id>     # for view: camera (the id shown in the VMS camera page URL)
 *   floor: <floor id>       # for view: map
 *   height: 360             # px, optional
 *   title: Entrance         # optional
 *   addon: <slug>           # optional override, e.g. 1a2b3c4d_smplwise_vms or local_smplwise_vms
 *   ingress_url: /api/hassio_ingress/<token>   # optional override, skips the add-on lookup entirely
 *
 * The visual editor (getConfigElement) edits view, camera, floor, height and title; addon and ingress_url are
 * YAML-only overrides.
 *
 * Finding the add-on (0.2.2): the slug carries a per-repository prefix that Home Assistant generates at install
 * time, so it is discovered, never assumed. Order:
 *   1. cfg.ingress_url, when set, is used as is.
 *   2. cfg.addon, when set, is the slug.
 *   3. The add-on sidebar panel in hass.panels (url_path is the slug; config.addon on current Home Assistant,
 *      config.ingress on older releases). The add-on sets panel_admin: false, so every user sees it.
 *   4. The Supervisor add-on list (websocket supervisor/api GET /addons, answer {addons: [{slug, name, ...}]}),
 *      admin users only: the entry whose slug is smplwise_vms or ends with _smplwise_vms.
 * The ingress URL then comes from GET /addons/<slug>/info (ingress_url). All Supervisor calls go through the
 * websocket command supervisor/api, as the Home Assistant frontend does: the REST proxy /api/hassio/ refuses
 * addons, addons/<slug>/info and ingress/session with 401. Non-admin users may call /addons/<slug>/info and
 * /ingress/session and /ingress/validate_session there.
 */
(function () {
  const VERSION = '0.2.2';
  const VIEWS = ['camera', 'map', 'events', 'health', 'wall'];
  const VIEW_LABELS = { camera: 'מצלמה', map: 'מפה', events: 'אירועים', health: 'בריאות המערכת', wall: 'קיר מצלמות' };

  function routeFor(config) {
    const view = config.view || 'events';
    if (view === 'camera') return config.camera ? `/live/cameras/${encodeURIComponent(config.camera)}` : '/live';
    if (view === 'map') return config.floor ? `/explore/floors/${encodeURIComponent(config.floor)}` : '/explore/sites';
    if (view === 'health') return '/system';
    if (view === 'events') return '/investigate/events';
    if (view === 'wall') return '/live/wall';
    return '/live';
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function isOurSlug(slug) {
    return typeof slug === 'string' && (slug === 'smplwise_vms' || slug.endsWith('_smplwise_vms'));
  }

  // A readable reason from whatever a failed call rejected with:
  //   hass.callWS  -> {code, message}                          (home-assistant-js-websocket)
  //   hass.callApi -> {error, status_code, body}               (frontend src/util/hass-call-api.ts)
  //   the Supervisor's own error body inside it -> {result: 'error', message}
  //   a plain Error thrown here -> .message
  function reasonOf(err) {
    if (err === undefined || err === null) return 'unknown error';
    if (typeof err === 'string') return err;
    if (typeof err !== 'object') return String(err);
    const parts = [];
    if (typeof err.message === 'string' && err.message) {
      parts.push(err.code !== undefined && err.code !== null && err.code !== '' ? `${err.code}: ${err.message}` : err.message);
    } else if (err.code !== undefined && err.code !== null && err.code !== '') {
      parts.push(String(err.code));
    }
    if (typeof err.error === 'string' && err.error) parts.push(err.error);
    const body = err.body;
    if (body && typeof body === 'object' && typeof body.message === 'string' && body.message) parts.push(body.message);
    else if (typeof body === 'string' && body.trim()) parts.push(body.trim().slice(0, 160));
    if (parts.length) return parts.join(' - ');
    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}') return json.slice(0, 200);
    } catch (_e) {
      /* fall through */
    }
    return 'unknown error';
  }

  // One Supervisor call through the websocket command the Home Assistant frontend itself uses; the answer is the
  // Supervisor's data object, already unwrapped.
  function supervisor(hass, endpoint, method, data) {
    const msg = { type: 'supervisor/api', endpoint, method };
    if (data) msg.data = data;
    return hass.callWS(msg);
  }

  function slugFromPanels(hass) {
    const panels = (hass && hass.panels) || {};
    for (const panel of Object.values(panels)) {
      if (!panel || typeof panel !== 'object') continue;
      const config = panel.config || {};
      for (const candidate of [config.addon, config.ingress, panel.url_path]) {
        if (isOurSlug(candidate)) return candidate;
      }
    }
    return null;
  }

  async function slugFromAddonList(hass) {
    const answer = await supervisor(hass, '/addons', 'get');
    const list = (answer && (answer.addons || (answer.data && answer.data.addons))) || [];
    const ours = list.filter((a) => a && isOurSlug(a.slug) && a.installed !== false);
    return ours.length ? ours[0].slug : null;
  }

  class SmplwiseCard extends HTMLElement {
    static getStubConfig() {
      return { view: 'events', height: 360 };
    }

    static getConfigElement() {
      return document.createElement('smplwise-card-editor');
    }

    setConfig(config) {
      if (!config || typeof config !== 'object') throw new Error('smplwise-card: config is required');
      if (config.view && !VIEWS.includes(config.view)) throw new Error(`smplwise-card: view must be one of ${VIEWS.join(', ')}`);
      this._config = { height: 360, ...config };
      const target = `${config.addon || ''}|${config.ingress_url || ''}`;
      if (this._hass && target !== this._target) {
        void this._connect();
        return;
      }
      this._render();
    }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (first) void this._connect();
    }

    getCardSize() {
      return Math.max(1, Math.round((this._config?.height || 360) / 50));
    }

    connectedCallback() {
      if (this._session && !this._timer) this._keepSession(this._session);
    }

    disconnectedCallback() {
      if (this._timer) window.clearInterval(this._timer);
      this._timer = null;
    }

    _ingressCookie(session) {
      // the same cookie the Home Assistant frontend sets when it opens an add-on panel; scoped to the ingress path
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `ingress_session=${session}; path=/api/hassio_ingress/; SameSite=Strict${secure}`;
    }

    _keepSession(session) {
      // validate every few minutes like the Home Assistant panel does
      if (this._timer) window.clearInterval(this._timer);
      this._timer = window.setInterval(() => {
        const hass = this._hass;
        if (hass) supervisor(hass, '/ingress/validate_session', 'post', { session }).catch(() => undefined);
      }, 4 * 60 * 1000);
    }

    async _resolveIngressUrl(hass, cfg) {
      if (cfg.ingress_url) return cfg.ingress_url;
      let slug = cfg.addon || slugFromPanels(hass);
      if (!slug) {
        try {
          slug = await slugFromAddonList(hass);
        } catch (err) {
          // the add-on list is for Home Assistant admins only; say so rather than a bare "Unauthorized"
          throw new Error(`התוסף SMPLWISE VMS לא נמצא בסרגל הצדדי, ורשימת התוספים לא נגישה למשתמש הזה (${reasonOf(err)})`);
        }
      }
      if (!slug) throw new Error('התוסף SMPLWISE VMS לא נמצא בין התוספים המותקנים');
      let info;
      try {
        info = await supervisor(hass, `/addons/${slug}/info`, 'get');
      } catch (err) {
        throw new Error(`פרטי התוסף ${slug} לא נקראו: ${reasonOf(err)}`);
      }
      const url = info && (info.ingress_url || (info.data && info.data.ingress_url));
      if (!url) throw new Error(`לתוסף ${slug} אין כתובת Ingress (האם התוסף פועל?)`);
      return url;
    }

    async _connect() {
      const hass = this._hass;
      const cfg = this._config || {};
      const target = `${cfg.addon || ''}|${cfg.ingress_url || ''}`;
      this._target = target;
      this._state = { phase: 'connecting' };
      this._render();
      let state;
      try {
        if (!hass || typeof hass.callWS !== 'function') throw new Error('Home Assistant connection is not ready');
        const ingressUrl = await this._resolveIngressUrl(hass, cfg);
        // an Ingress session is required for the iframe
        let created;
        try {
          created = await supervisor(hass, '/ingress/session', 'post');
        } catch (err) {
          throw new Error(`לא נפתח חיבור Ingress: ${reasonOf(err)}`);
        }
        const session = created && (created.session || (created.data && created.data.session));
        if (session) {
          this._ingressCookie(session);
          this._session = session;
          this._keepSession(session);
        }
        state = { phase: 'ready', base: String(ingressUrl).replace(/\/$/, '') };
      } catch (err) {
        state = { phase: 'error', message: reasonOf(err) };
      }
      if (this._target !== target) return; // a newer config started its own attempt
      this._state = state;
      this._render();
    }

    _render() {
      const cfg = this._config || {};
      const st = this._state || { phase: 'idle' };
      const h = Number(cfg.height) || 360;
      if (!this._root) {
        this._root = this.attachShadow({ mode: 'open' });
      }
      const title = cfg.title ? `<div class="t">${esc(cfg.title)}</div>` : '';
      let body = '';
      if (st.phase === 'ready') {
        const src = `${st.base}/#${routeFor(cfg)}?embed=1`;
        body = `<iframe src="${esc(src)}" title="SMPLWISE VMS" allow="fullscreen; autoplay" style="border:0;inline-size:100%;block-size:${h}px;display:block"></iframe>`;
      } else if (st.phase === 'error') {
        body = `<div class="msg">SMPLWISE: לא ניתן לפתוח את התצוגה (${esc(st.message)}). ודא שהתוסף SMPLWISE VMS מותקן, פועל ומוצג בסרגל הצדדי (Show in sidebar), או הוסף <code>addon</code> או <code>ingress_url</code> להגדרת הכרטיס.</div>`;
      } else {
        body = `<div class="msg">SMPLWISE: מתחבר…</div>`;
      }
      this._root.innerHTML = `<style>
        :host { display: block; }
        ha-card { overflow: hidden; }
        .t { padding: 12px 16px 0; font-weight: 600; }
        .msg { padding: 16px; color: var(--secondary-text-color, #666); font-size: 14px; direction: rtl; }
        code { direction: ltr; unicode-bidi: embed; }
      </style><ha-card>${title}${body}</ha-card>`;
    }
  }

  // The visual editor: Lovelace calls setConfig(config) and sets hass; every change is reported with a
  // config-changed event (bubbles, composed) whose detail is {config}.
  class SmplwiseCardEditor extends HTMLElement {
    setConfig(config) {
      this._config = { ...(config || {}) };
      this._build();
      this._sync();
    }

    set hass(hass) {
      this._hass = hass;
    }

    _build() {
      if (this._root) return;
      this._root = this.attachShadow({ mode: 'open' });
      const options = VIEWS.map((v) => `<option value="${v}">${esc(VIEW_LABELS[v])} (${v})</option>`).join('');
      this._root.innerHTML = `<style>
        :host { display: block; }
        .form { display: grid; gap: 12px; direction: rtl; }
        label { display: grid; gap: 4px; font-size: 14px; color: var(--primary-text-color, #212121); }
        select, input {
          font: inherit; padding: 8px; border-radius: 6px; box-sizing: border-box; inline-size: 100%;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--card-background-color, #fff); color: var(--primary-text-color, #212121);
        }
        input[type=number] { direction: ltr; }
        .hint { font-size: 12px; color: var(--secondary-text-color, #666); }
        [hidden] { display: none; }
      </style>
      <div class="form">
        <label>תצוגה<select data-key="view">${options}</select></label>
        <label data-for="camera">מזהה מצלמה (camera)<input data-key="camera" type="text" dir="ltr" autocomplete="off"></label>
        <label data-for="map">מזהה קומה (floor)<input data-key="floor" type="text" dir="ltr" autocomplete="off"></label>
        <label>גובה בפיקסלים (height)<input data-key="height" type="number" min="100" step="10"></label>
        <label>כותרת (title)<input data-key="title" type="text" autocomplete="off"></label>
        <div class="hint">addon ו־ingress_url נקבעים ב־YAML בלבד, כשהתוסף לא נמצא אוטומטית.</div>
      </div>`;
      for (const el of this._root.querySelectorAll('[data-key]')) {
        const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(eventName, () => this._changed(el.dataset.key, el.value));
      }
    }

    _sync() {
      const cfg = this._config || {};
      const view = VIEWS.includes(cfg.view) ? cfg.view : 'events';
      const active = this._root.activeElement;
      for (const el of this._root.querySelectorAll('[data-key]')) {
        if (el === active) continue; // do not move the caret while the person types
        const key = el.dataset.key;
        const value = key === 'view' ? view : cfg[key] === undefined || cfg[key] === null ? '' : String(cfg[key]);
        if (el.value !== value) el.value = value;
      }
      this._root.querySelector('[data-for="camera"]').hidden = view !== 'camera';
      this._root.querySelector('[data-for="map"]').hidden = view !== 'map';
    }

    _changed(key, raw) {
      const next = { ...(this._config || {}) };
      if (key === 'height') {
        const n = Number(raw);
        if (raw === '' || !Number.isFinite(n) || n <= 0) delete next.height;
        else next.height = Math.round(n);
      } else if (raw === '' || raw === undefined || raw === null) {
        delete next[key];
      } else {
        next[key] = raw;
      }
      this._config = next;
      this._sync();
      const event = new Event('config-changed', { bubbles: true, composed: true });
      event.detail = { config: next };
      this.dispatchEvent(event);
    }
  }

  if (!customElements.get('smplwise-card-editor')) customElements.define('smplwise-card-editor', SmplwiseCardEditor);
  if (!customElements.get('smplwise-card')) customElements.define('smplwise-card', SmplwiseCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === 'smplwise-card')) {
    window.customCards.push({ type: 'smplwise-card', name: 'SMPLWISE VMS', description: 'מצלמה, מפה, אירועים או בריאות מ־SMPLWISE VMS בתוך הדשבורד (זהות HA, הרשאות VMS)', preview: false });
  }
  window.SMPLWISE_CARD_VERSION = VERSION;
})();
