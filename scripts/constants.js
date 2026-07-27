export const MODULE_ID = "character-exporter";
export const MODULE_TITLE = "Character Sheet Exporter";
export const CHARACTER_EXPORT_SCHEMA_VERSION = 1;
export const SUPPORTED_SYSTEM_ID = "dnd5e";
export const BUILT_IN_TEMPLATE_METADATA =
  `modules/${MODULE_ID}/templates/sheets/default/template.json`;
export const TEMPLATE_DIALOG_PATH =
  `modules/${MODULE_ID}/templates/dialogs/template-selection.hbs`;

export const INVENTORY_ITEM_TYPES = Object.freeze([
  "weapon",
  "equipment",
  "consumable",
  "tool",
  "loot",
  "container",
  "backpack"
]);

export const ABILITY_NAMES = Object.freeze({
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma"
});
