/**
 * CR-DIAG-TABS-2440 (review 06:BUNDLE-2): the one-tab cards of הגדרות › בריאות ועבודות.
 * <system-diagnostics> fetches this module when the tab is first opened (TAB_CHUNKS there) and draws the tab only once it landed.
 * Imports only - the tab's rows and state are still drawn by screens/system-diagnostics.ts.
 */
import '../components/recorder-health-panel'; // CR-026: per-recorder health cards and thresholds (בריאות ועבודות)
import '../components/camera-image-health-settings'; // CAMHEALTH091: the camera picture check (off by default), its thresholds and recipients
import '../components/health-log-export'; // CR-FE-LOGEXPORT-TARIFF-EN-2440 (T033): the redacted log export, with consent
