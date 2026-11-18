import './i18n/ui-lang-boot'; // I18N-EN-SWITCH-2438: <html lang dir> from the user's language before any module builds text (imports nothing)
// CR-I18N-LAZY-LANG-2443: a non-Hebrew page fetches its language pack here, and nothing after this line is evaluated before the
// words are in (top-level await; every catalogue imports this module too). Hebrew fetches nothing and waits for nothing.
import './i18n/lang-packs';
import './design/boot'; // design foundation: the token sheet, the skin sheet and data-skin / data-theme on <html> - before anything renders
import { bootMobilePolish } from './design/mobile-polish'; // POLISH-PHONE-297: the phone layer (after the skin sheet, before any component)
bootMobilePolish();
import './styles/focus-policy'; // mobile audit 2026-09-30: one focus ring for every shadow root (never the browser's amber); must run before any component connects
// CR-008: the pre-gate runs first - on the remote channel (`/arx/`) it parks the shell until the Arx sign-in is done.
import { REMOTE } from './arx/pre-gate';
import './shell/sw-app';
import { syncUiLang } from './i18n/ui-lang';
// CR-SHELL-LAZY-2436 (review 07:F4 c): the remote start-up (sign-in, welcome, local identity words) is a chunk of its own, fetched only on the remote channel
if (REMOTE) void import('./arx/boot').then((m) => m.bootRemote());
void syncUiLang(); // the server's choice wins over this browser's copy (one reload when they differ)
import './pwa/arx-pwa-prompts'; // CR-008 P3: service worker, install prompt, iOS hint, update notice
import { installOverflowDebug } from './debug/overflow';

installOverflowDebug(); // review G: `?debug=overflow` installs window.__arxOverflow() (read-only diagnostics)
