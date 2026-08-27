import {
  BOARD_COLS,
  BOARD_ROWS,
  DIFFICULTIES,
  FIXED_LEVELS_PER_DIFFICULTY,
  PIECES,
  fixedLevelSeed,
  generatePuzzle,
  placementsEqual,
} from "./logic.js?v=20260819-2";
import { createLevelPickerItems } from "./level-picker.js?v=20260820-1";
import { pointerAnchorForPlacement, placementFromBoardPoint } from "./placement-math.js?v=20260821-1";
import {
  runTheftCapture,
  runTheftPrelude,
  theftEffectBounds,
  theftPresentationFor,
} from "./boss-animation.js?v=20260827-mobile-drag-absolute-1";
import { createPuzzleModel } from "./puzzle-model.js?v=20260824-secret-1";
import { sanitizeStats } from "./game-storage.js?v=20260826-boss-phases-1";
import {
  BOSS_CONFIG,
  SECRET_NOTICE_MS,
  bossLockMessage,
  createBossPuzzle,
  createBossSelectionItems,
  isBossUnlocked,
  isSecretModeUnlocked,
  planNovelMutation,
  secretModeLockMessage,
} from "./secret-levels.js?v=20260826-notice-3s-1";
import {
  ABSOLUTE_HITS_TO_WIN,
  NORMAL_BOSS_THEFTS,
  absoluteReactionWindow,
  canFinishBoss,
  createBossState,
  isAbsoluteBoss,
  recordAbsoluteHit,
  recordAbsoluteMiss,
  recordTheft,
  shouldStartAbsoluteAttack,
  shouldStartNormalAttack,
} from "./boss-engine.js?v=20260826-boss-phases-1";

const STORAGE_KEY = "polonese-game-v1";
const DIFFICULTY_ORDER = Object.keys(DIFFICULTIES);
const DRAG_THRESHOLD = 8;
const TOUCH_PREVIEW_LIFT = 64;
const ABSOLUTE_POSITIONS = ["left", "right", "top"];
const ABSOLUTE_HIT_DURATIONS = Object.freeze([0, 1100, 1280, 1480]);
const ABSOLUTE_DEATH_DURATION = 4300;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const elements = {
  body: document.body,
  gamePanel: document.querySelector(".game-panel"),
  modeSelector: document.querySelector("#modeSelector"),
  secretModeButton: document.querySelector("#secretModeButton"),
  secretModeLock: document.querySelector("#secretModeLock"),
  difficultyControls: document.querySelector("#difficultyControls"),
  difficultySelector: document.querySelector("#difficultySelector"),
  difficultyHint: document.querySelector("#difficultyHint"),
  fixedLevelControls: document.querySelector("#fixedLevelControls"),
  secretStatusControls: document.querySelector("#secretStatusControls"),
  secretBossName: document.querySelector("#secretBossName"),
  secretBossStatus: document.querySelector("#secretBossStatus"),
  openSecretPickerButton: document.querySelector("#openSecretPickerButton"),
  previousLevel: document.querySelector("#previousLevel"),
  nextLevel: document.querySelector("#nextLevel"),
  levelPickerButton: document.querySelector("#levelPickerButton"),
  levelNumber: document.querySelector("#levelNumber"),
  levelProgressText: document.querySelector("#levelProgressText"),
  progressBar: document.querySelector("#progressBar"),
  challengeEyebrow: document.querySelector("#challengeEyebrow"),
  challengeTitle: document.querySelector("#challengeTitle"),
  challengeDescription: document.querySelector("#challengeDescription"),
  clueCount: document.querySelector("#clueCount"),
  templateCard: document.querySelector("#templateCard"),
  templateBoard: document.querySelector("#templateBoard"),
  boardCard: document.querySelector("#boardCard"),
  gameBoard: document.querySelector("#gameBoard"),
  placedCounter: document.querySelector("#placedCounter"),
  boardMessage: document.querySelector("#boardMessage"),
  undoButton: document.querySelector("#undoButton"),
  resetButton: document.querySelector("#resetButton"),
  pieceTray: document.querySelector("#pieceTray"),
  selectedPieceLabel: document.querySelector("#selectedPieceLabel"),
  rotateButton: document.querySelector("#rotateButton"),
  flipButton: document.querySelector("#flipButton"),
  mobileActionBar: document.querySelector("#mobileActionBar"),
  mobileSelectedPieceLabel: document.querySelector("#mobileSelectedPieceLabel"),
  mobileRotateButton: document.querySelector("#mobileRotateButton"),
  mobileFlipButton: document.querySelector("#mobileFlipButton"),
  mobileCancelButton: document.querySelector("#mobileCancelButton"),
  statsButton: document.querySelector("#statsButton"),
  headerSolved: document.querySelector("#headerSolved"),
  howButton: document.querySelector("#howButton"),
  toast: document.querySelector("#toast"),
  secretNotice: document.querySelector("#secretNotice"),
  bossArena: document.querySelector("#bossArena"),
  bossCreature: document.querySelector("#bossCreature"),
  winDialog: document.querySelector("#winDialog"),
  winEyebrow: document.querySelector("#winEyebrow"),
  winTitle: document.querySelector("#winTitle"),
  winDescription: document.querySelector("#winDescription"),
  levelPickerDialog: document.querySelector("#levelPickerDialog"),
  levelPickerDifficulty: document.querySelector("#levelPickerDifficulty"),
  levelPickerProgress: document.querySelector("#levelPickerProgress"),
  levelPickerGrid: document.querySelector("#levelPickerGrid"),
  secretPickerDialog: document.querySelector("#secretPickerDialog"),
  secretBossGrid: document.querySelector("#secretBossGrid"),
  statsDialog: document.querySelector("#statsDialog"),
  howDialog: document.querySelector("#howDialog"),
  continueButton: document.querySelector("#continueButton"),
  statsSolved: document.querySelector("#statsSolved"),
  statsSecret: document.querySelector("#statsSecret"),
  statsPercent: document.querySelector("#statsPercent"),
  difficultyStats: document.querySelector("#difficultyStats"),
};

function loadStats() {
  try {
    return sanitizeStats(JSON.parse(localStorage.getItem(STORAGE_KEY)), {
      difficultyIds: DIFFICULTY_ORDER,
      levelsPerDifficulty: FIXED_LEVELS_PER_DIFFICULTY,
    });
  } catch {
    return sanitizeStats(null, {
      difficultyIds: DIFFICULTY_ORDER,
      levelsPerDifficulty: FIXED_LEVELS_PER_DIFFICULTY,
    });
  }
}

const stats = loadStats();
const unlockedAtStartup = isSecretModeUnlocked(stats.completed);
const showStartupUnlockNotice = unlockedAtStartup && !stats.secret.unlockNoticeShown;
if (unlockedAtStartup) stats.secret.unlocked = true;

const state = {
  mode: "fixed",
  difficulty: "easy",
  levelIndex: stats.currentLevel.easy,
  bossId: null,
  boss: null,
  puzzle: null,
  model: null,
  placed: new Map(),
  selectedPieceId: null,
  rotation: 0,
  flipped: false,
  history: [],
  preview: null,
  pickedUpPieceId: null,
  solved: false,
  inputLocked: false,
  pendingUnlockNotice: false,
};

let toastTimeout;
let secretNoticeTimeout;
let dragSession = null;
let dragGhost = null;
let suppressClickUntil = 0;
let bossHitResolver = null;
let bossHitTimeoutId = null;
let activeTheftPortal = null;
let activeTheftParticles = null;

function removeAllDragGhosts({ clearBodyState = true } = {}) {
  dragGhost?.remove();
  document.querySelectorAll(".drag-ghost").forEach((ghost) => ghost.remove());
  dragGhost = null;
  if (clearBodyState) elements.body.classList.remove("dragging-piece");
}

function releaseDragPointer(session) {
  const target = session?.captureTarget;
  if (!target?.releasePointerCapture) return;
  try {
    if (!target.hasPointerCapture || target.hasPointerCapture(session.pointerId)) {
      target.releasePointerCapture(session.pointerId);
    }
  } catch {
    // Der Browser kann die Capture bei pointercancel bereits selbst freigegeben haben.
  }
}

function clearDragSession({ clearPreview = true } = {}) {
  const session = dragSession;
  dragSession = null;
  releaseDragPointer(session);
  removeAllDragGhosts();
  if (clearPreview) state.preview = null;
  return session;
}

