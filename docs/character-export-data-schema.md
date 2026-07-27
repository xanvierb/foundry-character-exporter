# CharacterExportData schema version 1

CharacterExportData is the stable public contract between a character adapter and an export template. It is a plain, JSON-safe object: no Foundry Documents, DataModels, Collections, Sets, functions, or circular references are permitted.

The schema version is the integer `schemaVersion`, not the module version. Version 1 may gain optional additive fields. Removing or renaming a field, changing its meaning, or making an incompatible type change requires schema version 2.

All arrays are ordinary arrays. Missing text is `""`, optional structured values may be `null`, and numeric character-sheet values are numbers.

## Top level

```js
{
  schemaVersion: 1,
  generatedAt: "2026-07-27T12:00:00.000Z",
  source: { ... },
  character: { ... },
  abilities: { ... },
  combat: { ... },
  skills: [],
  senses: [],
  proficiencies: { ... },
  defenses: { ... },
  attacks: [],
  inventory: [],
  features: [],
  spellcasting: { ... },
  spells: [],
  resources: [],
  currency: { ... },
  notes: { ... },
  extensions: { dnd5e: { ... } }
}
```

### `source`

- `system`: semantic system ID, currently `"dnd5e"`.
- `systemVersion`: installed system version.
- `actorId`, `actorUuid`: source identifiers for diagnostics/integration, not document references.

### `character`

- `name`, `portrait`, `level`, `proficiencyBonus`, `inspiration`.
- `playerName`: name of the Foundry user whose assigned character matches this Actor, when available.
- `alignment`.
- `size`: `{ id, name }`.
- `species`, `background`: `{ name, description }`; description is cleaned HTML.
- `experience`: `{ current, minimum, maximum, percentage }`.
- `classes`: one entry per class Item, preserving multiclass characters:

```js
{
  id,
  identifier,
  name,
  level,
  subclass,
  hitDie,
  hitDice: { current, maximum, spent },
  spellcasting: {
    ability,
    progression,
    preparationMaximum,
    attackBonus,
    saveDc
  }
}
```

2014 “race” and 2024 “species” source Items are normalized to the semantic `species` field.

### `abilities`

An object with semantic keys `strength`, `dexterity`, `constitution`, `intelligence`, `wisdom`, and `charisma`. Each value is:

```js
{
  id,                    // dnd5e short ID, e.g. "str"
  name,
  abbreviation,
  score,
  modifier,
  check,                 // effective numeric ability check modifier
  save,                  // effective numeric saving throw modifier
  saveProficiency,       // 0, 0.5, 1, 2, etc.
  saveProficiencyLabel,  // "none", "half", "proficient", "expertise"
  proficient             // true at a multiplier of at least 1
}
```

### `combat`

- `armorClass`, `armorClassLabel`.
- `initiative`, `initiativeAbility`.
- `speed`: the walking entry from `movement`, or `null`.
- `movement`: `{ id, name, distance, units }[]`; a special entry can use `details` and a null distance.
- `hp`: `{ current, maximum, effectiveMaximum, temporary, temporaryMaximum }`.
- `hitDice`: `{ className, denomination, current, maximum, spent }[]`.
- `deathSaves`: `{ successes, failures }`.
- `exhaustion`, `passivePerception`.
- `encumbrance`: `{ current, maximum, percentage }`.
- `attunement`: `{ current, maximum }`.

### `skills`

Every configured dnd5e skill becomes:

```js
{
  id,
  name,
  ability,
  modifier,              // prepared total
  passive,               // prepared passive value
  proficiency,           // effective multiplier
  proficiencyLabel,
  proficient
}
```

This respects effective proficiency, expertise, half proficiency, global bonuses, and ability-specific bonuses prepared by dnd5e.

### `senses`

`{ id, name, distance, units, details }[]`. Configured senses use a distance; custom/special text uses `details`.

### `proficiencies`

- `armor`, `weapons`, `languages`, `communication`: localized string arrays.
- `tools`: `{ id, name, ability, modifier, proficiency, proficiencyLabel }[]`.

