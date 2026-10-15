import { PresetSymbol } from './PresetSymbol.jsx';

// Each concept has a readable 32 px silhouette, without a frame or thumbnail.
const motifs={
  'black-softbox':'M7 5h18v5H7z M10 15l-4 11 M22 15l4 11 M16 15v8 M10 27h12',
  'pearl-infinity':'M5 23V7h15q7 0 7 7v9 M5 23h22 M8 16c3-6 5 6 8 0s5 6 8 0',
  'amber-horizon':'M3 20h10 M19 20h10 M16 4v12 M12 25h8',
  'halo-floor':'M4 21a12 5 0 1 0 24 0 M4 21a12 5 0 0 1 7-4 M21 17a12 5 0 0 1 7 4 M12 10h8 M16 6v8',
  'concrete-cut':'M5 27V7h9v20 M19 27V4h8v23 M16 8v14',
  'neon-gate':'M7 28V5h18v23 M3 28h8 M21 28h8',
  'rain-veil':'M8 4 5 13 M18 3l-3 9 M27 6l-3 9 M11 16l-2 6 M21 17l-2 6 M4 27h24',
  'twin-blades':'M6 5h3v23H6z M23 3h3v23h-3z M13 16h6',
  'mist-island':'M7 20l9-4 9 4-9 4z M7 20v4l9 4 9-4v-4 M4 12h10 M18 8h10 M3 7h8',
  'velocity-lines':'M3 9h13 M21 9h8 M3 16h6 M23 16h6 M3 23h10 M18 23h11 M12 15h8v3h-8z',
  'neon-rain-cathedral':'M3 28V4h26v24 M8 28V9h16v19 M13 28V14h6v14 M11 2 9 6 M23 2l-2 4',
  'endless-monoliths':'M4 27V13l5-2v16 M13 27V5l6-2v24 M23 27V10l5-2v19 M3 29h26',
  'brutalist-orbit':'M5 9a11 4 0 1 0 22 0a11 4 0 1 0-22 0 M8 13v10 M24 13v10 M4 27l12-5 12 5',
  'hyperdrive':'M3 28 11 4h10l8 24 M8 28l6-18h4l6 18 M16 21v8 M3 12l4 5 M29 12l-4 5',
  'tidal-eclipse':'M21 4a8 8 0 1 0 0 14 8 8 0 0 1 0-14 M3 23q3-3 6 0t6 0t6 0t6 0 M7 28h18',
  'aurora-vault':'M3 9q6-9 13 0t13 0 M3 15q6-9 13 0t13 0 M4 28l7-8 5 6 5-4 7 6',
  'ember-rift':'M3 27 6 10l7 3-2 14 M21 27l-2-14 7-6 3 20 M17 9l-3 9 4 1-3 10',
  'kinetic-gallery':'M5 27 3 7l9-2 3 22 M19 27l2-22 8 2-2 20 M9 10l2 12 M24 10l-1 12',
  'signal-garden':'M5 27V12 M12 27V6 M20 27V16 M27 27V9 M3 10h4 M10 4h4 M18 14h4 M25 7h4',
  'midnight-skydeck':'M3 23h26 M5 29h22 M6 19V8h5v11 M15 19V4h5v15 M24 19v-7h4v7 M4 23v6 M28 23v6',
};
export function StageIllustration({id}) {
  if(!motifs[id])return <PresetSymbol category="scene" id={id}/>;
  return <svg className="stage-illustration" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={motifs[id]}/></svg>;
}