function abortDragSession({
  message = "Drag abgebrochen. Der Stein bleibt ausgewählt.",
  restorePickedUp = true,
} = {}) {
  const session = clearDragSession();
  if (!session) return false;
  if (!session.active) return true;

  suppressClickUntil = performance.now() + 400;
  if (restorePickedUp && state.pickedUpPieceId === state.selectedPieceId) {
    cancelSelection({ restorePickedUp: true });
    return true;
  }

  setBoardMessage(message);
  renderBoard();
  renderTray();
  renderStatus();
  return true;
}

function refreshActiveDrag() {
  if (!dragSession?.active || dragSession.pieceId !== state.selectedPieceId) return;
  createDragGhost(dragSession.pieceId, dragSession.pointerAnchor);
  updateActiveDrag({
    clientX: dragSession.lastX,
    clientY: dragSession.lastY,
  }, { allowScroll: false });
}

function saveStats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function wait(milliseconds) {
  const duration = prefersReducedMotion.matches ? Math.min(milliseconds, 45) : milliseconds;
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function clonePlacements() {
  return [...state.placed.values()].map((placement) => ({ ...placement }));
}

function restorePlacements(snapshot) {
  state.placed = new Map(snapshot
    .filter((placement) => state.model.getPiece(placement.pieceId))
    .map((placement) => [placement.pieceId, { ...placement }]));
  invalidatePendingMutation();
}

function pushHistory() {
  state.history.push(clonePlacements());
  if (state.history.length > 80) state.history.shift();
}

function invalidatePendingMutation() {
  if (state.boss) state.boss.pendingMutation = null;
}

function currentPieces() {
  return state.puzzle?.pieces ?? PIECES;
}

function currentPiece(pieceId) {
  return state.model?.getPiece(pieceId);
}

function currentVariants(pieceId) {
  return state.model?.getVariants(pieceId) ?? [];
}

function selectedVariant() {
  if (!state.selectedPieceId) return null;
  const index = state.model.getVariantIndex(state.selectedPieceId, state.rotation, state.flipped);
  return { index, cells: currentVariants(state.selectedPieceId)[index] };
}

function findTransform(pieceId, variantIndex) {
  for (const flipped of [false, true]) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      if (state.model.getVariantIndex(pieceId, rotation, flipped) === variantIndex) return { rotation, flipped };
    }
  }
  return { rotation: 0, flipped: false };
}

function showToast(message, duration = 2500) {
  window.clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimeout = window.setTimeout(() => elements.toast.classList.remove("visible"), duration);
}

function showSecretNotice(message) {
  window.clearTimeout(secretNoticeTimeout);
  elements.secretNotice.textContent = message;
  elements.secretNotice.classList.add("visible");
  secretNoticeTimeout = window.setTimeout(() => {
    elements.secretNotice.classList.remove("visible");
  }, SECRET_NOTICE_MS);
}

function setBoardMessage(message, isError = false) {
  elements.boardMessage.textContent = message;
  elements.boardMessage.classList.toggle("error", isError);
}

function resetInteractionState() {
  clearDragSession({ clearPreview: false });
  state.solved = false;
  state.placed.clear();
  state.selectedPieceId = null;
  state.rotation = 0;
  state.flipped = false;
  state.history = [];
  state.preview = null;
  state.pickedUpPieceId = null;
  state.inputLocked = false;
  elements.body.classList.remove("dragging-piece", "boss-sequence-active");
  clearTheftEffects();
  hideBossArena();
}

function createFixedPuzzle() {
  const generated = generatePuzzle(fixedLevelSeed(state.difficulty, state.levelIndex), state.difficulty);
  const pieces = PIECES.map((piece) => ({ ...piece, cells: piece.cells.map((cell) => [...cell]) }));
  const model = createPuzzleModel({ pieces, rows: BOARD_ROWS, cols: BOARD_COLS });
  return {
    ...generated,
    rows: BOARD_ROWS,
    cols: BOARD_COLS,
    mask: null,
    pieces,
    model,
  };
}

function loadFixedPuzzle() {
  resetInteractionState();
  state.mode = "fixed";
  state.bossId = null;
  state.boss = null;
  state.puzzle = createFixedPuzzle();
  state.model = state.puzzle.model;
  setBoardMessage("Lege zuerst alle Teile aus der Vorlage exakt auf das Spielfeld.");
  renderAll();
}

function startSecretBoss(bossId) {
  if (!isBossUnlocked(bossId, stats.completed, stats.secret)) {
    showSecretNotice(bossLockMessage(bossId));
    return;
  }
  if (elements.secretPickerDialog.open) elements.secretPickerDialog.close();
  resetInteractionState();
  state.mode = "secret";
  state.bossId = bossId;
  state.boss = createBossState(bossId);
  state.puzzle = createBossPuzzle(bossId);
  state.model = state.puzzle.model;
  setBoardMessage("Lege zuerst die Vorlagen-Teile. Der Boss beobachtet jeden Zug.");
  renderAll();
  showToast(`${BOSS_CONFIG[bossId].label}: Der Boss wartet.`);
}

function placementAtCell(cellIndex) {
  return [...state.placed.values()].find((placement) => state.model.placementCells(placement).includes(cellIndex));
}

function clueForPiece(pieceId) {
  return state.puzzle.clues.find((clue) => clue.pieceId === pieceId);
}

function cluePhaseComplete(placements = clonePlacements()) {
  return state.puzzle.clues.every((clue) => placements.some((placement) => placementsEqual(placement, clue)));
}

function reservedOwnerAtCell(cellIndex) {
  return state.puzzle.clues.find((clue) => state.model.placementCells(clue).includes(cellIndex))?.pieceId ?? null;
}

function candidateFromCell(cellIndex) {
  const variant = selectedVariant();
  if (!variant) return null;
  const clickedRow = Math.floor(cellIndex / state.model.cols);
  const clickedCol = cellIndex % state.model.cols;
  return {
    pieceId: state.selectedPieceId,
    variant: variant.index,
    ...placementFromBoardPoint(
      { row: clickedRow + 0.5, col: clickedCol + 0.5 },
      pointerAnchorForPlacement(variant.cells),
    ),
  };
}

function buildBossMutationPlan(placements) {
  if (!state.boss || state.boss.dead) return null;
  return planNovelMutation({
    puzzle: state.puzzle,
    placements,
    bossId: state.bossId,
    serial: state.boss.attackCount + 1,
    attackIndex: state.boss.attackCount,
    seed: `${state.puzzle.seed}-${state.boss.attackCount}-${placements.map((placement) => placement.pieceId).join("-")}`,
  });
}

function validateSecretFuture(placements) {
  if (!state.boss || state.boss.dead) return { valid: true, reason: "" };

  const mustPrepareAttack = isAbsoluteBoss(state.boss)
    ? shouldStartAbsoluteAttack(state.boss, placements.length, currentPieces().length)
    : shouldStartNormalAttack(state.boss, placements.length, currentPieces().length);
  if (!mustPrepareAttack) {
    state.boss.pendingMutation = null;
    return { valid: true, reason: "" };
  }

  // Die Prüfung bereitet einen sicheren Bossangriff nur vor. Sie darf dem
  // Spieler niemals verraten, ob seine aktuelle Anordnung später lösbar ist.
  state.boss.pendingMutation = buildBossMutationPlan(placements);
  return { valid: true, reason: "" };
}

function validateCandidate(candidate) {
  if (!candidate || !state.model.isPlacementInside(candidate)) {
    return { valid: false, reason: "Das Teil ragt über den Rand hinaus." };
  }

  const clue = clueForPiece(candidate.pieceId);
  if (!clue && !cluePhaseComplete()) {
    return { valid: false, reason: "Lege zuerst alle Vorlagen-Teile richtig auf das Feld." };
  }
  if (clue && !placementsEqual(candidate, clue)) {
    return { valid: false, reason: "Dieses Vorlagen-Teil muss exakt an die gezeigte Position." };
  }

  const cells = state.model.placementCells(candidate);
  const occupied = new Set(clonePlacements().flatMap((placement) => state.model.placementCells(placement)));
  if (cells.some((cell) => occupied.has(cell))) {
    return { valid: false, reason: "Dort liegt bereits ein anderes Teil." };
  }

  if (cells.some((cell) => {
    const owner = reservedOwnerAtCell(cell);
    return owner && owner !== candidate.pieceId;
  })) {
    return { valid: false, reason: "Dieses Feld ist für ein Vorlagen-Teil reserviert." };
  }

  if (state.mode === "secret") return validateSecretFuture([...clonePlacements(), candidate]);
  return { valid: true, reason: "" };
}

function interactionBlocked() {
  return state.solved || state.inputLocked;
}