### `defenses`

Localized string arrays: `damageResistances`, `damageImmunities`, `damageVulnerabilities`, and `conditionImmunities`.

### `attacks`

One entry per current dnd5e attack Activity on an owned Item:

```js
{
  id,
  name,
  image,
  kind,                  // weapon, spell, unarmed, etc.
  attackType,            // melee or ranged
  ability,
  equipped,
  proficient,
  attackBonus,           // numeric when the prepared formula is a fixed number
  attackFormula,         // prepared display formula/bonus
  activation: { type, value, condition, label } | null,
  range: { value, long, reach, units, label } | null,
  damage: [{ formula, label, type, typeName }],
  properties: [{ id, name }],
  description            // cleaned HTML
}
```

Prepared dnd5e Activity labels are preferred so magic bonuses, actor bonuses, base weapon damage, and current effective values match the sheet.

### `inventory`

Physical owned Items (`weapon`, `equipment`, `consumable`, `tool`, `loot`, `container`, and `backpack`) become:

```js
{
  id, name, type, typeName, image, quantity,
  weight: { value, total, units },
  price: { value, denomination },
  rarity,
  equipped,              // boolean or null when not applicable
  attuned,               // boolean or null when not applicable
  container: { id, name } | null,
  uses: {
    current, maximum, spent, label,
    recovery: [{ period, type, formula }]
  } | null,
  properties: [{ id, name }],
  description            // cleaned HTML
}
```

Contained Items remain in the array; their `container` link prevents information loss. Quantity, weight, and price values remain numeric and are normalized to at most four decimal places so templates never receive binary floating-point display artifacts.

### `features`

Feature/feat Items become:

```js
{
  id, name, image,
  category, categoryName, subtype, requirements,
  activation: { type, value, condition, label } | null,
  uses: { current, maximum, spent, label, recovery } | null,
  properties: [{ id, name }],
  description
}
```

Class, subclass, species, and background Items have dedicated locations under `character` and are not duplicated in `features`.

### `spellcasting`

```js
{
  ability,
  abilityName,
  modifier,
  attackBonus,
  saveDc,
  classes: [{
    identifier, name, ability, progression,
    preparationMaximum, attackBonus, saveDc
  }],
  slots: [{
    id, level, label, current, maximum, override, pact
  }]
}
```

The class array preserves different multiclass casting sources. Slots are effective prepared dnd5e slot values, including pact slots.

### `spells`

```js
{
  id, name, image,
  level, levelName,
  school, schoolName,
  method, methodName,
  prepared, preparationState,
  ritual, concentration,
  activation: { type, value, condition, label } | null,
  range: { value, long, reach, units, label } | null,
  duration: { value, units, concentration, label } | null,
  components: [{ id, name }],
  materials,
  sourceClass,           // normalized from dnd5e 5.1 sourceClass or newer source-item data
  description
}
```

The array is ordered by spell level, then name. No spells are dropped because they are unprepared.

### `resources`

`{ id, name, current, maximum, recovery }[]`, where recovery is `"shortRest"`, `"longRest"`, or `""` for the three standard character resources.

### `currency`

- `denominations`: `{ id, name, value }[]` based on the active system configuration.
- Convenience numeric fields `pp`, `gp`, `ep`, `sp`, `cp`.

### `notes`

Plain text: `personalityTraits`, `ideals`, `bonds`, `flaws`, `appearance`, `age`, `gender`, `height`, `weight`, `eyes`, `hair`, `skin`, `faith`.

Cleaned HTML: `biography`, `publicBiography`.

### `extensions.dnd5e`

A narrow system-specific semantic namespace:

- `rulesVersion`: `"2014"`, `"2024"`, or an unknown configured value.
- `tier`.
- `concentrationSave`, `concentrationLimit`.
- `attunementMaximum`.

The extension namespace is not permission to expose `actor.system` or raw Items. Future fields must remain plain, documented, and purpose-specific.
