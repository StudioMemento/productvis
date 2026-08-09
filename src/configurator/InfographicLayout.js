function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function layoutInfographicCards(items = [], { width, height } = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const output = items.map((item) => ({ ...item }));

  ['left', 'right'].forEach((side) => {
    const sideItems = output.filter((item) => item.side === side).sort((a, b) => a.idealY - b.idealY);
    const gap = 14;
    const topBound = 64;
    const bottomBound = Math.max(topBound + 120, safeHeight - 76);
    let cursor = topBound;
    sideItems.forEach((item) => {
      item.cardY = Math.max(clamp(item.idealY, topBound, bottomBound - item.cardHeight), cursor);
      cursor = item.cardY + item.cardHeight + gap;
    });
    const overflow = cursor - gap - bottomBound;
    if (overflow > 0) {
      sideItems.forEach((item) => { item.cardY -= overflow; });
      let floor = topBound;
      sideItems.forEach((item) => {
        if (item.cardY < floor) item.cardY = floor;
        floor = item.cardY + item.cardHeight + gap;
      });
    }
  });

  return output.map((item) => {
    const edgeMargin = 18;
    const cardX = item.side === 'right'
      ? clamp(item.anchorX + 58, edgeMargin, safeWidth - item.cardWidth - edgeMargin)
      : clamp(item.anchorX - item.cardWidth - 58, edgeMargin, safeWidth - item.cardWidth - edgeMargin);
    const cardY = clamp(item.cardY, 54, Math.max(54, safeHeight - item.cardHeight - 68));
    const edgeX = item.side === 'right' ? cardX : cardX + item.cardWidth;
    const edgeY = clamp(item.anchorY, cardY + 20, cardY + item.cardHeight - 20);
    return { ...item, cardX, cardY, edgeX, edgeY };
  });
}

export function createInfographicConnector({ anchorX, anchorY, edgeX, edgeY, side }) {
  const direction = side === 'right' ? 1 : -1;
  const span = Math.abs(edgeX - anchorX);
  const bend = Math.max(34, span * 0.42);
  return [
    `M ${anchorX.toFixed(2)} ${anchorY.toFixed(2)}`,
    `C ${(anchorX + direction * bend).toFixed(2)} ${anchorY.toFixed(2)}`,
    `${(edgeX - direction * Math.min(44, bend * 0.35)).toFixed(2)} ${edgeY.toFixed(2)}`,
    `${edgeX.toFixed(2)} ${edgeY.toFixed(2)}`,
  ].join(' ');
}
