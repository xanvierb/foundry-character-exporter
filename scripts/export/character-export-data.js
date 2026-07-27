import { CHARACTER_EXPORT_SCHEMA_VERSION } from "../constants.js";

/**
 * The current public CharacterExportData schema version.
 *
 * Templates consume this module-owned contract and never Foundry documents.
 * See docs/character-export-data-schema.md for the complete field reference.
 */
export const CURRENT_SCHEMA_VERSION = CHARACTER_EXPORT_SCHEMA_VERSION;

export class CharacterExportDataError extends Error {
  constructor(message, path = "") {
    super(path ? `${message} (${path})` : message);
    this.name = "CharacterExportDataError";
    this.path = path;
  }
}

/** Perform inexpensive contract validation at the adapter/renderer boundary. */
export function assertCharacterExportData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new CharacterExportDataError("Character export data must be an object");
  }
  if (data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new CharacterExportDataError(
      `Unsupported CharacterExportData schema version ${String(data.schemaVersion)}`,
      "schemaVersion"
    );
  }
  if (!data.character || typeof data.character !== "object") {
    throw new CharacterExportDataError("Character details are required", "character");
  }
  if (typeof data.character.name !== "string" || !data.character.name.trim()) {
    throw new CharacterExportDataError("Character name is required", "character.name");
  }

  for (const field of ["skills", "senses", "attacks", "inventory", "features", "spells", "resources"]) {
    if (!Array.isArray(data[field])) {
      throw new CharacterExportDataError("Expected an array", field);
    }
  }

  for (const field of ["abilities", "combat", "proficiencies", "spellcasting", "currency", "notes", "extensions"]) {
    if (!data[field] || typeof data[field] !== "object" || Array.isArray(data[field])) {
      throw new CharacterExportDataError("Expected an object", field);
    }
  }
  return data;
}

export function isSchemaCompatible(templateSchemaVersion, dataSchemaVersion = CURRENT_SCHEMA_VERSION) {
  return Number.isInteger(templateSchemaVersion)
    && Number.isInteger(dataSchemaVersion)
    && templateSchemaVersion === dataSchemaVersion;
}
