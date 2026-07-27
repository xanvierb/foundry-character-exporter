import test from "node:test";
import assert from "node:assert/strict";

import { cleanRichText } from "../scripts/foundry/compatibility.js";

test("rich text is neutralized and Foundry-only markup becomes printable text", t => {
  const previous = { document: globalThis.document, foundry: globalThis.foundry };
  t.after(() => Object.assign(globalThis, previous));

  globalThis.document = undefined;
  globalThis.foundry = { utils: { cleanHTML: value => value } };

  const cleaned = cleanRichText(`
    <div style="background:#111;color:#eee" onclick="alert(1)">
      <p>@UUID[Compendium.dnd5e.spells.Item.magic]{Magic Missile}</p>
      <p>&amp;Reference[Charmed]</p>
      <section class="secret"><p>Foundry Note</p></section>
      <script>throw new Error("not printable")</script>
    </div>
  `);

  assert.match(cleaned, /Magic Missile/u);
  assert.match(cleaned, /Charmed/u);
  assert.doesNotMatch(cleaned, /@UUID|Reference\[|Foundry Note|<script|style=|onclick=/u);
});
