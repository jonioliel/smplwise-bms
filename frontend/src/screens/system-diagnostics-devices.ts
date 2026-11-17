/**
 * CR-DIAG-TABS-2440 (review 06:BUNDLE-2): the one-tab cards of הגדרות › חשמל והתקנים.
 * <system-diagnostics> fetches this module when the tab is first opened (TAB_CHUNKS there) and draws the tab only once it landed.
 * Imports only - the tab's rows and state are still drawn by screens/system-diagnostics.ts.
 */
import './system-home-screen'; // home redesign: הגדרות › חשמל והתקנים › מסך ראשי
import './devices-theme-picker';
import './devices-climate-kind-admin'; // owner 2026-09-30: מיזוג / חימום per climate entity
import './devices-type-admin'; // DEVTYPE (owner 2026-10-09): סוגי התקנים - the fixed type of a switch-wired device
import './area-row-editor'; // release 0.1.149: הגדרות › חשמל והתקנים › מה מוצג ליד שם האזור
import './devices-protected-switches-admin'; // CR-019: הגדרות › חשמל והתקנים › מתגים מוגנים (replaces פעולה קבוצתית)
