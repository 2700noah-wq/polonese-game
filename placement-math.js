export function pointerAnchorForPlacement(cells) {
  if (!Array.isArray(cells) || cells.length === 0) return { row: 0.5, col: 0.5 };
  const total = cells.reduce(
    (sum, [row, col]) => ({ row: sum.row + row + 0.5, col: sum.col + col + 0.5 }),
    { row: 0, col: 0 },
  );
  return {
    row: total.row / cells.length,
    col: total.col / cells.length,
  };
}

export function placementFromBoardPoint(point, pointerAnchor) {
  return {
    row: Math.round(point.row - pointerAnchor.row),
    col: Math.round(point.col - pointerAnchor.col),
  };
}
