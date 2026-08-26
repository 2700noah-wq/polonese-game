import assert from "node:assert/strict";
import test from "node:test";

import {
  BOSS_CONFIG,
  BOSS_ORDER,
  SECRET_NOTICE_MS,
  bossLockMessage,
  createBossPuzzle,
  createBossSelectionItems,
  isBossUnlocked,
  isSecretModeUnlocked,
  planNovelMutation,
  secretModeLockMessage,
} from "../secret-levels.js";

function completedDifficulties(...ids) {
  return Object.fromEntries(["easy", "medium", "hard", "expert"].map((id) => [
    id,
    ids.includes(id) ? Array.from({ length: 60 }, (_, index) => index) : [],
  ]));
}

function extendAlongSolution(puzzle, current, targetCount) {
  const byId = new Map(current.map((placement) => [placement.pieceId, { ...placement }]));
  for (const placement of [...puzzle.clues, ...puzzle.solution]) {
    if (byId.size >= targetCount) break;
    if (!byId.has(placement.pieceId)) byId.set(placement.pieceId, { ...placement });
  }
  return [...byId.values()];
}

function planAttack(puzzle, placements, attackIndex, preservePlaced = true) {
  return planNovelMutation({
    puzzle,
    placements,
    bossId: puzzle.bossId,
    serial: attackIndex + 1,
    attackIndex,
    seed: `${puzzle.bossId}-${attackIndex}`,
    preservePlaced,
  });
}

function applyPlan(puzzle, plan) {
  return {
    ...puzzle,
    pieces: plan.pieces,
    clues: plan.clues,
    solution: plan.solution,
    model: plan.model,
  };
}

test("Secret Level und Bossfreischaltungen werden aus echtem Fortschritt berechnet", () => {
  const none = completedDifficulties();
  const easy = completedDifficulties("easy");
  const all = completedDifficulties("easy", "medium", "hard", "expert");
  const secret = { completed: { easy: true, medium: true, hard: true, expert: false, absolute: false } };

  assert.equal(isSecretModeUnlocked(none), false);
  assert.equal(isSecretModeUnlocked(easy), true);
  assert.equal(isBossUnlocked("easy", easy, secret), true);
  assert.equal(isBossUnlocked("medium", easy, secret), false);
  assert.equal(isBossUnlocked("expert", all, secret), true);
  assert.equal(isBossUnlocked("absolute", all, secret), false);
  secret.completed.expert = true;
  assert.equal(isBossUnlocked("absolute", all, secret), true);
});

test("alle fünf benannten Bosse und die vorgegebenen Sperrmeldungen sind vorhanden", () => {
  const items = createBossSelectionItems(completedDifficulties("easy"), {
    completed: Object.fromEntries(BOSS_ORDER.map((id) => [id, false])),
  });
  assert.deepEqual(items.map((item) => item.label), ["Leicht", "Mittel", "Schwer", "Polonesisch", "Absolut"]);
  assert.equal(SECRET_NOTICE_MS, 7000);
  assert.equal(secretModeLockMessage(), "Schließe zuerst alle Level von Stufe Leicht ab, um die Secret Level freizuschalten.");
  assert.equal(bossLockMessage("medium"), "Schließe zuerst alle Level von Stufe Mittel ab, um diesen Boss freizuschalten.");
  assert.equal(bossLockMessage("absolute"), "Besiege zuerst alle anderen Secret-Level-Bosse, um Absolut freizuschalten.");
});

test("die vier normalen Bossstarts besitzen exakt 4, 3, 2 und 1 Vorlage", () => {
  assert.deepEqual(["easy", "medium", "hard", "expert"].map((id) => createBossPuzzle(id).clues.length), [4, 3, 2, 1]);
  assert.equal(createBossPuzzle("absolute").clues.length, BOSS_CONFIG.absolute.targetClues);
});

for (const bossId of ["easy", "medium", "hard", "expert"]) {
  test(`${bossId}: Angriffe bei 2, 1 und 0 Reststeinen bleiben auf dem 5×10-Feld lösbar`, () => {
    let puzzle = createBossPuzzle(bossId);
    let placements = [];
    const triggerCounts = [8, 9, 10];

    for (let attackIndex = 0; attackIndex < 3; attackIndex += 1) {
      placements = extendAlongSolution(puzzle, placements, triggerCounts[attackIndex]);
      assert.equal(placements.length, triggerCounts[attackIndex]);
      const plan = planAttack(puzzle, placements, attackIndex, attackIndex === 0);
      assert.ok(plan, `Angriff ${attackIndex + 1} muss vorbereitbar sein`);
      const beforeIds = new Set(puzzle.pieces.map((piece) => piece.id));
      const beforeShape = puzzle.model.getPiece(plan.stolen.piece.id).cells;
      assert.equal(beforeIds.has(plan.replacement.id), false);
      assert.notDeepEqual(plan.replacement.cells, beforeShape);
      assert.equal(plan.model.validateCompletedBoard(plan.solution, plan.clues), true);

      placements = placements.filter((placement) => placement.pieceId !== plan.stolen.piece.id);
      puzzle = applyPlan(puzzle, plan);
      assert.equal(puzzle.rows, 5);
      assert.equal(puzzle.cols, 10);
      assert.equal(puzzle.model.activeCells.size, 50);
      assert.equal(puzzle.pieces.length, 10);
    }

    assert.equal(placements.length, 9);
    assert.equal(puzzle.model.validateCompletedBoard(puzzle.solution, puzzle.clues), true);
  });
}

test("Absolut bleibt auch nach mehreren verpassten, validierten Angriffen kontrolliert lösbar", () => {
  let puzzle = createBossPuzzle("absolute");
  let placements = [];
  for (let attackIndex = 0; attackIndex < 6; attackIndex += 1) {
    placements = extendAlongSolution(puzzle, placements, 8);
    const plan = planAttack(puzzle, placements, attackIndex);
    assert.ok(plan);
    assert.equal(plan.model.validateCompletedBoard(plan.solution, plan.clues), true);
    placements = placements.filter((placement) => placement.pieceId !== plan.stolen.piece.id);
    puzzle = applyPlan(puzzle, plan);
  }
});
