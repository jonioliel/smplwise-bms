/**
 * CR-FLEET215: the receiver's check of a fleet report against the SAME closed schema the add-on validates with before signing
 * (`schema.json` is generated from smplwise_vms/backend/smplwise/services/fleet_report.py by tools/gen_fixtures.py; a backend test fails
 * when the committed file drifts). Exact key sets at every level, typed and bounded values, enums only - anything else is refused whole.
 */
import spec from './schema.json';

type Node =
  | { type: 'object'; keys: Record<string, Node> }
  | { type: 'const'; value: unknown }
  | { type: 're'; pattern: string }
  | { type: 'int'; min: number; max: number; null: boolean }
  | { type: 'bool'; null: boolean }
  | { type: 'enum'; values: string[]; null: boolean }
  | { type: 'version'; pattern: string; null: boolean }
  | { type: 'ids'; values: string[] };

export const SCHEMA = spec as unknown as Node;

export class SchemaError extends Error {
  constructor(public path: string, public why: string) {
    super(`${path || '<root>'}: ${why}`);
  }
}

const reCache = new Map<string, RegExp>();
function re(p: string): RegExp {
  let r = reCache.get(p);
  if (!r) {
    r = new RegExp(p);
    reCache.set(p, r);
  }
  return r;
}

function check(node: Node, value: unknown, path: string): void {
  switch (node.type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new SchemaError(path, 'not_an_object');
      const got = Object.keys(value as object);
      const want = Object.keys(node.keys);
      if (got.some((k) => !(k in node.keys))) throw new SchemaError(path, 'unexpected_key');
      if (want.some((k) => !Object.prototype.hasOwnProperty.call(value, k))) throw new SchemaError(path, 'missing_key');
      for (const k of want) check(node.keys[k], (value as Record<string, unknown>)[k], path ? `${path}.${k}` : k);
      return;
    }
    case 'const':
      if (value !== node.value) throw new SchemaError(path, 'wrong_constant');
      return;
    case 're':
      if (typeof value !== 'string' || !re(node.pattern).test(value)) throw new SchemaError(path, 'bad_format');
      return;
    case 'int':
      if (value === null && node.null) return;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < node.min || value > node.max) throw new SchemaError(path, 'bad_integer');
      return;
    case 'bool':
      if (value === null && node.null) return;
      if (typeof value !== 'boolean') throw new SchemaError(path, 'bad_boolean');
      return;
    case 'enum':
      if (value === null && node.null) return;
      if (typeof value !== 'string' || !node.values.includes(value)) throw new SchemaError(path, 'not_in_enum');
      return;
    case 'version':
      if (value === null && node.null) return;
      if (typeof value !== 'string' || !re(node.pattern).test(value)) throw new SchemaError(path, 'bad_version');
      return;
    case 'ids':
      if (!Array.isArray(value) || new Set(value).size !== value.length || value.some((v) => typeof v !== 'string' || !node.values.includes(v)))
        throw new SchemaError(path, 'bad_id_list');
      return;
    default:
      throw new SchemaError(path, 'unknown_spec');
  }
}

/** Throws SchemaError (path + closed reason, never a value) when the report is not exactly the schema. */
export function validateReport(report: unknown): void {
  check(SCHEMA, report, '');
}
