import {
  BOARD_COLS,
  BOARD_ROWS,
  DIFFICULTIES,
  FIXED_LEVELS_PER_DIFFICULTY,
  PIECES,
  areCluesPlaced,
  fixedLevelSeed,
  generatePuzzle,
  getPiece,
  getVariantIndex,
  getVariants,
  isPlacementInside,
  placementCells,
  placementsEqual,
  validateCompletedBoard,
} from "./logic.js?v=20260819-2";
import { createLevelPickerItems } from "./level-picker.js?v=20260820-1";
import { pointerAnchorForPlacement, placementFromBoardPoint } from "./placement-math.js?v=20260821-1";

const STORAGE_KEY = "polonese-game-v1";
const DIFFICULTY_ORDER = Object.keys(DIFFICULTIES);

const elements = {
  body: document.body,
  modeSelector: document.querySelector("#modeSelector"),
  difficultySelector: document.querySelector("#difficultySelector"),
  difficultyHint: document.querySelector("#difficultyHint"),
  fixedLevelControls: document.querySelector("#fixedLevelControls"),
  endlessControls: document.querySelector("#endlessControls"),
  previousLevel: document.querySelector("#previousLevel"),
  nextLevel: document.querySelector("#nextLevel"),
  levelPickerButton: document.querySelector("#levelPickerButton"),
  levelNumber: document.querySelector("#levelNumber"),
  levelProgressText: document.querySelector("#levelProgressText"),
  progressBar: document.querySelector("#progressBar"),
  endlessRound: document.querySelector("#endlessRound"),
  newEndlessButton: document.querySelector("#newEndlessButton"),
  clueCount: document.querySelector("#clueCount"),
  templateBoard: document.querySelector("#templateBoard"),
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
  winDialog: document.querySelector("#winDialog"),
  levelPickerDialog: document.querySelector("#levelPickerDialog"),
  levelPickerDifficulty: document.querySelector("#levelPickerDifficulty"),
  levelPickerProgress: document.querySelector("#levelPickerProgress"),
  levelPickerGrid: document.querySelector("#levelPickerGrid"),
  statsDialog: document.querySelector("#statsDialog"),
  howDialog: document.querySelector("#howDialog"),
  resultTime: document.querySelector("#resultTime"),
  resultBest: document.querySelector("#resultBest"),
  continueButton: document.querySelector("#continueButton"),
  statsSolved: document.querySelector("#statsSolved"),
  statsEndless: document.querySelector("#statsEndless"),
  statsPlayTime: document.querySelector("#statsPlayTime"),
  statsPercent: document.querySelector("#statsPercent"),
  difficultyStats: document.querySelector("#difficultyStats"),
};

function freshStats() {
  return {
    completed: Object.fromEntries(DIFFICULTY_ORDER.map((difficulty) => [difficulty, []])),
    bestTimes: {},
    totalSolved: 0,
    endlessSolved: 0,
    totalPlaySeconds: 0,
    endlessRound: 1,
    currentLevel: Object.fromEntries(DIFFICULTY_ORDER.map((difficulty) => [difficulty, 0])),
  };
}

function loadStats() {
  const fallback = freshStats();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== "object") return fallback;
    for (const difficulty of DIFFICULTY_ORDER) {
      const completed = Array.isArray(stored.completed?.[difficulty])
        ? stored.completed[difficulty].filter((level) => Number.isInteger(level) && level >= 0 && level < FIXED_LEVELS_PER_DIFFICULTY)
        : [];
      fallback.completed[difficulty] = [...new Set(completed)];
      const current = Number(stored.currentLevel?.[difficulty]);
      fallback.currentLevel[difficulty] = Number.isInteger(current)
        ? Math.max(0, Math.min(FIXED_LEVELS_PER_DIFFICULTY - 1, current))
        : 0;
    }
    fallback.bestTimes = stored.bestTimes && typeof stored.bestTimes === "object" ? stored.bestTimes : {};
    fallback.totalSolved = Math.max(0, Number(stored.totalSolved) || 0);
    fallback.endlessSolved = Math.max(0, Number(stored.endlessSolved) || 0);
    fallback.totalPlaySeconds = Math.max(0, Number(stored.totalPlaySeconds) || 0);
    fallback.endlessRound = Math.max(1, Number(stored.endlessRound) || 1);
    return fallback;
  } catch {
    return fallback;
  }
}

