import { MODULE_ID } from "../constants.js";

export function getDialogV2() {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2) throw new Error("Foundry DialogV2 is not available");
  return DialogV2;
}

export async function renderFoundryTemplate(path, data) {
  const renderer = globalThis.foundry?.applications?.handlebars?.renderTemplate;
  if (typeof renderer !== "function") {
    throw new Error("Foundry's Handlebars renderTemplate API is not available");
  }
  return renderer(path, data);
}

export function localize(key, fallback = key) {
  try {
    const value = globalThis.game?.i18n?.localize?.(key);
    return value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

export function format(key, data, fallback = key) {
  try {
    const value = globalThis.game?.i18n?.format?.(key, data);
    return value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

export function localizeConfigEntry(entry, fallback = "") {
  const candidate = entry && typeof entry === "object" ? entry.label ?? entry.name : entry;
  if (typeof candidate !== "string" || !candidate) return fallback;
  return localize(candidate, candidate);
}

export function notify(level, key, data = {}) {
  const message = Object.keys(data).length ? format(key, data, key) : localize(key, key);
  globalThis.ui?.notifications?.[level]?.(message);
}

export function resolveActorFromDirectoryTarget(target) {
  const HTMLElementClass = globalThis.HTMLElement;
  if (!HTMLElementClass || !(target instanceof HTMLElementClass)) return null;
  const entry = target.closest("[data-entry-id], [data-document-id]") ?? target;
  const actorId = entry.dataset.entryId ?? entry.dataset.documentId;
  return actorId ? globalThis.game?.actors?.get(actorId) ?? null : null;
}

export function canExportActor(actor, user = globalThis.game?.user) {
  if (!actor || !user || globalThis.game?.system?.id !== "dnd5e" || actor.type !== "character") return false;
  const owner = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER;
  return owner !== undefined && actor.testUserPermission(user, owner);
}

/**
 * Clean rich-text copied into the export contract. Foundry's public cleaner fixes
 * malformed HTML; the DOM pass removes executable/embed content from Actor text.
 */
export function cleanRichText(raw) {
  const source = String(raw ?? "");
  if (!source) return "";

  let cleaned = source;
  try {
    cleaned = globalThis.foundry?.utils?.cleanHTML?.(source) ?? source;
  } catch {
    cleaned = source;
  }

  if (globalThis.document?.createElement) {
    const template = globalThis.document.createElement("template");
    template.innerHTML = cleaned;
    template.content.querySelectorAll("script, style, iframe, object, embed, link, meta, base, form, input, button")
      .forEach(node => node.remove());
    template.content.querySelectorAll("*").forEach(element => {
      for (const attribute of [...element.attributes]) {
        if (/^on/iu.test(attribute.name)) element.removeAttribute(attribute.name);
        if (["href", "src", "xlink:href"].includes(attribute.name.toLowerCase())
          && /^\s*javascript:/iu.test(attribute.value)) element.removeAttribute(attribute.name);
      }
    });
    return template.innerHTML;
  }

  return cleaned
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/giu, "")
    .replace(/(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/giu, "");
}

export function modulePath(relativePath) {
  return `modules/${MODULE_ID}/${String(relativePath).replace(/^\/+/, "")}`;
}
