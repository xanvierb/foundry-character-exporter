import test from "node:test";
import assert from "node:assert/strict";

import { Dnd5eCharacterAdapter } from "../scripts/adapters/dnd5e-character-adapter.js";
import { assertCharacterExportData } from "../scripts/export/character-export-data.js";

class MockCollection {
  constructor(entries) {
    this.contents = entries;
    this.map = new Map(entries.map(entry => [entry.id, entry]));
  }

  get(id) {
    return this.map.get(id);
  }

  values() {
    return this.contents.values();
  }

  [Symbol.iterator]() {
    return this.contents[Symbol.iterator]();
  }
}

function proficiency(multiplier, flat) {
  return { multiplier, flat, term: String(flat) };
}

function makeActor() {
  const abilities = Object.fromEntries([
    ["str", 16], ["dex", 14], ["con", 13], ["int", 10], ["wis", 12], ["cha", 18]
  ].map(([id, score]) => {
    const modifier = Math.floor((score - 10) / 2);
    const proficient = ["con", "cha"].includes(id);
    return [id, {
      value: score,
      mod: modifier,
      checkBonus: 0,
      saveBonus: 0,
      save: { value: modifier + (proficient ? 3 : 0) },
      saveProf: proficiency(proficient ? 1 : 0, proficient ? 3 : 0),
      proficient: proficient ? 1 : 0
    }];
  }));

  const classItem = {
    id: "class-paladin",
    type: "class",
    name: "Paladin",
    identifier: "paladin",
    system: {
      levels: 3,
      hd: { denomination: "d10", value: 2, max: 3, spent: 1 },
      spellcasting: {
        ability: "cha",
        progression: "half",
        preparation: { max: 5 },
        attack: 7,
        save: 15
      }
    }
  };
  const secondClass = {
    id: "class-warlock",
    type: "class",
    name: "Warlock",
    identifier: "warlock",
    system: {
      levels: 2,
      hd: { denomination: "d8", value: 2, max: 2, spent: 0 },
      spellcasting: {
        ability: "cha",
        progression: "pact",
        preparation: { max: 0 },
        attack: 7,
        save: 15
      }
    }
  };
  const subclass = {
    id: "subclass-devotion",
    type: "subclass",
    name: "Oath of Devotion",
    system: { classIdentifier: "paladin", description: { value: "" } }
  };
  const race = {
    id: "race-human",
    type: "race",
    name: "Human",
    system: { description: { value: "<p>Versatile folk.</p>" } }
  };
  const background = {
    id: "background-sage",
    type: "background",
    name: "Sage",
    system: { description: { value: "<p>A life of study.</p>" } }
  };
  const attackActivity = {
    id: "attack-longsword",
    type: "attack",
    name: "Longsword",
    ability: "str",
    attack: { type: { classification: "weapon", value: "melee" } },
    activation: { type: "action", value: 1 },
    range: { reach: 5, units: "ft" },
    damage: { parts: [] },
    labels: {
      modifier: "6",
      toHit: "+6",
      activation: "Action",
      reach: "5 ft",
      damages: [{ formula: "1d8 + 3", label: "1d8 + 3 Slashing", damageType: "slashing" }]
    }
  };
  const weapon = {
    id: "weapon-longsword",
    type: "weapon",
    name: "Longsword",
    img: "icons/longsword.webp",
    labels: { range: "5 ft" },
    system: {
      equipped: true,
      attuned: false,
      proficient: 1,
      prof: proficiency(1, 3),
      quantity: 1,
      weight: { value: 3, units: "lb" },
      totalWeight: 3,
      price: { value: 15, denomination: "gp" },
      rarity: "",
      properties: new Set(["ver"]),
      activities: new MockCollection([attackActivity]),
      description: { value: "<p>A versatile blade.</p>" }
    }
  };
  const feature = {
    id: "feat-lay-on-hands",
    type: "feat",
    name: "Lay on Hands",
    img: "icons/hand.webp",
    system: {
      type: { value: "class", subtype: "" },
      requirements: "Paladin 1",
      properties: new Set(),
      uses: { value: 15, max: 15, spent: 0, recovery: [{ period: "lr", type: "recoverAll" }] },
      activities: new MockCollection([]),
      description: { value: "<p>Restore a pool of hit points.</p>" }
    }
  };
  const spell = {
    id: "spell-bless",
    type: "spell",
    name: "Bless",
    img: "icons/bless.webp",
    labels: { activation: "1 Action", range: "30 ft", duration: "1 Minute" },
    system: {
      level: 1,
      school: "enc",
      method: "spell",
      prepared: 1,
      properties: new Set(["vocal", "somatic", "material", "concentration"]),
      materials: { value: "A sprinkling of holy water" },
      classIdentifier: "paladin",
      activation: { type: "action", value: 1 },
      range: { value: 30, units: "ft" },
      duration: { value: 1, units: "minute", concentration: true },
      activities: new MockCollection([]),
      description: { value: "<p>Bless up to three creatures.</p>" }
    }
  };

  const skills = {
    ath: { ability: "str", total: 6, passive: 16, prof: proficiency(1, 3), proficient: 1 },
    prc: { ability: "wis", total: 1, passive: 11, prof: proficiency(0, 0), proficient: 0 }
  };
  const system = {
    abilities,
    skills,
    tools: {
      smith: { ability: "str", total: 6, prof: proficiency(1, 3), value: 1 }
    },
    attributes: {
      prof: 3,
      inspiration: true,
      ac: { value: 18, label: "Chain Mail & Shield" },
      init: { total: 2, ability: "dex" },
      movement: { walk: 30, swim: 15, units: "ft", special: "" },
      hp: { value: 38, max: 42, effectiveMax: 42, temp: 4, tempmax: 0 },
      death: { success: 1, failure: 0 },
      exhaustion: 0,
      attunement: { value: 1, max: 3 },
      encumbrance: { value: 48, max: 240, pct: 20 },
      senses: { ranges: { darkvision: 60 }, units: "ft", special: "Divine awareness" },
      spellcasting: "cha",
      spell: { mod: 4, attack: 7, dc: 15 },
      concentration: { save: 4, limit: 1 }
    },
    details: {
      level: 5,
      tier: 2,
      alignment: "Lawful Good",
      race: "race-human",
      background: "background-sage",
      xp: { value: 6500, min: 6500, max: 14000, pct: 0 },
      trait: "Always impeccably polite.",
      ideal: "Knowledge.",
      bond: "My old academy.",
      flaw: "I overthink everything.",
      biography: { value: "<p>Raised among dusty tomes.</p>", public: "" },
      appearance: "Silver armor and blue cloak."
    },
    traits: {
      size: "med",
      armorProf: { value: new Set(["hvy"]), custom: "" },
      weaponProf: { value: new Set(["mar"]), custom: "" },
      languages: { value: new Set(["common", "celestial"]), custom: "", labels: {
        languages: ["Common", "Celestial"], ranged: []
      } },
      dr: { value: new Set(["radiant"]), custom: "" },
      di: { value: new Set(), custom: "" },
      dv: { value: new Set(), custom: "" },
      ci: { value: new Set(["frightened"]), custom: "" }
    },
    spells: {
      spell1: { level: 1, label: "1st", value: 3, max: 4 },
      pact: { level: 1, label: "Pact", value: 1, max: 2 }
    },
    resources: {
      primary: { label: "Channel Divinity", value: 1, max: 1, sr: true, lr: false },
      secondary: { label: "", value: 0, max: 0, sr: false, lr: false },
      tertiary: { label: "", value: 0, max: 0, sr: false, lr: false }
    },
    currency: { pp: 1, gp: 42, ep: 0, sp: 9, cp: 3 }
  };
  const items = new MockCollection([
    classItem, secondClass, subclass, race, background, weapon, feature, spell
  ]);
  return {
    id: "actor-ada",
    uuid: "Actor.actor-ada",
    type: "character",
    name: "Dame Ada",
    img: "portraits/ada.webp",
    system,
    items,
    getRollData() {
      return system;
    }
  };
}

