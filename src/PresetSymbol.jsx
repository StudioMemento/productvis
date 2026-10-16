import { IconLamp,IconCircleHalfTilt,IconCircleHalf2,IconArrowBarToDown,IconSun,IconLayersIntersect,IconCloud,IconLightning,IconSunHorizon,IconMoon,IconLampPendant,IconCubeTransparent,IconArrowUpRight,IconRectangle,IconRectangleDashed,IconMagnifyingGlassPlus,IconArrowUDownLeft,IconArrowDownRight,IconFocus2,IconMaximize,IconScan,IconArrowLeft,IconPlayerPause,IconWaveSine,IconRotateClockwise,IconPlanet,IconArrowsInLineHorizontal,IconAlignBottomSimple,IconAlignCenterVerticalSimple,IconAlignTopSimple } from './icons.jsx';
const icons={
  lighting:{softbox:IconLamp,rim:IconCircleHalfTilt,split:IconCircleHalf2,top:IconArrowBarToDown,warm:IconSun,bicolor:IconLayersIntersect,overcast:IconCloud,neon:IconLightning,sunset:IconSunHorizon,moon:IconMoon,showroom:IconLampPendant,noir:IconCircleHalfTilt},
  camera:{hero:IconCubeTransparent,low:IconArrowUpRight,front:IconRectangle,profile:IconRectangleDashed,top:IconArrowBarToDown,macro:IconMagnifyingGlassPlus,rear:IconArrowUDownLeft,rearLow:IconArrowDownRight,overhead:IconFocus2,wide:IconMaximize,detail:IconScan,left:IconArrowLeft},
  motion:{still:IconPlayerPause,idle:IconWaveSine,turntable:IconRotateClockwise,orbit:IconPlanet,dolly:IconArrowsInLineHorizontal},
};
export function PresetSymbol({category,id}) {
  const Icon=icons[category]?.[id];
  return Icon?<Icon size={28}/>:null;
}
export function CompositionSymbol({index}) {
  const Icon=[IconAlignBottomSimple,IconAlignCenterVerticalSimple,IconAlignTopSimple][index];
  return Icon?<Icon size={28}/>:null;
}
