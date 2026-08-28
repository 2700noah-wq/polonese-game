import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const game = readFileSync(new URL("../game.js", import.meta.url), "utf8");
const bossAnimation = readFileSync(new URL("../boss-animation.js", import.meta.url), "utf8");
const bossEngine = readFileSync(new URL("../boss-engine.js", import.meta.url), "utf8");
const secretLevels = readFileSync(new URL("../secret-levels.js", import.meta.url), "utf8");

test("Endless ist vollständig aus Oberfläche und Spielsteuerung entfernt", () => {
  assert.doesNotMatch(html, /Endlos|data-mode="endless"/i);
  assert.doesNotMatch(game, /endless/i);
  assert.match(html, /data-mode="secret"/);
});

test("Boss-Erscheinungsportal gehört ausschließlich zur Absolut-Darstellung", () => {
  assert.match(html, /class="boss-portal"/);
  assert.match(css, /\.boss-portal\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.boss-arena\.is-absolute \.boss-portal/);
  assert.match(game, /classList\.toggle\("is-absolute", state\.bossId === "absolute"\)/);
});

test("Diebstahl zeigt Suche, Zielblick, Doppelblinzeln, Wackeln, Zielportal und Partikel", () => {
  assert.match(game, /classList\.add\("visible", "searching"\)/);
  assert.match(game, /setBossTargetLook\(plan\.stolen\.piece\.id\)/);
  assert.match(game, /classList\.add\("targeting", "target-locked", "blink-confirm", "grinning"\)/);
  assert.match(game, /markTheftTarget\(target, presentation\)/);
  assert.match(game, /createTheftPortal\(target, presentation\)/);
  assert.match(game, /markStolenPiece\(target, presentation\)/);
  assert.match(game, /createTheftParticles\(target, presentation\)/);
  assert.match(css, /@keyframes boss-search/);
  assert.match(css, /@keyframes boss-double-blink/);
  assert.match(css, /@keyframes theft-target-wobble/);
  assert.match(css, /@keyframes theft-portal-open/);
  assert.match(css, /@keyframes stolen-piece/);
  assert.match(css, /@keyframes theft-particle/);
});

