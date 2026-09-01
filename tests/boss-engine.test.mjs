import assert from "node:assert/strict";
import test from "node:test";

import {
  ABSOLUTE_HITS_TO_WIN,
  ABSOLUTE_REMAINING_TRIGGERS,
  NORMAL_BOSS_REMAINING_TRIGGERS,
  NORMAL_BOSS_THEFTS,
  canFinishBoss,
  createBossState,
  finalizeAbsoluteAttack,
  isAbsoluteRunExhausted,
  markAbsoluteTriggerUsed,
  recordAbsoluteHit,
  recordAbsoluteMiss,
  recordTheft,
  rollbackAbsoluteTrigger,
  shouldStartAbsoluteAttack,
  shouldStartNormalAttack,
} from "../boss-engine.js";

test("normale Bosse greifen phasenabhängig bei 2, 1 und 0 übrigen Steinen an", () => {
  const boss = createBossState("easy");
  assert.deepEqual(NORMAL_BOSS_REMAINING_TRIGGERS, [2, 1, 0]);

  assert.equal(shouldStartNormalAttack(boss, 8, 10), true);
  assert.equal(shouldStartNormalAttack(boss, 7, 10), false);
  assert.equal(shouldStartNormalAttack(boss, 9, 10), false);
  recordTheft(boss, { piece: { id: "p0" } });

  assert.equal(boss.attackCount, 1);
  assert.equal(shouldStartNormalAttack(boss, 8, 10), false);
  assert.equal(shouldStartNormalAttack(boss, 9, 10), true);
  assert.equal(shouldStartNormalAttack(boss, 10, 10), false);
  recordTheft(boss, { piece: { id: "p1" } });

  assert.equal(boss.attackCount, 2);
  assert.equal(shouldStartNormalAttack(boss, 9, 10), false);
  assert.equal(shouldStartNormalAttack(boss, 10, 10), true);
  recordTheft(boss, { piece: { id: "p2" } });

  assert.equal(boss.attackCount, NORMAL_BOSS_THEFTS);
  assert.equal(boss.thefts.length, NORMAL_BOSS_THEFTS);
  assert.equal(shouldStartNormalAttack(boss, 10, 10), false);
  assert.equal(canFinishBoss(boss, false), false);
  boss.thefts.push({ piece: { id: "unerwartet" } });
  assert.equal(canFinishBoss(boss, true), false);
  boss.thefts.pop();
  assert.equal(canFinishBoss(boss, true), true);
});

