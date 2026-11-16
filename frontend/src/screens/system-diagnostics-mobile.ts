/**
 * CR-DIAG-TABS-2440 (review 06:BUNDLE-2): the one-tab cards of הגדרות › אפליקציה לנייד.
 * <system-diagnostics> fetches this module when the tab is first opened (TAB_CHUNKS there) and draws the tab only once it landed.
 * Imports only - the tab's rows and state are still drawn by screens/system-diagnostics.ts.
 */
import './system-presence'; // CR-027: הגדרות › אפליקציה לנייד
