import type { ExplainFactor, Explanation } from '../api/temperature';
import { tt, type TtKey, type TtLang, ttLang } from '../i18n/temperature';

/** TEMPEXPLAIN093-295: the pure words of an excursion explanation (no DOM: the unit tests import it directly). */
export const CONF_TONE: Record<Explanation['confidence'], string> = { high: 'acc', medium: 'warn', low: 'mut', none: 'mut' };
export const CONF_KEY: Record<Explanation['confidence'], TtKey> = { high: 'whyConfHigh', medium: 'whyConfMedium', low: 'whyConfLow', none: 'whyConfNone' };
export const FACTOR_ICON: Record<string, string> = {
  maint: 'wrench', defrost: 'snow', door: 'door', outage: 'bolt', compressor_off: 'bolt', compressor_no_power: 'bolt', compressor_on: 'bolt',
  unit_off: 'power', setpoint: 'edit', gap: 'clock', spike: 'warning', shared: 'grid', local: 'home', gradual: 'thermometer',
};
export const num = (v: unknown, d = 0): string => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: d }) : '-');

/** One factor in operator words (i18n keys `fx_*`; the evidence numbers fill the template). */
export function factorText(f: ExplainFactor, kind: 'high' | 'low' = 'high', lang: TtLang = ttLang()): string {
  const v = f.vars;
  const w = (k: TtKey, vars?: Record<string, string | number>) => tt(k, vars, lang);
  switch (f.key) {
    case 'maint': return v.reason ? w('fx_maint_reason', { r: String(v.reason) }) : w('fx_maint');
    case 'defrost': return w(v.above_hard_max ? 'fx_defrost_hot' : 'fx_defrost');
    case 'door': return w(v.open_at_start ? 'fx_door_open' : 'fx_door', { c: num(v.count), t: num(v.total_min, 1), l: num(v.lead_min) });
    case 'outage': return w('fx_outage', { d: String(v.device_name || w('fx_outage_src')), l: num(v.lead_min), m: num(v.minutes) });
    case 'compressor_off': return w('fx_compressor_off', { m: num(v.minutes) });
    case 'compressor_no_power': return w('fx_compressor_no_power');
    case 'compressor_on': return w('fx_compressor_on', { m: num(v.minutes) });
    case 'unit_off': return w('fx_unit_off');
    case 'setpoint': return w('fx_setpoint', { a: num(v.sp_from, 1), b: num(v.sp_to, 1) });
    case 'gap': return v.silent ? w('fx_gap_silent') : w('fx_gap', { m: num(v.gap_min) });
    case 'spike': return w('fx_spike', { j: num(v.jump, 1) });
    case 'shared': return w(kind === 'low' ? 'fx_shared_low' : 'fx_shared', { a: num(v.n_moved), b: num(v.n_total), names: Array.isArray(v.names) ? v.names.join(', ') : '' });
    case 'local': return w('fx_local', { b: num(v.n_total) });
    case 'gradual': return w('fx_gradual', { r: num(v.rate_h, 1) });
    default: return f.key;
  }
}
