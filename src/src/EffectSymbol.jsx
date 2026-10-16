import { IconProhibit,IconCircleNotch,IconScan,IconPrism,IconCylinder,IconWaveSine,IconPolygon,IconActivity,IconGradient,IconGridDots,IconCirclesThreePlus,IconFlowArrow,IconLightning,IconWind,IconBezierCurve,IconCopySimple } from './icons.jsx';
const icons={none:IconProhibit,rim:IconCircleNotch,scan:IconScan,spectral:IconPrism,hologram:IconCylinder,contour:IconWaveSine,wire:IconPolygon,glitch:IconActivity,dissolve:IconGradient,points:IconGridDots,scatter:IconCirclesThreePlus,flow:IconFlowArrow,filaments:IconLightning,streaks:IconWind,ribbon:IconBezierCurve,ghost:IconCopySimple};
export function EffectSymbol({id}) {
  const Icon=icons[id];
  return Icon?<Icon size={28}/>:null;
}
