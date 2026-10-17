import type { Page, Route } from '@playwright/test';
import { ApiError } from '../src/api/client';
import { mockRfq, rememberDemoContact, resetDemoRfq } from '../src/api/tickets-rfq-mock';
import type { RfqDetail } from '../src/api/tickets-rfq';
import { installTicketsMock, type Persona } from './tickets-mocks';

// TKRFQ2: the fake server of the RFQ evidence / layout specs. The REAL build runs against page.route; the RFQ routes of contract v0.9
// (routers/tickets_rfq.py on pilot/TKRFQ1-core) are answered by replaying the demo store (src/api/tickets-rfq-mock.ts) in Node, so the
// screens see the server's JSON shapes and refusals. Fake data only (invented vendors, people and prices).

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NAME = { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' };

export interface RfqMockOptions {
  persona?: Persona;
  perms?: string[];
  /** contract v0.9 exactly: vendor_page false, no attachments / vendor options (the C2 gaps hidden) */
  contract?: boolean;
  /** without tickets.costs.view: amounts null, the comparison refused */
  noAmounts?: boolean;
  /** the RFQ routes do not exist yet (before TKRFQ1 is merged) */
  unavailable?: boolean;
  /** the list answers 500 once */
  failList?: boolean;
  /** no request at all */
  empty?: boolean;
  /** the list hangs for a while (the loading state) */
  slowList?: boolean;
  /** TKRFQ4: the order create answers this 409 code (e.g. `vendor_not_allowed`, `public_link_unavailable`) */
  orderRefusal?: string;
}

export interface RfqMock { calls: { method: string; path: string; body: unknown }[] }

const CONTACTS = [
  { id: 'ct-alon', kind: 'vendor', display_name: 'אלון ד.', vendor_name: 'מיזוג אלון בע״מ', phone: '050-000-0001', email: null, preferred_channel: 'whatsapp', require_code: false },
  { id: 'ct-kortek', kind: 'vendor', display_name: 'שירה ב.', vendor_name: 'קור-טק מיזוג', phone: null, email: 'office@kortek.example', preferred_channel: 'email', require_code: true },
  { id: 'ct-aklim', kind: 'vendor', display_name: 'מוחמד ע.', vendor_name: 'אקלים פלוס', phone: '054-000-0003', email: null, preferred_channel: 'whatsapp', require_code: false },
  { id: 'ct-free', kind: 'person', display_name: 'גיל ר.', vendor_name: null, phone: '052-000-0004', email: null, preferred_channel: 'whatsapp', require_code: false },
  { id: 'ct-staff', kind: 'employee', display_name: 'עובד אחזקה', vendor_name: null, phone: '050-000-0005', email: null, preferred_channel: 'whatsapp', require_code: false },
].map((c) => ({
  ...c, vendor_id: c.vendor_name ? `v-${c.id}` : null, user_linked: false, company: c.vendor_name ?? '', phone_full: false, has_phone: !!c.phone, share_history: null, lang: 'he',
  notes: '', active: true, erased: false, departments: [], open_tickets: 0, last_assigned_at: null, revision: 1,
}));

function strip(d: RfqDetail): RfqDetail {
  return {
    ...d, kpis: { ...d.kpis, lowest_total_minor: null, currency: null }, can: { ...d.can, see_amounts: false, award: false },
    vendors: d.vendors.map((v) => ({ ...v, quote: v.quote ? { id: v.quote.id, version: v.quote.version, state: v.quote.state, created_at: v.quote.created_at } : null })),
    awards: d.awards.map((a) => ({ ...a, total_minor: null, subtotal_minor: null, vat_minor: null })), second_approval: { ...d.second_approval, threshold_minor: null },
  };
}

export async function installRfqMock(page: Page, o: RfqMockOptions = {}): Promise<RfqMock> {
  resetDemoRfq();
  const perms = o.perms ?? (o.noAmounts ? ['tickets.external'] : ['tickets.external', 'tickets.costs', 'tickets.costs.view', 'tickets.delete']);
  await installTicketsMock(page, { persona: o.persona ?? 'admin', name: NAME, extraPerms: perms });
  const st: RfqMock = { calls: [] };
  let failList = !!o.failList;
  for (const c of CONTACTS) rememberDemoContact(c.id, c.display_name, c.vendor_name ?? '');
  // registered after the tickets mock, so these answer first
  await page.route('**/api/v1/tickets/contacts**', async (route) => {
    const kind = new URL(route.request().url()).searchParams.get('kind');
    return json(route, { contacts: CONTACTS.filter((c) => !kind || c.kind === kind), can_edit: true });
  });
  await page.route('**/api/v1/tickets/rfqs**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname.replace(/^.*\/api\/v1\/tickets\/rfqs/, '').replace(/^\//, '');
    const method = req.method();
    const body = method === 'GET' || method === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
    st.calls.push({ method, path: `tickets/rfqs/${p}${u.search}`, body });
    if (o.unavailable) return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
    const seg = p ? p.split('/') : [];
    const api = mockRfq;
    try {
      if (!seg.length && method === 'GET') {
        if (failList) {
          failList = false;
          return json(route, { code: 'internal', user_message: 'שגיאה בשרת', retryable: true, correlation_id: 'mock', details: {} }, 500);
        }
        if (o.slowList) await new Promise((r) => setTimeout(r, 4000));
        const page1 = await api.list({ state: (u.searchParams.get('state') ?? 'open') as never, department_id: u.searchParams.get('department_id') ?? undefined, q: u.searchParams.get('q') ?? '' });
        if (o.empty) page1.items = [];
        if (o.noAmounts) page1.items = page1.items.map((i) => ({ ...i, kpis: { ...i.kpis, lowest_total_minor: null, currency: null } }));
        return json(route, page1);
      }
      if (!seg.length && method === 'POST') return json(route, await api.create(body), 201);
      if (seg[0] === 'meta') {
        const m = await api.meta();
        return json(route, o.contract ? { ...m, vendor_page: false, attachments: undefined, vendor_options: undefined } : m);
      }
      if (seg[0] === 'departments') return json(route, await api.setThreshold(seg[1], body.second_approval_minor));
      if (seg[0] === 'questions' && seg[1] === 'summary') return json(route, await api.questionsSummary()); // RFQQUESTIONS: the nav badge
      const id = seg[0];
      const out = (d: RfqDetail) => (o.noAmounts ? strip(d) : d);
      const contractDetail = (d: RfqDetail) => out(o.contract ? { ...d, vendor_page: false, attachments: undefined } : d);
      if (seg.length === 1) {
        if (method === 'GET') return json(route, contractDetail(await api.get(id)));
        if (method === 'PATCH') return json(route, contractDetail(await api.edit(id, body)));
        if (method === 'DELETE') {
          await api.remove(id);
          return json(route, { deleted: true, rows: {} });
        }
      }
      const b = body ?? {};
      switch (seg[1]) {
        case 'comparison':
          if (o.noAmounts) return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'mock', details: {} }, 403);
          return json(route, await api.comparison(id));
        case 'send':
          if (o.contract && b.channel !== 'manual') return json(route, { code: 'rfq_vendor_page_unavailable', user_message: 'דף הספק לא זמין', retryable: false, correlation_id: 'mock', details: {} }, 409);
          return json(route, contractDetail(await api.send(id, b.revision, b.channel, b.client_request_id)));
        case 'remind':
          return json(route, contractDetail(await api.remind(id, b.vendor_ids)));
        case 'close':
          return json(route, contractDetail(await api.close(id, b.revision)));
        case 'cancel':
          return json(route, contractDetail(await api.cancel(id, b.revision, b.reason, b.notify)));
        case 'awards':
          if (seg.length === 2) return json(route, await api.award(id, b), 201);
          if (seg[3] === 'confirm') return json(route, await api.confirmAward(id, seg[2], b.revision));
          if (seg[3] === 'decline') return json(route, contractDetail(await api.declineAward(id, seg[2], b.revision, b.reason)));
          // TKRFQ4 (contract v1.2 section 16): the work order - open the request (sends nothing), the preview, the explicit send
          if (seg[3] === 'order' && seg.length === 4 && method === 'POST') {
            if (o.orderRefusal) return json(route, { code: o.orderRefusal, user_message: 'נדחה', retryable: false, correlation_id: 'mock', details: {} }, 409);
            const a = await api.createOrder(id, seg[2], b);
            return json(route, { ...a, rfq: out(a.rfq) }, 201);
          }
          if (seg[3] === 'order' && seg[4] === 'preview') return json(route, await api.orderPreview(id, seg[2]));
          if (seg[3] === 'order' && seg[4] === 'send') {
            const a = await api.sendOrder(id, seg[2]);
            return json(route, { ...a, rfq: out(a.rfq) });
          }
          break;
        case 'vendors': {
          if (seg.length === 2) return json(route, contractDetail(await api.addVendor(id, b.contact_id, b.revision)), 201);
          const vid = seg[2];
          if (seg[3] === 'remove') return json(route, contractDetail(await api.removeVendor(id, vid, b.revision)));
          if (seg[3] === 'options') return json(route, contractDetail(await api.vendorOptions(id, vid, b)));
          if (seg[3] === 'link') return json(route, contractDetail(await api.revokeLink(id, vid)));
          if (seg[3] === 'decline') return json(route, contractDetail(await api.declineOnBehalf(id, vid, b.reason)));
          if (seg[3] === 'messages' && seg[4] === 'read') return json(route, await api.markRead(id, vid)); // RFQQUESTIONS
          if (seg[3] === 'messages' && method === 'GET') return json(route, await api.messages(id, vid));
          if (seg[3] === 'messages') return json(route, await api.writeMessage(id, vid, b.text, b.notify, b.source), 201);
          if (seg[3] === 'quotes' && seg.length === 4) return json(route, contractDetail(await api.quoteOnBehalf(id, vid, b)), 201);
          if (seg[3] === 'quotes' && seg[5] === 'withdraw') return json(route, contractDetail(await api.withdrawQuote(id, vid, seg[4], b.revision)));
          break;
        }
        case 'questions': // RFQQUESTIONS: preview / answer / resolve one vendor question
          if (seg[3] === 'preview') return json(route, await api.answerPreview(id, seg[2], b));
          if (seg[3] === 'answer') {
            const a = await api.answer(id, seg[2], b, b.client_request_id);
            return json(route, { ...a, rfq: out(a.rfq) }, 201);
          }
          if (seg[3] === 'resolve') return json(route, contractDetail(await api.resolveQuestion(id, seg[2])));
          break;
        default:
          break;
      }
      return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
    } catch (e) {
      if (e instanceof ApiError) return json(route, e.body, e.status);
      throw e;
    }
  });
  return st;
}

export const RFQ7 = 'rfq0000000000007';
export const RFQ8 = 'rfq0000000000008';
export const RFQ6 = 'rfq0000000000006';