const stats = loadStats();
const state = {
  mode: "fixed",
  difficulty: "easy",
  levelIndex: stats.currentLevel.easy,
  endlessRound: stats.endlessRound,
  endlessSeed: randomSeed(),
  puzzle: null,
  placed: new Map(),
  selectedPieceId: null,
  rotation: 0,
  flipped: false,
  history: [],
  preview: null,
  pickedUpPieceId: null,
  startedAt: performance.now(),
  elapsedSeconds: 0,
  solved: false,
};

let toastTimeout;
let dragSession = null;
let dragGhost = null;
let suppressClickUntil = 0;

const DRAG_THRESHOLD = 8;
const TOUCH_PREVIEW_LIFT = 64;

function saveStats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Date.now() >>> 0;
}

function clonePlacements() {
  return [...state.placed.values()].map((placement) => ({ ...placement }));
}

function restorePlacements(snapshot) {
  state.placed = new Map(snapshot.map((placement) => [placement.pieceId, { ...placement }]));
}

function pushHistory() {
  state.history.push(clonePlacements());
  if (state.history.length > 80) state.history.shift();
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours ? `${String(hours).padStart(2, "0")}:${clock}` : clock;
}

function bestTimeKey() {
  return state.mode === "fixed"
    ? `fixed:${state.difficulty}:${state.levelIndex}`
    : `endless:${state.difficulty}`;
}

function selectedVariant() {
  if (!state.selectedPieceId) return null;
  const index = getVariantIndex(state.selectedPieceId, state.rotation, state.flipped);
  return { index, cells: getVariants(state.selectedPieceId)[index] };
}

function findTransform(pieceId, variantIndex) {
  for (const flipped of [false, true]) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      if (getVariantIndex(pieceId, rotation, flipped) === variantIndex) return { rotation, flipped };
    }
  }
  return { rotation: 0, flipped: false };
}

function showToast(message) {
  window.clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimeout = window.setTimeout(() => elements.toast.classList.remove("visible"), 2500);
}

function setBoardMessage(message, isError = false) {
  elements.boardMessage.textContent = message;
  elements.boardMessage.classList.toggle("error", isError);
}

function loadPuzzle() {
  state.solved = false;
  state.placed.clear();
  state.selectedPieceId = null;
  state.rotation = 0;
  state.flipped = false;
  state.history = [];
  state.preview = null;
  state.pickedUpPieceId = null;
  state.elapsedSeconds = 0;
  state.startedAt = performance.now();
  const seed = state.mode === "fixed"
    ? fixedLevelSeed(state.difficulty, state.levelIndex)
    : state.endlessSeed;
  state.puzzle = generatePuzzle(seed, state.difficulty);
  setBoardMessage("Lege zuerst alle Teile aus der Vorlage exakt auf das Spielfeld.");
  renderAll();
}

function placementAtCell(cellIndex) {
  return [...state.placed.values()].find((placement) => placementCells(placement).includes(cellIndex));
}

function clueForPiece(pieceId) {
  return state.puzzle.clues.find((clue) => clue.pieceId === pieceId);
}

function cluePhaseComplete() {
  return areCluesPlaced(clonePlacements(), state.puzzle.clues);
}

function reservedOwnerAtCell(cellIndex) {
  return state.puzzle.clues.find((clue) => placementCells(clue).includes(cellIndex))?.pieceId ?? null;
}

function candidateFromCell(cellIndex) {
  const variant = selectedVariant();
  if (!variant) return null;
  const clickedRow = Math.floor(cellIndex / BOARD_COLS);
  const clickedCol = cellIndex % BOARD_COLS;
  return {
    pieceId: state.selectedPieceId,
    variant: variant.index,
    ...placementFromBoardPoint(
      { row: clickedRow + 0.5, col: clickedCol + 0.5 },
      pointerAnchorForPlacement(variant.cells),
    ),
  };
}

