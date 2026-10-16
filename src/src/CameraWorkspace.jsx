import { CameraControls, MotionControls } from './CreativeControls.jsx';
export function CameraWorkspace(controls) {
  return <div className="camera-workspace property-pair"><div className="property-bank"><CameraControls {...controls}/></div><div className="property-bank"><MotionControls {...controls}/></div></div>;
}
