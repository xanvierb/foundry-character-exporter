import {
  ABILITY_NAMES,
  CHARACTER_EXPORT_SCHEMA_VERSION,
  INVENTORY_ITEM_TYPES,
  SUPPORTED_SYSTEM_ID
} from "../constants.js";
import { cleanRichText, localize, localizeConfigEntry } from "../foundry/compatibility.js";
import {
  finiteNumber,
  integer,
  optionalNumber,
  proficiencyLabel,
  sortByName,
  splitList,
  text,
  toArray,
  uniqueStrings
} from "../utils/normalization.js";
import { CharacterAdapter } from "./character-adapter.js";

function dndConfig() {
  return globalThis.CONFIG?.DND5E ?? {};
}

function configLabel(collection, key, fallback = key) {
  return localizeConfigEntry(collection?.[key], fallback);
}

function propertiesList(properties, configuration) {
  return toArray(properties).map(id => ({ id: text(id), name: configLabel(configuration, id, text(id)) }));
}

function usesData(uses, labels = {}) {
  if (!uses) return null;
  const maximum = optionalNumber(uses.max);
  if (!maximum) return null;
  const spent = finiteNumber(uses.spent);
  const current = optionalNumber(uses.value) ?? Math.max(maximum - spent, 0);
  return {
    current,
    maximum,
    spent,
    label: text(uses.label ?? labels.recovery),
    recovery: toArray(uses.recovery).map(profile => ({
      period: text(profile?.period),
      type: text(profile?.type),
      formula: text(profile?.formula)
    }))
  };
}

function activationData(source, labels = {}) {
  if (!source && !labels.activation) return null;
  return {
    type: text(source?.type),
    value: optionalNumber(source?.value ?? source?.cost),
    condition: text(source?.condition),
    label: text(labels.activation)
  };
}

function rangeData(source, labels = {}) {
  if (!source && !labels.range && !labels.reach) return null;
  return {
    value: optionalNumber(source?.value),
    long: optionalNumber(source?.long),
    reach: optionalNumber(source?.reach),
    units: text(source?.units),
    label: text(labels.range ?? labels.reach)
  };
}

function durationData(source, labels = {}) {
  if (!source && !labels.duration) return null;
  return {
    value: optionalNumber(source?.value),
    units: text(source?.units),
    concentration: Boolean(source?.concentration),
    label: text(labels.duration)
  };
}

function activityList(item) {
  return toArray(item?.system?.activities);
}

function primaryActivity(item) {
  return activityList(item)[0] ?? null;
}

function descriptionOf(item) {
  return cleanRichText(item?.system?.description?.value);
}

function itemUses(item) {
  const activity = primaryActivity(item);
  return usesData(item?.system?.uses ?? activity?.uses, item?.labels ?? activity?.labels);
}

function damageList(activity) {
  const prepared = toArray(activity?.labels?.damages ?? activity?.labels?.damage);
  if (prepared.length) {
    return prepared.map(part => typeof part === "string" ? {
      formula: part,
      label: part,
      type: "",
      typeName: ""
    } : {
      formula: text(part?.formula),
      label: text(part?.label ?? part?.formula),
      type: text(part?.damageType),
      typeName: configLabel(dndConfig().damageTypes, part?.damageType, text(part?.damageType))
    });
  }

  return toArray(activity?.damage?.parts).map(part => {
    const types = toArray(part?.types);
    const type = text(types[0]);
    return {
      formula: text(part?.formula),
      label: text(part?.formula),
      type,
      typeName: configLabel(dndConfig().damageTypes, type, type)
    };
  });
}

function numericAttackBonus(activity) {
  const candidate = text(activity?.labels?.modifier ?? activity?.labels?.toHit);
  return /^[+-]?\d+$/u.test(candidate) ? Number(candidate) : null;
}

