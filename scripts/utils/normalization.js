/** Convert Foundry Collections, Sets, iterables, arrays, and object maps to arrays. */
export function toArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return [...value];
  if (Array.isArray(value.contents)) return [...value.contents];
  if (typeof value === "string") return value ? [value] : [];
  if (typeof value.values === "function") {
    try {
      return Array.from(value.values());
    } catch {
      // Fall through to other representations.
    }
  }
  if (typeof value[Symbol.iterator] === "function") return Array.from(value);
  if (typeof value === "object") return Object.values(value);
  return [];
}

export function finiteNumber(value, fallback = 0) {
  if (value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Normalize display-facing decimal values without leaking binary floating-point
 * artifacts such as 0.15000000000000002 into CharacterExportData.
 */
export function roundedNumber(value, fallback = 0, precision = 4) {
  const number = finiteNumber(value, fallback);
  const safePrecision = Math.min(Math.max(integer(precision), 0), 8);
  const factor = 10 ** safePrecision;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

export function integer(value, fallback = 0) {
  return Math.trunc(finiteNumber(value, fallback));
}

export function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

export function splitList(value) {
  if (Array.isArray(value)) return value.map(entry => text(entry)).filter(Boolean);
  return text(value)
    .split(/[;,\n]/u)
    .map(entry => entry.trim())
    .filter(Boolean);
}

export function uniqueStrings(values) {
  return [...new Set(toArray(values).map(value => text(value)).filter(Boolean))];
}

export function signedNumber(value) {
  const number = finiteNumber(value);
  return number >= 0 ? `+${number}` : String(number);
}

export function proficiencyLabel(multiplier) {
  const value = finiteNumber(multiplier);
  if (value >= 2) return "expertise";
  if (value >= 1) return "proficient";
  if (value > 0) return "half";
  return "none";
}

export function sortByName(entries) {
  return [...entries].sort((a, b) => text(a?.name).localeCompare(text(b?.name)));
}

/** Return a JSON-safe, recursively cloned value composed only of public primitives. */
export function toPlainValue(value, seen = new WeakSet()) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return undefined;
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return undefined;
  seen.add(value);

  if (Array.isArray(value) || value instanceof Set || value instanceof Map) {
    const source = value instanceof Map ? value.values() : value;
    return Array.from(source, entry => toPlainValue(entry, seen)).filter(entry => entry !== undefined);
  }

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    const plain = toPlainValue(entry, seen);
    if (plain !== undefined) result[key] = plain;
  }
  return result;
}
