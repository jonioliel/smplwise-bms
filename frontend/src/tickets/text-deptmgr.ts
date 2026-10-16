/**
 * CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17): the words of a department manager's handlers and vendors (the "מטפלים וספקים" page,
 * the board's pane) and of the installation setting that unmasks phones. Merged into tickets/text.ts (`...DM_HE`, `...DM_EN`) and read
 * through `tt()`. No internal codes, no product name of the infrastructure, never the module's noun hard-coded.
 */
export const DM_HE = {
  dmPaneGroup: 'תצוגת הלוח',
  dmManagerFixed: 'מנהל מחלקה נקבע בהגדרות',
  dmShared: 'זמין לכל המחלקות',
  dmSharedHint: 'ספק או איש קשר שתיצרו יופיע גם בספרייה של שאר המחלקות. כבוי: רק במחלקה שבחרתם.',
  dmCreateIn: 'מחלקה',
  dmMyDepartments: 'המחלקות שלי',
  dmAttach: 'שיוך',
  dmDetach: 'הסרה',
  dmAttachmentOnly: 'ברשומה הזו אפשר לשנות רק את השיוך למחלקות שלך.',
  dmMemberRemove: 'הסרה מהמחלקה',
  dmFullPhones: 'מנהלי מחלקה רואים מספרים מלאים',
  dmFullPhonesHint: 'רק ברשומות של המחלקות שהם מנהלים. כבוי: ארבע הספרות האחרונות בלבד.',
  dmMasked: 'מוסתר',
  p_handlers: 'מטפלים וספקים במחלקות שלי', // the "הרשאות" tab's words of the permission (tickets/perm-label.ts)
} as const;

export const DM_EN: Record<keyof typeof DM_HE, string> = {
  dmPaneGroup: 'Board view',
  dmManagerFixed: 'Department managers are set in Settings',
  dmShared: 'Available to every department',
  dmSharedHint: 'A vendor or contact you create also appears in the other departments\' directory. Off: only in the department you chose.',
  dmCreateIn: 'Department',
  dmMyDepartments: 'My departments',
  dmAttach: 'Attach',
  dmDetach: 'Remove',
  dmAttachmentOnly: 'For this entry you can change only its attachment to your departments.',
  dmMemberRemove: 'Remove from the department',
  dmFullPhones: 'Department managers see full numbers',
  dmFullPhonesHint: 'Only in the entries of the departments they manage. Off: the last four digits only.',
  dmMasked: 'Hidden',
  p_handlers: 'Handlers in my departments',
};
