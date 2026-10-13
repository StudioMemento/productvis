const creative=['product','scene','lighting','camera','motion'];
export const TECHNICAL_MENUS=['project','inspect','render','post'];
export const INITIAL_MENU={category:'product',open:'product'};
export function workspaceMenu(state,action){
  if(action.type==='close')return {...state,open:null};
  if(![...creative,...TECHNICAL_MENUS].includes(action.id))return state;
  return {category:creative.includes(action.id)?action.id:state.category,open:action.type==='toggle'&&state.open===action.id?null:action.id};
}
