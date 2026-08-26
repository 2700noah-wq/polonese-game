import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const game = readFileSync(new URL("../game.js", import.meta.url), "utf8");
const bossEngine = readFileSync(new URL("../boss-engine.js", import.meta.url), "utf8");
const secretLevels = readFileSync(new URL("../secret-levels.js", import.meta.url), "utf8");

test("Endless ist vollständig aus Oberfläche und Spielsteuerung entfernt", () => {
  assert.doesNotMatch(html, /Endlos|data-mode="endless"/i);
  assert.doesNotMatch(game, /endless/i);
  assert.match(html, /data-mode="secret"/);
});

test("Portal gehört ausschließlich zur Absolut-Darstellung", () => {
  assert.match(html, /class="boss-portal"/);
  assert.match(css, /\.boss-portal\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.boss-arena\.is-absolute \.boss-portal/);
  assert.match(game, /classList\.toggle\("is-absolute", state\.bossId === "absolute"\)/);
});

test("Touchziel, mobile Bossansicht und Wiederfreigabe der Steuerung sind vorgesehen", () => {
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.boss-creature[\s\S]*width:\s*112px/);
  assert.match(css, /\.boss-arena\.attack-window \.boss-creature[\s\S]*pointer-events:\s*auto/);
  assert.match(game, /setInputLocked\(false\)/);
  assert.match(game, /addEventListener\("pointerdown"/);
});

test("Krone, Risse und langsame Zerfallsanimation sind im Bossaufbau enthalten", () => {
  assert.match(html, /boss-crown/);
  assert.match(html, /boss-crack/);
  assert.match(css, /@keyframes crown-fly/);
  assert.match(css, /@keyframes boss-crumble/);
  assert.match(css, /@keyframes eyes-last/);
  assert.match(game, /classList\.add\("dying"\)/);
});

test("Trefferstatus wird bei Absolut sofort aktualisiert", () => {
  assert.match(
    game,
    /recordAbsoluteHit\(state\.boss\);\s*elements\.bossArena\.dataset\.damage = String\(state\.boss\.hits\);\s*renderStatus\(\);/,
  );
});

test("isolierte 390-Pixel-Testansicht ist vorhanden", () => {
  const mobilePreview = readFileSync(new URL("./mobile-preview.html", import.meta.url), "utf8");
  assert.match(mobilePreview, /width:\s*390px/);
  assert.match(mobilePreview, /height:\s*844px/);
  assert.match(mobilePreview, /src="\.\.\/index\.html"/);
});

test("Secret Level blockiert keine legalen Spielerplatzierungen anhand der späteren Lösbarkeit", () => {
  const validation = game.match(
    /function validateSecretFuture\(placements\) \{[\s\S]*?\n\}/,
  )?.[0] ?? "";
  assert.ok(validation);
  assert.doesNotMatch(validation, /\.solve\(/);
  assert.doesNotMatch(validation, /valid:\s*false/);
  assert.doesNotMatch(game, /Dieser Zug blockiert das Secret Level/);
  assert.match(validation, /pendingMutation = buildBossMutationPlan\(placements\)/);
});

test("nur geometrische Regeln und Vorlagen bleiben beim Platzieren verbindlich", () => {
  assert.match(game, /Das Teil ragt über den Rand hinaus/);
  assert.match(game, /Dort liegt bereits ein anderes Teil/);
  assert.match(game, /Dieses Vorlagen-Teil muss exakt an die gezeigte Position/);
});

test("Timeranzeige und aktive Spielzeitmessung sind vollständig entfernt", () => {
  assert.doesNotMatch(html, /resultTime|resultBest|statsPlayTime|Bestzeit|Gesamte Spielzeit/);
  assert.doesNotMatch(game, /startedAt|elapsedSeconds|updateTimer|bestTimeKey|bestTimes|totalPlaySeconds|setInterval/);
});

test("Bosskämpfe besitzen keinen vergrößerten Brett- oder False-Ending-Pfad mehr", () => {
  for (const source of [html, css, game, bossEngine, secretLevels]) {
    assert.doesNotMatch(source, /finalBoard|createFinalBoardPlan|beginFinalBoard|shouldStartFalseEnding|board-pull|secret-final|65\s*Felder|13\s*Steine/);
  }
});