function validateCandidate(candidate) {
  if (!candidate || !isPlacementInside(candidate)) {
    return { valid: false, reason: "Das Teil ragt über den Rand hinaus." };
  }

  const clue = clueForPiece(candidate.pieceId);
  if (!clue && !cluePhaseComplete()) {
    return { valid: false, reason: "Lege zuerst alle Vorlagen-Teile richtig auf das Feld." };
  }
  if (clue && !placementsEqual(candidate, clue)) {
    return { valid: false, reason: "Dieses Vorlagen-Teil muss exakt an die gezeigte Position." };
  }

  const cells = placementCells(candidate);
  const occupied = new Set(clonePlacements().flatMap((placement) => placementCells(placement)));
  if (cells.some((cell) => occupied.has(cell))) {
    return { valid: false, reason: "Dort liegt bereits ein anderes Teil." };
  }

  if (cells.some((cell) => {
    const owner = reservedOwnerAtCell(cell);
    return owner && owner !== candidate.pieceId;
  })) {
    return { valid: false, reason: "Dieses Feld ist für ein Vorlagen-Teil reserviert." };
  }

  return { valid: true, reason: "" };
}

function selectPiece(pieceId) {
  if (state.solved) return;
  if (state.selectedPieceId === pieceId && !state.placed.has(pieceId)) {
    setBoardMessage(`${getPiece(pieceId).name} ist bereits ausgewählt. Tippe auf das Feld oder ziehe den Stein.`);
    return;
  }
  if (state.pickedUpPieceId && state.pickedUpPieceId !== pieceId) {
    cancelSelection({ restorePickedUp: true });
  }
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
  setBoardMessage(`${getPiece(pieceId).name} ist ausgewählt. Tippe auf das Feld oder ziehe den Stein hinein.`);
  renderBoard();
  renderTray();
}

function pickUpPiece(pieceId) {
  const placement = state.placed.get(pieceId);
  if (!placement || state.solved) return;
  pushHistory();
  const transform = findTransform(pieceId, placement.variant);
  state.placed.delete(pieceId);
  state.selectedPieceId = pieceId;
  state.rotation = transform.rotation;
  state.flipped = transform.flipped;
  state.preview = null;
  state.pickedUpPieceId = pieceId;
  setBoardMessage(`${getPiece(pieceId).name} aufgenommen. Setze es neu.`);
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
  checkWin();
}