function selectPiece(pieceId) {
  if (interactionBlocked()) return;
  if (state.selectedPieceId === pieceId && !state.placed.has(pieceId)) {
    setBoardMessage(`${currentPiece(pieceId).name} ist bereits ausgewählt. Tippe auf das Feld oder ziehe den Stein.`);
    return;
  }
  if (state.pickedUpPieceId && state.pickedUpPieceId !== pieceId) cancelSelection({ restorePickedUp: true });
  if (state.placed.has(pieceId)) {
    pickUpPiece(pieceId);
    return;
  }
  if (!clueForPiece(pieceId) && !cluePhaseComplete()) {
    const message = "Zuerst müssen alle Vorlagen-Teile richtig liegen.";
    setBoardMessage(message, true);
    showToast(message);
    return;
  }
  state.selectedPieceId = pieceId;
  state.rotation = 0;
  state.flipped = false;
  state.preview = null;
  state.pickedUpPieceId = null;
  invalidatePendingMutation();
  setBoardMessage(`${currentPiece(pieceId).name} ist ausgewählt. Tippe auf das Feld oder ziehe den Stein hinein.`);
  renderBoard();
  renderTray();
}

function pickUpPiece(pieceId) {
  const placement = state.placed.get(pieceId);
  if (!placement || interactionBlocked()) return;
  pushHistory();
  const transform = findTransform(pieceId, placement.variant);
  state.placed.delete(pieceId);
  state.selectedPieceId = pieceId;
  state.rotation = transform.rotation;
  state.flipped = transform.flipped;
  state.preview = null;
  state.pickedUpPieceId = pieceId;
  invalidatePendingMutation();
  setBoardMessage(`${currentPiece(pieceId).name} aufgenommen. Setze es neu.`);
  renderBoard();
  renderTray();
  renderStatus();
}

function placeCandidate(candidate) {
  const wasPickedUp = state.pickedUpPieceId === candidate.pieceId;
  if (!wasPickedUp) pushHistory();
  state.placed.set(candidate.pieceId, candidate);
  state.selectedPieceId = null;
  state.preview = null;
  state.pickedUpPieceId = null;
  state.rotation = 0;
  state.flipped = false;
  const templateFinished = cluePhaseComplete();
  setBoardMessage(templateFinished
    ? "Vorlage vollständig! Jetzt kannst du die übrigen Teile einsetzen."
    : "Passt! Lege das nächste Vorlagen-Teil auf.");
  renderBoard();
  renderTray();
  renderStatus();
  void checkProgress();
}

function placeSelected(cellIndex) {
  if (!state.selectedPieceId || interactionBlocked()) {
    if (!state.inputLocked) setBoardMessage("Wähle zuerst unten einen Spielstein aus.", true);
    return;
  }
  const candidate = candidateFromCell(cellIndex);
  const validation = validateCandidate(candidate);
  if (!validation.valid) {
    setBoardMessage(validation.reason, true);
    showToast(validation.reason);
    return;
  }
  placeCandidate(candidate);
}

function cancelSelection({ restorePickedUp = true } = {}) {
  clearDragSession();
  if (!state.selectedPieceId || state.inputLocked) return;
  if (restorePickedUp && state.pickedUpPieceId === state.selectedPieceId && state.history.length) {
    restorePlacements(state.history.pop());
    setBoardMessage("Der Spielstein liegt wieder an seiner vorherigen Position.");
  } else {
    setBoardMessage("Auswahl aufgehoben.");
  }
  state.selectedPieceId = null;
  state.preview = null;
  state.pickedUpPieceId = null;
  state.rotation = 0;
  state.flipped = false;
  invalidatePendingMutation();
  renderBoard();
  renderTray();
  renderStatus();
}

function rotateSelected() {
  if (!state.selectedPieceId || interactionBlocked()) return;
  state.rotation = (state.rotation + 1) % 4;
  state.preview = null;
  invalidatePendingMutation();
  renderBoard();
  renderTray();
  refreshActiveDrag();
}

function flipSelected() {
  if (!state.selectedPieceId || interactionBlocked()) return;
  state.flipped = !state.flipped;
  state.preview = null;
  invalidatePendingMutation();
  renderBoard();
  renderTray();
  refreshActiveDrag();
}

function undo() {
  if (!state.history.length || interactionBlocked()) return;
  restorePlacements(state.history.pop());
  state.selectedPieceId = null;
  state.preview = null;
  state.pickedUpPieceId = null;
  state.rotation = 0;
  state.flipped = false;
  setBoardMessage("Letzten Zug rückgängig gemacht.");
  renderBoard();
  renderTray();
  renderStatus();
}

function resetBoard() {
  if (!state.placed.size || interactionBlocked()) return;
  pushHistory();
  state.placed.clear();
  state.selectedPieceId = null;
  state.preview = null;
  state.pickedUpPieceId = null;
  state.rotation = 0;
  state.flipped = false;
  invalidatePendingMutation();
  setBoardMessage("Spielfeld geleert – beginne wieder mit den Vorlagen-Teilen.");
  renderBoard();
  renderTray();
  renderStatus();
}

function recordWinAndOpen({ eyebrow, title, description, continueText }) {
  state.solved = true;
  saveStats();
  renderStatus();
  renderStats();
  elements.winEyebrow.textContent = eyebrow;
  elements.winTitle.textContent = title;
  elements.winDescription.textContent = description;
  elements.continueButton.textContent = continueText;
  openDialog(elements.winDialog);
}

function syncSecretUnlockAfterNormalProgress() {
  const unlocked = isSecretModeUnlocked(stats.completed);
  if (!unlocked) return;
  const wasUnlocked = stats.secret.unlocked;
  stats.secret.unlocked = true;
  if (!wasUnlocked && !stats.secret.unlockNoticeShown) state.pendingUnlockNotice = true;
}

function completeFixedLevel() {
  const completed = stats.completed[state.difficulty];
  if (!completed.includes(state.levelIndex)) completed.push(state.levelIndex);
  stats.totalSolved += 1;
  syncSecretUnlockAfterNormalProgress();
  recordWinAndOpen({
    eyebrow: "Aufgabe geschafft",
    title: "Perfekt eingepasst!",
    description: "Jedes Feld ist belegt und alle Vorlagen stimmen.",
    continueText: "Nächstes Level",
  });
}

function completeSecretBoss() {
  if (!stats.secret.completed[state.bossId]) {
    stats.secret.completed[state.bossId] = true;
    stats.totalSolved += 1;
  }
  recordWinAndOpen({
    eyebrow: "Secret Level geschafft",
    title: `${BOSS_CONFIG[state.bossId].label} besiegt!`,
    description: state.bossId === "absolute"
      ? "Der letzte König ist zerfallen. Alle Secret Level sind beendet."
      : "Du hast den veränderten Boss-Puzzleplan vollständig gelöst.",
    continueText: "Secret-Level-Auswahl",
  });
}

async function checkProgress() {
  if (state.inputLocked || state.solved) return;
  const boardComplete = state.model.validateCompletedBoard(clonePlacements(), state.puzzle.clues);
  if (state.mode === "fixed") {
    if (boardComplete) completeFixedLevel();
    return;
  }
  if (isAbsoluteBoss(state.boss)) {
    if (shouldStartAbsoluteAttack(state.boss, state.placed.size, currentPieces().length)) {
      await runAbsoluteAttack();
      return;
    }
    if (canFinishBoss(state.boss, boardComplete)) completeSecretBoss();
    return;
  }
  if (shouldStartNormalAttack(state.boss, state.placed.size, currentPieces().length)) {
    await runNormalBossTheft();
    return;
  }
  if (canFinishBoss(state.boss, boardComplete)) completeSecretBoss();
}

function configureBossArena(position = "top") {
  const config = BOSS_CONFIG[state.bossId];
  const presentation = theftPresentationFor(state.bossId);
  elements.bossArena.className = "boss-arena";
  elements.bossArena.dataset.boss = state.bossId;
  elements.bossArena.dataset.position = position;
  elements.bossArena.dataset.damage = String(state.boss?.hits ?? 0);
  elements.bossArena.style.setProperty("--boss-color", config.color);
  elements.bossArena.style.setProperty("--boss-accent", config.accent);
  elements.bossArena.style.setProperty("--theft-intensity", String(presentation.intensity));
  elements.bossArena.style.setProperty("--boss-search-duration", `${presentation.durations.search}ms`);
  elements.bossArena.style.setProperty("--boss-lock-duration", `${presentation.durations.lock}ms`);
  elements.bossArena.style.setProperty("--boss-snatch-duration", `${presentation.durations.suction}ms`);
  elements.bossArena.style.setProperty("--boss-entry-duration", `${Math.round(180 * presentation.speed)}ms`);
  elements.bossArena.classList.toggle("is-absolute", state.bossId === "absolute");
  elements.bossArena.setAttribute("aria-hidden", "false");
  return presentation;
}

