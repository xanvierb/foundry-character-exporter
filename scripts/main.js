import {
  BUILT_IN_TEMPLATE_METADATA,
  CHARACTER_EXPORT_SCHEMA_VERSION,
  MODULE_ID
} from "./constants.js";
import { createPublicApi } from "./api/public-api.js";
import { AdapterRegistry } from "./adapters/adapter-registry.js";
import { Dnd5eCharacterAdapter } from "./adapters/dnd5e-character-adapter.js";
import { CharacterExportService } from "./export/character-export-service.js";
import { HtmlTemplateRenderer } from "./export/html-template-renderer.js";
import { TemplateRegistry } from "./export/template-registry.js";
import { registerActorContextMenu } from "./foundry/actor-context-menu.js";
import { registerHandlebarsHelpers } from "./foundry/handlebars-helpers.js";
import { notify } from "./foundry/compatibility.js";
import { PrintView } from "./ui/print-view.js";
import { TemplateSelectionDialog } from "./ui/template-selection-dialog.js";
import { logger } from "./utils/logger.js";

const adapterRegistry = new AdapterRegistry();
const templateRegistry = new TemplateRegistry();
const api = createPublicApi({ adapterRegistry, templateRegistry });
const exportService = new CharacterExportService({
  adapterRegistry,
  templateRegistry,
  renderer: new HtmlTemplateRenderer(),
  selector: new TemplateSelectionDialog(),
  printView: new PrintView()
});

function resolveBuiltInAssets(metadata) {
  const base = BUILT_IN_TEMPLATE_METADATA.slice(0, BUILT_IN_TEMPLATE_METADATA.lastIndexOf("/"));
  const resolve = path => {
    const value = String(path ?? "");
    return value.startsWith("modules/") || value.startsWith("systems/") ? value : `${base}/${value}`;
  };
  const stylesheets = metadata.stylesheets ?? (metadata.stylesheet ? [metadata.stylesheet] : []);
  return {
    ...metadata,
    template: resolve(metadata.template),
    stylesheets: stylesheets.map(resolve),
    sourceModule: MODULE_ID
  };
}

async function registerBuiltInTemplate() {
  const response = await fetch(BUILT_IN_TEMPLATE_METADATA);
  if (!response.ok) throw new Error(`Unable to load built-in template metadata (${response.status})`);
  const metadata = resolveBuiltInAssets(await response.json());
  templateRegistry.register(metadata);
}

globalThis.Hooks.once("init", () => {
  registerHandlebarsHelpers();
  adapterRegistry.register("dnd5e.character", new Dnd5eCharacterAdapter(), { priority: 100 });

  const module = globalThis.game.modules.get(MODULE_ID);
  module.api = api;
  registerActorContextMenu({ adapterRegistry, exportService });
  logger.debug(`Initialized API v${api.apiVersion}, CharacterExportData schema v${CHARACTER_EXPORT_SCHEMA_VERSION}`);
});

globalThis.Hooks.once("ready", async () => {
  try {
    await registerBuiltInTemplate();
    globalThis.Hooks.callAll(`${MODULE_ID}.ready`, api);
    logger.info("Ready");
  } catch (error) {
    logger.error("Failed to register the built-in template", error);
    notify("error", "CHARACTER-EXPORTER.Errors.BuiltInTemplateFailed");
  }
});
