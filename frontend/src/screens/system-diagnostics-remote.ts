/**
 * CR-DIAG-TABS-2440 (review 06:BUNDLE-2): the one-tab cards of הגדרות › גישה מרחוק.
 * <system-diagnostics> fetches this module when the tab is first opened (TAB_CHUNKS there) and draws the tab only once it landed.
 * Imports only - the tab's rows and state are still drawn by screens/system-diagnostics.ts.
 */
import '../components/sw-remote-sessions';
import '../components/sw-csp-reports';
import './system-app-signin'; // release/2380-train: the phone app's two sign-in switches (auth/app/settings), system administrators
import './system-video-conn-test'; // owner 2026-10-01: הגדרות › גישה מרחוק › בדיקת חיבור וידאו
