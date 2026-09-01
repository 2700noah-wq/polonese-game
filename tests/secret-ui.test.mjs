import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const game = readFileSync(new URL("../game.js", import.meta.url), "utf8");
const bossAnimation = readFileSync(new URL("../boss-animation.js", import.meta.url), "utf8");
const bossEngine = readFileSync(new URL("../boss-engine.js", import.meta.url), "utf8");
const secretLevels = readFileSync(new URL("../secret-levels.js", import.meta.url), "utf8");
const gameStorage = readFileSync(new URL("../game-storage.js", import.meta.url), "utf8");
const absoluteLoss = readFileSync(new URL("../absolute-loss.js", import.meta.url), "utf8");

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
  assert.match(game, /finally \{\s*hideBossArena\(\);\s*setInputLocked\(false\);\s*\}/);
  assert.match(game, /finally \{\s*hideBossArena\(\);\s*lost = finalizeAbsoluteAttack[\s\S]*if \(!lost\) setInputLocked\(false\);\s*\}/);
});

test("Touchziel, mobile Bossansicht und Wiederfreigabe der Steuerung sind vorgesehen", () => {
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.boss-creature[\s\S]*width:\s*112px/);
  assert.match(css, /\.boss-arena\.attack-window \.boss-creature[\s\S]*pointer-events:\s*auto/);
  assert.match(game, /setInputLocked\(false\)/);
  assert.match(game, /addEventListener\("pointerdown"/);
});

