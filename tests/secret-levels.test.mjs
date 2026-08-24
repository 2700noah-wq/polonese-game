import assert from "node:assert/strict";
import test from "node:test";

import { PIECES } from "../logic.js";
import {
  BOSS_CONFIG,
  BOSS_ORDER,
  SECRET_NOTICE_MS,
  bossLockMessage,
  createBossPuzzle,
  createBossSelectionItems,
  createFinalBoardPlan,
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

function combinations(values, count, start = 0, current = [], result = []) {
  if (current.length === count) {
    result.push([...current]);
    return result;
  }
  for (let index = start; index <= values.length - (count - current.length); index += 1) {
    current.push(values[index]);
    combinations(values, count, index + 1, current, result);
    current.pop();
  }
  return result;
}

function findValidatedAttack(puzzle, attackIndex) {
  for (let solutionSeed = 0; solutionSeed < 16; solutionSeed += 1) {
    const solution = puzzle.model.solve(puzzle.clues, { limit: 1, seed: solutionSeed }).solution ?? puzzle.solution;
    for (const placements of combinations(solution, 8)) {
      if (!puzzle.clues.every((clue) => placements.some((placement) => placement.pieceId === clue.pieceId))) continue;
      const plan = planNovelMutation({
        puzzle,
        placements,
        bossId: puzzle.bossId,
        serial: attackIndex + 1,
        attackIndex,
        seed: `${puzzle.bossId}-${attackIndex}-${solutionSeed}`,
      });
      if (plan) return { placements, plan };
    }
  }
  return null;
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
  test(`${bossId}: drei validierte Mutationen und das 65-Felder-Finale bleiben lösbar`, () => {
    let puzzle = createBossPuzzle(bossId);
    const stolen = [];
    for (let attackIndex = 0; attackIndex < 3; attackIndex += 1) {
      const attack = findValidatedAttack(puzzle, attackIndex);
      assert.ok(attack, `Angriff ${attackIndex + 1} muss vorbereitbar sein`);
      const beforeIds = new Set(puzzle.pieces.map((piece) => piece.id));
      const beforeShape = puzzle.model.getPiece(attack.plan.stolen.piece.id).cells;
      assert.equal(beforeIds.has(attack.plan.replacement.id), false);
      assert.notDeepEqual(attack.plan.replacement.cells, beforeShape);
      assert.equal(attack.plan.model.validateCompletedBoard(attack.plan.solution, attack.plan.clues), true);
      stolen.push(attack.plan.stolen);
      puzzle = applyPlan(puzzle, attack.plan);
    }
    const finalPuzzle = createFinalBoardPlan({ puzzle, stolen });
    assert.equal(finalPuzzle.pieces.length, PIECES.length + 3);
    assert.equal(finalPuzzle.model.activeCells.size, 65);
    assert.equal(finalPuzzle.model.validateCompletedBoard(finalPuzzle.solution, []), true);
  });
}

test("Absolut bleibt auch nach mehreren verpassten, validierten Angriffen kontrolliert lösbar", () => {
  let puzzle = createBossPuzzle("absolute");
  for (let attackIndex = 0; attackIndex < 6; attackIndex += 1) {
    const attack = findValidatedAttack(puzzle, attackIndex);
    assert.ok(attack);
    assert.equal(attack.plan.model.validateCompletedBoard(attack.plan.solution, attack.plan.clues), true);
    puzzle = applyPlan(puzzle, attack.plan);
  }
});
