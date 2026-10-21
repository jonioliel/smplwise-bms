import type { Page, Route } from '@playwright/test';
import { installExternalMock, type ExternalMock, type ExternalOptions } from './access-external-mocks';

// ACCESSREQ-293: the manual request form's mock, layered over tests/access-external-mocks.ts (a route registered later answers first; anything
// else falls back to it). The wire follows routers/access_grants.py (grantable-doors, approvers, notice, POST /access-grants) and the tickets
// routes the form reads (GET /tickets/contacts, GET /tickets). Every name, company, ticket, station and time is INVENTED sample data (the
// mockup's), no PIN anywhere. Nothing here reaches a WisKey, a station, a door or WhatsApp.

export interface RequestOptions extends ExternalOptions {
  /** the caller may only request (no approve permission anywhere): owner decision (b) - entrances + the ticket's station */
  requesterOnly?: boolean;
  offline?: boolean;
  manyDoors?: boolean;
  longNames?: boolean;
  /** what POST /access-grants answers for "I approve now" */
  approval?: 'ok' | 'failed';
  /** SHAREDUI-295: GET /access-grants/grantable-doors fails on the first ask (the form's load error, then a retry that works) */
  doorsFailOnce?: boolean;
}

export interface RequestMock extends ExternalMock {
  requests: Record<string, unknown>[];
  contactsCreated: Record<string, unknown>[];
}

type S = { id: string; name: string; relays: [number, string][]; mine: boolean; ent?: boolean };

function stations(o: RequestOptions): S[] {
  const base: S[] = [
    { id: 'lobby', name: o.longNames ? 'אגף מזרחי – מבואת כניסה לשירותי תחזוקה ומערכות מיזוג אוויר מרכזיות' : 'לובי ראשי', relays: [[1, o.longNames ? 'דלת חירום אחורית לכיוון רמפת הפריקה והטעינה הצפונית' : 'דלת ראשית'], [2, 'דלת זכוכית פנימית']], mine: true, ent: true },
    { id: 'park', name: 'חניון', relays: [[1, 'שער רכבים'], [2, 'דלת הולכי רגל']], mine: true, ent: true },
    { id: 'base', name: 'מרתף', relays: [[1, 'חדר מכונות']], mine: true },
    { id: 'roof', name: 'גג', relays: [[1, 'חדר מעליות']], mine: true },
    { id: 'kitchen', name: 'מטבח', relays: [[1, 'דלת שירות']], mine: true },
    { id: 'l2', name: 'קומה 2', relays: [[1, 'חדר שרתים']], mine: false },
  ];
  if (o.manyDoors) {
    for (const [wi, w] of ['בניין B', 'בניין C'].entries())
      for (let f = 1; f <= 6; f++) base.push({ id: `w${wi}f${f}`, name: `${w} · קומה ${f}`, relays: [[1, 'דלת מסדרון'], [2, 'חדר תקשורת'], ...(f % 2 ? [[3, 'מחסן'] as [number, string]] : [])], mine: !(wi === 1 && f > 3) });
  }
  return base;
}

interface C {
  id: string;
  display_name: string;
  vendor_name: string | null;
  phone: string | null;
  confirmed: string | null;
  lang: string;
  kind?: string;
  company?: string;
  user_linked?: boolean;
  active?: boolean;
}

const CONTACTS: C[] = [
  { id: 'c1', display_name: 'יוסי אברהם', vendor_name: 'קר־טק מיזוג', phone: '····42', confirmed: 'code', lang: 'he' },
  { id: 'c2', display_name: 'מוחמד חסן', vendor_name: 'אלקום חשמל', phone: '····08', confirmed: null, lang: 'ar' },
  { id: 'c3', display_name: 'אלכס פטרוב', vendor_name: 'פ.א. מערכות כיבוי', phone: '····71', confirmed: 'user', lang: 'ru' },
  { id: 'c4', display_name: 'קר־טק מיזוג', kind: 'vendor', vendor_name: null, phone: null, confirmed: null, lang: 'he' },
  { id: 'c5', display_name: 'דנה לוי', vendor_name: null, company: 'עובדת', phone: '····65', confirmed: 'code', user_linked: true, lang: 'he' },
  { id: 'c6', display_name: 'רוני כהן', vendor_name: 'אלקום חשמל', phone: '····90', confirmed: null, active: false, lang: 'he' },
];

function contact(c: C, long = false) {
  return {
    id: c.id, kind: c.kind ?? 'person', vendor_id: c.vendor_name ? 'c4' : null, vendor_name: c.vendor_name, user_linked: !!c.user_linked,
    display_name: long && c.id === 'c1' ? 'אלכסנדרה-מריה ואן דר הוחנבורג-שטיינמץ' : c.display_name, company: long && c.id === 'c1' ? 'חברת השירותים הטכניים המאוחדים לתחזוקת מבנים ומערכות בע״מ' : c.company ?? '',
    phone: c.phone, phone_full: false, has_phone: !!c.phone, email: null, preferred_channel: 'whatsapp', require_code: false, share_history: null, lang: c.lang, notes: '',
    active: c.active ?? true, erased: false, departments: [], open_tickets: 0, last_assigned_at: null, revision: 1,
    phone_confirmed: !!c.confirmed, phone_confirmed_via: c.confirmed,
  };
}