test("der fokussierbare Absolut-Boss zeigt niemals den rechteckigen Button-Fokus", () => {
  assert.match(game, /elements\.bossCreature\.focus\(\{ preventScroll: true \}\)/);
  assert.match(css, /\.boss-creature\s*\{[\s\S]*appearance:\s*none[\s\S]*outline:\s*none[\s\S]*box-shadow:\s*none/s);
  assert.match(css, /\.boss-creature:focus,\s*\.boss-creature:focus-visible\s*\{[\s\S]*outline:\s*none[\s\S]*box-shadow:\s*none/s);
  assert.match(css, /\.boss-arena\.attack-window \.boss-creature[\s\S]*animation:\s*boss-target-pulse/);
  assert.match(css, /button:focus-visible,\s*a:focus-visible/);
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

test("Neu beginnen initialisiert einen Secret-Bossdurchlauf vollständig neu", () => {
  assert.match(
    game,
    /function initializeSecretBossRun\(bossId,[\s\S]*?resetInteractionState\(\);[\s\S]*?state\.boss = createBossState\(bossId\);[\s\S]*?state\.puzzle = createBossPuzzle\(bossId\);/,
  );
  assert.match(
    game,
    /function restartSecretBoss\(\)[\s\S]*?initializeSecretBossRun\(bossId,/,
  );
  assert.match(
    game,
    /function resetBoard\(\) \{\s*if \(state\.mode === "secret"\) \{\s*restartSecretBoss\(\);\s*return;/,
  );
  assert.match(
    game,
    /function resetInteractionState\(\)[\s\S]*?clearDragSession[\s\S]*?state\.placed\.clear\(\)[\s\S]*?state\.history = \[\][\s\S]*?state\.preview = null[\s\S]*?state\.inputLocked = false[\s\S]*?resetBossPresentation\(\)/,
  );
  assert.match(
    game,
    /function resetBossPresentation\(\)[\s\S]*?hideBossArena\(\)[\s\S]*?removeAttribute\("data-boss"\)[\s\S]*?removeAttribute\("data-damage"\)[\s\S]*?removeAttribute\("style"\)/,
  );
});

test("normale Levelabschlüsse verwenden den eindeutigen Fortschrittszähler", () => {
  const completionFlow = game.match(
    /function completeFixedLevel\(\) \{[\s\S]*?\n\}/,
  )?.[0] ?? "";
  assert.ok(completionFlow);
  assert.match(completionFlow, /recordFixedLevelCompletion\(stats, state\.difficulty, state\.levelIndex\)/);
  assert.doesNotMatch(completionFlow, /totalSolved\s*\+=/);
});

test("geöffnete Dialoge blockieren sämtliche Gameplay-Tastenkürzel", () => {
  assert.match(game, /function isGameDialogOpen\(\) \{\s*return Boolean\(document\.querySelector\("dialog\[open\]"\)\);\s*\}/);
  const hotkeys = game.match(
    /document\.addEventListener\("keydown", \(event\) => \{[\s\S]*?\n\}\);/,
  )?.[0] ?? "";
  assert.ok(hotkeys);
  const guardIndex = hotkeys.indexOf("if (isGameDialogOpen()) return;");
  assert.ok(guardIndex >= 0);
  for (const action of ["rotateSelected()", "flipSelected()", "cancelSelection(", "undo()"]) {
    assert.ok(guardIndex < hotkeys.indexOf(action), `${action} muss hinter der Dialogsperre liegen`);
  }
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
  assert.match(game, /finalizeAbsoluteAttack\(state\.boss, remainingCount\)/);
  assert.match(game, /isAbsoluteBoss\(state\.boss\) \? planAbsoluteMutation : planNovelMutation/);
  assert.match(game, /function hideBossArena\(\)[\s\S]*state\.boss\.attackWindow = false/);
  assert.match(game, /function setInputLocked\(locked\)[\s\S]*state\.boss\.inputLocked = locked/);
  const attackFlow = game.match(/async function runAbsoluteAttack[\s\S]*?\n\}\n\nfunction renderTemplate/)?.[0] ?? "";
  assert.ok(attackFlow);
  assert.ok(
    attackFlow.indexOf("markAbsoluteTriggerUsed(state.boss, remainingCount)")
      < attackFlow.indexOf("setInputLocked(true)"),
    "der Trigger muss vor dem ersten Angriffs-State verbraucht werden",
  );
  assert.ok(
    attackFlow.indexOf("markAbsoluteTriggerUsed(state.boss, remainingCount)")
      < attackFlow.indexOf("buildBossMutationPlan(clonePlacements())"),
    "der Trigger muss vor dem Solverzugriff verbraucht werden",
  );
  const hitFlow = game.match(/async function animateAbsoluteHit[\s\S]*?\n\}\n\nasync function runAbsoluteAttack/)?.[0] ?? "";
  assert.ok(hitFlow);
  assert.doesNotMatch(hitFlow, /runAbsoluteAttack\(\{ alreadyLocked/);
  assert.match(hitFlow, /if \(!keepLocked\) setInputLocked\(false\);/);
});

test("Absolut-Niederlage ist ein expliziter gesperrter State mit verzögertem Retry", () => {
  assert.match(bossEngine, /lost: false/);
  assert.match(bossEngine, /function finalizeAbsoluteAttack/);
  assert.match(bossEngine, /remainingCount !== 0/);
  assert.match(game, /async function enterAbsoluteLoss\(\)/);
  assert.match(game, /setInputLocked\(true\)/);
  assert.match(game, /runAbsoluteLossSequence/);
  assert.match(game, /function setNormalAppInert\(inert\)[\s\S]*elements\.topbar[\s\S]*elements\.appShell[\s\S]*elements\.mobileActionBar[\s\S]*element\.inert = inert/);
  const lossFlow = game.match(/async function enterAbsoluteLoss\(\)[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(lossFlow);
  assert.ok(lossFlow.indexOf("setNormalAppInert(true)") < lossFlow.indexOf("elements.absoluteLossScreen.inert = false"));
  assert.match(game, /if \(lost\) await enterAbsoluteLoss\(\)/);
  assert.match(game, /if \(finalizeAbsoluteAttack\(state\.boss, remainingCount\)\) await enterAbsoluteLoss\(\)/);
  assert.doesNotMatch(game, /Absolut ist entkommen/);
  assert.match(html, /id="absoluteLossScreen"[\s\S]*VERLOREN[\s\S]*id="absoluteRetryButton"[\s\S]*Erneut versuchen/);
  assert.match(css, /\.absolute-loss-screen\.show-title/);
  assert.match(css, /\.absolute-loss-screen\.show-retry/);
  assert.match(absoluteLoss, /titleHold: 2000/);
});

test("Retry stoppt Musik und erzeugt einen vollständig frischen Absolut-Durchlauf", () => {
  const retryFlow = game.match(/elements\.absoluteRetryButton\.addEventListener[\s\S]*?\n\}\);/)?.[0] ?? "";
  assert.ok(retryFlow);
  assert.ok(retryFlow.indexOf("stopAbsoluteLossMusic") < retryFlow.indexOf("restartSecretBoss()"));
  assert.match(game, /function restartSecretBoss\(\)[\s\S]*initializeSecretBossRun\(bossId,/);
  assert.match(game, /function resetInteractionState\(\)[\s\S]*resetAbsoluteLossPresentation\(\)/);
  const resetLossFlow = game.match(/function resetAbsoluteLossPresentation\(\)[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(resetLossFlow);
  assert.ok(resetLossFlow.indexOf("setNormalAppInert(false)") < resetLossFlow.indexOf("elements.absoluteLossScreen.inert = true"));
  assert.match(game, /elements\.absoluteLossScreen\.inert = false[\s\S]*elements\.absoluteRetryButton\.focus/);
  assert.match(game, /state\.boss = createBossState\(bossId\)/);
});

test("Niederlagenmusik ist lokal, klein und gegen blockiertes Autoplay abgesichert", () => {
  assert.match(html, /id="absoluteLossMusic" src="\.\/assets\/absolute-loss\.ogg"/);
  assert.doesNotMatch(html, /https?:\/\/[^"]+absolute-loss/);
  assert.ok(statSync(new URL("../assets/absolute-loss.ogg", import.meta.url)).size > 1000);
  assert.match(absoluteLoss, /playback\?\.catch/);
  assert.match(absoluteLoss, /audio\.pause\(\);\s*audio\.currentTime = 0/);
});

test("game.js verwendet den fehlertoleranten zentralen Storage-Helper", () => {
  assert.match(gameStorage, /function saveStatsToStorage/);
  assert.match(gameStorage, /storageProvider\(\)\.setItem\(storageKey, JSON\.stringify\(stats\)\)/);
  assert.match(gameStorage, /catch \{\s*return false/);
  assert.match(game, /return saveStatsToStorage\(stats, \{ storageKey: STORAGE_KEY \}\)/);
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
  assert.doesNotMatch(validation, /buildBossMutationPlan/);
  assert.doesNotMatch(game, /Dieser Zug blockiert das Secret Level/);
  assert.match(validation, /state\.boss\.pendingMutation = null/);
});

test("Triggerplatzierungen werden sichtbar gerendert, bevor der Solverlauf startet", () => {
  assert.match(game, /import \{ waitForPlacementPaint \} from "\.\/boss-attack-flow\.js/);
  assert.match(game, /function placeCandidate\(candidate\)[\s\S]*?state\.placed\.set[\s\S]*?renderBoard\(\);[\s\S]*?renderTray\(\);[\s\S]*?renderStatus\(\);[\s\S]*?void checkProgress\(\);/);

  const normalFlow = game.match(/async function runNormalBossTheft\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(normalFlow);
  assert.ok(normalFlow.indexOf("setInputLocked(true)") < normalFlow.indexOf("await waitForPlacementPaint()"));
  assert.ok(normalFlow.indexOf("await waitForPlacementPaint()") < normalFlow.indexOf("buildBossMutationPlan(clonePlacements())"));

  const absoluteFlow = game.match(/async function runAbsoluteAttack[\s\S]*?\n\}\n\nfunction renderTemplate/)?.[0] ?? "";
  assert.ok(absoluteFlow);
  assert.ok(absoluteFlow.indexOf("markAbsoluteTriggerUsed(state.boss, remainingCount)") < absoluteFlow.indexOf("await waitForPlacementPaint()"));
  assert.ok(absoluteFlow.indexOf("await waitForPlacementPaint()") < absoluteFlow.indexOf("buildBossMutationPlan(clonePlacements())"));
  assert.match(absoluteFlow, /rollbackAbsoluteTrigger\(state\.boss, remainingCount\)/);
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
