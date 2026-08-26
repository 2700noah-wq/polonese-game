import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeStats } from "../game-storage.js";

const options = {
  difficultyIds: ["easy", "medium", "hard", "expert"],
  levelsPerDifficulty: 60,
};

test("bestehender Fortschritt bleibt erhalten, alte Endless- und Timerdaten werden ignoriert", () => {
  const migrated = sanitizeStats({
    completed: { easy: [0, 1, 59], medium: [4], hard: [], expert: [] },
    currentLevel: { easy: 30, medium: 4, hard: 0, expert: 0 },
    bestTimes: { "fixed:easy:0": 18, "endless:easy": 44 },
    totalSolved: 7,
    totalPlaySeconds: 380,
    endlessSolved: 99,
    endlessRound: 100,
  }, options);

  assert.deepEqual(migrated.completed.easy, [0, 1, 59]);
  assert.equal(migrated.currentLevel.easy, 30);
  assert.equal(migrated.totalSolved, 7);
  assert.equal("bestTimes" in migrated, false);
  assert.equal("totalPlaySeconds" in migrated, false);
  assert.equal("endlessSolved" in migrated, false);
  assert.equal("endlessRound" in migrated, false);
  assert.deepEqual(migrated.secret.completed, {
    easy: false,
    medium: false,
    hard: false,
    expert: false,
    absolute: false,
  });
});

test("Bossfortschritt wird streng als boolescher Zustand geladen", () => {
  const migrated = sanitizeStats({
    completed: {},
    secret: {
      unlocked: true,
      unlockNoticeShown: true,
      completed: { easy: true, medium: 1, hard: false, expert: true, absolute: "ja" },
    },
  }, options);

  assert.equal(migrated.secret.unlocked, true);
  assert.equal(migrated.secret.unlockNoticeShown, true);
  assert.equal(migrated.secret.completed.easy, true);
  assert.equal(migrated.secret.completed.medium, false);
  assert.equal(migrated.secret.completed.expert, true);
  assert.equal(migrated.secret.completed.absolute, false);
});