const NOTICE: Record<string, { text: string; attest: string }> = {
  he: { text: 'לצורך כניסת הטכנאי למבנה נשמרים שמו ומספר הטלפון שלו, ובכל כניסה גם השעה והדלת (ובמקומות שהדבר הופעל - גם תמונה ברגע הכניסה). המידע משמש לאבטחת המבנה ולניהול הכניסות לעבודה זו בלבד. מספר הטלפון משמש רק לאימות המספר ולמשלוח קוד הכניסה האישי בוואטסאפ. המידע נשמר עד שהארגון מוחק אותו, בהתאם למדיניות השמירה שלו. אין חובה חוקית למסור את הפרטים, אך בלעדיהם לא ניתן להנפיק קוד כניסה. לבקשת עיון, תיקון או מחיקה, או בכל שאלה, יש לפנות למנהל המבנה.', attest: 'הודעתי לטכנאי על האמור לעיל.' },
  en: { text: 'For the technician to enter the building, the technician\'s name and phone number are kept, and for each entry the time and the door. This information is used only for building security and for managing entries for this job.', attest: 'I have told the technician the above.' },
  ar: { text: 'لغرض دخول الفني إلى المبنى، يُحفظ اسم الفني ورقم هاتفه.', attest: 'أبلغتُ الفني بما ورد أعلاه.' },
  ru: { text: 'Для допуска техника в здание сохраняются его имя и номер телефона.', attest: 'Подтверждаю: техник уведомлён мною об изложенном выше.' },
};

export async function installRequestMock(page: Page, o: RequestOptions = {}): Promise<RequestMock> {
  const ext = await installExternalMock(page, { ticketsOn: true, ...o }); // TICKGATE-295: the form's ticket link exists only while the tickets module is on
  const st: RequestMock = { ...ext, requests: [], contactsCreated: [] };
  const admin = o.systemAdmin ?? true;
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const all = stations(o);
  let doorsFailed = false;
  await page.route((u) => u.pathname.endsWith('/api/v1/tickets/contacts'), async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      st.contactsCreated.push(body);
      return json(route, { ...contact({ id: 'c-new', display_name: String(body.display_name), vendor_name: null, phone: '····67', confirmed: null, lang: String(body.lang ?? 'he') }) }, 201);
    }
    return json(route, { contacts: CONTACTS.map((c) => contact(c, o.longNames)), can_edit: true });
  });
  await page.route((u) => /\/api\/v1\/tickets\/contacts\/[^/]+\/phone-verify\/send$/.test(u.pathname), (route) => json(route, { sent: true, expires_in_s: 600, resend_after_s: 60 }));
  await page.route((u) => u.pathname.endsWith('/api/v1/tickets'), (route) => json(route, {
    items: [
      { id: 't1842', number: 1842, title: o.longNames ? 'בדיקה שנתית מקיפה של מערכות גילוי וכיבוי אש, לחצני מצוקה ותאורת חירום בכל קומות המרתף והחניון התת-קרקעי' : 'תקלת מיזוג, קומה 3', status: 'assigned' },
      { id: 't1907', number: 1907, title: 'בדיקה תקופתית למערכת הכיבוי', status: 'new' },
    ],
    next_cursor: null,
  }));
  await page.route('**/api/v1/access-grants**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname.replace(/^.*\/api\/v1\//, '');
    if (req.method() === 'GET' && p === 'access-grants/grantable-doors') {
      if (o.doorsFailOnce && !doorsFailed) {
        doorsFailed = true;
        return json(route, { code: 'service_unavailable', user_message: 'השרת לא זמין כרגע.', retryable: true, correlation_id: 'mock', details: {} }, 503);
      }
      const ticket = u.searchParams.get('ticket_id');
      return json(route, {
        stations: all.map((s) => {
          const req2 = o.requesterOnly ? !!s.ent || (ticket === 't1842' && s.id === 'base') : s.mine;
          return { station_id: s.id, name: s.name, online: true, relays: s.relays.map(([relay, name]) => ({ relay, name })), may_request: req2, may_approve: !o.requesterOnly && s.mine,
            may_approve_pin: !o.requesterOnly && s.mine, entrance: !!s.ent, ticket: ticket === 't1842' && s.id === 'base' };
        }).sort((a, b) => Number(b.may_request) - Number(a.may_request)),
        max_doors: 4, max_days: 14, tickets_requester: !!o.requesterOnly, system_admin: admin && !o.requesterOnly,
        as_of: '2026-10-20T06:41:00Z', reachable: !o.offline, has_copy: true,
      });
    }
    if (req.method() === 'GET' && p === 'access-grants/approvers') {
      const ids = (u.searchParams.get('stations') ?? '').split(',');
      const people = [
        { name: 'משה שטרן', me: true, ok: (k: string) => k !== 'l2' && !/^w1f[456]$/.test(k) },
        { name: 'רונית בר', me: false, ok: () => true },
        { name: 'איגור קרמר', me: false, ok: (k: string) => ['lobby', 'park', 'base'].includes(k) },
      ].filter((a) => (admin && !o.requesterOnly ? true : !a.me) && ids.every(a.ok));
      return json(route, { approvers: people.map(({ name, me }) => ({ name, me })), count: people.length, self_approval: admin && !o.requesterOnly });
    }
    if (req.method() === 'GET' && p === 'access-grants/notice') {
      const lang = u.searchParams.get('lang') ?? 'he';
      return json(route, { lang, version: 'n2', ...NOTICE[lang] });
    }
    if (req.method() === 'POST' && p === 'access-grants') {
      const body = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>;
      st.requests.push(body);
      const now = !!body.approve_now;
      const approval = now ? (o.approval === 'failed' ? { approved: false, code: 'access_grant_engine_unavailable', message: 'לא ניתן לקרוא כעת את רשומת האדם במערכת הכניסה.' } : { approved: true }) : null;
      return json(route, { grant: { id: 'g-new'.padEnd(32, '0'), state: now && o.approval !== 'failed' ? 'approved' : 'requested' }, outcome: 'created', approval });
    }
    return route.fallback();
  });
  return st;
}