function hideBossArena() {
  window.clearTimeout(bossHitTimeoutId);
  bossHitTimeoutId = null;
  bossHitResolver = null;
  clearTheftEffects();
  if (!elements.bossArena) return;
  elements.bossArena.className = "boss-arena";
  elements.bossArena.removeAttribute("data-position");
  elements.bossArena.setAttribute("aria-hidden", "true");
  elements.bossCreature.tabIndex = -1;
}

function setInputLocked(locked) {
  state.inputLocked = locked;
  elements.body.classList.toggle("boss-sequence-active", locked);
  renderTray();
  renderStatus();
}

function targetCellsFor(pieceId) {
  return [...elements.gameBoard.querySelectorAll(`[data-owner="${pieceId}"]`)];
}

function theftTargetFor(pieceId) {
  const cells = targetCellsFor(pieceId);
  const boardRect = elements.gameBoard.getBoundingClientRect();
  const geometry = theftEffectBounds(boardRect, cells.map((cell) => cell.getBoundingClientRect()));
  return geometry ? { cells, boardRect, geometry } : null;
}

function setBossTargetLook(pieceId) {
  const target = theftTargetFor(pieceId);
  if (!target) return null;
  const bossRect = elements.bossCreature.querySelector(".boss-body")?.getBoundingClientRect();
  if (!bossRect?.width || !bossRect?.height) return target;

  const targetX = target.boardRect.left + target.geometry.targetCenterX;
  const targetY = target.boardRect.top + target.geometry.targetCenterY;
  const deltaX = targetX - (bossRect.left + bossRect.width / 2);
  const deltaY = targetY - (bossRect.top + bossRect.height / 2);
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const lookX = Math.max(-8, Math.min(8, (deltaX / distance) * 8));
  const lookY = Math.max(-6, Math.min(6, (deltaY / distance) * 6));
  const headShiftX = Math.max(-3, Math.min(3, (deltaX / distance) * 3));
  const headShiftY = Math.max(-2, Math.min(3, (deltaY / distance) * 3));
  const headTurn = Math.max(-5, Math.min(5, (deltaX / distance) * 5));

  elements.bossArena.style.setProperty("--target-look-x", `${lookX.toFixed(1)}px`);
  elements.bossArena.style.setProperty("--target-look-y", `${lookY.toFixed(1)}px`);
  elements.bossArena.style.setProperty("--target-head-x", `${headShiftX.toFixed(1)}px`);
  elements.bossArena.style.setProperty("--target-head-y", `${headShiftY.toFixed(1)}px`);
  elements.bossArena.style.setProperty("--target-head-turn", `${headTurn.toFixed(1)}deg`);
  return target;
}

function positionTheftEffect(element, geometry) {
  element.style.left = `${geometry.left}px`;
  element.style.top = `${geometry.top}px`;
  element.style.width = `${geometry.width}px`;
  element.style.height = `${geometry.height}px`;
}

function createTheftPortal(target, presentation) {
  const portal = document.createElement("span");
  portal.className = "theft-portal";
  portal.setAttribute("aria-hidden", "true");
  portal.style.setProperty("--portal-glow", `${Math.round(18 + presentation.intensity * 14)}px`);
  portal.style.setProperty("--portal-inner-glow", `${Math.round(13 + presentation.intensity * 10)}px`);
  portal.style.setProperty("--portal-ring", `${Math.max(2, target.geometry.cellSize * 0.09).toFixed(1)}px`);
  portal.style.setProperty("--portal-inner-ring", `${Math.max(1, target.geometry.cellSize * 0.05).toFixed(1)}px`);
  portal.style.setProperty("--portal-duration", `${presentation.durations.suction}ms`);
  portal.style.setProperty("--particle-duration", `${presentation.durations.particles}ms`);
  positionTheftEffect(portal, target.geometry);
  for (let index = 0; index < 3; index += 1) portal.append(document.createElement("i"));
  elements.gameBoard.append(portal);
  activeTheftPortal = portal;
  portal.getBoundingClientRect();
  portal.classList.add("active");
  return portal;
}

function markTheftTarget(target, presentation) {
  const distance = Math.max(2, Math.min(5, 1.8 + presentation.intensity * 1.7));
  target.cells.forEach((cell) => {
    cell.style.setProperty("--wobble-distance", `${distance.toFixed(1)}px`);
    cell.style.setProperty("--wobble-negative", `${(-distance).toFixed(1)}px`);
    cell.style.setProperty("--wobble-negative-soft", `${(-distance * 0.65).toFixed(1)}px`);
    cell.style.setProperty("--wobble-positive-soft", `${(distance * 0.55).toFixed(1)}px`);
    cell.style.setProperty("--wobble-duration", `${presentation.durations.wobble}ms`);
    cell.classList.add("theft-target-wobble");
  });
}

function markStolenPiece(target, presentation) {
  target.cells.forEach((cell) => {
    const rect = cell.getBoundingClientRect();
    const cellCenterX = rect.left - target.boardRect.left + rect.width / 2;
    const cellCenterY = rect.top - target.boardRect.top + rect.height / 2;
    const pullX = Math.max(-16, Math.min(16, (target.geometry.centerX - cellCenterX) * 0.34));
    const pullY = Math.max(-12, Math.min(12, (target.geometry.centerY - cellCenterY) * 0.34));
    cell.style.setProperty("--suck-step-x", `${(pullX * 0.48).toFixed(1)}px`);
    cell.style.setProperty("--suck-step-y", `${(pullY * 0.48).toFixed(1)}px`);
    cell.style.setProperty("--suck-final-x", `${pullX.toFixed(1)}px`);
    cell.style.setProperty("--suck-final-y", `${pullY.toFixed(1)}px`);
    cell.style.setProperty("--suction-duration", `${presentation.durations.suction}ms`);
    cell.classList.remove("theft-target-wobble");
    cell.classList.add("being-stolen");
  });
}

function createTheftParticles(target, presentation) {
  const particles = document.createElement("span");
  particles.className = "theft-particles";
  particles.setAttribute("aria-hidden", "true");
  particles.style.setProperty("--particle-duration", `${presentation.durations.particles}ms`);
  positionTheftEffect(particles, target.geometry);

  for (let index = 0; index < presentation.particles; index += 1) {
    const particle = document.createElement("i");
    const progress = (index + 0.5) / presentation.particles;
    const angle = progress * Math.PI * 4.8 + presentation.intensity;
    const startX = target.geometry.width * (0.18 + ((index * 37) % 64) / 100);
    const startY = target.geometry.height * (0.2 + ((index * 53) % 60) / 100);
    const travel = target.geometry.cellSize * (0.42 + presentation.intensity * 0.28 + (index % 3) * 0.09);
    const size = Math.max(2.5, Math.min(7, target.geometry.cellSize * (0.07 + presentation.intensity * 0.025)));
    particle.style.left = `${startX.toFixed(1)}px`;
    particle.style.top = `${startY.toFixed(1)}px`;
    particle.style.setProperty("--particle-x", `${(Math.cos(angle) * travel).toFixed(1)}px`);
    particle.style.setProperty("--particle-y", `${(Math.sin(angle) * travel).toFixed(1)}px`);
    particle.style.setProperty("--particle-size", `${size.toFixed(1)}px`);
    particles.append(particle);
  }
  elements.gameBoard.append(particles);
  activeTheftParticles = particles;
  return particles;
}

function clearTheftEffects() {
  activeTheftPortal?.remove();
  activeTheftParticles?.remove();
  activeTheftPortal = null;
  activeTheftParticles = null;
  elements.gameBoard?.querySelectorAll(".theft-target-wobble, .being-stolen").forEach((cell) => {
    cell.classList.remove("theft-target-wobble", "being-stolen");
    [
      "--wobble-distance",
      "--wobble-negative",
      "--wobble-negative-soft",
      "--wobble-positive-soft",
      "--wobble-duration",
      "--suck-step-x",
      "--suck-step-y",
      "--suck-final-x",
      "--suck-final-y",
      "--suction-duration",
    ].forEach((property) => cell.style.removeProperty(property));
  });
}

