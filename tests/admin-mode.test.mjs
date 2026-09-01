import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_MODE_STORAGE_KEY, isAdminModeEnabled } from "../admin-mode.js";
import {
  BOSS_ORDER,
  createBossSelectionItems,
  isBossUnlocked,
  isSecretModeUnlocked,
} from "../secret-levels.js";

function emptyProgress() {
  return {
    completed: { easy: [], medium: [], hard: [], expert: [] },
    secret: { completed: { easy: false, medium: false, hard: false, expert: false, absolute: false } },
    totalSolved: 0,
  };
}

test("Adminmodus wird ausschließlich über den lokalen Override-Schlüssel gelesen", () => {
  let reads = 0;
  const enabled = isAdminModeEnabled(() => ({
    getItem(key) {
      reads += 1;
      assert.equal(key, ADMIN_MODE_STORAGE_KEY);
      return "true";
    },
  }));

  assert.equal(enabled, true);
  assert.equal(reads, 1);
  assert.equal(isAdminModeEnabled(() => ({ getItem: () => "false" })), false);
  assert.equal(isAdminModeEnabled(() => { throw new Error("Storage blockiert"); }), false);
});

test("Adminmodus umgeht nur die Secret-Sperren und verändert keinen Fortschritt", () => {
  const progress = emptyProgress();
  const before = JSON.parse(JSON.stringify(progress));
  const adminOptions = { adminMode: true };

  assert.equal(isSecretModeUnlocked(progress.completed), false);
  assert.equal(isSecretModeUnlocked(progress.completed, adminOptions), true);
  assert.equal(isBossUnlocked("absolute", progress.completed, progress.secret), false);
  assert.ok(BOSS_ORDER.every((bossId) => isBossUnlocked(bossId, progress.completed, progress.secret, adminOptions)));
  assert.ok(createBossSelectionItems(progress.completed, progress.secret, adminOptions).every((item) => item.unlocked));
  assert.deepEqual(progress, before);

  assert.equal(isSecretModeUnlocked(progress.completed, { adminMode: false }), false);
  assert.equal(isBossUnlocked("absolute", progress.completed, progress.secret, { adminMode: false }), false);
});
