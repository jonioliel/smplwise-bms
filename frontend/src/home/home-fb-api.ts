// HOME-V3-FOLLOWUP-B-2431 (owner answers 11.11): the wall panel's one calendar write and a photo on a new ticket.
// POST /home/wall/events (routers/home_wall_events.py): a wall panel locked to its room adds an event to the FAMILY calendar - kind
// "event" only; every other calendar write of a wall panel is refused on the server (403 kiosk_calendar_add_only).
// POST /home/tickets/{id}/photos (routers/home_ticket_photo.py): the caller's own NEW ticket, JPEG / PNG, at most 8 MB, at most three;
// the server re-encodes it (EXIF and location never stored). The checks here only spare a useless upload; the server decides.
import { post, upload } from '../api/client';

export const PHOTO_TYPES = ['image/jpeg', 'image/png'];
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTOS_MAX = 3;

export const wallEvent = (body: { calendar_id?: string; title: string; start: string; end: string }) =>
  post<{ event: { id: string }; state: string }>('home/wall/events', body);

export function ticketPhoto(id: string, file: Blob, name = 'photo.jpg') {
  const form = new FormData();
  form.append('file', file, name);
  return upload<{ ticket: unknown }>(`home/tickets/${encodeURIComponent(id)}/photos`, form);
}

/** Why a picked file cannot be attached (a Hebrew sentence), or null when it may be sent. */
export function photoProblem(file: { type: string; size: number }, already: number): string | null {
  if (already >= PHOTOS_MAX) return `אפשר לצרף עד ${PHOTOS_MAX} תמונות.`;
  if (!PHOTO_TYPES.includes((file.type || '').toLowerCase())) return 'אפשר לצרף רק תמונה (JPEG או PNG).';
  if (file.size > PHOTO_MAX_BYTES) return 'התמונה גדולה מ־8 MB.';
  if (file.size <= 0) return 'הקובץ ריק.';
  return null;
}
