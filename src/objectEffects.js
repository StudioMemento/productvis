import * as THREE from 'three';
import { topologyOverlay } from './inspection.js';
import { DEFAULT_EFFECTS, EFFECT_CYCLE, effectBudget, effectsEnabled, effectsAnimated, effectsAlterCoverage } from './objectEffectsState.js';
import { surfaceUniforms, installSurfaceShader, SURFACE_MODES } from './objectSurfaceShader.js';
import { SurfaceSamples } from './effectSampling.js';
import { createParticleObject, createFilaments } from './effectParticles.js';
import { ObjectTrails } from './effectTrails.js';

export class ObjectEffects {
  constructor(scene, product, meshes, bounds, {coarse=false}={}) {
    this.scene=scene;this.product=product;this.meshes=meshes;this.coarse=coarse;
    this.size=bounds.getSize(new THREE.Vector3());this.span=Math.max(this.size.x,this.size.y,this.size.z,.001);
    this.uniforms=surfaceUniforms();this.uniforms.pvFxCenter.value.copy(bounds.getCenter(new THREE.Vector3()));this.uniforms.pvFxSpan.value=this.span;
    Object.assign(this.uniforms,{uSize:{value:.7},uSpread:{value:.45},uLength:{value:.45},uPixels:{value:10},uMode:{value:0},uReverse:{value:1},uCamera:{value:new THREE.Vector3()}});
    this.group=new THREE.Group();this.group.name='Product FX';product.add(this.group);
    this.restores=[];this.wires=[];this.originalShadows=meshes.map(mesh=>mesh.castShadow);
    const materials=new Set();meshes.forEach(mesh=>{const base=mesh.userData.pvBaseMaterials||mesh.material;for(const mat of Array.isArray(base)?base:[base])materials.add(mat);});
    for(const mat of materials)this.restores.push(installSurfaceShader(mat,this.uniforms));
    this.time=0;this.poseClock=0;this.forcePose=true;this.fx={...DEFAULT_EFFECTS};this.enabled=false;
  }

  setState(state, planes=[]) {
    this.planes=planes;
    const previous=this.fx,fx=state.effects||DEFAULT_EFFECTS;
    if(previous.phase!==fx.phase||['surface','particles','trail','seed'].some(key=>previous[key]!==fx[key])){this.time=fx.phase*EFFECT_CYCLE;this.trails?.clear();}
    this.fx=fx;this.enabled=effectsEnabled(fx)&&state.inspection.view==='pbr';
    this.uniforms.pvFxEnabled.value=this.enabled?1:0;
    this.uniforms.pvFxMode.value=SURFACE_MODES[fx.surface];
    this.uniforms.pvFxIntensity.value=fx.intensity;this.uniforms.pvFxSolid.value=fx.solid;this.uniforms.pvFxDensity.value=fx.density;
    this.uniforms.pvFxColor.value.set(fx.color);this.uniforms.pvFxAxis.value.set(0,0,0);this.uniforms.pvFxAxis.value[fx.axis]=1;
    this.uniforms.uSize.value=fx.size;this.uniforms.uSpread.value=fx.spread;this.uniforms.uLength.value=fx.length;this.uniforms.uReverse.value=fx.reverse?-1:1;
    this.uniforms.uMode.value={points:0,scatter:1,flow:2,streaks:3}[fx.particles]||0;
    this.uniforms.pvFxTime.value=this.cursor*EFFECT_CYCLE;
    this.meshes.forEach((mesh,i)=>{mesh.castShadow=this.originalShadows[i]&&!(this.enabled&&effectsAlterCoverage(fx));});
    const deforming=this.meshes.some(mesh=>mesh.isSkinnedMesh||mesh.morphTargetInfluences?.length||mesh.morphTexture);
    this.budget=effectBudget({coarse:this.coarse,quality:state.quality,deforming});
    const resourceKey=JSON.stringify([fx.particles,fx.trail,fx.seed,this.budget]);
    if(resourceKey!==this.resourceKey) {
      this.disposeParticles();this.resourceKey=resourceKey;
      const sampledParticles=!['none','filaments'].includes(fx.particles);
      const count=Math.max(sampledParticles?(fx.particles==='streaks'?this.budget.streaks:this.budget.points):0,fx.trail==='ghost'?this.budget.ghostPoints:fx.trail==='ribbon'?192:0);
      if(count)this.samples=new SurfaceSamples(this.meshes,this.product,count,fx.seed);
      if(fx.particles==='filaments')this.particle=createFilaments(this.uniforms,this.size,this.coarse?4:6);
      else if(sampledParticles&&this.samples.count)this.particle=createParticleObject(this.samples,this.uniforms,fx.particles);
      if(this.particle)this.group.add(this.particle.object);
      if(fx.trail!=='none'&&this.samples?.count)this.trails=new ObjectTrails(this.scene,this.product,this.samples,fx.trail,this.budget,this.span);
      this.forcePose=true;
    }
    if(fx.surface==='wire'&&!this.wires.length) {
      for(const mesh of this.meshes) {
        const material=new THREE.MeshBasicMaterial({color:fx.color,wireframe:true,transparent:true,opacity:fx.intensity,depthWrite:false});
        const wire=topologyOverlay(mesh,material);wire.name='Product FX · wire';mesh.add(wire);this.wires.push(wire);
      }
    }
    for(const wire of this.wires){wire.visible=this.enabled&&fx.surface==='wire';wire.material.color.set(fx.color);wire.material.opacity=fx.intensity;wire.material.clippingPlanes=planes;}
    if(this.particle){this.particle.material.clippingPlanes=planes;this.particle.setCount(fx.particles==='filaments'?(this.coarse?4:6)*fx.density:Math.round(this.samples.count*fx.density));}
    if(this.trails)for(const material of this.trails.materials)material.clippingPlanes=planes;
    this.group.visible=this.enabled;if(this.trails)this.trails.group.visible=this.enabled;
    if(!this.enabled)this.trails?.clear();
  }

