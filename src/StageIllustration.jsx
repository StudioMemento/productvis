import { IconPlanet,IconCube,IconWarehouse,IconCloudRain,IconCylinder,IconWind,IconSunHorizon,IconCloud,IconWaves,IconSparkles } from './icons.jsx';
const icons={'amber-halo':IconSunHorizon,water:IconWaves,cloud:IconCloud,aurora:IconWind,dust:IconSparkles,void:IconPlanet,cubes:IconCube,studio:IconWarehouse,rain:IconCloudRain,ring:IconCylinder,'velocity-lines':IconWind};
export function StageIllustration({id}) {
  const Icon=icons[id];
  return Icon?<Icon className="stage-illustration" size={30}/>:null;
}
