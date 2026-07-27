import { CHARACTER_EXPORT_SCHEMA_VERSION } from "../constants.js";

/** Build the intentionally small API exposed as game.modules.get("character-exporter").api. */
export function createPublicApi({ templateRegistry, adapterRegistry }) {
  return Object.freeze({
    apiVersion: 1,
    schemaVersion: CHARACTER_EXPORT_SCHEMA_VERSION,

    /** Register a Handlebars/CSS template distributed by an installed Foundry package. */
    registerTemplate(definition, options = {}) {
      return templateRegistry.register(definition, options);
    },

    unregisterTemplate(id) {
      return templateRegistry.unregister(id);
    },

    getTemplates(options = {}) {
      return templateRegistry.getTemplates(options);
    },

    /** Advanced extension point for future systems and Actor types. */
    registerAdapter(id, adapter, options = {}) {
      return adapterRegistry.register(id, adapter, options);
    },

    unregisterAdapter(id) {
      return adapterRegistry.unregister(id);
    }
  });
}
