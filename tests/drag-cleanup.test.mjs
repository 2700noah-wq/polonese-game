import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const game = readFileSync(new URL("../game.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("jeder Drag-Abschluss entfernt Ghost, Vorschau, Body-Zustand und Pointer-Capture zentral", () => {
  assert.match(game, /function removeAllDragGhosts\([\s\S]*querySelectorAll\("\.drag-ghost"\)[\s\S]*classList\.remove\("dragging-piece"\)/);
  assert.match(
    game,
    /function clearDragSession[\s\S]*dragSession = null;[\s\S]*releaseDragPointer\(session\);[\s\S]*removeAllDragGhosts\(\);[\s\S]*state\.preview = null;/,
  );
  assert.match(game, /function activateDrag[\s\S]*dragSession\.captureTarget\?\.setPointerCapture\?\.\(dragSession\.pointerId\)/);
  assert.doesNotMatch(game, /function beginPotentialDrag(?:(?!function activateDrag)[\s\S])*captureTarget\?\.setPointerCapture/);
  assert.match(game, /target\.releasePointerCapture\(session\.pointerId\)/);
  assert.match(game, /function finishDrag[\s\S]*clearDragSession\(\);/);
  assert.match(game, /function cancelSelection[\s\S]*clearDragSession\(\);/);
});

test("Mobile-Abbruchpfade räumen eine aktive Drag-Session idempotent auf", () => {
  assert.match(game, /addEventListener\("pointercancel", \(event\) => finishDrag\(event, true\)\)/);
  assert.match(game, /addEventListener\("touchcancel"[\s\S]*abortDragSession\(\)/);
  assert.match(game, /addEventListener\("lostpointercapture"[\s\S]*abortDragSession\(\)/);
  assert.match(game, /addEventListener\("blur", \(\) => abortDragSession\(\)\)/);
  assert.match(game, /addEventListener\("pagehide", \(\) => clearDragSession\(\)\)/);
  assert.match(game, /visibilitychange[\s\S]*document\.hidden[\s\S]*abortDragSession\(\)/);
});

test("Rotation und Spiegelung halten Ghost und Vorschau während des aktiven Drags synchron", () => {
  assert.match(
    game,
    /function refreshActiveDrag[\s\S]*createDragGhost\(dragSession\.pieceId, dragSession\.pointerAnchor\);[\s\S]*allowScroll: false/,
  );
  assert.ok((game.match(/refreshActiveDrag\(\);/g) ?? []).length >= 2);
  assert.match(game, /dragSession\.lastX = event\.clientX;/);
  assert.match(game, /dragSession\.lastY = event\.clientY;/);
});

test("Mobile-Spielsteine überlassen den aktiven Drag nicht der Browser-Gestensteuerung", () => {
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.piece-card\s*\{[^}]*touch-action:\s*none/s);
});
