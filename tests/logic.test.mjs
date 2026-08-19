import test from "node:test";
import assert from "node:assert/strict";

import {
  BOARD_SIZE,
  DIFFICULTIES,
  PIECES,
  fixedLevelSeed,
  generatePuzzle,
  getVariants,
  placementCells,
  solvePuzzle,
  validateCompletedBoard,
} from "../logic.js";

test("alle zehn Teile bestehen aus fünf Feldern und besitzen eindeutige Varianten", () => {
  assert.equal(PIECES.length, 10);
  for (const piece of PIECES) {
    assert.equal(piece.cells.length, 5);
    const keys = getVariants(piece.id).map((variant) => JSON.stringify(variant));
    assert.equal(new Set(keys).size, keys.length);
  }
});

test("feste Level sind deterministisch", () => {
  const first = generatePuzzle(fixedLevelSeed("medium", 17), "medium");
  const second = generatePuzzle(fixedLevelSeed("medium", 17), "medium");
  assert.deepEqual(first, second);
});

for (const [difficulty, settings] of Object.entries(DIFFICULTIES)) {
  test(`${difficulty}: erzeugte Aufgabe ist vollständig, eindeutig und passend dosiert`, () => {
    const puzzle = generatePuzzle(fixedLevelSeed(difficulty, 3), difficulty);
    const occupied = new Set(puzzle.solution.flatMap(placementCells));

    assert.equal(puzzle.solution.length, PIECES.length);
    assert.equal(occupied.size, BOARD_SIZE);
    assert.equal(puzzle.clues.length, settings.targetClues);
    assert.equal(solvePuzzle(puzzle.clues, { limit: 2 }).count, 1);
    assert.equal(validateCompletedBoard(puzzle.solution, puzzle.clues), true);
  });
}

test("unvollständige Bretter werden nicht als Lösung akzeptiert", () => {
  const puzzle = generatePuzzle(fixedLevelSeed("easy", 0), "easy");
  assert.equal(validateCompletedBoard(puzzle.solution.slice(0, -1), puzzle.clues), false);
});
