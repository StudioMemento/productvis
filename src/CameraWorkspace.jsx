import { CameraControls, MotionControls } from './CreativeControls.jsx';
export function CameraWorkspace(controls) {
  return <div className="camera-workspace"><CameraControls {...controls}/><MotionControls {...controls}/></div>;
}