test("dnd5e adapter creates normalized multiclass CharacterExportData", async t => {
  const previous = {
    game: globalThis.game,
    CONFIG: globalThis.CONFIG,
    foundry: globalThis.foundry,
    document: globalThis.document
  };
  t.after(() => Object.assign(globalThis, previous));

  globalThis.game = {
    system: { id: "dnd5e", version: "5.3.3" },
    settings: { get: () => "modern" },
    users: [{ name: "Player One", character: { id: "actor-ada" } }],
    i18n: { localize: value => value }
  };
  globalThis.CONFIG = {
    DND5E: {
      abilities: {
        str: { label: "Strength", abbreviation: "STR" }, dex: { label: "Dexterity", abbreviation: "DEX" },
        con: { label: "Constitution", abbreviation: "CON" }, int: { label: "Intelligence", abbreviation: "INT" },
        wis: { label: "Wisdom", abbreviation: "WIS" }, cha: { label: "Charisma", abbreviation: "CHA" }
      },
      skills: { ath: { label: "Athletics" }, prc: { label: "Perception" } },
      movementTypes: { walk: { label: "Walk" }, swim: { label: "Swim" } },
      senses: { darkvision: { label: "Darkvision" } },
      actorSizes: { med: { label: "Medium" } },
      defaultAbilities: { initiative: "dex" },
      armorProficiencies: { hvy: "Heavy Armor" },
      weaponProficiencies: { mar: "Martial Weapons" },
      languages: { common: "Common", celestial: "Celestial" },
      tools: { smith: "Smith's Tools" },
      damageTypes: { radiant: "Radiant", slashing: "Slashing" },
      conditionTypes: { frightened: "Frightened" },
      itemProperties: {
        ver: "Versatile", vocal: "Verbal", somatic: "Somatic",
        material: "Material", concentration: "Concentration"
      },
      spellLevels: { 1: "1st Level" },
      spellSchools: { enc: { label: "Enchantment" } },
      spellcasting: { spell: { label: "Spellcasting" } },
      featureTypes: { class: { label: "Class Feature" } },
      itemRarity: {},
      currencies: { pp: "Platinum", gp: "Gold", ep: "Electrum", sp: "Silver", cp: "Copper" }
    },
    Item: { typeLabels: { weapon: "Weapon" } }
  };
  globalThis.foundry = { utils: { cleanHTML: value => value } };
  globalThis.document = undefined;

  const adapter = new Dnd5eCharacterAdapter();
  const data = assertCharacterExportData(await adapter.convert(makeActor()));
  assert.equal(data.character.name, "Dame Ada");
  assert.equal(data.character.playerName, "Player One");
  assert.equal(data.character.classes.length, 2);
  assert.equal(data.character.classes[0].subclass, "Oath of Devotion");
  assert.deepEqual(data.character.classes.map(entry => entry.level), [3, 2]);
  assert.equal(data.abilities.charisma.score, 18);
  assert.equal(data.abilities.charisma.save, 7);
  assert.equal(data.skills.find(skill => skill.id === "ath").modifier, 6);
  assert.equal(data.combat.armorClass, 18);
  assert.equal(data.combat.speed.distance, 30);
  assert.equal(data.senses[0].distance, 60);
  assert.equal(data.attacks[0].attackBonus, 6);
  assert.equal(data.attacks[0].damage[0].formula, "1d8 + 3");
  assert.equal(data.inventory[0].name, "Longsword");
  assert.equal(data.features[0].uses.maximum, 15);
  assert.equal(data.spellcasting.classes.length, 2);
  assert.equal(data.spellcasting.slots.find(slot => slot.pact).maximum, 2);
  assert.equal(data.spells[0].prepared, true);
  assert.equal(data.spells[0].methodName, "Spellcasting");
  assert.deepEqual(data.spells[0].components.map(component => component.name), [
    "Verbal", "Somatic", "Material", "Concentration"
  ]);
  assert.equal(data.extensions.dnd5e.rulesVersion, "2024");
  assert.doesNotThrow(() => JSON.stringify(data));
  assert.equal(JSON.stringify(data).includes('"system"'), true, "source.system is an intentional semantic field");
  assert.equal("actor" in data, false);
});

test("dnd5e adapter rejects NPCs and other systems", async t => {
  const previousGame = globalThis.game;
  t.after(() => {
    globalThis.game = previousGame;
  });
  globalThis.game = { system: { id: "dnd5e" } };
  const adapter = new Dnd5eCharacterAdapter();
  assert.equal(adapter.supports({ type: "npc" }), false);
  await assert.rejects(adapter.convert({ type: "npc" }), /only supports/u);
});
