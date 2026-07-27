import { signedNumber, text, toArray } from "../utils/normalization.js";

export function registerHandlebarsHelpers() {
  const handlebars = globalThis.Handlebars;
  if (!handlebars?.registerHelper) throw new Error("Foundry Handlebars is not available");

  handlebars.registerHelper("characterExporterSigned", value => signedNumber(value));
  handlebars.registerHelper("characterExporterJoin", (values, separator = ", ") => {
    // Handlebars always appends its options object to helper arguments. When a
    // template omits the optional separator that object is the second argument,
    // and joining with it would print "[object Object]" between every value.
    const delimiter = typeof separator === "string" ? separator : ", ";
    return toArray(values).map(value => text(value?.name ?? value)).filter(Boolean).join(delimiter);
  });
  handlebars.registerHelper("characterExporterHas", value => {
    if (Array.isArray(value) || value instanceof Set || value instanceof Map) return value.size ?? value.length;
    return Boolean(value && (typeof value !== "object" || Object.keys(value).length));
  });
  handlebars.registerHelper("characterExporterEqual", (left, right) => String(left) === String(right));
}
