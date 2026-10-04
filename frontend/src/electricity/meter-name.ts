/**
 * How a meter or a candidate sensor is named on screen. Many sensors are called just "Energy"; what tells them apart is the device they belong to.
 * `primary` is the device's name (the user's name for the device, else its own); `secondary` is the sensor's own name, only when it differs. A sensor
 * with no device shows only its name. A registered meter the operator renamed keeps that name as primary, with the device and sensor below it.
 */
export interface NamedMeter {
  name: string;
  device_name?: string | null;
  entity_name?: string | null;
}

export interface MeterNames {
  primary: string;
  secondary: string;
}

export function meterNames(x: NamedMeter): MeterNames {
  const device = (x.device_name ?? '').trim();
  const entity = (x.entity_name ?? '').trim() || x.name;
  if (x.name && x.name !== entity && x.name !== device) {
    return { primary: x.name, secondary: [...new Set([device, entity].filter((s) => s && s !== x.name))].join(' · ') };
  }
  const primary = device || entity;
  return { primary, secondary: device && entity !== device ? entity : '' };
}

/** The text a search matches: the shown name, the device's name and the sensor's name. */
export function meterSearchText(x: NamedMeter): string {
  return [x.name, x.device_name, x.entity_name].filter(Boolean).join(' ').toLowerCase();
}