test("Absolut greift jeden Restwert von 6 bis 0 höchstens einmal an", () => {
  const boss = createBossState("absolute");
  assert.deepEqual(ABSOLUTE_REMAINING_TRIGGERS, [6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(boss.usedAbsoluteTriggers, []);
  assert.equal(shouldStartAbsoluteAttack(boss, 3, 10), false, "vor 6 Reststeinen kein Angriff");

  for (const remainingCount of ABSOLUTE_REMAINING_TRIGGERS) {
    const placedCount = 10 - remainingCount;
    assert.equal(shouldStartAbsoluteAttack(boss, placedCount, 10), true);
    assert.equal(markAbsoluteTriggerUsed(boss, remainingCount), true);
    assert.equal(shouldStartAbsoluteAttack(boss, placedCount, 10), false);
    assert.equal(markAbsoluteTriggerUsed(boss, remainingCount), false);
    recordAbsoluteMiss(boss, { piece: { id: `phase-${remainingCount}` } });
  }

  assert.deepEqual(boss.usedAbsoluteTriggers, ABSOLUTE_REMAINING_TRIGGERS);
  assert.equal(boss.attackCount, ABSOLUTE_REMAINING_TRIGGERS.length);
  assert.equal(boss.hits, 0);
  assert.equal(shouldStartAbsoluteAttack(boss, 10, 10), false);
  assert.equal(isAbsoluteRunExhausted(boss), true);
  assert.equal(finalizeAbsoluteAttack(boss, 0), true);
  assert.equal(boss.lost, true);
  assert.equal(canFinishBoss(boss, true), false);
});

test("Absolut initialisiert fehlenden Trigger-State sicher und kann nur einen fehlgeschlagenen Start zurückrollen", () => {
  const boss = createBossState("absolute");
  delete boss.usedAbsoluteTriggers;

  assert.equal(shouldStartAbsoluteAttack(boss, 4, 10), true);
  assert.deepEqual(boss.usedAbsoluteTriggers, []);
  assert.equal(markAbsoluteTriggerUsed(boss, 6), true);
  assert.equal(shouldStartAbsoluteAttack(boss, 4, 10), false);
  assert.equal(rollbackAbsoluteTrigger(boss, 6), true);
  assert.equal(rollbackAbsoluteTrigger(boss, 6), false);
  assert.deepEqual(boss.usedAbsoluteTriggers, []);
  assert.equal(shouldStartAbsoluteAttack(boss, 4, 10), true);
});

test("Absolut endet bei direkten Treffern auf 6, 5 und 4 Reststeinen", () => {
  const boss = createBossState("absolute");

  for (const remainingCount of [6, 5, 4]) {
    assert.equal(shouldStartAbsoluteAttack(boss, 10 - remainingCount, 10), true);
    assert.equal(markAbsoluteTriggerUsed(boss, remainingCount), true);
    recordAbsoluteHit(boss);
  }

  assert.equal(boss.attackCount, 3);
  assert.equal(boss.hits, 3);
  assert.equal(boss.dead, true);
  assert.equal(isAbsoluteRunExhausted(boss), false);
  for (const remainingCount of [3, 2, 1, 0]) {
    assert.equal(shouldStartAbsoluteAttack(boss, 10 - remainingCount, 10), false);
  }
  assert.equal(canFinishBoss(boss, true), true);
});

test("Absolut trennt Misses, Treffer und einmalige Triggerwerte voneinander", () => {
  const boss = createBossState("absolute");
  const phases = [
    { remaining: 6, hit: false },
    { remaining: 5, hit: false },
    { remaining: 4, hit: true },
    { remaining: 3, hit: true },
    { remaining: 2, hit: false },
    { remaining: 1, hit: true },
  ];

  for (const phase of phases) {
    const placedCount = 10 - phase.remaining;
    assert.equal(shouldStartAbsoluteAttack(boss, placedCount, 10), true);
    assert.equal(markAbsoluteTriggerUsed(boss, phase.remaining), true);
    if (phase.hit) recordAbsoluteHit(boss);
    else recordAbsoluteMiss(boss, { piece: { id: `miss-${phase.remaining}` } });
    assert.equal(shouldStartAbsoluteAttack(boss, placedCount, 10), false, "verwendeter Wert bleibt gesperrt");
  }

  assert.deepEqual(boss.usedAbsoluteTriggers, [6, 5, 4, 3, 2, 1]);
  assert.equal(boss.attackCount, 6);
  assert.equal(boss.hits, ABSOLUTE_HITS_TO_WIN);
  assert.equal(boss.dead, true);
  assert.equal(shouldStartAbsoluteAttack(boss, 10, 10), false, "nach Treffer 3 folgt kein 0-Angriff");
});

test("ein neuer Secret-Durchlauf enthält keinerlei alten Bossfortschritt", () => {
  const previous = createBossState("absolute");
  previous.pendingMutation = { id: "alt" };
  markAbsoluteTriggerUsed(previous, 6);
  recordAbsoluteMiss(previous, { piece: { id: "gestohlen" } });
  recordAbsoluteHit(previous);
  previous.inputLocked = true;
  previous.attackWindow = true;

  const restarted = createBossState("absolute");
  assert.deepEqual(restarted, {
    id: "absolute",
    thefts: [],
    hits: 0,
    attackCount: 0,
    usedAbsoluteTriggers: [],
    inputLocked: false,
    attackWindow: false,
    dead: false,
    lost: false,
    pendingMutation: null,
  });
  assert.equal(shouldStartAbsoluteAttack(restarted, 4, 10), true, "Trigger 6 ist nach Retry wieder frei");
});

for (const hits of [0, 1]) {
  test(`Trigger 0 mit Trefferstand ${hits} beendet den Absolut-Kampf als Niederlage`, () => {
    const boss = createBossState("absolute");
    for (let index = 0; index < hits; index += 1) recordAbsoluteHit(boss);
    assert.equal(markAbsoluteTriggerUsed(boss, 0), true);
    recordAbsoluteMiss(boss, { piece: { id: `zero-miss-${hits}` } });
    assert.equal(finalizeAbsoluteAttack(boss, 0), true);
    assert.equal(boss.lost, true);
    assert.equal(boss.dead, false);
    assert.equal(shouldStartAbsoluteAttack(boss, 4, 10), false);
  });
}

test("Trigger 0 mit zwei Treffern und Miss führt zur Niederlage", () => {
  const boss = createBossState("absolute");
  recordAbsoluteHit(boss);
  recordAbsoluteHit(boss);
  assert.equal(markAbsoluteTriggerUsed(boss, 0), true);
  recordAbsoluteMiss(boss, { piece: { id: "zero-miss-two" } });
  assert.equal(finalizeAbsoluteAttack(boss, 0), true);
  assert.equal(boss.hits, 2);
  assert.equal(boss.lost, true);
  assert.equal(boss.attackWindow, false);
  assert.equal(boss.pendingMutation, null);
});

test("Treffer 3 beim Trigger 0 führt zum Sieg und niemals zur Niederlage", () => {
  const boss = createBossState("absolute");
  recordAbsoluteHit(boss);
  recordAbsoluteHit(boss);
  assert.equal(markAbsoluteTriggerUsed(boss, 0), true);
  recordAbsoluteHit(boss);
  assert.equal(finalizeAbsoluteAttack(boss, 0), false);
  assert.equal(boss.hits, ABSOLUTE_HITS_TO_WIN);
  assert.equal(boss.dead, true);
  assert.equal(boss.lost, false);
  assert.equal(canFinishBoss(boss, true), true);
});
