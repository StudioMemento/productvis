// A small, unenclosed line vocabulary shared by the advanced menu and axis actions.
const paths={
  model:'M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z M4 7.5l8 4.5 8-4.5 M12 12v9',
  inspect:'M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M7 12l5-5 5 5-5 5z M7 12h10 M12 7v10',
  project:'M4 6h5 M13 6h7 M4 12h10 M18 12h2 M4 18h3 M11 18h9 M9 4v4 M14 10v4 M7 16v4',
  render:'M4 4h16v16H4z M4 8h16 M4 16h16 M8 4v4 M16 4v4 M8 16v4 M16 16v4 M10 10l4 2-4 2z',
  export:'M12 15V3 M8 7l4-4 4 4 M4 13v7h16v-7',
  reset:'M5 9a8 8 0 1 1-.5 6 M5 3v6h6',
  lock:'M7 11V7a5 5 0 0 1 10 0v4 M5 11h14v10H5z M12 15v2',
  unlock:'M7 11V7a5 5 0 0 1 9-3 M5 11h14v10H5z M12 15v2',
};
export function WorkspaceIcon({name,size=20}) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
