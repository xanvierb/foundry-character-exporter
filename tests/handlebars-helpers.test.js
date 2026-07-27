import test from "node:test";
import assert from "node:assert/strict";

import { registerHandlebarsHelpers } from "../scripts/foundry/handlebars-helpers.js";

test("join helper ignores Handlebars' implicit options argument", t => {
  const previousHandlebars = globalThis.Handlebars;
  t.after(() => {
    globalThis.Handlebars = previousHandlebars;
  });

  const helpers = new Map();
  globalThis.Handlebars = {
    registerHelper(name, helper) {
      helpers.set(name, helper);
    }
  };

  registerHandlebarsHelpers();
  const join = helpers.get("characterExporterJoin");
  const values = [{ name: "Verbal" }, { name: "Somatic" }, { name: "Material" }];

  assert.equal(join(values, { hash: {} }), "Verbal, Somatic, Material");
  assert.equal(join(values, " / ", { hash: {} }), "Verbal / Somatic / Material");
  assert.equal(join(values, { hash: {} }).includes("[object Object]"), false);

  const equal = helpers.get("characterExporterEqual");
  assert.equal(equal(3, 3), true);
  assert.equal(equal(3, "3"), true);
  assert.equal(equal(3, 4), false);
});
