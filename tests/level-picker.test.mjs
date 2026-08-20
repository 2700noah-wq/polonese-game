import assert from "node:assert/strict";
import test from "node:test";

import { createLevelPickerItems } from "../level-picker.js";

test("die Levelauswahl enthält alle 60 Levels der Kategorie", () => {
  const items = createLevelPickerItems(60, 29, [0, 4, 29]);

  assert.equal(items.length, 60);
  assert.deepEqual(items[0], {
    index: 0,
    number: 1,
    current: false,
    completed: true,
  });
  assert.deepEqual(items[29], {
    index: 29,
    number: 30,
    current: true,
    completed: true,
  });
  assert.equal(items[59].number, 60);
});

test("ungültige gespeicherte Level werden nicht als geschafft markiert", () => {
  const items = createLevelPickerItems(60, 0, [-1, 60, 100]);

  assert.equal(items.filter((item) => item.completed).length, 0);
  assert.equal(items.filter((item) => item.current).length, 1);
});