function placeSelected(cellIndex) {
  if (!state.selectedPieceId || state.solved) {
    setBoardMessage("Wähle zuerst unten einen Spielstein aus.", true);
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
  if (!state.selectedPieceId) return;
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
  renderBoard();
  renderTray();
  renderStatus();
}

function rotateSelected() {
  if (!state.selectedPieceId || state.solved) return;
  state.rotation = (state.rotation + 1) % 4;
  state.preview = null;
  renderBoard();
  renderTray();
}

function flipSelected() {
  if (!state.selectedPieceId || state.solved) return;
  state.flipped = !state.flipped;
  state.preview = null;
  renderBoard();
  renderTray();
}

function undo() {
  if (!state.history.length || state.solved) return;
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
  if (!state.placed.size || state.solved) return;
  pushHistory();
  state.placed.clear();
  state.selectedPieceId = null;
  state.preview = null;
  state.pickedUpPieceId = null;
  state.rotation = 0;
  state.flipped = false;
  state.startedAt = performance.now();
  state.elapsedSeconds = 0;
  setBoardMessage("Spielfeld geleert – beginne wieder mit den Vorlagen-Teilen.");
  renderBoard();
  renderTray();
  renderStatus();
}

function checkWin() {
  const placements = clonePlacements();
  if (!validateCompletedBoard(placements, state.puzzle.clues)) return;

  state.solved = true;
  updateTimer();
  const time = Math.max(1, state.elapsedSeconds);
  const key = bestTimeKey();
  const previousBest = Number(stats.bestTimes[key]);
  const isBest = !previousBest || time < previousBest;
  if (isBest) stats.bestTimes[key] = time;

  stats.totalSolved += 1;
  stats.totalPlaySeconds += time;
  if (state.mode === "fixed") {
    const completed = stats.completed[state.difficulty];
    if (!completed.includes(state.levelIndex)) completed.push(state.levelIndex);
  } else {
    stats.endlessSolved += 1;
  }
  saveStats();
  renderStatus();
  renderStats();

  elements.resultTime.textContent = formatTime(time);
  elements.resultBest.textContent = formatTime(stats.bestTimes[key]);
  elements.continueButton.textContent = state.mode === "fixed" ? "Nächstes Level" : "Neue Endlos-Aufgabe";
  openDialog(elements.winDialog);
  if (isBest) showToast("Neue Bestzeit!");
}

function renderTemplate() {
  const cellOwners = new Map();
  state.puzzle.clues.forEach((clue) => {
    placementCells(clue).forEach((cell) => cellOwners.set(cell, clue.pieceId));
  });

  elements.templateBoard.replaceChildren();
  for (let index = 0; index < BOARD_ROWS * BOARD_COLS; index += 1) {
    const cell = document.createElement("span");
    cell.className = "template-cell";
    const owner = cellOwners.get(index);
    if (owner) {
      cell.classList.add("filled");
      cell.style.setProperty("--piece-color", getPiece(owner).color);
      cell.title = getPiece(owner).name;
    }
    elements.templateBoard.append(cell);
  }
}

function renderBoard() {
  const occupied = new Map();
  state.placed.forEach((placement) => {
    placementCells(placement).forEach((cell) => occupied.set(cell, placement.pieceId));
  });
  const clueIds = new Set(state.puzzle.clues.map((clue) => clue.pieceId));
  const previewCells = state.preview ? new Set(placementCells(state.preview.placement)) : new Set();

  elements.gameBoard.replaceChildren();
  for (let index = 0; index < BOARD_ROWS * BOARD_COLS; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "board-cell";
    button.dataset.cell = String(index);
    button.setAttribute("role", "gridcell");
    const owner = occupied.get(index);
    if (owner) {
      const piece = getPiece(owner);
      button.classList.add("filled");
      if (clueIds.has(owner)) button.classList.add("clue-piece");
      button.style.setProperty("--piece-color", piece.color);
      button.title = `${piece.name} aufnehmen`;
      button.setAttribute("aria-label", `${piece.name}, gesetztes Teil`);
    } else {
      button.setAttribute("aria-label", `Feld ${index + 1}`);
    }
    if (previewCells.has(index)) {
      button.classList.add("preview-piece");
      button.style.setProperty("--selected-color", getPiece(state.preview.placement.pieceId).color);
    }
    elements.gameBoard.append(button);
  }
}

function miniPiece(pieceId, variantIndex = 0) {
  const variant = getVariants(pieceId)[variantIndex] ?? getVariants(pieceId)[0];
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
  const clueIds = new Set(state.puzzle.clues.map((clue) => clue.pieceId));
  const templateFinished = cluePhaseComplete();
  elements.pieceTray.replaceChildren();
  PIECES.forEach((piece) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "piece-card";
    card.dataset.piece = piece.id;
    card.style.setProperty("--piece-color", piece.color);
    const placed = state.placed.get(piece.id);
    const locked = !clueIds.has(piece.id) && !templateFinished && !placed;
    if (placed) card.classList.add("placed");
    if (locked) {
      card.classList.add("locked");
      card.disabled = true;
      card.title = "Wird nach der vollständigen Vorlage freigeschaltet";
    }
    if (state.selectedPieceId === piece.id) card.classList.add("selected");
    if (clueIds.has(piece.id)) card.classList.add("is-clue");
    const variantIndex = state.selectedPieceId === piece.id
      ? selectedVariant().index
      : placed?.variant ?? 0;
    card.append(miniPiece(piece.id, variantIndex));
    const name = document.createElement("strong");
    name.textContent = piece.name;
    const hint = document.createElement("small");
    hint.textContent = placed ? "gesetzt" : clueIds.has(piece.id) ? "zuerst platzieren" : locked ? "noch gesperrt" : "frei platzieren";
    card.append(name, hint);
    card.setAttribute("aria-pressed", String(state.selectedPieceId === piece.id));
    elements.pieceTray.append(card);
  });

  const selected = state.selectedPieceId ? getPiece(state.selectedPieceId) : null;
  elements.selectedPieceLabel.textContent = selected ? `${selected.name} ausgewählt` : "Teil auswählen";
  elements.rotateButton.disabled = !selected;
  elements.flipButton.disabled = !selected;
  elements.mobileSelectedPieceLabel.textContent = selected?.name ?? "Kein Teil";
  elements.mobileRotateButton.disabled = !selected;
  elements.mobileFlipButton.disabled = !selected;
  elements.mobileCancelButton.disabled = !selected;
  elements.mobileActionBar.classList.remove("hidden");
  elements.mobileActionBar.classList.toggle("has-selection", Boolean(selected));
  elements.body.classList.toggle("piece-selected", Boolean(selected));
}