async function animateBossTheftPrelude(plan, presentation) {
  const target = await runTheftPrelude(presentation, {
    startSearch() {
      elements.bossArena.classList.add("visible", "searching");
    },
    lockTarget() {
      elements.bossArena.classList.remove("searching");
      const lockedTarget = setBossTargetLook(plan.stolen.piece.id);
      elements.bossArena.classList.add("targeting", "target-locked", "blink-confirm", "grinning");
      return lockedTarget;
    },
    wait,
  });
  elements.bossArena.classList.remove("blink-confirm");
  return target;
}

async function animateBossTheftCapture(target, presentation) {
  await runTheftCapture(presentation, target, {
    warnTarget(lockedTarget) {
      markTheftTarget(lockedTarget, presentation);
    },
    startSuction(lockedTarget) {
      const portal = createTheftPortal(lockedTarget, presentation);
      markStolenPiece(lockedTarget, presentation);
      elements.bossArena.classList.add("stealing");
      return portal;
    },
    releaseParticles(lockedTarget, portal) {
      portal.classList.add("closing");
      createTheftParticles(lockedTarget, presentation);
    },
    wait,
  });
}

function applyMutation(plan, absoluteMiss = false) {
  state.placed.delete(plan.stolen.piece.id);
  state.puzzle = {
    ...state.puzzle,
    pieces: plan.pieces,
    clues: plan.clues,
    solution: plan.solution,
    model: plan.model,
  };
  state.model = plan.model;
  state.history = [];
  state.selectedPieceId = null;
  state.preview = null;
  state.pickedUpPieceId = null;
  state.rotation = 0;
  state.flipped = false;
  if (absoluteMiss) recordAbsoluteMiss(state.boss, plan.stolen);
  else recordTheft(state.boss, plan.stolen);
  renderAll();
}

async function runNormalBossTheft() {
  const plan = state.boss.pendingMutation ?? buildBossMutationPlan(clonePlacements());
  if (!plan) {
    setBoardMessage("Der Boss beobachtet weiter. Du kannst deine Anordnung jederzeit verändern.");
    return;
  }
  const position = ["right", "left", "top"][state.boss.thefts.length % 3];
  setInputLocked(true);
  const presentation = configureBossArena(position);
  try {
    const target = await animateBossTheftPrelude(plan, presentation);
    await animateBossTheftCapture(target, presentation);
    applyMutation(plan, false);
    setBoardMessage(`Der Boss hat ${plan.stolen.piece.name} gestohlen und ${plan.replacement.name} zurückgelassen.`);
    showToast(`Bossangriff ${state.boss.thefts.length} von ${NORMAL_BOSS_THEFTS}`);
    await wait(140);
  } finally {
    hideBossArena();
    setInputLocked(false);
  }
}

function chooseAbsolutePosition() {
  const previous = state.boss.lastPosition;
  const available = ABSOLUTE_POSITIONS.filter((position) => position !== previous);
  const values = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(values);
  const position = available[(values[0] || state.boss.attackCount) % available.length];
  state.boss.lastPosition = position;
  return position;
}

function waitForBossHit(milliseconds) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (hit) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(bossHitTimeoutId);
      bossHitTimeoutId = null;
      bossHitResolver = null;
      state.boss.attackWindow = false;
      elements.bossArena.classList.remove("attack-window");
      elements.bossCreature.tabIndex = -1;
      resolve(hit);
    };
    bossHitResolver = () => finish(true);
    bossHitTimeoutId = window.setTimeout(() => finish(false), milliseconds);
    state.boss.attackWindow = true;
    elements.bossArena.classList.add("attack-window");
    elements.bossCreature.tabIndex = 0;
    elements.bossCreature.focus({ preventScroll: true });
  });
}

async function animateAbsoluteHit() {
  const nextHit = state.boss.hits + 1;
  const hitClass = `hit-${nextHit}`;
  elements.bossArena.classList.remove("searching", "targeting", "target-locked", "blink-confirm", "grinning");
  elements.bossArena.classList.remove("hit-1", "hit-2", "hit-3", "portal-unstable");
  elements.bossArena.classList.add("hit", hitClass);
  if (nextHit === 1) elements.bossArena.classList.add("crown-fly");
  if (nextHit === 3) elements.bossArena.classList.add("portal-unstable");
  await wait(ABSOLUTE_HIT_DURATIONS[nextHit]);
  recordAbsoluteHit(state.boss);
  elements.bossArena.dataset.damage = String(state.boss.hits);
  renderStatus();
  elements.bossArena.classList.remove("hit", "crown-fly", hitClass);

  if (state.boss.dead) {
    elements.bossArena.classList.add("dying", "portal-unstable");
    setBoardMessage("Der Endboss zerbricht …");
    await wait(ABSOLUTE_DEATH_DURATION);
    hideBossArena();
    setInputLocked(false);
    setBoardMessage("Absolut ist besiegt. Fülle jetzt das aktuelle Spielfeld vollständig.");
    renderStatus();
    if (state.model.validateCompletedBoard(clonePlacements(), state.puzzle.clues)) completeSecretBoss();
    return;
  }

  setBoardMessage(`Treffer ${state.boss.hits} von ${ABSOLUTE_HITS_TO_WIN}! Der Boss wird wütender.`);
  await wait(520);
  hideBossArena();
  await wait(900);
  await runAbsoluteAttack({ alreadyLocked: true });
}

async function runAbsoluteAttack({ alreadyLocked = false } = {}) {
  if (state.boss.dead || state.solved) {
    if (alreadyLocked) setInputLocked(false);
    return;
  }
  const plan = buildBossMutationPlan(clonePlacements());
  if (!plan) {
    setBoardMessage("Das Portal bleibt vorerst geschlossen. Du kannst deine Anordnung weiter verändern.");
    if (alreadyLocked) setInputLocked(false);
    return;
  }

  if (!alreadyLocked) setInputLocked(true);
  const position = chooseAbsolutePosition();
  const presentation = configureBossArena(position);
  elements.bossArena.classList.add("portal-open");
  await wait(Math.round(300 * presentation.speed));
  const target = await animateBossTheftPrelude(plan, presentation);
  setBoardMessage("Der Boss fixiert einen Stein …");
  const hit = await waitForBossHit(absoluteReactionWindow(state.boss.hits));

  if (hit) {
    await animateAbsoluteHit();
    return;
  }

  try {
    await animateBossTheftCapture(target, presentation);
    applyMutation(plan, true);
    setBoardMessage(`Zu spät! Absolut hat ${plan.stolen.piece.name} durch ${plan.replacement.name} ersetzt.`);
    showToast(`Angriff verpasst · ${state.boss.hits} von ${ABSOLUTE_HITS_TO_WIN} Treffern bleiben erhalten`);
    await wait(140);
  } finally {
    hideBossArena();
    setInputLocked(false);
  }
}

function renderTemplate() {
  const cellOwners = new Map();
  state.puzzle.clues.forEach((clue) => {
    state.model.placementCells(clue).forEach((cell) => cellOwners.set(cell, clue.pieceId));
  });
  elements.templateBoard.replaceChildren();
  for (let index = 0; index < BOARD_ROWS * BOARD_COLS; index += 1) {
    const cell = document.createElement("span");
    cell.className = "template-cell";
    const owner = cellOwners.get(index);
    if (owner) {
      cell.classList.add("filled");
      cell.style.setProperty("--piece-color", currentPiece(owner).color);
      cell.title = currentPiece(owner).name;
    }
    elements.templateBoard.append(cell);
  }
}

function renderBoard() {
  const occupied = new Map();
  state.placed.forEach((placement) => {
    state.model.placementCells(placement).forEach((cell) => occupied.set(cell, placement.pieceId));
  });
  const clueIds = new Set(state.puzzle.clues.map((clue) => clue.pieceId));
  const previewCells = state.preview ? new Set(state.model.placementCells(state.preview.placement)) : new Set();

  elements.gameBoard.style.setProperty("--board-cols", state.model.cols);
  elements.gameBoard.style.setProperty("--board-rows", state.model.rows);
  elements.gameBoard.setAttribute("aria-label", `Spielfeld mit ${state.model.rows} Reihen und ${state.model.cols} Spalten`);
  elements.gameBoard.replaceChildren();
  for (let index = 0; index < state.model.rows * state.model.cols; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "board-cell";
    button.dataset.cell = String(index);
    button.setAttribute("role", "gridcell");
    if (!state.model.activeCells.has(index)) {
      button.classList.add("board-void");
      button.disabled = true;
      button.tabIndex = -1;
      elements.gameBoard.append(button);
      continue;
    }
    const owner = occupied.get(index);
    if (owner) {
      const piece = currentPiece(owner);
      button.classList.add("filled");
      button.dataset.owner = owner;
      if (clueIds.has(owner)) button.classList.add("clue-piece");
      button.style.setProperty("--piece-color", piece.color);
      button.title = `${piece.name} aufnehmen`;
      button.setAttribute("aria-label", `${piece.name}, gesetztes Teil`);
    } else {
      button.setAttribute("aria-label", `Feld ${index + 1}`);
    }
    if (previewCells.has(index)) {
      button.classList.add("preview-piece");
      button.style.setProperty("--selected-color", currentPiece(state.preview.placement.pieceId).color);
    }
    elements.gameBoard.append(button);
  }
}

