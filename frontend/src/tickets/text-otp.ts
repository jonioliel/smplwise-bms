/**
 * TKNOTIFOTP (owner decision 2026-10-16): the words of the OPTIONAL number verification by a one-time code. Merged into tickets/text.ts
 * (`...OTP_HE`, `...OTP_EN`) and read through `tt()`. Never the module's noun, never a product name of the infrastructure.
 */
export const OTP_HE = {
  otpSettingTitle: 'אימות מספר בקוד',
  otpSettingHint: 'כשמופעל, קישורים והתראות בוואטסאפ יישלחו רק למספר שאומת בקוד חד-פעמי שנשלח אליו. כבוי כברירת מחדל.',
  otpRowSwitch: 'אימות המספר בקוד',
  otpConfirmed: 'המספר אומת',
  otpConfirmedCode: 'אומת בקוד',
  otpConfirmedManager: 'אושר על ידי מנהל',
  otpConfirmedUser: 'אושר על ידי המשתמש',
  otpUnconfirmed: 'המספר לא אומת',
  otpRequired: 'נדרש אימות בקוד',
  otpSend: 'שליחת קוד',
  otpResend: 'שליחה חוזרת',
  otpSent: 'הקוד נשלח בוואטסאפ ובתוקף 10 דקות.',
  otpCodeLabel: 'קוד בן 6 ספרות',
  otpVerify: 'אימות',
  otpManagerSure: 'אני בטוח שזה המספר שלו',
  otpUserOnly: 'המשתמש מאמת את המספר בעצמו, בתפריט החשבון שלי.',
  otpMineHint: 'בקשו קוד, והקלידו את 6 הספרות שהגיעו בוואטסאפ.',
};

export const OTP_EN: Record<keyof typeof OTP_HE, string> = {
  otpSettingTitle: 'Verify numbers with a code',
  otpSettingHint: 'When on, WhatsApp links and notifications go only to a number verified with a one-time code sent to it. Off by default.',
  otpRowSwitch: 'Verify the number with a code',
  otpConfirmed: 'Number verified',
  otpConfirmedCode: 'Verified by code',
  otpConfirmedManager: 'Confirmed by a manager',
  otpConfirmedUser: 'Confirmed by the user',
  otpUnconfirmed: 'Number not verified',
  otpRequired: 'Code verification required',
  otpSend: 'Send code',
  otpResend: 'Send again',
  otpSent: 'The code was sent by WhatsApp and is valid for 10 minutes.',
  otpCodeLabel: '6-digit code',
  otpVerify: 'Verify',
  otpManagerSure: "I'm sure this is their number",
  otpUserOnly: 'The user verifies the number themselves, in My account.',
  otpMineHint: 'Ask for a code and type the 6 digits that arrive by WhatsApp.',
};
