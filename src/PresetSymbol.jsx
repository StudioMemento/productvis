// UI-only vector symbols. No renderer, image requests or GPU readback.
const paths = {
  scene: {
    ring: 'M4 17a12 5 0 1 0 24 0a12 5 0 1 0-24 0 M10 12v-3l6-3 6 3v3',
    void: 'M12 12h8v8h-8z',
    studio: 'M5 7h15q7 0 7 7v11H5 M5 20h22',
    cinema: 'M5 8h22v16H5z M5 12h22 M5 20h22 M11 8v4 M21 8v4',
    cubes: 'M4 13l7-4 7 4v9l-7 4-7-4z M4 13l7 4 7-4 M11 17v9 M17 8l6-3 6 3v8l-6 3-5-3 M17 8l6 4 6-4 M23 12v7',
    particles: 'M8 8h.1 M24 7h.1 M16 13h.1 M6 22h.1 M25 22h.1 M17 26h.1 M12 18h.1',
  },
  lighting: {
    softbox: 'M7 5h18v9H7z M11 18l-3 8 M16 18v9 M21 18l3 8',
    rim: 'M19 7a10 10 0 1 0 0 18 M23 9a8 8 0 0 1 0 14',
    split: 'M16 5a11 11 0 1 0 0 22V5z M20 7l5 5 M20 13l7 7 M20 20l4 4',
    top: 'M7 5h18 M16 9v12 M12 17l4 4 4-4 M6 27h20',
    warm: 'M11 16a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M16 3v4 M16 25v4 M3 16h4 M25 16h4 M7 7l3 3 M22 22l3 3 M7 25l3-3 M22 10l3-3',
    bicolor: 'M12 7a9 9 0 0 0 0 18 M20 7a9 9 0 0 1 0 18 M16 11v10',
  },
  camera: {
    hero: 'M6 12l12-5 8 6-12 6z M6 12v10l8 5 12-6v-8 M14 19v8',
    low: 'M4 24h24 M9 19l7-13 7 13 M12 9l4-3 4 3',
    front: 'M6 10h20v14H6z M12 15h8v4h-8z',
    profile: 'M7 11h18v12H7z M7 11l5 3v6l-5 3 M25 11l-4 3v6l4 3',
    top: 'M8 18l8-4 8 4-8 4z M16 3v8 M12 7l4 4 4-4 M8 25l8 4 8-4',
    macro: 'M5 12V5h7 M20 5h7v7 M27 20v7h-7 M12 27H5v-7 M12 16h8 M16 12v8',
  },
  motion: {
    still: 'M12 8v16 M20 8v16',
    turntable: 'M5 17a11 7 0 1 0 5-6 M5 6v7h7 M14 13h4v7h-4z',
    orbit: 'M4 16a12 8 0 1 0 24 0a12 8 0 1 0-24 0 M12 16a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
    dolly: 'M3 16h10 M9 12l4 4-4 4 M29 16H19 M23 12l-4 4 4 4 M16 5v4 M16 23v4',
  },
};
export function PresetSymbol({ category, id }) {
  if (category === 'product') return <span className="finish-sample" aria-hidden="true" />;
  return <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth={id === 'particles' ? 3 : 1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[category]?.[id]} /></svg>;
}
export function CompositionSymbol({ index }) {
  const heights = [[8, 18, 11], [17, 8, 17], [7, 12, 21]][index];
  return <svg viewBox="0 0 36 28" width="32" height="26" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">{heights.map((h,i) => <path key={i} d={`M${3+i*11} 25v-${h}l7-3v${h}z`} />)}</svg>;
}
