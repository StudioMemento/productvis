const creative=['product','scene','lighting','camera','motion'];
export const TECHNICAL_MENUS=['model','project','export'];
export const INITIAL_MENU={category:'product',open:'product'};
const menuIds=[...creative,...TECHNICAL_MENUS];
const normalize=id=>({post:'motion',inspect:'model',render:'project'}[id]||id);
const storageKey='productvis.workspace.v2';
export function workspaceMenu(state,action){
  // Selection is persistent. Dismissing a transient tool or hiding the UI must
  // never empty the workspace; only an explicit navigation action changes it.
  const id=normalize(action.id);
  if(!['open','toggle'].includes(action.type)||!menuIds.includes(id)||state.open===id)return state;
  return {category:creative.includes(id)?id:state.category,open:id};
}

export function restoreWorkspaceMenu(storage){
  try{
    const saved=JSON.parse((storage??globalThis.localStorage)?.getItem(storageKey)||'null');
    if(!saved||!creative.includes(saved.category)||!menuIds.includes(normalize(saved.open)))return INITIAL_MENU;
    const open=normalize(saved.open);
    return {category:creative.includes(open)?open:saved.category,open};
  }catch{return INITIAL_MENU;}
}
export function persistWorkspaceMenu(menu,storage){
  try{(storage??globalThis.localStorage)?.setItem(storageKey,JSON.stringify(menu));}catch{/* Storage is optional, including private browsing. */}
}
