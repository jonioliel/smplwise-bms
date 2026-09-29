// CR-008: the pre-gate runs first - on the remote channel (`/arx/`) it parks the shell until the Arx sign-in is done.
import { REMOTE } from './arx/pre-gate';
import './shell/sw-app';
import { bootRemote } from './arx/boot';

if (REMOTE) void bootRemote();
import './pwa/arx-pwa-prompts'; // CR-008 P3: service worker, install prompt, iOS hint, update notice
