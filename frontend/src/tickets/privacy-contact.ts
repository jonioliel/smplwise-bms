/** PRIVORG-291: client-side checks of the privacy contact point and link (the server validates again, services/tickets/settings_doc.py).
 * The contact is an e-mail address or a phone number (7-15 digits); both fields may be empty (= not set). */
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const PHONE = /^[+(]?[0-9][0-9 ()-]{5,24}$/;

export function validPrivacyContact(value: string): boolean {
  const v = value.trim();
  if (v === '') return true;
  if (v.length > 80) return false;
  if (EMAIL.test(v)) return true;
  const digits = (v.match(/[0-9]/g) ?? []).length;
  return PHONE.test(v) && digits >= 7 && digits <= 15;
}

export function validPrivacyLink(value: string): boolean {
  const v = value.trim();
  if (v === '') return true;
  // eslint-disable-next-line no-control-regex
  if (v.length > 200 || /[\s{}<>"'\\\u0000-\u001f\u007f]/.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname !== '' && u.username === '' && u.password === '';
  } catch {
    return false;
  }
}

export interface PrivacyDraft { contact: string; link: string }

/** The patch to send for the typed values, or null when nothing changed or a value is invalid. */
export function privacyPatch(stored: { contact?: string; link?: string } | undefined, draft: PrivacyDraft): Partial<PrivacyDraft> | null {
  if (!validPrivacyContact(draft.contact) || !validPrivacyLink(draft.link)) return null;
  const out: Partial<PrivacyDraft> = {};
  if (draft.contact.trim() !== (stored?.contact ?? '')) out.contact = draft.contact.trim();
  if (draft.link.trim() !== (stored?.link ?? '')) out.link = draft.link.trim();
  return Object.keys(out).length ? out : null;
}
