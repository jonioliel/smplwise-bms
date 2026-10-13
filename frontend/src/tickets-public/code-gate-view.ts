import {
  INITIAL, RTL_LANGS, cleanCode, controls, fromView, gateText, onSendAnswer, onSendStart, onVerifyAnswer, onVerifyStart, statusLine,
  type Answer, type GateLang, type GateState, type TicketView,
} from './code-gate';

/**
 * CR-038 slice 7: the code gate of the handler page as plain DOM (no framework, no innerHTML: every text is `textContent`, so a
 * value can never become markup; no inline style - the page's CSP is `style-src 'self'`). Slice 4's page mounts it in place of
 * the ticket card while `GET /t/api/ticket` answers `code_required && !code_ok`:
 *
 *   const gate = mountCodeGate(box, { lang: view.lang, view, api: { send, verify }, onSession, onGone });
 *   ...  gate.update(nextView)  // after a reload on visibilitychange
 *   ...  gate.destroy()
 *
 * `api.send()` / `api.verify(code)` are the page's own fetch wrappers (they add `X-Ticket-Token`, `Content-Type:
 * application/json` and parse the JSON body) and answer `{status, body}`; a network failure answers `{status: 0, body: {}}`.
 * Classes (`cg-*`) are styled by the page's CSS file (tickets-public/code-gate.css).
 */
export interface GateApi {
  send(): Promise<Answer>;
  verify(code: string): Promise<Answer>;
}

export interface GateOptions {
  lang: GateLang;
  view: TicketView;
  api: GateApi;
  onSession(session: string): void;
  onGone(): void;
  now?: () => number;
}

export interface GateHandle {
  update(view: TicketView): void;
  state(): GateState;
  destroy(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function mountCodeGate(root: HTMLElement, opts: GateOptions): GateHandle {
  const now = opts.now ?? (() => Date.now());
  const lang = opts.lang;
  let s: GateState = fromView(opts.view, INITIAL, now());
  let timer: number | undefined;
  let alive = true;

  const box = el('section', 'cg');
  box.setAttribute('dir', RTL_LANGS.includes(lang) ? 'rtl' : 'ltr');
  box.setAttribute('data-code-gate', '');
  const title = el('h2', 'cg-title', gateText(lang, 'title'));
  const status = el('p', 'cg-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const form = el('form', 'cg-form');
  form.noValidate = true;
  const label = el('label', 'cg-label', gateText(lang, 'field'));
  const input = el('input', 'cg-input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'one-time-code';
  input.maxLength = 12;
  input.setAttribute('dir', 'ltr');
  input.setAttribute('aria-label', gateText(lang, 'field'));
  input.id = 'cg-code';
  label.htmlFor = 'cg-code';
  const verify = el('button', 'cg-verify btn primary', gateText(lang, 'verify'));
  verify.type = 'submit';
  form.append(label, input, verify);
  const send = el('button', 'cg-send btn');
  send.type = 'button';
  box.append(title, status, form, send);
  root.replaceChildren(box);

  function paint(): void {
    if (!alive) return;
    const c = controls(s);
    const line = statusLine(s, lang, now());
    status.textContent = line ?? '';
    status.hidden = line === null;
    box.dataset.phase = s.phase;
    form.hidden = !c.field;
    send.hidden = c.send === null;
    if (c.send) send.textContent = gateText(lang, s.phase === 'sending' ? 'sending' : c.send);
    send.disabled = c.busy;
    verify.disabled = c.busy;
    verify.textContent = gateText(lang, s.phase === 'verifying' ? 'verifying' : 'verify');
    input.disabled = c.busy;
    window.clearTimeout(timer);
    if (s.phase === 'locked' || s.notice === 'rate_limited') timer = window.setTimeout(tick, 15000); // keep the minutes / seconds fresh
  }

  function tick(): void {
    if (s.phase === 'locked' && s.waitUntil !== null && s.waitUntil <= now()) s = { ...INITIAL };
    else if (s.notice === 'rate_limited' && s.waitUntil !== null && s.waitUntil <= now()) s = { ...s, notice: null, waitUntil: null };
    paint();
  }

  function settle(next: GateState): void {
    s = next;
    if (s.phase === 'gone') {
      opts.onGone();
      return;
    }
    if (s.phase === 'done' && s.session) {
      input.value = '';
      opts.onSession(s.session);
      return;
    }
    paint();
  }

  send.addEventListener('click', async () => {
    if (controls(s).busy) return;
    s = onSendStart(s);
    paint();
    let a: Answer;
    try {
      a = await opts.api.send();
    } catch {
      a = { status: 0, body: {} };
    }
    settle(onSendAnswer(s, a, now()));
    if (s.phase === 'sent') input.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (controls(s).busy) return;
    const code = cleanCode(input.value);
    if (code === null) {
      s = { ...s, notice: 'code_malformed' };
      paint();
      return;
    }
    s = onVerifyStart(s);
    paint();
    let a: Answer;
    try {
      a = await opts.api.verify(code);
    } catch {
      a = { status: 0, body: {} };
    }
    if (!(a.status === 200)) input.select();
    settle(onVerifyAnswer(s, a, now()));
  });

  paint();
  return {
    update(view: TicketView) {
      settle(fromView(view, s, now()));
    },
    state: () => s,
    destroy() {
      alive = false;
      window.clearTimeout(timer);
      root.replaceChildren();
    },
  };
}
