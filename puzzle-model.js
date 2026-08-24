function normalizeCells(cells) {
  if (!Array.isArray(cells) || cells.length === 0) return [];
  const minRow = Math.min(...cells.map(([row]) => row));
  const minCol = Math.min(...cells.map(([, col]) => col));
  return cells
    .map(([row, col]) => [row - minRow, col - minCol])
    .sort(([rowA, colA], [rowB, colB]) => rowA - rowB || colA - colB);
}

function cellsKey(cells) {
  return normalizeCells(cells).map(([row, col]) => `${row},${col}`).join(";");
}

function transformCells(cells, rotation = 0, flipped = false) {
  let transformed = cells.map(([row, col]) => [row, flipped ? -col : col]);
  for (let turn = 0; turn < ((rotation % 4) + 4) % 4; turn += 1) {
    transformed = transformed.map(([row, col]) => [col, -row]);
  }
  return normalizeCells(transformed);
}

function buildVariants(piece) {
  const variants = new Map();
  for (const flipped of [false, true]) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const cells = transformCells(piece.cells, rotation, flipped);
      variants.set(cellsKey(cells), cells);
    }
  }
  return [...variants.values()];
}

function hashValue(value) {
  const input = String(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalizeMask(rows, cols, mask) {
  if (!mask) {
    return new Set(Array.from({ length: rows * cols }, (_, index) => index));
  }
  const indexes = mask.map((cell) => (
    Array.isArray(cell) ? cell[0] * cols + cell[1] : Number(cell)
  ));
  return new Set(indexes.filter((index) => Number.isInteger(index) && index >= 0 && index < rows * cols));
}

export function canonicalShapeKey(cells) {
  const variants = new Set();
  for (const flipped of [false, true]) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      variants.add(cellsKey(transformCells(cells, rotation, flipped)));
    }
  }
  return [...variants].sort()[0] ?? "";
}

export function isConnectedShape(cells) {
  if (!Array.isArray(cells) || cells.length === 0) return false;
  const keys = new Set(cells.map(([row, col]) => `${row},${col}`));
  const visited = new Set();
  const queue = [cells[0]];
  while (queue.length) {
    const [row, col] = queue.shift();
    const key = `${row},${col}`;
    if (visited.has(key)) continue;
    visited.add(key);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([rowDelta, colDelta]) => {
      const neighbor = `${row + rowDelta},${col + colDelta}`;
      if (keys.has(neighbor) && !visited.has(neighbor)) queue.push([row + rowDelta, col + colDelta]);
    });
  }
  return visited.size === keys.size;
}

