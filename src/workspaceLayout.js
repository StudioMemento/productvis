export const usesBottomDock = (width, height) => width < 600 || (height > 550 && (width < 900 || width / height < 1.15));
