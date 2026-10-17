// The "add a navigation link to the message" switch of the service request's external assign dialog (owner 2026-10-17, CR-ORG-LOCATIONS).
// Pure logic, no DOM: the dialog (external-assign.ts) renders what these functions say. The server decides whether the switch exists
// (`preview.location_nav.available` = the request's location has coordinates); the browser never sees raw coordinates.

export interface NavAnswer { available: boolean; on: boolean }

/** What the dialog shows for the switch. Hidden unless the server says a link can exist; unchecked by default; the checked state only
 * counts while it is visible (a contact change or a location without coordinates can never leave a stale "on"). */
export function navSwitch(answer: NavAnswer | null | undefined, wanted: boolean): { visible: boolean; checked: boolean } {
  const visible = !!answer?.available;
  return { visible, checked: visible && wanted };
}

/** The value sent to the preview route: only ever true when the switch is visible and on (otherwise the field stays off the wire, so a
 * request without coordinates is never answered with the server's 422). */
export function navForPreview(answer: NavAnswer | null | undefined, wanted: boolean): boolean | undefined {
  return navSwitch(answer, wanted).checked ? true : undefined;
}

/** The value sent with the assignment itself: the preview's last answer decides, exactly what the manager saw. */
export function navForAssign(answer: NavAnswer | null | undefined, wanted: boolean): boolean | undefined {
  return navSwitch(answer, wanted).checked && !!answer?.on ? true : undefined;
}
