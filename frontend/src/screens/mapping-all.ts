/**
 * MAPPING-ASSIST-2330: the mapping assistant's entry - the settings page and the assistant first, then the slices that register on them
 * (an import order that keeps the registration after the classes exist).
 */
import './system-mapping';
import './mapping-decide'; // slice 2: the exceptions step
import './mapping-health'; // slice 2: the health card and the home's chip
import './mapping-rules'; // slice 3: "מתקדם"
