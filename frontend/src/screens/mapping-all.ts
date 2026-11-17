/**
 * MAPPING-ASSIST-2330: the mapping family's entry - the settings page first, then the slice that registers on it (an import order that
 * keeps the registration after the class exists).
 *
 * CR-HOME-LAZY-2440 (review 07:F4 d): the assistant and its two slices (mapping-assistant, mapping-decide, mapping-rules) are no longer
 * imported here - <system-mapping> fetches them as one chunk when the assistant is first opened (loadAssistant there). The home screen
 * no longer imports this module at all: it imports the chip alone (screens/mapping-health-chip).
 */
import './system-mapping';
import './mapping-health'; // slice 2: the health card and the home's chip