  get cursor(){return ((this.time/EFFECT_CYCLE)%1+1)%1;}
  restart(){this.time=0;this.uniforms.pvFxTime.value=0;this.trails?.clear();this.forcePose=true;}
  updateCoverage(){this.samples?.updateVisibility();this.particle?.sync?.();if(this.trails){this.trails.dispose();this.trails=new ObjectTrails(this.scene,this.product,this.samples,this.fx.trail,this.budget,this.span);this.trails.group.visible=this.enabled;for(const material of this.trails.materials)material.clippingPlanes=this.planes;}}
  snapshot(){return {time:this.time,trail:this.trails?.snapshot()};}
  restore(snapshot){this.time=snapshot.time;this.trails?.restore(snapshot.trail);this.forcePose=true;}

  update(delta,{camera,height=800,deforming=false,forcePose=false,absoluteTime}={}) {
    if(!this.enabled)return false;
    const fx=this.fx,playing=fx.playing&&fx.speed>0;
    if(Number.isFinite(absoluteTime))this.time=absoluteTime;
    else if(playing)this.time+=Math.max(0,delta)*fx.speed;
    this.product.updateWorldMatrix(true,true);
    this.uniforms.pvFxWorldToProduct.value.copy(this.product.matrixWorld).invert();
    this.uniforms.pvFxTime.value=this.cursor*EFFECT_CYCLE;this.uniforms.uPixels.value=height*.012;
    camera.getWorldPosition(this.uniforms.uCamera.value).applyMatrix4(this.uniforms.pvFxWorldToProduct.value);
    this.poseClock+=Math.max(0,delta);
    if(this.samples&&(forcePose||this.forcePose||(deforming&&this.poseClock>=1/this.budget.updateHz))) {
      if(this.samples.refresh(forcePose||this.forcePose,deforming))this.particle?.sync?.();
      this.forcePose=false;this.poseClock=0;
    }
    const tail=this.trails?.update(this.time,fx,camera,playing);
    return (effectsAnimated(fx)&&(['scan','hologram','contour','glitch','dissolve'].includes(fx.surface)||!['none','points'].includes(fx.particles))) || !!(playing&&tail);
  }

  disposeParticles(){this.particle?.dispose();this.trails?.dispose();this.samples?.dispose();this.particle=null;this.trails=null;this.samples=null;}
  dispose(){
    this.disposeParticles();this.group.removeFromParent();
    for(const wire of this.wires){wire.removeFromParent();wire.material.dispose();}
    this.meshes.forEach((mesh,i)=>{mesh.castShadow=this.originalShadows[i];});
    this.restores.forEach(restore=>restore());this.wires=[];this.restores=[];
  }
}
