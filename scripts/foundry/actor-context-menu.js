import {
  canExportActor,
  createContextMenuEntry,
  localize,
  resolveActorFromDirectoryTarget
} from "./compatibility.js";
import { logger } from "../utils/logger.js";

export function registerActorContextMenu({ adapterRegistry, exportService }) {
  globalThis.Hooks.on("getActorContextOptions", (_application, menuItems) => {
    menuItems.push(createContextMenuEntry({
      group: "document",
      icon: "fas fa-file-export",
      label: localize("CHARACTER-EXPORTER.ContextMenu.Export", "Export Character"),
      visible: target => {
        const actor = resolveActorFromDirectoryTarget(target);
        return canExportActor(actor) && Boolean(adapterRegistry.getAdapter(actor));
      },
      onClick: (...args) => {
        const target = args.at(-1);
        const actor = resolveActorFromDirectoryTarget(target);
        if (!actor) return;
        return exportService.exportActor(actor.id).catch(error => logger.error("Unhandled export error", error));
      }
    }));
  });
}