function normalizeAttack(item, activity) {
  const config = dndConfig();
  const labels = activity?.labels ?? {};
  const attack = activity?.attack ?? {};
  const type = attack.type ?? {};
  return {
    id: `${text(item.id)}.${text(activity.id ?? activity._id)}`,
    name: activityDisplayName(item, activity),
    image: text(activity.img, item.img),
    kind: text(type.classification, item.type),
    attackType: text(type.value),
    ability: text(activity.ability ?? attack.ability),
    equipped: item.system?.equipped !== false,
    proficient: finiteNumber(item.system?.prof?.multiplier ?? item.system?.proficient) > 0,
    attackBonus: numericAttackBonus(activity),
    attackFormula: text(labels.toHit ?? labels.modifier),
    activation: activationData(activity.activation, labels),
    range: rangeData(activity.range ?? item.system?.range, { ...item.labels, ...labels }),
    damage: damageList(activity),
    properties: propertiesList(item.system?.properties, config.itemProperties ?? config.weaponProperties),
    description: descriptionOf(item)
  };
}

function resolveLocalItem(actor, value, type) {
  if (value && typeof value === "object" && typeof value.name === "string") return value;
  if (typeof value === "string") {
    const byId = actor.items?.get?.(value);
    if (byId) return byId;
  }
  return toArray(actor.items).find(item => item.type === type) ?? null;
}

function traitValueLabel(id, configuration, traitType) {
  try {
    const label = globalThis.game?.dnd5e?.documents?.Trait?.keyLabel?.(text(id), { trait: traitType });
    if (typeof label === "string" && label && label !== id) return text(label);
  } catch {
    // Fall back to the already-localized CONFIG mapping below.
  }

  const findEntry = entries => {
    if (!entries || typeof entries !== "object") return undefined;
    if (Object.hasOwn(entries, id)) return entries[id];
    for (const entry of Object.values(entries)) {
      const nested = entry && typeof entry === "object" ? findEntry(entry.children) : undefined;
      if (nested !== undefined) return nested;
    }
    return undefined;
  };
  return localizeConfigEntry(findEntry(configuration), text(id));
}

function normalizeTraitValues(trait, configuration, traitType) {
  const values = toArray(trait?.value).map(id => traitValueLabel(id, configuration, traitType));
  return uniqueStrings([...values, ...splitList(trait?.custom)]);
}

function activityDisplayName(item, activity) {
  const preparedName = text(activity?.name);
  const titleKey = text(activity?.metadata?.title,
    activity?.type === "attack" ? "DND5E.ATTACK.Title.one" : "");
  const defaultName = titleKey ? localize(titleKey, "") : "";
  return !preparedName || (defaultName && preparedName === defaultName)
    ? text(item?.name, preparedName)
    : preparedName;
}

function normalizeClasses(actor) {
  const items = toArray(actor.items);
  const subclasses = items.filter(item => item.type === "subclass");
  return items.filter(item => item.type === "class").map(item => {
    const system = item.system ?? {};
    const identifier = text(item.identifier ?? system.identifier ?? item.name).toLowerCase();
    const subclass = item.subclass ?? subclasses.find(candidate =>
      text(candidate.system?.classIdentifier).toLowerCase() === identifier
    );
    const spellcasting = item.spellcasting ?? system.spellcasting ?? {};
    return {
      id: text(item.id),
      identifier,
      name: text(item.name),
      level: integer(system.levels),
      subclass: subclass ? text(subclass.name) : "",
      hitDie: text(system.hd?.denomination),
      hitDice: {
        current: integer(system.hd?.value),
        maximum: integer(system.hd?.max ?? system.levels),
        spent: integer(system.hd?.spent)
      },
      spellcasting: {
        ability: text(spellcasting.ability),
        progression: text(spellcasting.progression, "none"),
        preparationMaximum: optionalNumber(spellcasting.preparation?.max),
        attackBonus: optionalNumber(spellcasting.attack),
        saveDc: optionalNumber(spellcasting.save)
      }
    };
  });
}

