/*
 * SMPLWISE Lovelace card (T056) — a thin wrapper that shows a VMS screen inside a Home Assistant dashboard.
 *
 * It embeds the add-on's own Ingress page, so the person is who Home Assistant says they are and the VMS applies
 * its own roles; the card holds no secret, creates no entity and cannot bypass a permission. Views: camera, map,
 * events, health (the same screens as the main interface, chrome hidden with embed=1).
 *
 *   type: custom:smplwise-card
 *   view: camera            # camera | map | events | health
 *   camera: <camera id>     # for view: camera (the id shown in the VMS camera page URL)
 *   floor: <floor id>       # for view: map
 *   height: 360             # px, optional
 *   addon: 0b8c26d5_smplwise_vms   # optional, the add-on slug
 *   ingress_url: /api/hassio_ingress/<token>   # optional, when the add-on info cannot be read for this user
 */
(function () {
  const DEFAULT_ADDON = '0b8c26d5_smplwise_vms';
  const VERSION = '0.2.0';

  function routeFor(config) {
    const view = config.view || 'events';
    if (view === 'camera') return config.camera ? `/live/cameras/${encodeURIComponent(config.camera)}` : '/live';
    if (view === 'map') return config.floor ? `/explore/floors/${encodeURIComponent(config.floor)}` : '/explore/sites';
    if (view === 'health') return '/system';
    if (view === 'events') return '/investigate/events';
    if (view === 'wall') return '/live/wall';
    return '/live';
  }

  class SmplwiseCard extends HTMLElement {
    static getStubConfig() {
      return { view: 'events', height: 360 };
    }

    setConfig(config) {
      if (!config || typeof config !== 'object') throw new Error('smplwise-card: config is required');
      const allowed = ['camera', 'map', 'events', 'health', 'wall'];
      if (config.view && !allowed.includes(config.view)) throw new Error(`smplwise-card: view must be one of ${allowed.join(', ')}`);
      this._config = { height: 360, ...config };
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

    _ingressCookie(session) {
      // the same cookie the Home Assistant frontend sets when it opens an add-on panel; scoped to the ingress path
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `ingress_session=${session}; path=/api/hassio_ingress/; SameSite=Strict${secure}`;
    }

    async _connect() {
      const hass = this._hass;
      const cfg = this._config || {};
      this._state = { phase: 'connecting' };
      this._render();
      try {
        let ingressUrl = cfg.ingress_url || null;
        if (!ingressUrl) {
          const info = await hass.callApi('GET', `hassio/addons/${cfg.addon || DEFAULT_ADDON}/info`);
          ingressUrl = info && (info.ingress_url || (info.data && info.data.ingress_url));
        }
        if (!ingressUrl) throw new Error('no ingress url');
        // an Ingress session is required for the iframe; validate every few minutes like the HA panel does
        const created = await hass.callApi('POST', 'hassio/ingress/session');
        const session = created && (created.session || (created.data && created.data.session));
        if (session) {
          this._ingressCookie(session);
          this._session = session;
          this._timer = window.setInterval(() => {
            hass.callApi('POST', 'hassio/ingress/validate_session', { session }).catch(() => undefined);
          }, 4 * 60 * 1000);
        }
        this._state = { phase: 'ready', src: `${ingressUrl.replace(/\/$/, '')}/#${routeFor(cfg)}?embed=1` };
      } catch (err) {
        this._state = { phase: 'error', message: (err && err.message) || String(err) };
      }
      this._render();
    }

    disconnectedCallback() {
      if (this._timer) window.clearInterval(this._timer);
    }

    _render() {
      const cfg = this._config || {};
      const st = this._state || { phase: 'idle' };
      const h = Number(cfg.height) || 360;
      if (!this._root) {
        this._root = this.attachShadow({ mode: 'open' });
      }
      const title = cfg.title ? `<div class="t">${cfg.title}</div>` : '';
      let body = '';
      if (st.phase === 'ready') {
        body = `<iframe src="${st.src}" title="SMPLWISE VMS" allow="fullscreen; autoplay" style="border:0;inline-size:100%;block-size:${h}px;display:block"></iframe>`;
      } else if (st.phase === 'error') {
        body = `<div class="msg">SMPLWISE: לא ניתן לפתוח את התצוגה (${st.message}). פתח את SMPLWISE פעם אחת מהסרגל הצדדי, או הוסף <code>ingress_url</code> להגדרת הכרטיס.</div>`;
      } else {
        body = `<div class="msg">SMPLWISE: מתחבר…</div>`;
      }
      this._root.innerHTML = `<style>
        :host { display: block; }
        ha-card { overflow: hidden; }
        .t { padding: 12px 16px 0; font-weight: 600; }
        .msg { padding: 16px; color: var(--secondary-text-color, #666); font-size: 14px; direction: rtl; }
        code { direction: ltr; }
      </style><ha-card>${title}${body}</ha-card>`;
    }
  }

  if (!customElements.get('smplwise-card')) customElements.define('smplwise-card', SmplwiseCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === 'smplwise-card')) {
    window.customCards.push({ type: 'smplwise-card', name: 'SMPLWISE VMS', description: 'מצלמה, מפה, אירועים או בריאות מ־SMPLWISE VMS בתוך הדשבורד (זהות HA, הרשאות VMS)', preview: false });
  }
  window.SMPLWISE_CARD_VERSION = VERSION;
})();
