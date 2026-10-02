import './design/boot'; // design foundation: the token sheet, the skin sheet and data-skin / data-theme on <html> - before anything renders
import './styles/focus-policy'; // mobile audit 2026-09-30: one focus ring for every shadow root (never the browser's amber); must run before any component connects
// CR-008: the pre-gate runs first - on the remote channel (`/arx/`) it parks the shell until the Arx sign-in is done.
import { REMOTE } from './arx/pre-gate';
import './shell/sw-app';
import { bootRemote } from './arx/boot';

if (REMOTE) void bootRemote();
import './pwa/arx-pwa-prompts'; // CR-008 P3: service worker, install prompt, iOS hint, update notice
import { installOverflowDebug } from './debug/overflow';

installOverflowDebug(); // review G: `?debug=overflow` installs window.__arxOverflow() (read-only diagnostics)
