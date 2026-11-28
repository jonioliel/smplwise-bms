// CR-I18N-LAZY-LANG-2443: language pack table of src/i18n/camera-reboot.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const en = {
  section: 'Restart camera',
  button: 'Restart camera…',
  lead: 'The camera restarts through the NVR. For a minute or two it has no live video and no recording.',
  dialogTitle: 'Restart this camera',
  dialogSub: '{name} · channel {channel}',
  dialogText: 'The camera goes offline for a minute or two: no live video and no recording from this camera until it is back. The other cameras and the NVR keep working. The action is logged.',
  confirm: 'Restart',
  cancel: 'Cancel',
  sending: 'Sending…',
  done: 'Restart command sent. The camera will be back in a minute or two.',
  reasonNotSupported: 'This NVR does not allow restarting a camera from here.',
  reasonNoPermission: 'You do not have permission to restart cameras. A system administrator can grant it.',
  reasonWritesOff: 'NVR changes are turned off. They can be turned on in the NVR connection settings.',
  reasonCooldown: 'The camera was just restarted. Try again in {min} min.',
  errorRateLimited: 'Too many restarts in a row. Try again in a few minutes.',
  errorRejected: 'The NVR refused the command. The camera was not restarted.',
  errorUnavailable: 'The NVR is not reachable right now. The camera was not restarted.',
  errorForbidden: 'You are not allowed to do this.',
  errorGeneric: 'The action failed. The camera was not restarted.',
  errorUnknown: 'It is not known whether the camera restarted: the link dropped after the command was sent. Check the picture before pressing again.',
};
