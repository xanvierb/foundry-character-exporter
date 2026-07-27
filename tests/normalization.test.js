import test from "node:test";
import assert from "node:assert/strict";

import {
  finiteNumber,
  proficiencyLabel,
  signedNumber,
  splitList,
  toArray,
  toPlainValue,
  uniqueStrings
} from "../scripts/utils/normalization.js";

test("normalization helpers handle Foundry-like collections and numeric values", () => {
  assert.deepEqual(toArray({ contents: [1, 2] }), [1, 2]);
  assert.deepEqual(toArray(new Set(["a", "b"])), ["a", "b"]);
  assert.equal(finiteNumber("3"), 3);
  assert.equal(finiteNumber("not-a-number", 7), 7);
  assert.deepEqual(splitList("Common; Elvish, Dwarvish\nGiant"), ["Common", "Elvish", "Dwarvish", "Giant"]);
  assert.deepEqual(uniqueStrings(["Common", "Common", "Elvish"]), ["Common", "Elvish"]);
});

test("signed number and proficiency labels are template-friendly", () => {
  assert.equal(signedNumber(3), "+3");
  assert.equal(signedNumber(-1), "-1");
  assert.equal(signedNumber(0), "+0");
  assert.equal(proficiencyLabel(0), "none");
  assert.equal(proficiencyLabel(0.5), "half");
  assert.equal(proficiencyLabel(1), "proficient");
  assert.equal(proficiencyLabel(2), "expertise");
});

test("toPlainValue removes functions and circular references", () => {
  const value = { name: "Ada", ignored() {} };
  value.self = value;
  assert.deepEqual(toPlainValue(value), { name: "Ada" });
});
