import {videoSettings} from './playblast.js';

// The same CSS rectangle drives the camera projection and the DOM-only guide.
export function exportFrame(width,height,insets,settings){
  const output=videoSettings(settings),aspect=output.width/output.height;
  const areaWidth=Math.max(1,width-(insets?.right||0)),areaHeight=Math.max(1,height-(insets?.bottom||0));
  const availableWidth=Math.max(1,areaWidth-40),availableHeight=Math.max(1,areaHeight-110);
  const frameWidth=Math.min(availableWidth,availableHeight*aspect),frameHeight=frameWidth/aspect;
  return {x:(areaWidth-frameWidth)/2,y:75+(availableHeight-frameHeight)/2,width:frameWidth,height:frameHeight};
}
