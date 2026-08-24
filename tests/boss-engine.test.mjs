import assert from "node:assert/strict";
import test from "node:test";

import {
  ABSOLUTE_HITS_TO_WIN,
  NORMAL_BOSS_THEFTS,
  beginFinalBoard,
  canFinishBoss,
  createBossState,
  recordAbsoluteHit,
  recordAbsoluteMiss,
  recordTheft,
  shouldStartAbsoluteAttack,
  shouldStartFalseEnding,
  shouldStartNormalAttack,
} from "../boss-engine.js";

test("normale Bosse greifen exakt dreimal bei zwei übrigen Steinen an", () => {
  const boss = createBossState("easy");
  assert.equal(shouldStartNormalAttack(boss, 8, 10), true);
  assert.equal(shouldStartNormalAttack(boss, 7, 10), false);
  for (let index = 0; index < NORMAL_BOSS_THEFTS; index += 1) recordTheft(boss, { piece: { id: `p${index}` } });
  assert.equal(shouldStartNormalAttack(boss, 8, 10), false);
  assert.equal(shouldStartFalseEnding(boss, true), true);
  assert.equal(canFinishBoss(boss, true), false);
  beginFinalBoard(boss);
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
