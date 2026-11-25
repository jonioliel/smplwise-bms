/**
 * DOCS-ONBOARDING-2530 (T071): the one-tab cards of הגדרות › תמיכה - the redacted log export (T033), the same card as on
 * בריאות ועבודות. <system-diagnostics> fetches this module when the tab is first opened (TAB_CHUNKS there).
 * Imports only - the tab's rows and state are drawn by screens/system-diagnostics.ts.
 */
import '../components/health-log-export'; // T033: the redacted log export, with consent