function renderStatus() {
  const completed = stats.completed[state.difficulty];
  const fixedSolved = DIFFICULTY_ORDER.reduce((sum, difficulty) => sum + stats.completed[difficulty].length, 0);

  elements.modeSelector.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
  elements.difficultySelector.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.classList.toggle("active", button.dataset.difficulty === state.difficulty);
  });
  elements.difficultyHint.textContent = DIFFICULTIES[state.difficulty].description;
  elements.fixedLevelControls.classList.toggle("hidden", state.mode !== "fixed");
  elements.endlessControls.classList.toggle("hidden", state.mode !== "endless");
  elements.levelNumber.textContent = String(state.levelIndex + 1).padStart(2, "0");
  elements.levelPickerButton.setAttribute("aria-label", `Level ${state.levelIndex + 1} auswählen`);
  elements.levelProgressText.textContent = `${completed.length} / ${FIXED_LEVELS_PER_DIFFICULTY} geschafft`;
  elements.progressBar.style.width = `${(completed.length / FIXED_LEVELS_PER_DIFFICULTY) * 100}%`;
  elements.previousLevel.disabled = state.levelIndex === 0;
  elements.nextLevel.disabled = state.levelIndex === FIXED_LEVELS_PER_DIFFICULTY - 1;
  elements.endlessRound.textContent = `Runde ${state.endlessRound}`;
  elements.clueCount.textContent = String(state.puzzle.clues.length);
  elements.placedCounter.textContent = `${state.placed.size} / ${PIECES.length} Teile`;
  elements.headerSolved.textContent = String(stats.totalSolved);
  elements.undoButton.disabled = state.history.length === 0 || state.solved;
  elements.resetButton.disabled = state.placed.size === 0 || state.solved;
  elements.statsPercent.textContent = `${Math.round((fixedSolved / (FIXED_LEVELS_PER_DIFFICULTY * DIFFICULTY_ORDER.length)) * 100)} %`;
}

function renderStats() {
  const fixedSolved = DIFFICULTY_ORDER.reduce((sum, difficulty) => sum + stats.completed[difficulty].length, 0);
  elements.statsSolved.textContent = String(stats.totalSolved);
  elements.statsEndless.textContent = String(stats.endlessSolved);
  elements.statsPlayTime.textContent = formatTime(stats.totalPlaySeconds);
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
  const items = createLevelPickerItems(
    FIXED_LEVELS_PER_DIFFICULTY,
    state.levelIndex,
    completed,
  );

  elements.levelPickerDifficulty.textContent = DIFFICULTIES[state.difficulty].label;
  elements.levelPickerProgress.textContent = `${completed.length} von ${FIXED_LEVELS_PER_DIFFICULTY} geschafft`;
  elements.levelPickerGrid.setAttribute(
    "aria-label",
    `${DIFFICULTIES[state.difficulty].label}: Level 1 bis ${FIXED_LEVELS_PER_DIFFICULTY}`,
  );
  elements.levelPickerGrid.replaceChildren();

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.levelIndex = String(item.index);
    button.textContent = String(item.number);
    button.classList.toggle("completed", item.completed);
    button.classList.toggle("current", item.current);
    button.setAttribute("aria-current", item.current ? "page" : "false");
    button.setAttribute(
      "aria-label",
      `Level ${item.number}${item.current ? ", aktuell" : ""}${item.completed ? ", geschafft" : ""}`,
    );
    elements.levelPickerGrid.append(button);
  });
}

function renderAll() {
  renderTemplate();
  renderBoard();
  renderTray();
  renderStatus();
  renderStats();
  updateTimer();
}

