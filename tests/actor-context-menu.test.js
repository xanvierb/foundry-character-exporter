import test from "node:test";
import assert from "node:assert/strict";

import { registerActorContextMenu } from "../scripts/foundry/actor-context-menu.js";

function installFoundryGlobals(t, generation) {
  const previous = {
    CONST: globalThis.CONST,
    HTMLElement: globalThis.HTMLElement,
    Hooks: globalThis.Hooks,
    game: globalThis.game
  };
  t.after(() => Object.assign(globalThis, previous));

  class MockElement {
    constructor(actorId) {
      this.dataset = { documentId: actorId };
    }

    closest() {
      return this;
    }
  }

  const actor = {
    id: "actor-ada",
    type: "character",
    testUserPermission: (_user, permission) => permission === 3
  };
  let contextHook;
  globalThis.HTMLElement = MockElement;
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };
  globalThis.game = {
    release: { generation },
    system: { id: "dnd5e" },
    user: { id: "user-one" },
    actors: new Map([[actor.id, actor]]),
    i18n: { localize: key => key }
  };
  globalThis.Hooks = {
    on(name, callback) {
      assert.equal(name, "getActorContextOptions");
      contextHook = callback;
    }
  };

  return {
    actor,
    element: new MockElement(actor.id),
    getHook: () => contextHook
  };
}

function installMenu(t, generation) {
  const foundry = installFoundryGlobals(t, generation);
  const exportedActorIds = [];
  registerActorContextMenu({
    adapterRegistry: { getAdapter: actor => actor ? {} : null },
    exportService: {
      async exportActor(actorId) {
        exportedActorIds.push(actorId);
        return true;
      }
    }
  });
  const menuItems = [];
  foundry.getHook()({}, menuItems);
  return { ...foundry, exportedActorIds, menuItem: menuItems[0] };
}

test("Foundry v13 receives name/condition/callback and supports jQuery targets", async t => {
  const { element, exportedActorIds, menuItem } = installMenu(t, 13);
  const jqueryTarget = { 0: element, length: 1, get: index => index === 0 ? element : undefined };

  assert.equal(menuItem.name, "Export Character");
  assert.equal(menuItem.label, undefined);
  assert.equal(menuItem.icon, '<i class="fas fa-file-export" aria-hidden="true"></i>');
  assert.equal(typeof menuItem.condition, "function");
  assert.equal(typeof menuItem.callback, "function");
  assert.equal(menuItem.condition(jqueryTarget), true);

  await menuItem.callback(jqueryTarget);
  assert.deepEqual(exportedActorIds, ["actor-ada"]);
});

test("Foundry v14 receives label/visible/onClick and supports HTMLElement targets", async t => {
  const { element, exportedActorIds, menuItem } = installMenu(t, 14);

  assert.equal(menuItem.label, "Export Character");
  assert.equal(menuItem.name, undefined);
  assert.equal(menuItem.icon, "fas fa-file-export");
  assert.equal(typeof menuItem.visible, "function");
  assert.equal(typeof menuItem.onClick, "function");
  assert.equal(menuItem.visible(element), true);

  await menuItem.onClick({}, element);
  assert.deepEqual(exportedActorIds, ["actor-ada"]);
});

