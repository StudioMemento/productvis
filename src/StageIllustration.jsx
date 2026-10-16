import { IconPlanet,IconCube,IconWarehouse,IconCloudRain,IconCylinder,IconWind } from './icons.jsx';
const icons={void:IconPlanet,cubes:IconCube,studio:IconWarehouse,rain:IconCloudRain,ring:IconCylinder,'velocity-lines':IconWind};
export function StageIllustration({id}) {
  const Icon=icons[id];
  return Icon?<Icon className="stage-illustration" size={30}/>:null;
}
