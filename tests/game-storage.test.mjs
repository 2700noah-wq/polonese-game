import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeStats, saveStatsToStorage } from "../game-storage.js";

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


test("Spielstand wird unter unverändertem Schlüssel und in unveränderter Struktur gespeichert", () => {
  const stats = sanitizeStats({
    completed: { easy: [0, 3], medium: [], hard: [], expert: [] },
    currentLevel: { easy: 4, medium: 0, hard: 0, expert: 0 },
    totalSolved: 2,
    secret: {
      unlocked: true,
      unlockNoticeShown: false,
      completed: { easy: true, medium: false, hard: false, expert: false, absolute: false },
    },
  }, options);
  let savedKey;
  let savedValue;

  const saved = saveStatsToStorage(stats, {
    storageKey: "polonese-game-v1",
    storageProvider: () => ({
      setItem(key, value) {
        savedKey = key;
        savedValue = value;
      },
    }),
  });

  assert.equal(saved, true);
  assert.equal(savedKey, "polonese-game-v1");
  assert.deepEqual(JSON.parse(savedValue), stats);
});

test("Fehler von localStorage.setItem werden nicht nach außen weitergeworfen", () => {
  const stats = sanitizeStats(null, options);
  let saved;

  assert.doesNotThrow(() => {
    saved = saveStatsToStorage(stats, {
      storageKey: "polonese-game-v1",
      storageProvider: () => ({
        setItem() {
          throw new Error("Storage blockiert");
        },
      }),
    });
  });

  assert.equal(saved, false);
});
