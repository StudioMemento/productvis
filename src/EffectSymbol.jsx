export function EffectSymbol({id}) {
  const motifs={
    none:<path d="m7 7 18 18M25 7 7 25"/>,
    rim:<><circle cx="16" cy="16" r="8"/><path d="M16 4a12 12 0 0 1 12 12M4 16a12 12 0 0 0 12 12"/></>,
    scan:<><path d="M7 6v20h18V6ZM3 15h26"/><path opacity=".4" d="M7 20h18"/></>,
    spectral:<><path d="m16 5 12 21H4Z"/><path d="M2 14h11m4 0 13-5m-12 8 12 2m-12 1 12 8"/></>,
    hologram:<><ellipse cx="16" cy="8" rx="9" ry="3"/><path d="M7 8v16q9 6 18 0V8M7 13h18M7 18h18M7 23h18"/></>,
    contour:<><path d="M3 18q5-17 13-7t13-1M3 23q5-17 13-7t13-1M3 28q5-17 13-7t13-1M3 13q5-17 13-7t13-1"/></>,
    wire:<path d="m16 3 13 9-5 15H8L3 12Zm0 0-8 24m8-24 8 24M3 12h26M3 12l21 15M29 12 8 27"/>,
    glitch:<path d="M8 5h16v6H4v5h22v6H10v5h14M2 8h3m23 10h3M4 25h3"/>,
    dissolve:<><path d="M7 5v22h11V5Z"/><path d="M22 5h2v2h-2zm3 7h2v2h-2zm-4 6h2v2h-2zm4 8h2v2h-2z"/></>,
    points:<>{[8,16,24].flatMap(x=>[8,16,24].map(y=><circle key={x+'-'+y} cx={x} cy={y} r="1.3"/>))}</>,
    scatter:<>{[[16,16],[3,8],[27,4],[24,25],[5,28],[28,16],[14,4],[8,18]].map(([x,y])=><circle key={x+'-'+y} cx={x} cy={y} r="1.4"/>)}</>,
    flow:<><path d="M3 20q7-16 13-6t13-6M3 27q7-16 13-6t13-6"/><circle cx="9" cy="8" r="1.5"/><circle cx="23" cy="25" r="1.5"/></>,
    filaments:<><path d="m2 23 7-9 7 3 7-13 7 8M2 29l6-9 8 3 6-10 8 6"/><circle cx="16" cy="17" r="2"/></>,
    streaks:<path d="m4 26 8-8M9 28 27 10M5 18 21 2M18 27l12-12"/>,
    ribbon:<><path d="M2 8c8 0 6 18 15 18s6-14 13-14M2 4c11 0 7 17 15 17s7-13 13-13"/></>,
    ghost:<><circle opacity=".3" cx="10" cy="16" r="7"/><circle opacity=".6" cx="16" cy="16" r="7"/><circle cx="22" cy="16" r="7"/></>
  };
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{motifs[id]}</svg>;
}
