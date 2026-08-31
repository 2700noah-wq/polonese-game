import assert from "node:assert/strict";
import test from "node:test";

import { waitForPlacementPaint } from "../boss-attack-flow.js";

test("die Bossplanung wartet zwei Frames und damit mindestens einen sichtbaren Placement-Paint ab", async () => {
  const frames = [];
  const queued = [];
  let settled = false;
  const waiting = waitForPlacementPaint((callback) => {
    frames.push("angefordert");
    queued.push(callback);
  }).then(() => {
    settled = true;
  });

  assert.deepEqual(frames, ["angefordert"]);
  assert.equal(settled, false);
  queued.shift()();
  assert.deepEqual(frames, ["angefordert", "angefordert"]);
  assert.equal(settled, false);
  queued.shift()();
  await waiting;
  assert.equal(settled, true);
});
