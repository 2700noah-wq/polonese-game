import assert from "node:assert/strict";
import test from "node:test";

import {
  ABSOLUTE_HITS_TO_WIN,
  NORMAL_BOSS_REMAINING_TRIGGERS,
  NORMAL_BOSS_THEFTS,
  canFinishBoss,
  createBossState,
  recordAbsoluteHit,
  recordAbsoluteMiss,
  recordTheft,
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

test("Absolut darf unbegrenzt verpasst werden und behält erfolgreiche Treffer", () => {
  const boss = createBossState("absolute");
  assert.equal(shouldStartAbsoluteAttack(boss, 8, 10), true);
  for (let index = 0; index < 12; index += 1) recordAbsoluteMiss(boss, { piece: { id: `miss-${index}` } });
  assert.equal(boss.attackCount, 12);
  assert.equal(boss.hits, 0);
  recordAbsoluteHit(boss);
  recordAbsoluteHit(boss);
  recordAbsoluteMiss(boss, { piece: { id: "later-miss" } });
  assert.equal(boss.hits, 2);
  assert.equal(boss.dead, false);
  recordAbsoluteHit(boss);
  assert.equal(boss.hits, ABSOLUTE_HITS_TO_WIN);
  assert.equal(boss.dead, true);
  assert.equal(shouldStartAbsoluteAttack(boss, 8, 10), false);
  assert.equal(canFinishBoss(boss, true), true);
});
