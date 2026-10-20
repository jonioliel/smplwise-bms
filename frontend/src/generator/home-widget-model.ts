/**
 * GENWIDGET 2.9.3: the generator HOME widget's pure logic (no DOM, no network). Unit-tested in tests/unit-generator-home-widget.spec.ts.
 *
 * Source: GET /generator/devices/live (one call for every generator; api/generator.ts `listLive`). Nothing is invented: each generator's
 * engine state and its mains / generator supply are derived by the SAME function the generator screen's power-flow uses (`flowPlan` in
 * gen-logic.ts) from the roles the controller exposes - mains_available, mains voltages, the mains breaker for mains presence; the transfer
 * switch / supply source, on-load flag, generator breaker or load-on-mains for "the site is on the generator".
 *
 * One documented derivation of our own (owner request 2026-10-20): when the controller exposes NO mains role at all and the engine is stopped
 * (standby), the site is taken to be on mains - a standby generator in a healthy installation means the grid feeds the site. That case is
 * marked `mainsInferred` (the screen draws it the same way; tests and the data attribute can tell). A running engine without any transfer-switch
 * role is taken to feed its load, exactly as the power-flow does.
 *
 * Per generator, the loudest first: fault (engine fault or an open CRITICAL alert) > alert (any other open alert) > unknown (offline, or the
 * mirror is stale) > starting / cooling > running > standby.
 */
import type { Availability, GenValues, LiveSummaryItem } from '../api/generator';
import { Caps, engineOf, flowPlan, num, type EngineState } from './gen-logic';
import type { GwtKey } from '../i18n/generator-widget';

/** The generator screen (תשתיות › גנרטור); a row adds `?device=<id>` (the screen's own picker parameter). Equal to nav's INFRA_GENERATOR_HREF. */
export const GEN_HOME_HREF = '#/infra/generator/live';
export const genDeviceHref = (id: string): string => `${GEN_HOME_HREF}?device=${encodeURIComponent(id)}`;

export type GenHomeState = 'fault' | 'alarm' | 'unknown' | 'starting' | 'cooling' | 'running' | 'standby';
export type GenSupply = 'generator' | 'none' | 'mains' | 'unknown';
/** The colour family of a state (`--sw-gw-*` tokens in home-widget.ts). */
export type GenLook = 'fault' | 'warn' | 'unk' | 'trans' | 'run' | 'ok';

export const STATE_LOOK: Record<GenHomeState, GenLook> = { fault: 'fault', alarm: 'warn', unknown: 'unk', starting: 'trans', cooling: 'trans', running: 'run', standby: 'ok' };
export const STATE_KEY: Record<GenHomeState, GwtKey> = {
  fault: 'stateFault', alarm: 'stateAlarm', unknown: 'stateUnknown', starting: 'stateStarting', cooling: 'stateCooling', running: 'stateRunning', standby: 'stateStandby',
};
export const SUPPLY_KEY: Record<GenSupply, GwtKey> = { generator: 'supplyGenerator', none: 'supplyNone', mains: 'supplyMains', unknown: 'supplyUnknown' };
export const RANK: Record<GenHomeState, number> = { fault: 0, alarm: 1, unknown: 2, starting: 3, cooling: 3, running: 4, standby: 5 };
/** The supply look: on the generator = the running blue; no mains = the fault red; unknown = grey; mains = green. */
export const SUPPLY_LOOK: Record<GenSupply, GenLook> = { generator: 'run', none: 'fault', mains: 'ok', unknown: 'unk' };

export interface GenHomeItem {
  id: string;
  name: string;
  state: GenHomeState;
  look: GenLook;
  engine: EngineState;
  supply: GenSupply;
  /** Mains taken from the stopped engine (no mains role exposed) - see the module comment. */
  mainsInferred: boolean;
  fuel: number | null;
  load: number | null;
  alerts: number;
  href: string;
}

/** The live summary as the value map gen-logic reads (only available values are sent). */
export function valuesOf(item: Pick<LiveSummaryItem, 'summary'>): GenValues {
  const out: GenValues = {};
  for (const [k, v] of Object.entries(item.summary ?? {})) out[k] = { value: v.value, unit: v.unit, available: true, updated_at: null, label: '' };
  return out;
}

/** The generators the widget lists: those whose core roles are met (a partial one is still being set up - the tab is not offered for it either). */
export const shownGenerators = (list: readonly LiveSummaryItem[] | null | undefined): LiveSummaryItem[] => (list ?? []).filter((d) => d.status !== 'partial' && d.status !== 'removed');

export function genHomeItem(d: LiveSummaryItem): GenHomeItem {
  const values = valuesOf(d);
  const caps = new Caps(d.roles?.length ? d.roles : Object.keys(values));
  const availability: Availability = d.availability;
  const engine = availability === 'online' ? engineOf(values, availability) : 'unknown';
  let state: GenHomeState;
  if (engine === 'unknown') state = 'unknown';
  else if (engine === 'fault' || (d.open_critical ?? 0) > 0) state = 'fault';
  else if (d.open_alerts > 0) state = 'alarm';
  else if (engine === 'starting' || engine === 'cooling') state = engine;
  else state = engine === 'running' ? 'running' : 'standby';
  let supply: GenSupply = 'unknown';
  let mainsInferred = false;
  if (engine !== 'unknown') {
    const p = flowPlan(values, caps, availability);
    if (p.onGen) supply = 'generator';
    else if (p.mainsOn === true) supply = 'mains';
    else if (p.mainsOn === false) supply = 'none';
    else if (engine === 'stopped') {
      supply = 'mains';
      mainsInferred = true;
    }
  }
  return { id: d.id, name: d.name, state, look: STATE_LOOK[state], engine, supply, mainsInferred, fuel: num(values, 'fuel_pct'), load: num(values, 'load_pct'), alerts: d.open_alerts, href: genDeviceHref(d.id) };
}

export interface GenHomeView {
  /** The loudest first (stable within a rank: the server's name order). */
  items: GenHomeItem[];
  loudest: GenHomeItem | null;
  /** The site: on the generator if any generator feeds it, else no mains if any reports so, else on mains, else unknown. */
  supply: GenSupply;
  supplyInferred: boolean;
  total: number;
  running: number;
  faults: number;
}

export function genHomeView(list: readonly LiveSummaryItem[] | null | undefined): GenHomeView {
  const items = shownGenerators(list).map(genHomeItem).map((x, i) => ({ x, i })).sort((a, b) => RANK[a.x.state] - RANK[b.x.state] || a.i - b.i).map((p) => p.x);
  const has = (s: GenSupply) => items.some((x) => x.supply === s);
  const supply: GenSupply = has('generator') ? 'generator' : has('none') ? 'none' : has('mains') ? 'mains' : 'unknown';
  const supplyInferred = supply === 'mains' && items.filter((x) => x.supply === 'mains').every((x) => x.mainsInferred);
  return {
    items, loudest: items[0] ?? null, supply, supplyInferred, total: items.length,
    running: items.filter((x) => x.engine === 'running').length, faults: items.filter((x) => x.state === 'fault').length,
  };
}

/** Whether the widget exists for this viewer: at least one generator is listed (none, no permission, not read yet = absent, no ghost). */
export const generatorsAvailable = (list: readonly LiveSummaryItem[] | null | undefined): boolean => shownGenerators(list).length > 0;
