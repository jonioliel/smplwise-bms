import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-WAVE1-COMBINED-2436: the backend's settings definitions, read as source text by the unit specs that pin a frontend
// setting to the server's. Since CR-SETTINGS-STORE-2436 they live in two files, each with its own part:
//   SETTINGS_STORE  - services/settings_store.py: the registry (`DEFAULTS`, `FROZEN_SKINS`, `stored_skin`, the `_stored_*`
//                     normalisers inside `read_settings`).
//   SETTINGS_ROUTER - routers/settings.py: what PATCH /settings accepts (`SettingsPatch` fields with their pattern / bounds,
//                     `TTS_*_PATTERN`, the PATCH-only words).
// A spec asserts each fact against the file that owns it, so a definition that moves again fails loudly here.
const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'smplwise_vms', 'backend', 'smplwise');

export const SETTINGS_STORE_PATH = path.join(BACKEND, 'services', 'settings_store.py');
export const SETTINGS_ROUTER_PATH = path.join(BACKEND, 'routers', 'settings.py');

export const SETTINGS_STORE = readFileSync(SETTINGS_STORE_PATH, 'utf8');
export const SETTINGS_ROUTER = readFileSync(SETTINGS_ROUTER_PATH, 'utf8');
