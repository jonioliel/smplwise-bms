import { getEmergencyState, getWindowsState } from '../api/door-windows';
import { doorWindowsTabOn } from '../shell/nav';
import type { DoorsWidgetData } from './home-widget-model';

const NONE: DoorsWidgetData = { windows: null, emergency: null };

/**
 * DOORWIN2-295: the doors home widget's data. `null` = the read FAILED (the home screen then says the widget failed, with a retry); NONE (both
 * null) = nothing to show: the doors tab is off (both master switches off, the shipped default - no request is made at all), or the viewer is
 * not allowed to see any door (the server answered 403/404). The emergency state is read only for a viewer who can see doors; a failed emergency
 * read never hides the windows (the entry is then simply absent).
 */
export async function loadHomeDoorsChecked(): Promise<DoorsWidgetData | null> {
  if (!doorWindowsTabOn()) return NONE;
  let windows;
  try {
    windows = await getWindowsState();
  } catch (e) {
    const status = (e as { status?: number }).status;
    return status === 403 || status === 404 ? NONE : null;
  }
  let emergency = null;
  try {
    emergency = await getEmergencyState();
  } catch {
    emergency = null;
  }
  return { windows, emergency };
}

export async function loadHomeDoors(): Promise<DoorsWidgetData> {
  return (await loadHomeDoorsChecked()) ?? NONE;
}
