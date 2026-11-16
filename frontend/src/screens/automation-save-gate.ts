/**
 * CR-EDITORS-MEMO-2440 (review 06:GATE-1): why the editors' save is off right now, as a CODE plus the text shown on the button.
 * The editor used to decide "שמירה עם אזהרות" by comparing the gate's Hebrew text; a wording or language change would have
 * switched that button off without a failing test. The order of the checks is the editor's (automation-editor-base.ts) and is
 * unchanged. Pure, so it runs in node (tests/unit-editors-memo-2440.spec.ts).
 */

export type SaveGateCode =
  | 'loading' // status, draft or catalogue not here yet
  | 'read_only' // the person may not edit this item
  | 'busy' // a save / run is in flight
  | 'blocked' // the installation blocks saves of this kind (saveBlocker)
  | 'code_read_only' // the code view is view-only
  | 'code_invalid' // the code does not parse
  | 'code_unchanged' // the code view holds nothing new
  | 'issues' // validation errors
  | 'grant' // a sensitive step the person has no grant for
  | 'preview' // the server's preview refuses (not an administrator / needs the code view)
  | 'unchanged' // nothing to save
  | 'warnings' // pre-save warnings; "שמירה עם אזהרות" may override this one only
  | 'warnings_blocked'; // pre-save warnings that must be handled first

export interface SaveGate {
  code: SaveGateCode;
  text: string;
}

/** What the gate reads. The costly facts are functions: they are asked only when the checks before them passed, as before. */
export interface SaveGateFacts {
  loaded: boolean;
  hardReadOnly: boolean;
  roText: string;
  busy: boolean;
  /** `saveBlocker(kind, status)?.text`. */
  blockerText: string | null;
  view: 'builder' | 'code';
  codeMode: 'hidden' | 'readonly' | 'editable';
  codeOk: boolean;
  codeDirtyOrDraft: () => boolean;
  issueCount: () => number;
  /** The text of the first missing grant, or null. */
  grantText: () => string | null;
  /** The text of the preview's blocker (other than "invalid"), or null. */
  previewText: () => string | null;
  isNew: boolean;
  dirty: () => boolean;
  warnMode: 'save' | 'with_warnings' | 'blocked';
}

export const GATE_TEXT = {
  loading: 'טוען',
  viewOnly: 'צפייה בלבד',
  fix: 'יש דברים לתקן',
  warnings: 'יש אזהרות',
  warningsBlocked: 'יש אזהרות לטיפול',
} as const;

/** null = the save may be pressed. */
export function saveGateOf(f: SaveGateFacts): SaveGate | null {
  if (!f.loaded) return { code: 'loading', text: GATE_TEXT.loading };
  if (f.hardReadOnly) return { code: 'read_only', text: f.roText };
  if (f.busy) return { code: 'busy', text: '' };
  if (f.blockerText !== null) return { code: 'blocked', text: f.blockerText };
  if (f.view === 'code') {
    if (f.codeMode === 'readonly') return { code: 'code_read_only', text: GATE_TEXT.viewOnly };
    if (!f.codeOk) return { code: 'code_invalid', text: GATE_TEXT.fix };
    return f.codeDirtyOrDraft() ? null : { code: 'code_unchanged', text: '' };
  }
  if (f.issueCount()) return { code: 'issues', text: GATE_TEXT.fix };
  const grant = f.grantText();
  if (grant !== null) return { code: 'grant', text: grant };
  const preview = f.previewText();
  if (preview !== null) return { code: 'preview', text: preview };
  if (!f.isNew && !f.dirty()) return { code: 'unchanged', text: '' };
  // KAV079-295: last, so every other gate (grants, the code-view rule, unchanged) still holds; "שמירה עם אזהרות" overrides only this one
  if (f.warnMode !== 'save') return f.warnMode === 'blocked' ? { code: 'warnings_blocked', text: GATE_TEXT.warningsBlocked } : { code: 'warnings', text: GATE_TEXT.warnings };
  return null;
}

/** "שמירה עם אזהרות" is offered, and accepted, only when the warnings are the one thing holding the save. */
export function warningsOnly(gate: SaveGate | null, warnMode: SaveGateFacts['warnMode']): boolean {
  return warnMode === 'with_warnings' && gate?.code === 'warnings';
}
