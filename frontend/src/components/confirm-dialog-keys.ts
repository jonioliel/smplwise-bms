/**
 * FE-SAFETY-FIX-2520 (deep review 2520 frontend core, finding FC-04): what Enter does in the system's confirmation dialog
 * (confirm-dialog.ts), as a rule of its own so a Node unit spec checks it without a page.
 *
 * Enter confirms ONLY while the focus is on the confirm button. On the cancel button and on the dialog's close button (✕) Enter
 * answers "no" - what a click there does. On another element inside the box (a link or a field a TemplateResult body brings) the key is
 * left to that element. With the focus outside the box or nowhere (before the dialog moved it there) Enter does nothing at all - it
 * neither confirms nor reaches the page behind (a native box is modal for the keyboard too). The old rule ("confirm unless the focus is
 * on cancel") confirmed a destructive action from the ✕: one Tab from the confirm button wraps to it.
 */

/** Where the focus is when Enter is pressed: one of the dialog's buttons, another element inside the box, or outside / nowhere. */
export type EnterTarget = 'confirm' | 'cancel' | 'close' | 'other' | 'none';

/** What the dialog does with that Enter: answer yes, answer no, leave the key to the focused element, or swallow it. */
export type EnterAnswer = 'confirm' | 'cancel' | 'pass' | 'ignore';

export function enterAnswer(on: EnterTarget): EnterAnswer {
  if (on === 'confirm') return 'confirm';
  if (on === 'cancel' || on === 'close') return 'cancel';
  if (on === 'other') return 'pass';
  return 'ignore';
}
