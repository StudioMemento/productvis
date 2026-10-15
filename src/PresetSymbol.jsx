// UI-only vector symbols. No renderer, image requests or GPU readback.
const paths = {
  scene: {
    ring: 'M4 17a12 5 0 1 0 24 0a12 5 0 1 0-24 0 M10 12v-3l6-3 6 3v3',
    void: 'M12 12h8v8h-8z',
    studio: 'M5 7h15q7 0 7 7v11H5 M5 20h22',
    cinema: 'M5 8h22v16H5z M5 12h22 M5 20h22 M11 8v4 M21 8v4',
    cubes: 'M4 13l7-4 7 4v9l-7 4-7-4z M4 13l7 4 7-4 M11 17v9 M17 8l6-3 6 3v8l-6 3-5-3 M17 8l6 4 6-4 M23 12v7',
    particles: 'M8 8h.1 M24 7h.1 M16 13h.1 M6 22h.1 M25 22h.1 M17 26h.1 M12 18h.1',
    grid:'M4 12h24 M4 20h24 M10 5v22 M22 5v22',desert:'M3 24Q10 3 18 24 M12 24Q23 6 29 24',mountain:'M3 26 13 5l9 21 M16 13l7-6 7 19 M9 14l4 3 4-3',
    urban:'M3 26V12h7v14 M13 26V5h7v21 M23 26V15h6v11',tunnel:'M3 28V4h26v24 M8 28V9h16v19 M13 28V14h6v14',road:'M5 28 11 4 M27 28 21 4 M16 24v-4 M16 15v-3 M16 7V4',rain:'M6 8l-3 9 M16 5l-4 12 M27 7l-4 11 M9 23l-2 6 M21 22l-2 7',monolith:'M7 27V5l7-2v22z M19 28V12l7-3v17z',
  },
  lighting: {
    softbox: 'M7 5h18v9H7z M11 18l-3 8 M16 18v9 M21 18l3 8',
    rim: 'M19 7a10 10 0 1 0 0 18 M23 9a8 8 0 0 1 0 14',
    split: 'M16 5a11 11 0 1 0 0 22V5z M20 7l5 5 M20 13l7 7 M20 20l4 4',
    top: 'M7 5h18 M16 9v12 M12 17l4 4 4-4 M6 27h20',
    warm: 'M11 16a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M16 3v4 M16 25v4 M3 16h4 M25 16h4 M7 7l3 3 M22 22l3 3 M7 25l3-3 M22 10l3-3',
    bicolor: 'M12 7a9 9 0 0 0 0 18 M20 7a9 9 0 0 1 0 18 M16 11v10',
    overcast:'M6 20a5 5 0 0 1 1-10 8 8 0 0 1 15 0 5 5 0 0 1 3 10z M9 24v3 M16 24v3 M23 24v3',neon:'M6 5h4v22H6z M22 5h4v22h-4z M14 10h4v12h-4z',sunset:'M3 21h26 M8 18a8 8 0 0 1 16 0 M16 3v4 M4 7l4 4 M28 7l-4 4',moon:'M23 5a12 12 0 1 0 4 18A12 12 0 0 1 23 5Z',showroom:'M3 7h8v14H3z M21 7h8v14h-8z M14 4h4v23h-4z',noir:'M16 4v24 M10 8a10 10 0 0 0 0 16 M20 7l7 4 M20 24l7-4',
  },
  camera: {
    hero: 'M6 12l12-5 8 6-12 6z M6 12v10l8 5 12-6v-8 M14 19v8',
    low: 'M4 24h24 M9 19l7-13 7 13 M12 9l4-3 4 3',
    front: 'M6 10h20v14H6z M12 15h8v4h-8z',
    profile: 'M7 11h18v12H7z M7 11l5 3v6l-5 3 M25 11l-4 3v6l4 3',
    top: 'M8 18l8-4 8 4-8 4z M16 3v8 M12 7l4 4 4-4 M8 25l8 4 8-4',
    macro: 'M5 12V5h7 M20 5h7v7 M27 20v7h-7 M12 27H5v-7 M12 16h8 M16 12v8',
    rear:'M6 10h20v14H6z M8 18h5 M19 18h5',rearLow:'M5 25h22 M7 20l9-14 9 14 M12 21h8',overhead:'M7 7h18v18H7z M16 3v26 M3 16h26',wide:'M3 9v14 M29 9v14 M8 11h16v10H8z',detail:'M5 12V5h7 M20 5h7v7 M27 20v7h-7 M12 27H5v-7 M12 12h8v8h-8z',left:'M7 10h18v14H7z M9 17h13 M13 13l-4 4 4 4',
  },
  motion: {
    still: 'M12 8v16 M20 8v16',
    idle: 'M3 16q6-12 13 0t13 0 M10 7h12 M10 25h12',
    turntable: 'M5 17a11 7 0 1 0 5-6 M5 6v7h7 M14 13h4v7h-4z',
    orbit: 'M4 16a12 8 0 1 0 24 0a12 8 0 1 0-24 0 M12 16a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
    dolly: 'M3 16h10 M9 12l4 4-4 4 M29 16H19 M23 12l-4 4 4 4 M16 5v4 M16 23v4',
  },
};
export function PresetSymbol({ category, id }) {
  return <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth={id === 'particles' ? 3 : 1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[category]?.[id]} /></svg>;
}
export function CompositionSymbol({ index }) {
  const heights = [[8, 18, 11], [17, 8, 17], [7, 12, 21]][index];
  return <svg viewBox="0 0 36 28" width="32" height="26" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">{heights.map((h,i) => <path key={i} d={`M${3+i*11} 25v-${h}l7-3v${h}z`} />)}</svg>;
}