function miniPiece(pieceId, variantIndex = 0) {
  const variant = currentVariants(pieceId)[variantIndex] ?? currentVariants(pieceId)[0];
  const maxRow = Math.max(...variant.map(([row]) => row));
  const maxCol = Math.max(...variant.map(([, col]) => col));
  const wrapper = document.createElement("span");
  wrapper.className = "mini-piece";
  const unit = 11;
  const width = (maxCol + 1) * unit;
  const height = (maxRow + 1) * unit;
  variant.forEach(([row, col]) => {
    const ball = document.createElement("i");
    ball.className = "mini-ball";
    ball.style.left = `calc(50% - ${width / 2}px + ${col * unit}px)`;
    ball.style.top = `calc(50% - ${height / 2}px + ${row * unit}px)`;
    wrapper.append(ball);
  });
  return wrapper;
}

function renderTray() {
  if (!state.puzzle || !state.model) return;
  const clueIds = new Set(state.puzzle.clues.map((clue) => clue.pieceId));
  const templateFinished = cluePhaseComplete();
  elements.pieceTray.replaceChildren();
  currentPieces().forEach((piece) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "piece-card";
    card.dataset.piece = piece.id;
    card.style.setProperty("--piece-color", piece.color);
    const placed = state.placed.get(piece.id);
    const locked = !clueIds.has(piece.id) && !templateFinished && !placed;
    if (placed) card.classList.add("placed");
    if (piece.bossPiece) card.classList.add("boss-piece");
    if (locked || state.inputLocked) {
      card.classList.toggle("locked", locked);
      card.disabled = true;
      card.title = locked ? "Wird nach der vollständigen Vorlage freigeschaltet" : "Bossanimation läuft";
    }
    if (state.selectedPieceId === piece.id) card.classList.add("selected");
    if (clueIds.has(piece.id)) card.classList.add("is-clue");
    const variantIndex = state.selectedPieceId === piece.id ? selectedVariant().index : placed?.variant ?? 0;
    card.append(miniPiece(piece.id, variantIndex));
    const name = document.createElement("strong");
    name.textContent = piece.name;
    const hint = document.createElement("small");
    hint.textContent = placed ? "gesetzt" : clueIds.has(piece.id) ? "zuerst platzieren" : locked ? "noch gesperrt" : "frei platzieren";
    card.append(name, hint);
    card.setAttribute("aria-pressed", String(state.selectedPieceId === piece.id));
    elements.pieceTray.append(card);
  });

  const selected = state.selectedPieceId ? currentPiece(state.selectedPieceId) : null;
  elements.selectedPieceLabel.textContent = selected ? `${selected.name} ausgewählt` : "Teil auswählen";
  elements.rotateButton.disabled = !selected || state.inputLocked;
  elements.flipButton.disabled = !selected || state.inputLocked;
  elements.mobileSelectedPieceLabel.textContent = selected?.name ?? "Kein Teil";
  elements.mobileRotateButton.disabled = !selected || state.inputLocked;
  elements.mobileFlipButton.disabled = !selected || state.inputLocked;
  elements.mobileCancelButton.disabled = !selected || state.inputLocked;
  elements.mobileActionBar.classList.remove("hidden");
  elements.mobileActionBar.classList.toggle("has-selection", Boolean(selected));
  elements.body.classList.toggle("piece-selected", Boolean(selected));
}

function renderStatus() {
  if (!state.puzzle || !state.model) return;
  const completed = stats.completed[state.difficulty];
  const fixedSolved = DIFFICULTY_ORDER.reduce((sum, difficulty) => sum + stats.completed[difficulty].length, 0);
  const secretUnlocked = isSecretModeUnlocked(stats.completed);

  elements.modeSelector.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
  elements.secretModeButton.classList.toggle("locked", !secretUnlocked);
  elements.secretModeLock.textContent = secretUnlocked ? "🔓" : "🔒";
  elements.secretModeButton.setAttribute("aria-label", `Secret Level, ${secretUnlocked ? "freigeschaltet" : "gesperrt"}`);
  elements.difficultyControls.classList.toggle("hidden", state.mode === "secret");
  elements.fixedLevelControls.classList.toggle("hidden", state.mode !== "fixed");
  elements.secretStatusControls.classList.toggle("hidden", state.mode !== "secret");
  elements.gamePanel.classList.toggle("secret-active", state.mode === "secret");

  elements.difficultySelector.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.classList.toggle("active", button.dataset.difficulty === state.difficulty);
  });
  elements.difficultyHint.textContent = DIFFICULTIES[state.difficulty].description;
  elements.levelNumber.textContent = String(state.levelIndex + 1).padStart(2, "0");
  elements.levelPickerButton.setAttribute("aria-label", `Level ${state.levelIndex + 1} auswählen`);
  elements.levelProgressText.textContent = `${completed.length} / ${FIXED_LEVELS_PER_DIFFICULTY} geschafft`;
  elements.progressBar.style.width = `${(completed.length / FIXED_LEVELS_PER_DIFFICULTY) * 100}%`;
  elements.previousLevel.disabled = state.levelIndex === 0;
  elements.nextLevel.disabled = state.levelIndex === FIXED_LEVELS_PER_DIFFICULTY - 1;

  if (state.mode === "secret") {
    elements.secretBossName.textContent = BOSS_CONFIG[state.bossId].label;
    if (isAbsoluteBoss(state.boss)) {
      elements.secretBossStatus.textContent = state.boss.dead
        ? "Boss besiegt · Puzzle beenden"
        : `Treffer ${state.boss.hits} / ${ABSOLUTE_HITS_TO_WIN}`;
    } else {
      elements.secretBossStatus.textContent = `Bossangriffe ${state.boss.attackCount} / ${NORMAL_BOSS_THEFTS}`;
    }
    elements.challengeEyebrow.textContent = `Secret Level · ${BOSS_CONFIG[state.bossId].label}`;
    elements.challengeTitle.textContent = "Besiege den Boss.";
    elements.challengeDescription.textContent = isAbsoluteBoss(state.boss)
      ? "Achte auf wechselnde Portale. Der Boss selbst verrät dir, wann du eingreifen kannst."
      : "Löse das Puzzle weiter, auch wenn der Boss deine Anordnung dreimal verändert.";
  } else {
    elements.challengeEyebrow.textContent = "Deine Herausforderung";
    elements.challengeTitle.textContent = "Fülle jedes Feld.";
    elements.challengeDescription.textContent = "Lege zuerst alle Teile exakt wie auf der Vorlage. Erst danach werden die übrigen Teile freigeschaltet – fülle das Feld ohne Lücken und Überlappungen.";
  }

  elements.clueCount.textContent = String(state.puzzle.clues.length);
  elements.placedCounter.textContent = `${state.placed.size} / ${currentPieces().length} Teile`;
  elements.headerSolved.textContent = String(stats.totalSolved);
  elements.undoButton.disabled = state.history.length === 0 || interactionBlocked();
  elements.resetButton.disabled = state.placed.size === 0 || interactionBlocked();
  elements.statsPercent.textContent = `${Math.round((fixedSolved / (FIXED_LEVELS_PER_DIFFICULTY * DIFFICULTY_ORDER.length)) * 100)} %`;
}

function renderStats() {
  const fixedSolved = DIFFICULTY_ORDER.reduce((sum, difficulty) => sum + stats.completed[difficulty].length, 0);
  const secretSolved = Object.values(stats.secret.completed).filter(Boolean).length;
  elements.statsSolved.textContent = String(stats.totalSolved);
  elements.statsSecret.textContent = `${secretSolved} / 5`;
  elements.statsPercent.textContent = `${Math.round((fixedSolved / (FIXED_LEVELS_PER_DIFFICULTY * DIFFICULTY_ORDER.length)) * 100)} %`;
  elements.difficultyStats.replaceChildren();
  DIFFICULTY_ORDER.forEach((difficulty) => {
    const solved = stats.completed[difficulty].length;
    const row = document.createElement("div");
    row.className = "difficulty-stat-row";
    row.innerHTML = `<span>${DIFFICULTIES[difficulty].label}</span><div class="bar"><i style="width:${(solved / FIXED_LEVELS_PER_DIFFICULTY) * 100}%"></i></div><small>${solved}/${FIXED_LEVELS_PER_DIFFICULTY}</small>`;
    elements.difficultyStats.append(row);
  });
}