test("visuelle Sequenz übernimmt das vorhandene Diebstahlziel und mutiert erst danach", () => {
  assert.match(
    game,
    /const target = await animateBossTheftPrelude\(plan, presentation\);\s*await animateBossTheftCapture\(target, presentation\);\s*applyMutation\(plan, false\);/,
  );
  assert.match(
    game,
    /await animateBossTheftCapture\(target, presentation\);\s*applyMutation\(plan, true\);/,
  );
  assert.doesNotMatch(bossAnimation, /planNovelMutation|recordTheft|shouldStartNormalAttack|solve\(/);
});

test("Zielportal und Partikel bleiben auf das Brett begrenzt und blockieren keine Eingaben", () => {
  assert.match(css, /\.board-wrap\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.theft-portal,\s*\.theft-particles\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(game, /theftEffectBounds\(boardRect, cells\.map/);
  assert.ok((game.match(/finally \{\s*hideBossArena\(\);\s*setInputLocked\(false\);\s*\}/g) ?? []).length >= 2);
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
  assert.match(html, /boss-impact/);
  assert.match(html, /boss-energy/);
  assert.match(html, /boss-horn-fragment/);
  assert.match(css, /@keyframes crown-fly/);
  assert.match(css, /@keyframes boss-crumble/);
  assert.match(css, /@keyframes eyes-last/);
  assert.match(game, /classList\.add\("dying", "portal-unstable"\)/);
});

test("Absolut besitzt drei gesteigerte Trefferreaktionen und einen mehrstufigen finalen Zerfall", () => {
  assert.match(game, /ABSOLUTE_HIT_DURATIONS = Object\.freeze\(\[0, 1100, 1280, 1480\]\)/);
  assert.match(game, /ABSOLUTE_DEATH_DURATION = 4300/);
  assert.match(game, /const hitClass = `hit-\$\{nextHit\}`/);
  assert.match(css, /@keyframes absolute-hit-one/);
  assert.match(css, /@keyframes absolute-hit-two/);
  assert.match(css, /@keyframes absolute-hit-three/);
  assert.match(css, /@keyframes absolute-horn-break/);
  assert.match(css, /@keyframes absolute-death-cracks/);
  assert.match(css, /@keyframes absolute-eye-overload/);
  assert.match(css, /@keyframes absolute-portal-instability/);
  assert.match(css, /@keyframes portal-collapse/);
});

test("Trefferstatus wird bei Absolut sofort aktualisiert", () => {
  assert.match(
    game,
    /recordAbsoluteHit\(state\.boss\);\s*elements\.bossArena\.dataset\.damage = String\(state\.boss\.hits\);\s*renderStatus\(\);/,
  );
});

test("Absolut verliert sein Grinsen stufenweise und zeigt bei 3 keinen Zahn mehr", () => {
  assert.match(css, /\.boss-arena\.is-absolute\[data-damage="1"\][\s\S]*--grin-scale: 0\.78/);
  assert.match(css, /\.boss-arena\.is-absolute\[data-damage="2"\][\s\S]*--grin-scale: 0\.52/);
  assert.match(css, /\.boss-arena\.is-absolute\[data-damage="3"\][\s\S]*--grin-scale: 0\.42/);
  assert.match(css, /\.boss-arena\.is-absolute\[data-damage="3"\][\s\S]*\.boss-mouth i \{\s*opacity: 0/);
  assert.match(css, /\.boss-arena\.is-absolute\[data-damage="3"\][\s\S]*\.boss-mouth::before/);
});

test("Absolut nutzt einmalige Reststein-Trigger von 6 bis 0", () => {
  assert.match(bossEngine, /ABSOLUTE_REMAINING_TRIGGERS = \[6, 5, 4, 3, 2, 1, 0\]/);
  assert.match(bossEngine, /usedAbsoluteTriggers: \[\]/);
  assert.match(bossEngine, /function markAbsoluteTriggerUsed/);
  assert.match(bossEngine, /function rollbackAbsoluteTrigger/);
  assert.match(bossEngine, /function isAbsoluteRunExhausted/);
  assert.doesNotMatch(bossEngine, /function shouldStartAbsoluteRetry/);
  assert.doesNotMatch(game, /shouldStartAbsoluteRetry/);
  assert.match(game, /markAbsoluteTriggerUsed\(state\.boss, remainingCount\)/);
  assert.match(game, /boardComplete && isAbsoluteRunExhausted\(state\.boss\)/);
  assert.match(game, /Kampf verloren · Boss neu starten/);
  assert.match(game, /Absolut ist entkommen\. Öffne „Boss wählen“ und starte den Kampf erneut\./);
  assert.match(game, /isAbsoluteBoss\(state\.boss\) \? planAbsoluteMutation : planNovelMutation/);
  const attackFlow = game.match(/async function runAbsoluteAttack[\s\S]*?\n\}\n\nfunction renderTemplate/)?.[0] ?? "";
  assert.ok(attackFlow);
  assert.ok(
    attackFlow.indexOf("markAbsoluteTriggerUsed(state.boss, remainingCount)")
      < attackFlow.indexOf("setInputLocked(true)"),
    "der Trigger muss vor dem ersten Angriffs-State verbraucht werden",
  );
  assert.ok(
    attackFlow.indexOf("markAbsoluteTriggerUsed(state.boss, remainingCount)")
      < attackFlow.indexOf("state.boss.pendingMutation ?? buildBossMutationPlan"),
    "der Trigger muss vor dem Solverzugriff verbraucht werden",
  );
  const hitFlow = game.match(/async function animateAbsoluteHit\(\) \{[\s\S]*?\n\}\n\nasync function runAbsoluteAttack/)?.[0] ?? "";
  assert.ok(hitFlow);
  assert.doesNotMatch(hitFlow, /runAbsoluteAttack\(\{ alreadyLocked/);
  assert.match(hitFlow, /hideBossArena\(\);\s*setInputLocked\(false\);/);
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
