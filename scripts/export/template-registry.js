import { isSchemaCompatible } from "./character-export-data.js";

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;

export class TemplateDefinitionError extends Error {
  constructor(message, field = "") {
    super(field ? `${message} (${field})` : message);
    this.name = "TemplateDefinitionError";
    this.field = field;
  }
}

function assetPath(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TemplateDefinitionError("A non-empty asset path is required", field);
  }
  const path = value.trim().replace(/^\/+/, "");
  if (/^(?:[a-z]+:|\/\/)/iu.test(path) || /(^|\/)\.\.(\/|$)/u.test(path)) {
    throw new TemplateDefinitionError("Template assets must use a safe Foundry package path", field);
  }
  if (!path.startsWith("modules/") && !path.startsWith("systems/")) {
    throw new TemplateDefinitionError("Template assets must be inside modules/ or systems/", field);
  }
  return path;
}

function publicCopy(definition) {
  return Object.freeze({
    ...definition,
    stylesheets: Object.freeze([...definition.stylesheets]),
    page: Object.freeze({ ...definition.page })
  });
}

export function normalizeTemplateDefinition(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TemplateDefinitionError("Template definition must be an object");
  }

  const id = String(input.id ?? "").trim();
  if (!ID_PATTERN.test(id)) {
    throw new TemplateDefinitionError(
      "Template id must contain only lowercase letters, digits, dots, underscores, and hyphens",
      "id"
    );
  }
  const name = String(input.name ?? "").trim();
  if (!name) throw new TemplateDefinitionError("Template name is required", "name");

  const version = String(input.version ?? "").trim();
  if (!VERSION_PATTERN.test(version)) {
    throw new TemplateDefinitionError("Template version must be semantic (for example 1.0.0)", "version");
  }

  const schemaVersion = Number(input.schemaVersion);
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new TemplateDefinitionError("schemaVersion must be a positive integer", "schemaVersion");
  }

  const renderer = String(input.renderer ?? "html").trim();
  if (renderer !== "html") {
    throw new TemplateDefinitionError(`Unsupported renderer "${renderer}"`, "renderer");
  }

  const stylesheetInput = input.stylesheets ?? (input.stylesheet ? [input.stylesheet] : []);
  if (!Array.isArray(stylesheetInput)) {
    throw new TemplateDefinitionError("stylesheets must be an array", "stylesheets");
  }

  const pageSize = String(input.page?.size ?? "A4").trim() || "A4";
  if (!["A4", "Letter"].includes(pageSize)) {
    throw new TemplateDefinitionError('page.size must be "A4" or "Letter"', "page.size");
  }
  const pageOrientation = String(input.page?.orientation ?? "portrait").trim() || "portrait";
  if (!["portrait", "landscape"].includes(pageOrientation)) {
    throw new TemplateDefinitionError(
      'page.orientation must be "portrait" or "landscape"', "page.orientation"
    );
  }

  return Object.freeze({
    id,
    name,
    description: String(input.description ?? "").trim(),
    author: String(input.author ?? "").trim(),
    version,
    schemaVersion,
    renderer,
    template: assetPath(input.template, "template"),
    stylesheets: Object.freeze(stylesheetInput.map((path, index) => assetPath(path, `stylesheets.${index}`))),
    page: Object.freeze({
      size: pageSize,
      orientation: pageOrientation
    }),
    sourceModule: String(input.sourceModule ?? "").trim()
  });
}

export class TemplateRegistry {
  #templates = new Map();

  register(definition, { replace = false } = {}) {
    const normalized = normalizeTemplateDefinition(definition);
    if (this.#templates.has(normalized.id) && !replace) {
      throw new TemplateDefinitionError(`Template "${normalized.id}" is already registered`, "id");
    }
    this.#templates.set(normalized.id, normalized);
    return publicCopy(normalized);
  }

  unregister(id) {
    return this.#templates.delete(id);
  }

  get(id) {
    return this.#templates.get(id) ?? null;
  }

  getTemplates({ schemaVersion, renderer } = {}) {
    return [...this.#templates.values()]
      .filter(template => schemaVersion === undefined || isSchemaCompatible(template.schemaVersion, schemaVersion))
      .filter(template => renderer === undefined || template.renderer === renderer)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(publicCopy);
  }

  getCompatible(schemaVersion, renderer = "html") {
    return this.getTemplates({ schemaVersion, renderer });
  }
}
