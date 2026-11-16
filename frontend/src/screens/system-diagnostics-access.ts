/**
 * CR-DIAG-TABS-2440 (review 06:BUNDLE-2): the one-tab cards of הגדרות › מתגי מסכי כניסה, and layout b's second tab הכרזות וקול (the same cards).
 * <system-diagnostics> fetches this module when the tab is first opened (TAB_CHUNKS there) and draws the tab only once it landed.
 * Imports only - the tab's rows and state are still drawn by screens/system-diagnostics.ts.
 */
import './system-wiskey-diagnostics'; // WisKey B0: הגדרות › מתגי מסכי כניסה › WisKey רואה את Arx כ־
import './system-call-banner'; // WISKEY-INBOUND-CALLS-2382: who gets the incoming-call banner (off by default)
import './system-wiskey-pairing'; // WISKEY-PAIRING-2382: הגדרות › מתגי מסכי כניסה › חיבור Arx ל-WisKey + מצב WisKey
import './system-access-display'; // CR-036 S12: הגדרות › מתגי מסכי כניסה › תצוגת מסך התחנות (the four S6 display settings)
import './system-access-parity'; // CR-036 S12: הגדרות › מתגי מסכי כניסה › השוואה למסכי האינטרקום (the side-by-side check before a screen is switched)
import './system-wiskey-validation-card'; // WISKEY-LIVE-VALIDATION-2390: הגדרות › מתגי מסכי כניסה › בדיקת קבלה לעמדות (link to its own route)
import '../components/sw-fold-cards'; // SETTINGS-INTERCOM-CARDS-2401: הגדרות › מתגי מסכי כניסה as collapsible cards (layout a)
