export const usesBottomDock = (width, height) => width < 600 || (height > 550 && (width < 900 || width / height < 1.15));

// Navigation belongs to the workspace now; it must never reserve a second area.
export function workspaceInsets(width, height, panel) {
  return usesBottomDock(width,height)
    ? {right:0,bottom:Math.max(0,height-panel.top)+12}
    : {right:Math.max(0,width-panel.left)+20,bottom:16};
}
