/**
 * RELEASE-2510-TRAIN (MFA-RESET-HARDENING-2510 section 5): the administrator's reset of another user's authentication methods asks the
 * preflight `GET auth/second-factor/users/{id}/reset-check` first and makes the administrator TYPE the user's username, which the reset
 * sends as `{confirm}` (the server checks it again). Shared by the drawer's two reset places: the authenticator row
 * (`sw-second-factor-user`) and the "other factors" reset (`sw-user-factors`); each keeps its own buttons and look, this module renders
 * only what goes between "reset" and "confirm": the refusal (when the preflight says no), what will be removed, what happens to the user,
 * and the typed field. The texts are the second-factor catalogue's (`i18n/msg/mfa`, Hebrew + English).
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { ApiError, describeError } from '../api/client';
import type { FactorResetCheck } from '../api/second-factor';
import { tr } from '../i18n/msg/mfa';

/** The server's comparison (services/factor_reset._norm): NFC, trimmed, case-folded. */
const norm = (s: string) => s.normalize('NFC').trim().toLowerCase();

/** The confirm button may be pressed: with a preflight, the typed text equals its `confirm_text`; without one (an older server, a
 * failed read), anything typed - the server decides. */
export function typedMatches(check: FactorResetCheck | null | undefined, typed: string): boolean {
  if (!typed.trim()) return false;
  return check ? norm(typed) === norm(check.confirm_text) : true;
}

/** The preflight refuses: no confirm button at all. */
export const refused = (check: FactorResetCheck | null | undefined): boolean => !!check && !check.allowed;

const REASON: Record<string, () => string> = {
  self: () => tr('את דרכי האימות שלך מסירים בחשבון שלי ‹ אבטחה.'),
  user_unknown: () => tr('המשתמש לא נמצא.'),
  local_only: () => tr('איפוס דרכי אימות של משתמש אחר מותר רק מהרשת המקומית.'),
  // MFA-FACTOR-HARDEN-2520 N-5: from outside, the administrator's own sign-in must be less than 5 minutes old
  reauth: () => tr('לאיפוס מבחוץ צריך כניסה טרייה (לפני פחות מ־5 דקות). צא והיכנס שוב, ואז נסה שוב.'),
  last_admin: () => tr('זה מנהל המערכת האחרון שיכול להיכנס מרחוק, ולכן אי אפשר לאפס את דרכי האימות שלו.'),
  rate_limited: () => tr('אפשר לאפס דרכי אימות לשלושה משתמשים לכל היותר בשעה. אפשר לנסות שוב מאוחר יותר.'),
};

/** The reset's refusals in the reader's language (the server's own words are Hebrew only). */
const CODE_REASON: Record<string, string> = {
  second_factor_self_reset: 'self',
  user_unknown: 'user_unknown',
  factor_reset_local_only: 'local_only',
  reauth_required: 'reauth',
  factor_reset_last_admin: 'last_admin',
  factor_reset_rate_limited: 'rate_limited',
};

export function resetErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    const code = err.body.code;
    if (code === 'factor_reset_confirm_required' || code === 'factor_reset_confirm_mismatch') return tr('שם המשתמש שהוקלד אינו תואם לחשבון. האיפוס לא בוצע.');
    const reason = CODE_REASON[code];
    if (reason) return REASON[reason]();
  }
  return describeError(err);
}

function removedText(f: FactorResetCheck['factors']): string {
  const parts = [
    ...(f.totp ? [tr('אפליקציית האימות')] : []),
    ...(f.passkeys ? [tr('מפתחות גישה: {n}', { n: f.passkeys })] : []),
    ...(f.device_keys ? [tr('מפתחות טלפון: {n}', { n: f.device_keys })] : []),
    ...(f.recovery_codes ? [tr('קודי שחזור: {n}', { n: f.recovery_codes })] : []),
  ];
  return parts.length ? tr('יוסרו: {list}', { list: parts.join(' · ') }) : tr('למשתמש אין דרכי אימות להסרה; הכניסות שלו יסתיימו.');
}

/**
 * Between "reset" and "confirm". `check`: undefined while the preflight is read, null when it could not be read (the typed field is
 * still asked; the server checks it), else the preflight. Hooks: `data-reset-refused=<reason>`, `data-reset-removes`,
 * `data-reset-confirm-text` (the typed field).
 */
export function renderResetConfirm(check: FactorResetCheck | null | undefined, typed: string, onInput: (value: string) => void, onSubmit: () => void): TemplateResult | typeof nothing {
  if (check === undefined) return nothing;
  if (check && !check.allowed) {
    const reason = check.reason ?? 'user_unknown';
    return html`<div class="err" role="alert" data-reset-refused=${reason}>${(REASON[reason] ?? REASON.user_unknown)()}</div>`;
  }
  const label = check ? tr('לאישור, יש להקליד את שם המשתמש: {name}', { name: check.confirm_text }) : tr('לאישור, יש להקליד את שם המשתמש');
  return html`${check
      ? html`<div class="lbl rc-line" data-reset-removes>${removedText(check.factors)}</div>
          <div class="lbl rc-line" data-reset-after>${tr('כל הכניסות והמכשירים של המשתמש יתנתקו.')}${check.must_enroll_after ? ` ${tr('בכניסה הבאה מרחוק יצטרך להגדיר אימות דו־שלבי מחדש.')}` : ''}</div>`
      : nothing}
    <form class="typed-form" @submit=${(e: Event) => { e.preventDefault(); onSubmit(); }}>
      <label class="lbl rc-line" data-reset-confirm-label>${label}
        <input class="typed" data-reset-confirm-text type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="200"
          .value=${typed} @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)} />
      </label>
    </form>
    ${check && check.resets_left < check.rate_max ? html`<div class="lbl rc-line" data-reset-left>${tr('אפשר לאפס עוד {n} בשעה הזו', { n: check.resets_left })}</div>` : nothing}`;
}

/** The typed field's look inside each host: a plain text field (not the six-digit code field's spacing), the host's tokens. */
export const resetConfirmStyles = css`
  .typed-form {
    display: block;
  }
  .rc-line {
    text-align: start;
  }
  label.rc-line {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-1);
  }
  input.typed {
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 20em;
    letter-spacing: normal;
    text-align: start;
    font-size: var(--sw-fs-sm);
    direction: ltr;
  }
`;