export function createPuzzleModel({ pieces, rows, cols, mask = null }) {
  const safePieces = pieces.map((piece) => ({
    ...piece,
    cells: normalizeCells(piece.cells),
  }));
  const pieceById = new Map(safePieces.map((piece) => [piece.id, piece]));
  const variantsById = new Map(safePieces.map((piece) => [piece.id, buildVariants(piece)]));
  const activeCells = normalizeMask(rows, cols, mask);
  const boardArea = activeCells.size;

  function getPiece(pieceId) {
    return pieceById.get(pieceId);
  }

  function getVariants(pieceId) {
    return variantsById.get(pieceId) ?? [];
  }

  function getVariantIndex(pieceId, rotation = 0, flipped = false) {
    const piece = getPiece(pieceId);
    if (!piece) return -1;
    const key = cellsKey(transformCells(piece.cells, rotation, flipped));
    return getVariants(pieceId).findIndex((cells) => cellsKey(cells) === key);
  }

  function placementCells(placement) {
    const variant = getVariants(placement?.pieceId)[placement?.variant];
    if (!variant) return [];
    return variant.flatMap(([row, col]) => {
      const boardRow = placement.row + row;
      const boardCol = placement.col + col;
      if (boardRow < 0 || boardRow >= rows || boardCol < 0 || boardCol >= cols) return [];
      const index = boardRow * cols + boardCol;
      return activeCells.has(index) ? [index] : [];
    });
  }

  function isPlacementInside(placement) {
    const variant = getVariants(placement?.pieceId)[placement?.variant];
    if (!variant) return false;
    return variant.every(([row, col]) => {
      const boardRow = placement.row + row;
      const boardCol = placement.col + col;
      if (boardRow < 0 || boardRow >= rows || boardCol < 0 || boardCol >= cols) return false;
      return activeCells.has(boardRow * cols + boardCol);
    });
  }

  const placementsByPiece = new Map();
  const placementsByCell = Array.from({ length: rows * cols }, () => []);
  for (const piece of safePieces) {
    const placements = [];
    getVariants(piece.id).forEach((variant, variantIndex) => {
      const height = Math.max(...variant.map(([row]) => row)) + 1;
      const width = Math.max(...variant.map(([, col]) => col)) + 1;
      for (let row = 0; row <= rows - height; row += 1) {
        for (let col = 0; col <= cols - width; col += 1) {
          const placement = { pieceId: piece.id, variant: variantIndex, row, col };
          if (!isPlacementInside(placement)) continue;
          const cells = placementCells(placement);
          const compiled = { ...placement, cells };
          placements.push(compiled);
          cells.forEach((cell) => placementsByCell[cell].push(compiled));
        }
      }
    });
    placementsByPiece.set(piece.id, placements);
  }

  function compileLockedPlacements(lockedPlacements) {
    const occupied = new Set();
    const usedPieces = new Set();
    const compiled = [];
    for (const placement of lockedPlacements) {
      if (!pieceById.has(placement.pieceId) || usedPieces.has(placement.pieceId) || !isPlacementInside(placement)) {
        return null;
      }
      const cells = placementCells(placement);
      if (cells.length !== getPiece(placement.pieceId).cells.length || cells.some((cell) => occupied.has(cell))) return null;
      cells.forEach((cell) => occupied.add(cell));
      usedPieces.add(placement.pieceId);
      compiled.push({ ...placement, cells });
    }
    return { occupied, usedPieces, compiled };
  }

  function solve(lockedPlacements = [], { limit = 1, seed = 0 } = {}) {
    const initial = compileLockedPlacements(lockedPlacements);
    if (!initial) return { count: 0, solution: null };
    const random = mulberry32(hashValue(seed));
    const occupied = initial.occupied;
    const usedPieces = initial.usedPieces;
    const chosen = [...initial.compiled];
    let count = 0;
    let firstSolution = null;

    function search() {
      if (count >= limit) return;
      if (usedPieces.size === safePieces.length) {
        if (occupied.size === boardArea) {
          count += 1;
          if (!firstSolution) {
            firstSolution = chosen.map(({ cells: _cells, ...placement }) => ({ ...placement }));
          }
        }
        return;
      }

      let bestOptions = null;
      for (const cell of activeCells) {
        if (occupied.has(cell)) continue;
        const options = placementsByCell[cell].filter((placement) => (
          !usedPieces.has(placement.pieceId)
          && placement.cells.every((candidateCell) => !occupied.has(candidateCell))
        ));
        if (options.length === 0) return;
        if (!bestOptions || options.length < bestOptions.length) {
          bestOptions = options;
          if (options.length === 1) break;
        }
      }

      if (!bestOptions) return;
      const orderedOptions = seed ? shuffled(bestOptions, random) : bestOptions;
      for (const placement of orderedOptions) {
        usedPieces.add(placement.pieceId);
        placement.cells.forEach((cell) => occupied.add(cell));
        chosen.push(placement);
        search();
        chosen.pop();
        placement.cells.forEach((cell) => occupied.delete(cell));
        usedPieces.delete(placement.pieceId);
        if (count >= limit) return;
      }
    }

    search();
    return { count, solution: firstSolution };
  }

  function validateCompletedBoard(placements, clues = []) {
    if (placements.length !== safePieces.length) return false;
    const compiled = compileLockedPlacements(placements);
    if (!compiled || compiled.occupied.size !== boardArea) return false;
    return clues.every((clue) => placements.some((placement) => (
      placement.pieceId === clue.pieceId
      && placement.variant === clue.variant
      && placement.row === clue.row
      && placement.col === clue.col
    )));
  }

  return {
    pieces: safePieces,
    rows,
    cols,
    activeCells,
    boardArea,
    getPiece,
    getVariants,
    getVariantIndex,
    placementCells,
    isPlacementInside,
    placementsFor: (pieceId) => placementsByPiece.get(pieceId) ?? [],
    solve,
    validateCompletedBoard,
  };
}

export { normalizeCells };
