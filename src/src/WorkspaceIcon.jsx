import { IconCubeTransparent,IconScan,IconSettings,IconMovie,IconExport,IconRefresh,IconLock,IconUnlock } from './icons.jsx';
const icons={model:IconCubeTransparent,inspect:IconScan,project:IconSettings,render:IconMovie,export:IconExport,reset:IconRefresh,lock:IconLock,unlock:IconUnlock};
export function WorkspaceIcon({name,size=20}) {
  const Icon=icons[name];
  return Icon?<Icon size={size}/>:null;
}
