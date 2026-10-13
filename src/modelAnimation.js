import { AnimationMixer, LoopOnce } from 'three';
import { validateAnimation } from './animationState.js';

// A separate clock for authored GLB clips; camera/product FX keep their own clock.
// Absolute sampling is also used by playblast, so dropped frames cannot slow a clip.
export class ModelAnimation {
  constructor(root,clips = []) {
    this.root=root;this.clips=clips.filter(clip=>clip.duration>0 && clip.tracks.length);
    this.mixer=new AnimationMixer(root);this.config=null;this.time=0;this.action=null;this.ended=false;
    this.metadata=this.clips.map((clip,index)=>({index,name:clip.name||`Animazione ${index+1}`,duration:clip.duration}));
  }
  get duration(){return this.clips[this.index]?.duration||0;}
  get cursor(){return this.duration?this.time/this.duration:0;}
  setState(value) {
    const next=validateAnimation(value),previous=this.config;
    const index=Math.min(next.clip,Math.max(0,this.clips.length-1));
    const changed=index!==this.index;
    if(changed){
      this.mixer.stopAllAction();this.index=index;
      this.action=this.clips[index]?this.mixer.clipAction(this.clips[index]):null;
      if(this.action){this.action.reset().setLoop(LoopOnce,1).play();this.action.clampWhenFinished=true;this.action.paused=true;}
    }
    this.config=next;
    if(changed || !previous || previous.cursor!==next.cursor)this.seek(next.cursor*this.duration);
    else if(next.playing && !previous.playing && this.time>=this.duration)this.seek(0);
    if(!previous || previous.playing!==next.playing || previous.loop!==next.loop)this.ended=false;
    return changed || !previous || previous.cursor!==next.cursor;
  }
  seek(seconds) {
    if(!this.action)return;
    this.time=Math.min(this.duration,Math.max(0,Number.isFinite(seconds)?seconds:0));
    this.action.enabled=true;this.action.time=this.time;this.mixer.update(0);this.root.updateMatrixWorld(true);this.ended=false;
  }
  sample(seconds,loop=this.config?.loop){
    this.seek(loop && seconds>this.duration ? seconds%this.duration : seconds);
  }
  update(delta) {
    if(!this.action || !this.config?.playing || this.ended)return {moving:false,ended:false};
    const next=this.time+Math.max(0,delta)*this.config.speed;
    this.sample(next);
    this.ended=!this.config.loop && next>=this.duration;
    return {moving:true,ended:this.ended};
  }
  dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.root);this.action=null;}
}
