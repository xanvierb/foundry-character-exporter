import test from "node:test";
import assert from "node:assert/strict";

import { CharacterExportService } from "../scripts/export/character-export-service.js";
import { PrintView } from "../scripts/ui/print-view.js";
import { TemplateSelectionDialog } from "../scripts/ui/template-selection-dialog.js";

function preserveGlobals(t, names) {
  const previous = Object.fromEntries(names.map(name => [name, globalThis[name]]));
  t.after(() => Object.assign(globalThis, previous));
}

function minimalData() {
  return {
    schemaVersion: 1,
    character: { name: "Ada" },
    abilities: {}, combat: {}, proficiencies: {}, spellcasting: {}, currency: {}, notes: {}, extensions: {},
    skills: [], senses: [], attacks: [], inventory: [], features: [], spells: [], resources: []
  };
}

test("template selection uses DialogV2 and opens the print window from the submit callback", async t => {
  preserveGlobals(t, ["document", "foundry", "game", "window"]);
  let dialogOptions;
  let popupArguments;
  const printWindow = { document: {} };
  const contentElement = { innerHTML: "" };

  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "div");
      return contentElement;
    }
  };
  globalThis.game = { i18n: { localize: key => key } };
  globalThis.window = {
    open(...args) {
      popupArguments = args;
      return printWindow;
    }
  };
  globalThis.foundry = {
    applications: {
      api: {
        DialogV2: {
          async wait(options) {
            dialogOptions = options;
            const exportButton = options.buttons.find(button => button.action === "export");
            return exportButton.callback({}, {
              form: { elements: { templateId: { value: "default" } } }
            }, {});
          }
        }
      },
      handlebars: {
        async renderTemplate(path, data) {
          assert.match(path, /template-selection\.hbs$/u);
          assert.equal(data.actorName, "Ada");
          return '<input name="templateId" value="default">';
        }
      }
    }
  };

  const selection = await new TemplateSelectionDialog().choose([{
    id: "default", name: "Default", description: "", version: "1.0.0", schemaVersion: 1
  }], "Ada");

  assert.equal(contentElement.innerHTML, '<input name="templateId" value="default">');
  assert.equal(dialogOptions.modal, true);
  assert.equal(selection.templateId, "default");
  assert.equal(selection.printWindow, printWindow);
  assert.equal(popupArguments[0], "");
  assert.match(popupArguments[1], /^character-exporter-/u);
});

test("print view writes standalone HTML and wires non-printing Print and Close controls", t => {
  preserveGlobals(t, ["document", "game", "location"]);
  const listeners = new Map();
  let writtenHtml = "";
  let printed = false;
  let closeCalled = false;
  const targetWindow = {
    closed: false,
    opener: {},
    document: {
      open() {},
      write(html) { writtenHtml = html; },
      close() {},
      querySelector(selector) {
        return {
          addEventListener(type, listener) {
            assert.equal(type, "click");
            listeners.set(selector, listener);
          }
        };
      }
    },
    print() { printed = true; },
    close() { closeCalled = true; }
  };
  globalThis.document = { baseURI: "https://foundry.example/game", documentElement: { lang: "en" } };
  globalThis.location = { href: "https://foundry.example/game" };
  globalThis.game = { i18n: { localize: key => key } };

  new PrintView().render(targetWindow, {
    html: "<article><h1>Ada</h1></article>",
    stylesheets: ["modules/character-exporter/templates/sheets/default/sheet.css"]
  }, "Ada");

  assert.match(writtenHtml, /^<!doctype html>/u);
  assert.match(writtenHtml, /https:\/\/foundry\.example\/modules\/character-exporter\/templates\/sheets\/default\/sheet\.css/u);
  assert.match(writtenHtml, /character-exporter-controls \{ display: none !important; \}/u);
  assert.match(writtenHtml, /<article><h1>Ada<\/h1><\/article>/u);
  assert.equal(targetWindow.opener, null);

  listeners.get('[data-action="print"]')();
  listeners.get('[data-action="close"]')();
  assert.equal(printed, true);
  assert.equal(closeCalled, true);
});

test("export service completes conversion, rendering, and print-view delivery", async t => {
  preserveGlobals(t, ["CONST", "game", "ui"]);
  const events = [];
  const actor = {
    id: "actor-ada",
    name: "Ada",
    type: "character",
    testUserPermission: () => true
  };
  const template = { id: "default", schemaVersion: 1, renderer: "html" };
  const printWindow = {};
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };
  globalThis.game = {
    system: { id: "dnd5e" },
    user: { id: "user-one" },
    actors: new Map([[actor.id, actor]]),
    i18n: { localize: key => key, format: key => key }
  };
  globalThis.ui = { notifications: { error() {}, warn() {} } };

  const adapter = {
    async convert(receivedActor) {
      events.push(["convert", receivedActor.id]);
      return minimalData();
    }
  };
  const service = new CharacterExportService({
    adapterRegistry: { getAdapter: () => adapter },
    templateRegistry: {
      getCompatible: () => [template],
      get: id => id === template.id ? template : null
    },
    selector: {
      async choose() {
        events.push(["choose"]);
        return { templateId: template.id, printWindow };
      }
    },
    renderer: {
      async render(receivedTemplate, data) {
        events.push(["render", receivedTemplate.id, data.character.name]);
        return { html: "<h1>Ada</h1>", stylesheets: [] };
      }
    },
    printView: {
      showLoading(window, name) { events.push(["loading", window === printWindow, name]); },
      render(window, _rendered, name) { events.push(["printView", window === printWindow, name]); }
    }
  });

  assert.equal(await service.exportActor(actor.id), true);
  assert.deepEqual(events, [
    ["choose"],
    ["loading", true, "Ada"],
    ["convert", "actor-ada"],
    ["render", "default", "Ada"],
    ["printView", true, "Ada"]
  ]);
});

