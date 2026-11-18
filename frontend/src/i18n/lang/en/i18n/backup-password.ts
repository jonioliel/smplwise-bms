// CR-I18N-LAZY-LANG-2443: language pack table of src/i18n/backup-password.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const en = {
  createLabel: 'Backup password',
  createHint: 'Encrypts the local accounts’ passwords inside the backup. Without a password they are left out. Keep it safe: without it they cannot be restored.',
  createPlaceholder: 'At least {n} characters (optional)',
  minLabel: 'Minimum backup password length',
  minHint: '8 to 64 characters. Applies to new backups; an existing backup opens with its own password',
  minSaved: 'Minimum length saved',
  minRange: 'A value from 8 to 64',
  createdEncrypted: 'Local account passwords are encrypted in the backup',
  createdOmitted: 'The backup was created without the local account passwords',
  badgeEncrypted: 'Encrypted',
  badgeOmitted: 'No passwords',
  badgeLegacy: 'Old backup',
  restoreLabel: 'Backup password',
  restoreHint: 'The backup holds {n} encrypted local account passwords',
  restoreSkip: 'Restore without the local account passwords',
  restoreSkipHint: 'A local account with no password on this installation will need a reset link from an administrator',
  restoreOmitted: 'This backup was created without a backup password: the local account passwords are not in it',
  restoreLegacy: 'Backup from an older version: the local account passwords are stored in it unencrypted. Keep the file protected or delete it after the restore.',
  resultNeedReset: '{n} local accounts need a password reset link',
};
