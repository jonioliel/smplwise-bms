/**
 * CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17): the words of a department manager's handlers and vendors (the "מטפלים וספקים" page,
 * the board's pane) and of the installation setting that unmasks phones. Merged into tickets/text.ts (`...DM_HE`, `...DM_EN`) and read
 * through `tt()`. No internal codes, no product name of the infrastructure, never the module's noun hard-coded.
 */
export const DM_HE = {
  dmPaneGroup: 'תצוגת הלוח',
  dmManagerFixed: 'מנהל מחלקה נקבע בהגדרות',
  dmShared: 'זמין לכל המחלקות',
  dmSharedHint: 'דלוק: ספק או איש קשר שתיצרו יופיע גם בספרייה של שאר המחלקות. כבוי (ברירת המחדל): רק במחלקה שבחרתם.',
  dmCreatedIn: 'נוצר במחלקה',
  dmCreatedOther: 'מחלקה אחרת',
  dmLookupTitle: 'הספק כבר קיים? חיפוש לפי מספר טלפון',
  dmLookupHint: 'מספר מלא ומדויק בלבד. המספר בתוצאה מוסתר.',
  dmLookupFind: 'חיפוש',
  dmLookupNone: 'לא נמצא ספק עם המספר הזה.',
  dmLookupAttach: 'שיוך למחלקה',
  dmLookupAttached: 'כבר משויך',
  dmCreateIn: 'מחלקה',
  dmMyDepartments: 'המחלקות שלי',
  dmAttach: 'שיוך',
  dmDetach: 'הסרה',
  dmAttachmentOnly: 'ברשומה הזו אפשר לשנות רק את השיוך למחלקות שלך.',
  dmMemberRemove: 'הסרה מהמחלקה',
  dmFullPhones: 'מנהלי מחלקה רואים מספרים מלאים',
  dmFullPhonesHint: 'רק ברשומות של המחלקות שהם מנהלים. כבוי: ארבע הספרות האחרונות בלבד.',
  dmMasked: 'מוסתר',
  p_directory: 'ספרייה: ספקים ואנשי קשר חיצוניים', // SMALL-294 (tickets.directory)
  p_handlers: 'מטפלים וספקים במחלקות שלי', // the "הרשאות" tab's words of the permission (tickets/perm-label.ts)
} as const;

export const DM_EN: Record<keyof typeof DM_HE, string> = {
  dmPaneGroup: 'Board view',
  dmManagerFixed: 'Department managers are set in Settings',
  dmShared: 'Available to every department',
  dmSharedHint: 'On: a vendor or contact you create also appears in the other departments\' directory. Off (the default): only in the department you chose.',
  dmCreatedIn: 'Created in',
  dmCreatedOther: 'Another department',
  dmLookupTitle: 'Vendor already listed? Find it by phone number',
  dmLookupHint: 'The full, exact number only. The number in the result is hidden.',
  dmLookupFind: 'Find',
  dmLookupNone: 'No vendor with this number.',
  dmLookupAttach: 'Attach to the department',
  dmLookupAttached: 'Already attached',
  dmCreateIn: 'Department',
  dmMyDepartments: 'My departments',
  dmAttach: 'Attach',
  dmDetach: 'Remove',
  dmAttachmentOnly: 'For this entry you can change only its attachment to your departments.',
  dmMemberRemove: 'Remove from the department',
  dmFullPhones: 'Department managers see full numbers',
  dmFullPhonesHint: 'Only in the entries of the departments they manage. Off: the last four digits only.',
  dmMasked: 'Hidden',
  p_directory: 'Directory: vendors and outside contacts',
  p_handlers: 'Handlers in my departments',
};

/**
 * DEV-MARKED (DEPTMGR2, 2026-10-17): an INITIAL Arabic and Russian translation of the words added for the owner's answers (the creating
 * department, the exact-phone lookup). The tickets screens read Hebrew / English only today (tickets/text.ts `ticketsLang`), so nothing
 * reads these yet and the bundle drops them; they wait for a native review before an Arabic / Russian column is wired.
 */
export const DM_AR_DEV: Partial<Record<keyof typeof DM_HE, string>> = {
  dmCreatedIn: 'أُنشئ في القسم',
  dmCreatedOther: 'قسم آخر',
  dmLookupTitle: 'المورّد مسجّل بالفعل؟ ابحث برقم الهاتف',
  dmLookupHint: 'الرقم الكامل والدقيق فقط. الرقم في النتيجة مخفي.',
  dmLookupFind: 'بحث',
  dmLookupNone: 'لا يوجد مورّد بهذا الرقم.',
  dmLookupAttach: 'ربط بالقسم',
  dmLookupAttached: 'مرتبط بالفعل',
  p_directory: 'الدليل: الموردون وجهات الاتصال الخارجية', // SMALL-294 / SMALL2-295 (tickets.directory)
  p_handlers: 'المعالجون والموردون في أقسامي',
};
export const DM_RU_DEV: Partial<Record<keyof typeof DM_HE, string>> = {
  dmCreatedIn: 'Создано в отделе',
  dmCreatedOther: 'Другой отдел',
  dmLookupTitle: 'Поставщик уже есть? Найти по номеру телефона',
  dmLookupHint: 'Только полный и точный номер. Номер в результате скрыт.',
  dmLookupFind: 'Найти',
  dmLookupNone: 'Поставщик с этим номером не найден.',
  dmLookupAttach: 'Привязать к отделу',
  dmLookupAttached: 'Уже привязан',
  p_directory: 'Справочник: поставщики и внешние контакты', // SMALL-294 / SMALL2-295 (tickets.directory)
  p_handlers: 'Исполнители и поставщики в моих отделах',
};
