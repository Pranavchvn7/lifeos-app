import type { LifeData } from "./model";

/**
 * Three-way merge of the habit log, used when the same account was changed on two devices.
 *
 *   base   - the log as this device last saw it on the server
 *   local  - the log on this device now (includes unsaved edits)
 *   server - the log on the server now (includes the other device's edits)
 *
 * Rules, applied at every level of the data:
 *   - only one side changed -> take that side
 *   - both changed different parts (other days, other habits, other fields) -> keep both
 *   - both changed the same value -> this device wins (it is the one being used right now)
 *   - one side deleted something the other side edited -> the edit is kept
 * Lists whose items have an `id` (habits, goals, to-dos) are merged item by item.
 */

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameData(item, b[i]));
  }
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!sameData(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

function hasIds(list: unknown): list is { id: string }[] {
  return Array.isArray(list) && list.every((item) => isObj(item) && typeof item.id === "string");
}

function mergeById(base: unknown, local: { id: string }[], server: { id: string }[]): unknown[] {
  const baseList = hasIds(base) ? base : [];
  const find = (list: { id: string }[], id: string) => list.find((item) => item.id === id);
  const ids = [...server.map((item) => item.id)];
  for (const item of local) if (!ids.includes(item.id)) ids.push(item.id);
  const out: unknown[] = [];
  for (const id of ids) {
    const merged = mergeValue(find(baseList, id), find(local, id), find(server, id));
    if (merged !== undefined) out.push(merged);
  }
  return out;
}

function mergeValue(base: unknown, local: unknown, server: unknown): unknown {
  if (sameData(local, base)) return server; // this device did not touch it
  if (sameData(server, base)) return local; // the other device did not touch it
  if (sameData(local, server)) return local;
  if (local === undefined) return server; // deleted here, edited there: keep the edit
  if (server === undefined) return local; // deleted there, edited here: keep the edit
  if (isObj(local) && isObj(server)) {
    const b = isObj(base) ? base : {};
    const out: Obj = {};
    const keys = new Set([...Object.keys(local), ...Object.keys(server), ...Object.keys(b)]);
    for (const key of keys) {
      const merged = mergeValue(b[key], local[key], server[key]);
      if (merged !== undefined) out[key] = merged;
    }
    return out;
  }
  if (hasIds(local) && hasIds(server)) return mergeById(base, local, server);
  return local; // same value changed on both devices (or a list without ids): this device wins
}

export function mergeLifeData(base: LifeData, local: LifeData, server: LifeData): LifeData {
  return mergeValue(base, local, server) as LifeData;
}
