import test from "node:test";
import assert from "node:assert/strict";

import { AdapterRegistry } from "../scripts/adapters/adapter-registry.js";
import {
  TemplateDefinitionError,
  TemplateRegistry
} from "../scripts/export/template-registry.js";

const validTemplate = {
  id: "test.clean",
  name: "Clean",
  version: "1.0.0",
  schemaVersion: 1,
  renderer: "html",
  template: "modules/test/templates/clean.hbs",
  stylesheet: "modules/test/styles/clean.css"
};

test("template registry validates, filters, freezes, and unregisters definitions", () => {
  const registry = new TemplateRegistry();
  const registered = registry.register(validTemplate);
  assert.equal(registered.id, "test.clean");
  assert.ok(Object.isFrozen(registered));
  assert.ok(Object.isFrozen(registered.stylesheets));
  assert.equal(registry.getCompatible(1).length, 1);
  assert.equal(registry.getCompatible(2).length, 0);
  assert.equal(registry.getTemplates({ renderer: "html" }).length, 1);
  assert.equal(registry.unregister("test.clean"), true);
  assert.equal(registry.getTemplates().length, 0);
});

test("template registry rejects duplicates, traversal, protocols, and unsupported renderers", () => {
  const registry = new TemplateRegistry();
  registry.register(validTemplate);
  assert.throws(() => registry.register(validTemplate), TemplateDefinitionError);
  assert.throws(() => registry.register({
    ...validTemplate,
    id: "test.bad-path",
    template: "modules/test/../secret.hbs"
  }), /safe Foundry package path/u);
  assert.throws(() => registry.register({
    ...validTemplate,
    id: "test.remote",
    template: "https://example.com/sheet.hbs"
  }), /safe Foundry package path/u);
  assert.throws(() => registry.register({
    ...validTemplate,
    id: "test.pdf",
    renderer: "pdf"
  }), /Unsupported renderer/u);
});

test("adapter registry selects highest-priority compatible adapter", () => {
  const registry = new AdapterRegistry();
  const fallback = { supports: () => true, convert: async () => ({ fallback: true }) };
  const preferred = { supports: actor => actor.type === "character", convert: async () => ({ preferred: true }) };
  registry.register("fallback", fallback, { priority: 0 });
  registry.register("preferred", preferred, { priority: 10 });
  assert.equal(registry.getAdapter({ type: "character" }), preferred);
  assert.equal(registry.getAdapter({ type: "npc" }), fallback);
  assert.equal(registry.unregister("preferred"), true);
});
