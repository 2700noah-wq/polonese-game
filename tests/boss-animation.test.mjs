import assert from "node:assert/strict";
import test from "node:test";

import {
  BOSS_THEFT_PROFILES,
  runTheftCapture,
  runTheftPrelude,
  theftEffectBounds,
  theftPresentationFor,
} from "../boss-animation.js";

test("Diebstahl wird von Leicht bis Absolut schneller und intensiver", () => {
  const order = ["easy", "medium", "hard", "expert", "absolute"];
  const presentations = order.map(theftPresentationFor);

  assert.deepEqual(Object.keys(BOSS_THEFT_PROFILES), order);
  for (let index = 1; index < presentations.length; index += 1) {
    assert.ok(presentations[index].totalMs < presentations[index - 1].totalMs);
    assert.ok(presentations[index].intensity > presentations[index - 1].intensity);
    assert.ok(presentations[index].particles > presentations[index - 1].particles);
  }
  assert.ok(presentations[1].totalMs >= 1350 && presentations[1].totalMs <= 1500);
  assert.ok(presentations.at(-1).totalMs >= 1100, "Absolut muss trotz höherem Tempo lesbar bleiben");
});

for (const bossId of ["easy", "absolute"]) {
  test(`${bossId}: vollständige visuelle Diebstahlsequenz läuft in der richtigen Reihenfolge`, async () => {
    const presentation = theftPresentationFor(bossId);
    const events = [];
    const waits = [];
    const expectedTarget = { pieceId: `${bossId}-target` };
    const wait = async (milliseconds) => waits.push(milliseconds);

    const target = await runTheftPrelude(presentation, {
      startSearch: () => events.push("search"),
      lockTarget: () => {
        events.push("lock-and-double-blink");
        return expectedTarget;
      },
      wait,
    });
    await runTheftCapture(presentation, target, {
      warnTarget: (lockedTarget) => {
        assert.equal(lockedTarget, expectedTarget);
        events.push("wobble");
      },
      startSuction: (lockedTarget) => {
        assert.equal(lockedTarget, expectedTarget);
        events.push("portal-and-suction");
        return { target: lockedTarget };
      },
      releaseParticles: (lockedTarget, portal) => {
        assert.equal(lockedTarget, expectedTarget);
        assert.equal(portal.target, expectedTarget);
        events.push("particles");
      },
      wait,
    });

    assert.equal(target, expectedTarget);
    assert.deepEqual(events, ["search", "lock-and-double-blink", "wobble", "portal-and-suction", "particles"]);
    assert.deepEqual(waits, Object.values(presentation.durations));
    assert.equal(waits.reduce((sum, milliseconds) => sum + milliseconds, 0), presentation.totalMs);
  });
}

test("Zielportal bleibt auch am Rand innerhalb eines 390-Pixel-Smartphone-Bretts", () => {
  const board = { left: 15, top: 100, width: 360, height: 180 };
  const cells = [0, 1, 2, 3, 4].map((index) => ({
    left: 15 + index * 35,
    right: 47 + index * 35,
    top: 100,
    bottom: 132,
    width: 32,
    height: 32,
  }));
  const bounds = theftEffectBounds(board, cells);

  assert.ok(bounds);
  assert.equal(bounds.left, 0);
  assert.ok(bounds.top >= 0);
  assert.ok(bounds.left + bounds.width <= board.width);
  assert.ok(bounds.top + bounds.height <= board.height);
  assert.ok(bounds.width > 172, "Portal muss breiter als der komplette Zielstein sein");
  assert.ok(bounds.height > 32, "Portal muss höher als der Zielstein sein");
});

test("Portalgeometrie wird ohne sichtbare Zielzellen sicher verworfen", () => {
  assert.equal(theftEffectBounds({ left: 0, top: 0, width: 360, height: 180 }, []), null);
});
