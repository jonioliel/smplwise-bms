// Test harness for the electricity screens of pilot/elec-ui-bills (CR-023): mounts the page elements the shell mounts, from the same hash routes
// (#/infra/electricity/accounts/..., #/system/infra/prices ...), without the shell, the session or a backend - the screens answer from the mock layer
// (src/api/electricity-billing-mock.ts, steered by localStorage `sw.demo.electricity`). Served by the Vite DEV server at /tests/electricity-harness/.
// The skin / scheme come from the usual URL parameters (?skin=bubble&scheme=dark), read by the design boot.
import '../../src/design/boot';
import '../../src/styles/focus-policy';
import '../../src/electricity/elec-pages';
import '../../src/electricity/elec-settings-calendar';
import { parseRoute } from '../../src/router';

const SETTINGS: Record<string, string> = { business: 'elec-settings-business', calendar: 'elec-settings-calendar' };

const root = document.getElementById('root') as HTMLElement;
root.style.cssText = 'display:block;min-height:100vh;background:var(--sw-bg);color:var(--sw-text);font-family:var(--sw-font)';

function mount() {
  const r = parseRoute();
  const s = r.segments;
  let el: HTMLElement & { segments?: string[]; params?: URLSearchParams };
  if (s[0] === 'system' && s[1] === 'infra') {
    el = document.createElement(SETTINGS[s[2] ?? ''] ?? 'elec-settings-prices');
  } else {
    const page = s[2] ?? 'accounts';
    el = document.createElement(page === 'bills' ? 'elec-bills-page' : page === 'customers' ? 'elec-customers-page' : 'elec-accounts-page');
    el.segments = s.slice(3);
    el.params = r.params;
  }
  el.setAttribute('data-harness', '');
  root.replaceChildren(el);
}
const sameKind = (a: string[], b: string[]) => a.slice(0, 3).join('/') === b.slice(0, 3).join('/');
let last = parseRoute().segments;
mount();
window.addEventListener('hashchange', () => {
  const now = parseRoute().segments;
  const el = root.firstElementChild as (HTMLElement & { segments?: string[] }) | null;
  // the same page element keeps its state when only the sub-route changes (as the shell does)
  if (el && sameKind(last, now) && !el.tagName.startsWith('ELEC-SETTINGS-') && 'segments' in el) el.segments = now.slice(3);
  else mount();
  last = now;
});
