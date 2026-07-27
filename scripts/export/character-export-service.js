import { CURRENT_SCHEMA_VERSION, assertCharacterExportData } from "./character-export-data.js";
import { canExportActor, format, localize, notify } from "../foundry/compatibility.js";
import { logger } from "../utils/logger.js";

export class CharacterExportService {
  constructor({ adapterRegistry, templateRegistry, renderer, selector, printView }) {
    this.adapterRegistry = adapterRegistry;
    this.templateRegistry = templateRegistry;
    this.renderer = renderer;
    this.selector = selector;
    this.printView = printView;
  }

  async exportActor(actorId) {
    const initialActor = globalThis.game?.actors?.get(actorId);
    if (!initialActor) {
      notify("error", "CHARACTER-EXPORTER.Errors.ActorMissing");
      return false;
    }
    if (!canExportActor(initialActor)) {
      notify("error", "CHARACTER-EXPORTER.Errors.PermissionDenied");
      return false;
    }
    if (!this.adapterRegistry.getAdapter(initialActor)) {
      notify("error", "CHARACTER-EXPORTER.Errors.NoAdapter");
      return false;
    }

    const templates = this.templateRegistry.getCompatible(CURRENT_SCHEMA_VERSION, "html");
    if (!templates.length) {
      notify("warn", "CHARACTER-EXPORTER.Errors.NoTemplates");
      return false;
    }

    let selection;
    try {
      selection = await this.selector.choose(templates, initialActor.name);
    } catch (error) {
      logger.error("Unable to open the template selection dialog", error);
      notify("error", "CHARACTER-EXPORTER.Errors.DialogFailed");
      return false;
    }
    if (!selection) return false;
    if (!selection.printWindow) {
      notify("error", "CHARACTER-EXPORTER.Errors.PopupBlocked");
      return false;
    }

    this.printView.showLoading(selection.printWindow, initialActor.name);
    try {
      const actor = globalThis.game?.actors?.get(actorId);
      if (!actor) throw new Error(localize("CHARACTER-EXPORTER.Errors.ActorMissing", "The Actor no longer exists."));
      if (!canExportActor(actor)) {
        throw new Error(localize("CHARACTER-EXPORTER.Errors.PermissionDenied", "You no longer own this Actor."));
      }

      const template = this.templateRegistry.get(selection.templateId);
      if (!template) throw new Error(format(
        "CHARACTER-EXPORTER.Errors.TemplateMissing",
        { id: selection.templateId },
        `Template "${selection.templateId}" is no longer registered.`
      ));
      const adapter = this.adapterRegistry.getAdapter(actor);
      if (!adapter) throw new Error(localize("CHARACTER-EXPORTER.Errors.NoAdapter", "No compatible adapter is available."));

      const data = assertCharacterExportData(await adapter.convert(actor));
      const rendered = await this.renderer.render(template, data);
      this.printView.render(selection.printWindow, rendered, data.character.name);
      logger.debug(`Rendered actor ${actor.id} with template ${template.id}`);
      return true;
    } catch (error) {
      logger.error(`Character export failed for actor ${actorId}`, error);
      const message = error instanceof Error ? error.message : String(error);
      try {
        this.printView.showError(selection.printWindow, message);
      } catch (printError) {
        logger.error("Unable to display the export error in the print window", printError);
      }
      notify("error", "CHARACTER-EXPORTER.Errors.RenderFailed");
      return false;
    }
  }
}
