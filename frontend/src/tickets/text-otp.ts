/**
 * TKNOTIFOTP (owner decision 2026-10-16): the words of the OPTIONAL number verification by a one-time code. Merged into tickets/text.ts
 * (`...OTP_HE`, `...OTP_EN`) and read through `tt()`. Never the module's noun, never a product name of the infrastructure.
 */
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

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

export const OTP_EN: Record<keyof typeof OTP_HE, string> = packTable<typeof import('../i18n/lang/en/tickets/text-otp').OTP_EN>('en', 'tickets/text-otp', 'OTP_EN');

registerCatalogue('tickets/text-otp', { he: OTP_HE, en: OTP_EN });
