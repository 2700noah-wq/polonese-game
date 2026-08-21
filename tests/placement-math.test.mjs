import assert from "node:assert/strict";
import test from "node:test";

import { placementFromBoardPoint, pointerAnchorForPlacement } from "../placement-math.js";

test("ein neuer Stein folgt beim Ziehen seinem tatsächlichen Mittelpunkt", () => {
  const anchor = pointerAnchorForPlacement([[0, 0], [0, 1], [1, 0], [1, 1], [1, 2]]);

  assert.deepEqual(anchor, { row: 1.1, col: 1.3 });
  assert.deepEqual(placementFromBoardPoint({ row: 3.1, col: 6.3 }, anchor), { row: 2, col: 5 });
});

test("die präzise Platzierung rastet auf das nächstgelegene Spielfeld ein", () => {
  assert.deepEqual(
    placementFromBoardPoint({ row: 2.64, col: 4.51 }, { row: 0.5, col: 1.5 }),
    { row: 2, col: 3 },
  );
});
