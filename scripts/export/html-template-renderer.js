import { renderFoundryTemplate } from "../foundry/compatibility.js";
import { assertCharacterExportData, isSchemaCompatible } from "./character-export-data.js";

export class TemplateCompatibilityError extends Error {
  constructor(templateId, expected, actual) {
    super(`Template "${templateId}" expects schema ${expected}, but export data uses schema ${actual}`);
    this.name = "TemplateCompatibilityError";
    this.templateId = templateId;
    this.expected = expected;
    this.actual = actual;
  }
}

export class HtmlTemplateRenderer {
  async render(template, data) {
    assertCharacterExportData(data);
    if (!template || template.renderer !== "html") {
      throw new Error(`Template "${template?.id ?? "unknown"}" does not use the HTML renderer`);
    }
    if (!isSchemaCompatible(template.schemaVersion, data.schemaVersion)) {
      throw new TemplateCompatibilityError(template.id, template.schemaVersion, data.schemaVersion);
    }

    // CharacterExportData is deliberately the entire Handlebars root context.
    const html = await renderFoundryTemplate(template.template, data);
    if (typeof html !== "string" || !html.trim()) {
      throw new Error(`Template "${template.id}" rendered an empty document`);
    }
    return {
      html,
      stylesheets: [...template.stylesheets],
      page: { ...template.page }
    };
  }
}