function updateTimer() {
  if (!state.solved) {
    state.elapsedSeconds = Math.floor((performance.now() - state.startedAt) / 1000);
  }
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function moveLevel(delta) {
  const next = Math.max(0, Math.min(FIXED_LEVELS_PER_DIFFICULTY - 1, state.levelIndex + delta));
  if (next === state.levelIndex) return;
  state.levelIndex = next;
  stats.currentLevel[state.difficulty] = next;
  saveStats();
  loadPuzzle();
}

function chooseLevel(levelIndex) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= FIXED_LEVELS_PER_DIFFICULTY) return;
  elements.levelPickerDialog.close();
  if (levelIndex === state.levelIndex) return;
  state.levelIndex = levelIndex;
  stats.currentLevel[state.difficulty] = levelIndex;
  saveStats();
  loadPuzzle();
}

function nextEndlessPuzzle(incrementRound = true) {
  if (incrementRound) state.endlessRound += 1;
  state.endlessSeed = randomSeed();
  stats.endlessRound = state.endlessRound;
  saveStats();
  loadPuzzle();
}

function boardPointFromPointer(clientX, clientY, pointerType) {
  const boardRect = elements.gameBoard.getBoundingClientRect();
  let targetY = clientY;
  if (pointerType === "touch") {
    const liftedY = clientY - TOUCH_PREVIEW_LIFT;
    if (liftedY >= boardRect.top && liftedY <= boardRect.bottom) targetY = liftedY;
  }
  if (
    clientX < boardRect.left
    || clientX > boardRect.right
    || targetY < boardRect.top
    || targetY > boardRect.bottom
  ) return null;
  return {
    row: ((targetY - boardRect.top) / boardRect.height) * BOARD_ROWS,
    col: ((clientX - boardRect.left) / boardRect.width) * BOARD_COLS,
  };
}

function createDragGhost(pieceId, pointerAnchor) {
  dragGhost?.remove();
  const variant = selectedVariant();
  if (!variant) return;
  const boardCell = elements.gameBoard.querySelector(".board-cell");
  const boardUnit = boardCell?.getBoundingClientRect().width ?? 28;
  const unit = Math.max(22, Math.min(34, boardUnit));
  const maxRow = Math.max(...variant.cells.map(([row]) => row));
  const maxCol = Math.max(...variant.cells.map(([, col]) => col));
  dragGhost = document.createElement("div");
  dragGhost.className = "drag-ghost";
  dragGhost.style.setProperty("--piece-color", getPiece(pieceId).color);
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
  if (state.solved || dragSession || (event.pointerType === "mouse" && event.button !== 0)) return;
  dragSession = {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    pieceId,
    source,
    sourceCellIndex,
    startX: event.clientX,
    startY: event.clientY,
    active: false,
    pointerAnchor: null,
  };
}

function activateDrag(event) {
  if (!dragSession || dragSession.active) return;
  const originalPlacement = state.placed.get(dragSession.pieceId);
  if (dragSession.source === "board" && originalPlacement) {
    const boardRow = Math.floor(dragSession.sourceCellIndex / BOARD_COLS);
    const boardCol = dragSession.sourceCellIndex % BOARD_COLS;
    dragSession.pointerAnchor = {
      row: boardRow - originalPlacement.row + 0.5,
      col: boardCol - originalPlacement.col + 0.5,
    };
  }

  if (state.selectedPieceId !== dragSession.pieceId || originalPlacement) {
    selectPiece(dragSession.pieceId);
  }
  if (state.selectedPieceId !== dragSession.pieceId) {
    dragSession = null;
    return;
  }

  const variant = selectedVariant();
  dragSession.pointerAnchor ??= pointerAnchorForPlacement(variant.cells);
  dragSession.active = true;
  elements.body.classList.add("dragging-piece");
  createDragGhost(dragSession.pieceId, dragSession.pointerAnchor);
  moveDragGhost(event.clientX, event.clientY, dragSession.pointerType);
}

