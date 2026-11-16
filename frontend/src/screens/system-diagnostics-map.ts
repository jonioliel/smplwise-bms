/**
 * CR-DIAG-TABS-2440 (review 06:BUNDLE-2): the one-tab cards of הגדרות › מפה.
 * <system-diagnostics> fetches this module when the tab is first opened (TAB_CHUNKS there) and draws the tab only once it landed.
 * Imports only - the tab's rows and state are still drawn by screens/system-diagnostics.ts.
 */
import './system-plan-view'; // CR-029 ST7 UI: הגדרות › מפה › תצוגה ריאליסטית (plan.view, the person's own dials, the site location)
import './plan-area-links-admin';