function normalizeAbilities(system) {
  const config = dndConfig();
  const result = {};
  for (const [id, semanticName] of Object.entries(ABILITY_NAMES)) {
    const ability = system.abilities?.[id] ?? {};
    const multiplier = finiteNumber(ability.saveProf?.multiplier ?? ability.proficient);
    result[semanticName] = {
      id,
      name: configLabel(config.abilities, id, semanticName),
      abbreviation: localizeConfigEntry(config.abilities?.[id]?.abbreviation, id.toUpperCase()),
      score: integer(ability.value, 10),
      modifier: integer(ability.mod, Math.floor((finiteNumber(ability.value, 10) - 10) / 2)),
      check: integer(finiteNumber(ability.mod) + finiteNumber(ability.checkBonus)),
      save: integer(ability.save?.value, finiteNumber(ability.mod) + finiteNumber(ability.saveBonus)),
      saveProficiency: multiplier,
      saveProficiencyLabel: proficiencyLabel(multiplier),
      proficient: multiplier >= 1
    };
  }
  return result;
}

function normalizeSkills(system) {
  const config = dndConfig();
  return Object.entries(system.skills ?? {}).map(([id, skill]) => {
    const multiplier = finiteNumber(skill.prof?.multiplier ?? skill.proficient ?? skill.value);
    return {
      id,
      name: configLabel(config.skills, id, id),
      ability: text(skill.ability),
      modifier: integer(skill.total, finiteNumber(skill.mod) + finiteNumber(skill.bonus)),
      passive: integer(skill.passive, 10 + finiteNumber(skill.total)),
      proficiency: multiplier,
      proficiencyLabel: proficiencyLabel(multiplier),
      proficient: multiplier >= 1
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeMovement(attributes) {
  const config = dndConfig();
  const movement = attributes.movement ?? {};
  const entries = Object.keys(config.movementTypes ?? {}).flatMap(id => {
    const distance = optionalNumber(movement[id]);
    return distance && distance > 0 ? [{
      id,
      name: configLabel(config.movementTypes, id, id),
      distance,
      units: text(movement.units)
    }] : [];
  });
  if (text(movement.special)) entries.push({
    id: "special",
    name: localize("DND5E.Special", "Special"),
    distance: null,
    units: "",
    details: text(movement.special)
  });
  return entries;
}

function normalizeSenses(attributes) {
  const config = dndConfig();
  const senses = attributes.senses ?? {};
  // dnd5e 5.1 stores configured ranges directly on senses; 5.3 moved them
  // into a mapping field while retaining migration shims for older data.
  const ranges = senses.ranges ?? senses;
  const result = Object.keys(config.senses ?? {}).flatMap(id => {
    const distance = optionalNumber(ranges[id]);
    return distance && distance > 0 ? [{
      id,
      name: configLabel(config.senses, id, id),
      distance,
      units: text(senses.units),
      details: ""
    }] : [];
  });
  for (const [index, details] of splitList(senses.special).entries()) result.push({
    id: `special-${index + 1}`,
    name: localize("DND5E.Special", "Special"),
    distance: null,
    units: "",
    details
  });
  return result;
}

function normalizeInventory(actor) {
  const config = dndConfig();
  const items = toArray(actor.items);
  const byId = new Map(items.map(item => [item.id, item]));
  return sortByName(items.filter(item => INVENTORY_ITEM_TYPES.includes(item.type)).map(item => {
    const system = item.system ?? {};
    const container = byId.get(system.container);
    return {
      id: text(item.id),
      name: text(item.name),
      type: text(item.type),
      typeName: configLabel(globalThis.CONFIG?.Item?.typeLabels, item.type, item.type),
      image: text(item.img),
      quantity: finiteNumber(system.quantity, 1),
      weight: {
        value: finiteNumber(system.weight?.value),
        total: finiteNumber(system.totalWeight, finiteNumber(system.weight?.value) * finiteNumber(system.quantity, 1)),
        units: text(system.weight?.units)
      },
      price: {
        value: finiteNumber(system.price?.value),
        denomination: text(system.price?.denomination)
      },
      rarity: configLabel(config.itemRarity, system.rarity, text(system.rarity)),
      equipped: "equipped" in system ? Boolean(system.equipped) : null,
      attuned: "attuned" in system ? Boolean(system.attuned) : null,
      container: container ? { id: text(container.id), name: text(container.name) } : null,
      uses: itemUses(item),
      properties: propertiesList(system.properties, config.itemProperties),
      description: descriptionOf(item)
    };
  }));
}

function normalizeFeatures(actor) {
  const config = dndConfig();
  return sortByName(toArray(actor.items).filter(item => item.type === "feat").map(item => {
    const system = item.system ?? {};
    const activity = primaryActivity(item);
    return {
      id: text(item.id),
      name: text(item.name),
      image: text(item.img),
      category: text(system.type?.value),
      categoryName: configLabel(config.featureTypes, system.type?.value, text(system.type?.value)),
      subtype: text(system.type?.subtype),
      requirements: text(system.requirements),
      activation: activationData(activity?.activation, activity?.labels ?? item.labels),
      uses: itemUses(item),
      properties: propertiesList(system.properties, config.itemProperties),
      description: descriptionOf(item)
    };
  }));
}

function normalizeSpells(actor) {
  const config = dndConfig();
  return toArray(actor.items).filter(item => item.type === "spell").map(item => {
    const system = item.system ?? {};
    const activity = primaryActivity(item);
    const properties = toArray(system.properties);
    return {
      id: text(item.id),
      name: text(item.name),
      image: text(item.img),
      level: integer(system.level),
      levelName: configLabel(config.spellLevels, system.level, system.level ? `Level ${system.level}` : "Cantrip"),
      school: text(system.school),
      schoolName: configLabel(config.spellSchools, system.school, text(system.school)),
      method: text(system.method),
      methodName: configLabel(config.spellcasting ?? config.spellPreparationModes, system.method, text(system.method)),
      prepared: finiteNumber(system.prepared) > 0,
      preparationState: integer(system.prepared),
      ritual: properties.includes("ritual"),
      concentration: properties.includes("concentration") || Boolean(system.duration?.concentration),
      activation: activationData(system.activation ?? activity?.activation, { ...item.labels, ...activity?.labels }),
      range: rangeData(system.range ?? activity?.range, { ...item.labels, ...activity?.labels }),
      duration: durationData(system.duration ?? activity?.duration, { ...item.labels, ...activity?.labels }),
      components: propertiesList(system.properties, config.spellProperties ?? config.itemProperties),
      materials: text(system.materials?.value),
      // dnd5e 5.1 stores this semantic identifier as sourceClass. In 5.3 the
      // prepared classIdentifier getter resolves the newer sourceItem field.
      sourceClass: text(system.classIdentifier ?? system.sourceClass),
      description: descriptionOf(item)
    };
  }).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

function normalizeSpellcasting(system, classes) {
  const config = dndConfig();
  const attributes = system.attributes ?? {};
  const ability = text(attributes.spellcasting);
  const slots = Object.entries(system.spells ?? {}).flatMap(([id, slot]) => {
    const maximum = optionalNumber(slot?.max);
    if (!maximum && !optionalNumber(slot?.value)) return [];
    return [{
      id,
      level: integer(slot?.level, id === "pact" ? 0 : id.replace("spell", "")),
      label: text(slot?.label, configLabel(config.spellLevels, slot?.level, id)),
      current: integer(slot?.value),
      maximum: integer(slot?.max),
      override: optionalNumber(slot?.override),
      pact: id === "pact"
    }];
  });
  return {
    ability,
    abilityName: configLabel(config.abilities, ability, ability),
    modifier: integer(attributes.spell?.mod),
    attackBonus: integer(attributes.spell?.attack),
    saveDc: integer(attributes.spell?.dc),
    classes: classes.filter(entry => entry.spellcasting.progression !== "none").map(entry => ({
      identifier: entry.identifier,
      name: entry.name,
      ability: entry.spellcasting.ability,
      progression: entry.spellcasting.progression,
      preparationMaximum: entry.spellcasting.preparationMaximum,
      attackBonus: entry.spellcasting.attackBonus,
      saveDc: entry.spellcasting.saveDc
    })),
    slots
  };
}

function normalizeResources(system) {
  return Object.entries(system.resources ?? {}).flatMap(([id, resource]) => {
    const maximum = finiteNumber(resource?.max);
    const label = text(resource?.label);
    if (!label && !maximum) return [];
    return [{
      id,
      name: label || id,
      current: finiteNumber(resource?.value),
      maximum,
      recovery: resource?.sr ? "shortRest" : resource?.lr ? "longRest" : ""
    }];
  });
}

function normalizeCurrency(system) {
  const config = dndConfig();
  const denominations = Object.entries(system.currency ?? {}).map(([id, value]) => ({
    id,
    name: configLabel(config.currencies, id, id.toUpperCase()),
    value: finiteNumber(value)
  }));
  return {
    denominations,
    pp: finiteNumber(system.currency?.pp),
    gp: finiteNumber(system.currency?.gp),
    ep: finiteNumber(system.currency?.ep),
    sp: finiteNumber(system.currency?.sp),
    cp: finiteNumber(system.currency?.cp)
  };
}

function currentRulesVersion() {
  try {
    const setting = globalThis.game?.settings?.get?.("dnd5e", "rulesVersion");
    return setting === "modern" ? "2024" : setting === "legacy" ? "2014" : text(setting);
  } catch {
    return "";
  }
}

export class Dnd5eCharacterAdapter extends CharacterAdapter {
  supports(actor) {
    return globalThis.game?.system?.id === SUPPORTED_SYSTEM_ID && actor?.type === "character";
  }

  async convert(actor) {
    if (!this.supports(actor)) throw new Error("Dnd5eCharacterAdapter only supports dnd5e character Actors");

    const rollData = actor.getRollData({ deterministic: true });
    const system = actor.system ?? rollData;
    const effective = {
      ...system,
      abilities: rollData.abilities ?? system.abilities,
      skills: rollData.skills ?? system.skills,
      spells: rollData.spells ?? system.spells,
      attributes: rollData.attributes ?? system.attributes,
      currency: rollData.currency ?? system.currency,
      details: rollData.details ?? system.details
    };
    const config = dndConfig();
    const attributes = effective.attributes ?? {};
    const details = effective.details ?? {};
    const traits = effective.traits ?? system.traits ?? {};
    const classes = normalizeClasses(actor);
    const race = resolveLocalItem(actor, system.details?.race, "race");
    const background = resolveLocalItem(actor, system.details?.background, "background");
    const movement = normalizeMovement(attributes);
    const user = toArray(globalThis.game?.users).find(candidate => candidate.character?.id === actor.id);
    const attacks = toArray(actor.items).flatMap(item =>
      activityList(item).filter(activity => activity.type === "attack").map(activity => normalizeAttack(item, activity))
    );

    const exportData = {
      schemaVersion: CHARACTER_EXPORT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      source: {
        system: SUPPORTED_SYSTEM_ID,
        systemVersion: text(globalThis.game?.system?.version),
        actorId: text(actor.id),
        actorUuid: text(actor.uuid)
      },
      character: {
        name: text(actor.name, localize("CHARACTER-EXPORTER.Fallback.Unnamed", "Unnamed Character")),
        portrait: text(actor.img),
        level: integer(details.level, classes.reduce((sum, entry) => sum + entry.level, 0)),
        proficiencyBonus: integer(attributes.prof),
        inspiration: Boolean(attributes.inspiration),
        classes,
        species: race ? { name: text(race.name), description: descriptionOf(race) } : { name: "", description: "" },
        background: background
          ? { name: text(background.name), description: descriptionOf(background) }
          : { name: "", description: "" },
        alignment: text(details.alignment),
        playerName: text(user?.name),
        size: {
          id: text(traits.size),
          name: configLabel(config.actorSizes, traits.size, text(traits.size))
        },
        experience: {
          current: finiteNumber(details.xp?.value),
          minimum: finiteNumber(details.xp?.min),
          maximum: optionalNumber(details.xp?.max),
          percentage: finiteNumber(details.xp?.pct)
        }
      },
      abilities: normalizeAbilities(effective),
      combat: {
        armorClass: integer(attributes.ac?.value),
        armorClassLabel: text(attributes.ac?.label),
        initiative: integer(attributes.init?.total),
        initiativeAbility: text(attributes.init?.ability, config.defaultAbilities?.initiative ?? "dex"),
        speed: movement.find(entry => entry.id === "walk") ?? null,
        movement,
        hp: {
          current: integer(attributes.hp?.value),
          maximum: integer(attributes.hp?.max),
          effectiveMaximum: integer(attributes.hp?.effectiveMax, attributes.hp?.max),
          temporary: integer(attributes.hp?.temp),
          temporaryMaximum: integer(attributes.hp?.tempmax)
        },
        hitDice: classes.map(entry => ({
          className: entry.name,
          denomination: entry.hitDie,
          current: entry.hitDice.current,
          maximum: entry.hitDice.maximum,
          spent: entry.hitDice.spent
        })),
        deathSaves: {
          successes: integer(attributes.death?.success),
          failures: integer(attributes.death?.failure)
        },
        exhaustion: integer(attributes.exhaustion),
        passivePerception: integer(effective.skills?.prc?.passive, 10),
        encumbrance: {
          current: finiteNumber(attributes.encumbrance?.value),
          maximum: finiteNumber(attributes.encumbrance?.max),
          percentage: finiteNumber(attributes.encumbrance?.pct)
        },
        attunement: {
          current: integer(attributes.attunement?.value),
          maximum: integer(attributes.attunement?.max)
        }
      },
      skills: normalizeSkills(effective),
      senses: normalizeSenses(attributes),
      proficiencies: {
        armor: normalizeTraitValues(traits.armorProf, config.armorProficiencies, "armor"),
        weapons: normalizeTraitValues(traits.weaponProf, config.weaponProficiencies, "weapon"),
        tools: Object.entries(effective.tools ?? {}).map(([id, tool]) => {
          const proficiency = finiteNumber(tool.prof?.multiplier ?? tool.value);
          return {
            id,
            name: traitValueLabel(id, config.toolProficiencies ?? config.tools, "tool"),
            ability: text(tool.ability),
            modifier: integer(tool.total, finiteNumber(tool.mod) + finiteNumber(tool.bonus)),
            proficiency,
            proficiencyLabel: proficiencyLabel(proficiency)
          };
        }).sort((a, b) => a.name.localeCompare(b.name)),
        // dnd5e prepares nested language categories into localized labels. Use
        // those as the canonical display list; combining them with raw ids
        // duplicates every language on 5.1.x and 5.3.x Actors.
        languages: toArray(traits.languages?.labels?.languages).length
          ? uniqueStrings(toArray(traits.languages.labels.languages))
          : normalizeTraitValues(traits.languages, config.languages, "languages"),
        communication: toArray(traits.languages?.labels?.ranged).map(value => text(value)).filter(Boolean)
      },
      defenses: {
        damageResistances: normalizeTraitValues(traits.dr, config.damageTypes, "dr"),
        damageImmunities: normalizeTraitValues(traits.di, config.damageTypes, "di"),
        damageVulnerabilities: normalizeTraitValues(traits.dv, config.damageTypes, "dv"),
        conditionImmunities: normalizeTraitValues(
          traits.ci, config.conditionTypes ?? config.conditionEffects, "ci"
        )
      },
      attacks: sortByName(attacks),
      inventory: normalizeInventory(actor),
      features: normalizeFeatures(actor),
      spellcasting: normalizeSpellcasting(effective, classes),
      spells: normalizeSpells(actor),
      resources: normalizeResources(effective),
      currency: normalizeCurrency(effective),
      notes: {
        personalityTraits: text(details.trait),
        ideals: text(details.ideal),
        bonds: text(details.bond),
        flaws: text(details.flaw),
        biography: cleanRichText(details.biography?.value),
        publicBiography: cleanRichText(details.biography?.public),
        appearance: text(details.appearance),
        age: text(details.age),
        gender: text(details.gender),
        height: text(details.height),
        weight: text(details.weight),
        eyes: text(details.eyes),
        hair: text(details.hair),
        skin: text(details.skin),
        faith: text(details.faith)
      },
      extensions: {
        dnd5e: {
          rulesVersion: currentRulesVersion(),
          tier: integer(details.tier),
          concentrationSave: integer(attributes.concentration?.save),
          concentrationLimit: integer(attributes.concentration?.limit),
          attunementMaximum: integer(attributes.attunement?.max)
        }
      }
    };

    return exportData;
  }
}