function updateActiveDrag(event) {
  if (!dragSession?.active) return;
  moveDragGhost(event.clientX, event.clientY, dragSession.pointerType);
  const point = boardPointFromPointer(event.clientX, event.clientY, dragSession.pointerType);
  const placement = point === null
    ? null
    : {
      pieceId: state.selectedPieceId,
      variant: selectedVariant().index,
      ...placementFromBoardPoint(point, dragSession.pointerAnchor),
    };
  const key = placement
    ? `${placement.pieceId}:${placement.variant}:${placement.row}:${placement.col}`
    : "outside";
  if (state.preview?.key !== key) {
    state.preview = placement ? { key, placement } : null;
    renderBoard();
  }

  if (dragSession.pointerType === "touch") {
    const edge = 54;
    if (event.clientY < edge) window.scrollBy(0, -12);
    if (event.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
  }
}

function finishDrag(event, cancelled = false) {
  if (!dragSession || event.pointerId !== dragSession.pointerId) return;
  if (!dragSession.active) {
    dragSession = null;
    return;
  }

  if (!cancelled) updateActiveDrag(event);
  const candidate = !cancelled ? state.preview?.placement : null;
  const validation = candidate
    ? validateCandidate(candidate)
    : { valid: false, reason: "Ziehe den Stein vollständig auf das Spielfeld." };

  dragGhost?.remove();
  dragGhost = null;
  elements.body.classList.remove("dragging-piece");
  suppressClickUntil = performance.now() + 400;
  dragSession = null;

  if (validation.valid) {
    placeCandidate(candidate);
    return;
  }

  state.preview = null;
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
  if (!button || button.dataset.mode === state.mode) return;
  state.mode = button.dataset.mode;
  if (state.mode === "endless") state.endlessSeed = randomSeed();
  loadPuzzle();
});

elements.difficultySelector.addEventListener("click", (event) => {
  const button = event.target.closest("[data-difficulty]");
  if (!button || button.dataset.difficulty === state.difficulty) return;
  state.difficulty = button.dataset.difficulty;
  state.levelIndex = stats.currentLevel[state.difficulty];
  if (state.mode === "endless") state.endlessSeed = randomSeed();
  loadPuzzle();
});

elements.previousLevel.addEventListener("click", () => moveLevel(-1));
elements.nextLevel.addEventListener("click", () => moveLevel(1));
elements.levelPickerButton.addEventListener("click", () => {
  renderLevelPicker();
  openDialog(elements.levelPickerDialog);
});
elements.levelPickerGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-level-index]");
  if (!button) return;
  chooseLevel(Number(button.dataset.levelIndex));
});
elements.newEndlessButton.addEventListener("click", () => nextEndlessPuzzle(true));
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
  if (!cell) return;
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

elements.pieceTray.addEventListener("click", (event) => {
  if (performance.now() < suppressClickUntil) return;
  const card = event.target.closest("[data-piece]");
  if (card) selectPiece(card.dataset.piece);
});

elements.gameBoard.addEventListener("click", (event) => {
  if (performance.now() < suppressClickUntil) return;
  const cell = event.target.closest("[data-cell]");
  if (!cell) return;
  const cellIndex = Number(cell.dataset.cell);
  const placed = placementAtCell(cellIndex);
  if (placed) pickUpPiece(placed.pieceId);
  else placeSelected(cellIndex);
});

elements.gameBoard.addEventListener("mouseover", (event) => {
  if (dragSession?.active) return;
  const cell = event.target.closest("[data-cell]");
  if (!cell || !state.selectedPieceId || state.solved) return;
  const placement = candidateFromCell(Number(cell.dataset.cell));
  const key = `${placement.pieceId}:${placement.variant}:${placement.row}:${placement.col}`;
  if (state.preview?.key === key) return;
  state.preview = { key, placement };
  renderBoard();
});

elements.gameBoard.addEventListener("mouseleave", () => {
  if (!state.preview) return;
  state.preview = null;
  renderBoard();
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

elements.continueButton.addEventListener("click", () => {
  elements.winDialog.close();
  if (state.mode === "fixed") {
    if (state.levelIndex < FIXED_LEVELS_PER_DIFFICULTY - 1) moveLevel(1);
    else showToast("Alle Levels dieser Schwierigkeit geschafft!");
  } else {
    nextEndlessPuzzle(true);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input, textarea, select")) return;
  if (event.key.toLowerCase() === "r") rotateSelected();
  if (event.key.toLowerCase() === "f") flipSelected();
  if (event.key === "Escape" && state.selectedPieceId) {
    cancelSelection({ restorePickedUp: true });
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
  }
});

window.setInterval(updateTimer, 250);
loadPuzzle();