function renderLevelPicker() {
  const completed = stats.completed[state.difficulty];
  const items = createLevelPickerItems(FIXED_LEVELS_PER_DIFFICULTY, state.levelIndex, completed);
  elements.levelPickerDifficulty.textContent = DIFFICULTIES[state.difficulty].label;
  elements.levelPickerProgress.textContent = `${completed.length} von ${FIXED_LEVELS_PER_DIFFICULTY} geschafft`;
  elements.levelPickerGrid.setAttribute("aria-label", `${DIFFICULTIES[state.difficulty].label}: Level 1 bis ${FIXED_LEVELS_PER_DIFFICULTY}`);
  elements.levelPickerGrid.replaceChildren();
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.levelIndex = String(item.index);
    button.textContent = String(item.number);
    button.classList.toggle("completed", item.completed);
    button.classList.toggle("current", item.current);
    button.setAttribute("aria-current", item.current ? "page" : "false");
    button.setAttribute("aria-label", `Level ${item.number}${item.current ? ", aktuell" : ""}${item.completed ? ", geschafft" : ""}`);
    elements.levelPickerGrid.append(button);
  });
}

function renderSecretPicker() {
  const items = createBossSelectionItems(stats.completed, stats.secret);
  elements.secretBossGrid.replaceChildren();
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secret-boss-card";
    button.dataset.boss = item.id;
    button.style.setProperty("--boss-card-color", item.color);
    button.classList.toggle("locked", !item.unlocked);
    button.classList.toggle("completed", item.completed);
    button.setAttribute("aria-label", `${item.label}, ${item.completed ? "besiegt" : item.unlocked ? "freigeschaltet" : "gesperrt"}`);
    const face = document.createElement("span");
    face.className = "boss-card-face";
    face.innerHTML = "<i></i><span></span>";
    const lock = document.createElement("span");
    lock.className = "boss-card-lock";
    lock.textContent = item.completed ? "✓" : item.unlocked ? "🔓" : "🔒";
    const name = document.createElement("strong");
    name.textContent = item.label;
    const subtitle = document.createElement("small");
    subtitle.textContent = item.completed ? "Besiegt" : item.unlocked ? item.personality : "Gesperrt";
    button.append(face, lock, name, subtitle);
    elements.secretBossGrid.append(button);
  });
}

function renderAll() {
  renderTemplate();
  renderBoard();
  renderTray();
  renderStatus();
  renderStats();
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function openSecretPicker() {
  if (!isSecretModeUnlocked(stats.completed)) {
    showSecretNotice(secretModeLockMessage());
    return;
  }
  renderSecretPicker();
  openDialog(elements.secretPickerDialog);
}

function moveLevel(delta) {
  const next = Math.max(0, Math.min(FIXED_LEVELS_PER_DIFFICULTY - 1, state.levelIndex + delta));
  if (next === state.levelIndex) return;
  state.levelIndex = next;
  stats.currentLevel[state.difficulty] = next;
  saveStats();
  loadFixedPuzzle();
}

function chooseLevel(levelIndex) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= FIXED_LEVELS_PER_DIFFICULTY) return;
  elements.levelPickerDialog.close();
  if (levelIndex === state.levelIndex) return;
  state.levelIndex = levelIndex;
  stats.currentLevel[state.difficulty] = levelIndex;
  saveStats();
  loadFixedPuzzle();
}

function boardPointFromPointer(clientX, clientY, pointerType) {
  const boardRect = elements.gameBoard.getBoundingClientRect();
  let targetY = clientY;
  if (pointerType === "touch") {
    const liftedY = clientY - TOUCH_PREVIEW_LIFT;
    if (liftedY >= boardRect.top && liftedY <= boardRect.bottom) targetY = liftedY;
  }
  if (clientX < boardRect.left || clientX > boardRect.right || targetY < boardRect.top || targetY > boardRect.bottom) return null;
  return {
    row: ((targetY - boardRect.top) / boardRect.height) * state.model.rows,
    col: ((clientX - boardRect.left) / boardRect.width) * state.model.cols,
  };
}

function createDragGhost(pieceId, pointerAnchor) {
  removeAllDragGhosts({ clearBodyState: false });
  const variant = selectedVariant();
  if (!variant) return;
  const boardCell = elements.gameBoard.querySelector(".board-cell:not(.board-void)");
  const boardUnit = boardCell?.getBoundingClientRect().width ?? 28;
  const unit = Math.max(18, Math.min(34, boardUnit));
  const maxRow = Math.max(...variant.cells.map(([row]) => row));
  const maxCol = Math.max(...variant.cells.map(([, col]) => col));
  dragGhost = document.createElement("div");
  dragGhost.className = "drag-ghost";
  dragGhost.style.setProperty("--piece-color", currentPiece(pieceId).color);
  dragGhost.style.setProperty("--drag-unit", `${unit}px`);
  dragGhost.style.width = `${(maxCol + 1) * unit}px`;
  dragGhost.style.height = `${(maxRow + 1) * unit}px`;
  dragGhost.dataset.anchorRow = String(pointerAnchor.row);
  dragGhost.dataset.anchorCol = String(pointerAnchor.col);
  variant.cells.forEach(([row, col]) => {
    const ball = document.createElement("i");
    ball.style.left = `${col * unit}px`;
    ball.style.top = `${row * unit}px`;
    dragGhost.append(ball);
  });
  document.body.append(dragGhost);
}

function moveDragGhost(clientX, clientY, pointerType) {
  if (!dragGhost) return;
  const unit = Number.parseFloat(getComputedStyle(dragGhost).getPropertyValue("--drag-unit"));
  const anchorRow = Number(dragGhost.dataset.anchorRow);
  const anchorCol = Number(dragGhost.dataset.anchorCol);
  const lift = pointerType === "touch" ? TOUCH_PREVIEW_LIFT : 0;
  dragGhost.style.left = `${clientX - ((anchorCol + 0.5) * unit)}px`;
  dragGhost.style.top = `${clientY - lift - ((anchorRow + 0.5) * unit)}px`;
}

function beginPotentialDrag(event, pieceId, source, sourceCellIndex = null) {
  if (interactionBlocked() || (event.pointerType === "mouse" && event.button !== 0)) return;
  if (dragSession) {
    if (dragSession.active || dragSession.pointerId === event.pointerId) return;
    clearDragSession();
  }
  const captureTarget = event.currentTarget;
  try {
    captureTarget?.setPointerCapture?.(event.pointerId);
  } catch {
    // Pointer-Capture ist eine zusätzliche Absicherung; globale Listener bleiben aktiv.
  }
  dragSession = {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    pieceId,
    source,
    sourceCellIndex,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    active: false,
    pointerAnchor: null,
    captureTarget,
  };
}

function activateDrag(event) {
  if (!dragSession || dragSession.active || state.inputLocked) return;
  const originalPlacement = state.placed.get(dragSession.pieceId);
  if (dragSession.source === "board" && originalPlacement) {
    const boardRow = Math.floor(dragSession.sourceCellIndex / state.model.cols);
    const boardCol = dragSession.sourceCellIndex % state.model.cols;
    dragSession.pointerAnchor = {
      row: boardRow - originalPlacement.row + 0.5,
      col: boardCol - originalPlacement.col + 0.5,
    };
  }
  if (state.selectedPieceId !== dragSession.pieceId || originalPlacement) selectPiece(dragSession.pieceId);
  if (state.selectedPieceId !== dragSession.pieceId) {
    dragSession = null;
    return;
  }
  const variant = selectedVariant();
  dragSession.pointerAnchor ??= pointerAnchorForPlacement(variant.cells);
  dragSession.active = true;
  dragSession.lastX = event.clientX;
  dragSession.lastY = event.clientY;
  elements.body.classList.add("dragging-piece");
  createDragGhost(dragSession.pieceId, dragSession.pointerAnchor);
  moveDragGhost(event.clientX, event.clientY, dragSession.pointerType);
}

