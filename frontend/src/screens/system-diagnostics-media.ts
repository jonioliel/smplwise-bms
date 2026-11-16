/**
 * CR-DIAG-TABS-2440 (review 06:BUNDLE-2): the one-tab cards of הגדרות › וידאו ומדיה.
 * <system-diagnostics> fetches this module when the tab is first opened (TAB_CHUNKS there) and draws the tab only once it landed.
 * Imports only - the tab's rows and state are still drawn by screens/system-diagnostics.ts.
 */
import '../components/sw-search-access';
import './system-timeline-colors'; // owner 2026-10-01: הגדרות › וידאו ומדיה › צבעי ציר הזמן
import '../components/sw-video-service-picker';
