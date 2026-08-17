function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function clone(value) { return value == null ? value : structuredClone(value); }

const SET_ARRAY_PATHS = new Set(['simpleWords', 'errorBooks']);
const ID_ARRAY_PATHS = new Set(['words', 'texts', 'activities', 'events']);

function itemKey(path, item, index) {
  if (ID_ARRAY_PATHS.has(path) && item && typeof item === 'object' && item.id != null) return `id:${item.id}`;
  if (path === 'sentenceBooks' && item && typeof item === 'object' && item.id != null) return `id:${item.id}`;
  if (path.endsWith('.entries') && item && typeof item === 'object' && item.id != null) return `id:${item.id}`;
  if (path === 'dataChart.attempts' && item && typeof item === 'object' && item.id != null) return `id:${item.id}`;
  return `index:${index}`;
}

function mergeSetArray(base = [], local = [], cloud = []) {
  const b = new Set(base), l = new Set(local), c = new Set(cloud);
  const all = new Set([...b, ...l, ...c]);
  const out = [];
  for (const value of all) {
    const was = b.has(value), lv = l.has(value), cv = c.has(value);
    if (lv === cv) { if (lv) out.push(value); continue; }
    if (lv === was) { if (cv) out.push(value); continue; }
    if (cv === was) { if (lv) out.push(value); continue; }
  }
  return out;
}

function mergeArray(base = [], local = [], cloud = [], path, conflicts) {
  if (SET_ARRAY_PATHS.has(path)) return mergeSetArray(base, local, cloud);
  const allObjectIds = [...base, ...local, ...cloud].every((item) => item == null || typeof item !== 'object' || item.id != null);
  const keyed = ID_ARRAY_PATHS.has(path) || path === 'sentenceBooks' || path.endsWith('.entries') || path === 'dataChart.attempts' || allObjectIds;
  if (!keyed) {
    if (same(local, cloud)) return clone(local);
    if (same(local, base)) return clone(cloud);
    if (same(cloud, base)) return clone(local);
    if (local.length === cloud.length && local.length === base.length) {
      return local.map((_, i) => mergeValue(base[i], local[i], cloud[i], `${path}[${i}]`, conflicts));
    }
    conflicts.push(path);
    return clone(local);
  }

  const map = (arr) => new Map(arr.map((item, index) => [itemKey(path, item, index), item]));
  const bm = map(base), lm = map(local), cm = map(cloud);
  const keys = [...new Set([...bm.keys(), ...lm.keys(), ...cm.keys()])];
  const out = [];
  for (const key of keys) {
    const b = bm.get(key), l = lm.get(key), c = cm.get(key);
    const childPath = `${path}{${key}}`;
    if (l === undefined && c === undefined) continue;
    if (b === undefined) {
      if (l === undefined) { out.push(clone(c)); continue; }
      if (c === undefined) { out.push(clone(l)); continue; }
      out.push(mergeValue(undefined, l, c, childPath, conflicts));
      continue;
    }
    if (l === undefined) {
      if (same(c, b)) continue;
      conflicts.push(childPath);
      out.push(clone(c));
      continue;
    }
    if (c === undefined) {
      if (same(l, b)) continue;
      conflicts.push(childPath);
      out.push(clone(l));
      continue;
    }
    out.push(mergeValue(b, l, c, childPath, conflicts));
  }
  return out;
}

function mergeObject(base = {}, local = {}, cloud = {}, path, conflicts) {
  const out = {};
  const keys = [...new Set([...Object.keys(base || {}), ...Object.keys(local || {}), ...Object.keys(cloud || {})])];
  for (const key of keys) {
    const childPath = path ? `${path}.${key}` : key;
    const value = mergeValue(base?.[key], local?.[key], cloud?.[key], childPath, conflicts);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function mergeValue(base, local, cloud, path, conflicts) {
  if (same(local, cloud)) return clone(local);
  if (same(local, base)) return clone(cloud);
  if (same(cloud, base)) return clone(local);
  if (local === undefined || cloud === undefined) {
    conflicts.push(path);
    return clone(local === undefined ? cloud : local);
  }
  if (Array.isArray(local) && Array.isArray(cloud) && Array.isArray(base || [])) return mergeArray(base || [], local, cloud, path, conflicts);
  if (local && cloud && typeof local === 'object' && typeof cloud === 'object' && !Array.isArray(local) && !Array.isArray(cloud)) {
    return mergeObject(base && typeof base === 'object' && !Array.isArray(base) ? base : {}, local, cloud, path, conflicts);
  }
  conflicts.push(path);
  return clone(local);
}

export function mergeCloudStates(base, local, cloud) {
  const conflicts = [];
  const state = mergeValue(base || {}, local || {}, cloud || {}, '', conflicts);
  return { state, conflicts: [...new Set(conflicts.filter(Boolean))] };
}