function updateActiveDrag(event, { allowScroll = true } = {}) {
  if (!dragSession?.active || state.inputLocked) return;
  dragSession.lastX = event.clientX;
  dragSession.lastY = event.clientY;
  moveDragGhost(event.clientX, event.clientY, dragSession.pointerType);
  const point = boardPointFromPointer(event.clientX, event.clientY, dragSession.pointerType);
  const placement = point === null ? null : {
    pieceId: state.selectedPieceId,
    variant: selectedVariant().index,
    ...placementFromBoardPoint(point, dragSession.pointerAnchor),
  };
  const key = placement ? `${placement.pieceId}:${placement.variant}:${placement.row}:${placement.col}` : "outside";
  if (state.preview?.key !== key) {
    state.preview = placement ? { key, placement } : null;
    renderBoard();
  }
  if (allowScroll && dragSession.pointerType === "touch") {
    const edge = 54;
    if (event.clientY < edge) window.scrollBy(0, -12);
    if (event.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
  }
}

function finishDrag(event, cancelled = false) {
  if (!dragSession || event.pointerId !== dragSession.pointerId) return;
  if (!dragSession.active) {
    clearDragSession();
    return;
  }
  if (!cancelled) updateActiveDrag(event);
  const candidate = !cancelled ? state.preview?.placement : null;
  const validation = candidate ? validateCandidate(candidate) : { valid: false, reason: "Ziehe den Stein vollständig auf das Spielfeld." };
  clearDragSession();
  suppressClickUntil = performance.now() + 400;
  if (validation.valid) {
    placeCandidate(candidate);
    return;
  }
  if (state.pickedUpPieceId === state.selectedPieceId) {
    cancelSelection({ restorePickedUp: true });
  } else {
    setBoardMessage(cancelled ? "Der Stein bleibt ausgewählt." : validation.reason, !cancelled);
    renderBoard();
    renderTray();
    if (!cancelled) showToast(validation.reason);
  }
}

elements.modeSelector.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (!button) return;
  if (button.dataset.mode === "secret") {
    openSecretPicker();
    return;
  }
  if (state.mode !== "fixed") loadFixedPuzzle();
});

elements.difficultySelector.addEventListener("click", (event) => {
  const button = event.target.closest("[data-difficulty]");
  if (!button || button.dataset.difficulty === state.difficulty || state.mode !== "fixed") return;
  state.difficulty = button.dataset.difficulty;
  state.levelIndex = stats.currentLevel[state.difficulty];
  loadFixedPuzzle();
});

elements.previousLevel.addEventListener("click", () => moveLevel(-1));
elements.nextLevel.addEventListener("click", () => moveLevel(1));
elements.levelPickerButton.addEventListener("click", () => {
  renderLevelPicker();
  openDialog(elements.levelPickerDialog);
});
elements.levelPickerGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-level-index]");
  if (button) chooseLevel(Number(button.dataset.levelIndex));
});
elements.openSecretPickerButton.addEventListener("click", openSecretPicker);
elements.secretBossGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-boss]");
  if (button) startSecretBoss(button.dataset.boss);
});
elements.undoButton.addEventListener("click", undo);
elements.resetButton.addEventListener("click", resetBoard);
elements.rotateButton.addEventListener("click", rotateSelected);
elements.flipButton.addEventListener("click", flipSelected);
elements.mobileRotateButton.addEventListener("click", rotateSelected);
elements.mobileFlipButton.addEventListener("click", flipSelected);
elements.mobileCancelButton.addEventListener("click", () => cancelSelection({ restorePickedUp: true }));
elements.mobileActionBar.addEventListener("pointerdown", (event) => event.stopPropagation());
elements.mobileActionBar.addEventListener("click", (event) => event.stopPropagation());

elements.pieceTray.addEventListener("pointerdown", (event) => {
  const card = event.target.closest("[data-piece]");
  if (!card || card.disabled) return;
  beginPotentialDrag(event, card.dataset.piece, "tray");
});

elements.gameBoard.addEventListener("pointerdown", (event) => {
  const cell = event.target.closest("[data-cell]");
  if (!cell || cell.disabled) return;
  const cellIndex = Number(cell.dataset.cell);
  const placed = placementAtCell(cellIndex);
  if (placed) beginPotentialDrag(event, placed.pieceId, "board", cellIndex);
});

window.addEventListener("pointermove", (event) => {
  if (!dragSession || event.pointerId !== dragSession.pointerId) return;
  if (!dragSession.active) {
    const distance = Math.hypot(event.clientX - dragSession.startX, event.clientY - dragSession.startY);
    if (distance < DRAG_THRESHOLD) return;
    activateDrag(event);
  }
  if (!dragSession?.active) return;
  event.preventDefault();
  updateActiveDrag(event);
}, { passive: false });

window.addEventListener("pointerup", (event) => finishDrag(event));
window.addEventListener("pointercancel", (event) => finishDrag(event, true));
window.addEventListener("lostpointercapture", (event) => {
  if (dragSession && event.pointerId === dragSession.pointerId) abortDragSession();
});
window.addEventListener("touchcancel", () => {
  if (dragSession?.pointerType === "touch") abortDragSession();
}, { passive: true });
window.addEventListener("blur", () => abortDragSession());
window.addEventListener("pagehide", () => clearDragSession());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) abortDragSession();
});

elements.pieceTray.addEventListener("click", (event) => {
  if (performance.now() < suppressClickUntil) return;
  const card = event.target.closest("[data-piece]");
  if (card) selectPiece(card.dataset.piece);
});

elements.gameBoard.addEventListener("click", (event) => {
  if (performance.now() < suppressClickUntil || state.inputLocked) return;
  const cell = event.target.closest("[data-cell]");
  if (!cell || cell.disabled) return;
  const cellIndex = Number(cell.dataset.cell);
  const placed = placementAtCell(cellIndex);
  if (placed) pickUpPiece(placed.pieceId);
  else placeSelected(cellIndex);
});

elements.gameBoard.addEventListener("mouseover", (event) => {
  if (dragSession?.active || state.inputLocked) return;
  const cell = event.target.closest("[data-cell]");
  if (!cell || cell.disabled || !state.selectedPieceId || state.solved) return;
  const placement = candidateFromCell(Number(cell.dataset.cell));
  const key = `${placement.pieceId}:${placement.variant}:${placement.row}:${placement.col}`;
  if (state.preview?.key === key) return;
  state.preview = { key, placement };
  renderBoard();
});

elements.gameBoard.addEventListener("mouseleave", () => {
  if (!state.preview || dragSession?.active) return;
  state.preview = null;
  renderBoard();
});

elements.bossCreature.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (state.boss?.attackWindow && bossHitResolver) bossHitResolver();
});

elements.bossCreature.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && state.boss?.attackWindow && bossHitResolver) {
    event.preventDefault();
    bossHitResolver();
  }
});

elements.bossCreature.addEventListener("pointermove", (event) => {
  if (state.bossId !== "absolute") return;
  const rect = elements.bossCreature.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 9;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * 7;
  elements.bossArena.style.setProperty("--look-x", `${x.toFixed(1)}px`);
  elements.bossArena.style.setProperty("--look-y", `${y.toFixed(1)}px`);
});

elements.statsButton.addEventListener("click", () => {
  renderStats();
  openDialog(elements.statsDialog);
});
elements.howButton.addEventListener("click", () => openDialog(elements.howDialog));

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close());
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

elements.winDialog.addEventListener("close", () => {
  if (!state.pendingUnlockNotice) return;
  state.pendingUnlockNotice = false;
  stats.secret.unlockNoticeShown = true;
  saveStats();
  showSecretNotice("Gratulation, Spieler! Du hast Stufe Leicht abgeschlossen und die Secret Level freigeschaltet.");
  renderStatus();
});

elements.continueButton.addEventListener("click", () => {
  elements.winDialog.close();
  if (state.mode === "fixed") {
    if (state.levelIndex < FIXED_LEVELS_PER_DIFFICULTY - 1) moveLevel(1);
    else showToast("Alle Levels dieser Schwierigkeit geschafft!");
  } else {
    openSecretPicker();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input, textarea, select")) return;
  if (event.key.toLowerCase() === "r") rotateSelected();
  if (event.key.toLowerCase() === "f") flipSelected();
  if (event.key === "Escape" && state.selectedPieceId) cancelSelection({ restorePickedUp: true });
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
  }
});

saveStats();
loadFixedPuzzle();

if (showStartupUnlockNotice) {
  window.setTimeout(() => {
    stats.secret.unlockNoticeShown = true;
    saveStats();
    showSecretNotice("Gratulation, Spieler! Du hast Stufe Leicht abgeschlossen und die Secret Level freigeschaltet.");
  }, 650);
}
