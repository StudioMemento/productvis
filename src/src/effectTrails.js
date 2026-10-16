import * as THREE from 'three';

// Object-space history, stored in world coordinates. Orbiting the camera alone
// never paints the environment into a trail. Ghosts use bounded surface samples.
export class ObjectTrails {
  constructor(scene, product, samples, kind, budget, span) {
    this.product=product;this.samples=samples;this.kind=kind;this.budget=budget;this.span=span;
    this.group=new THREE.Group();this.group.name=`Product FX · ${kind}`;scene.add(this.group);
    const visible=Array.from({length:samples.count},(_,i)=>i).filter(i=>samples.visibility[i]>.5);
    this.count=kind==='ghost'?Math.min(visible.length,budget.ghostPoints):Math.min(visible.length,budget.ribbons);
    this.sampleIndices=Array.from({length:this.count},(_,i)=>visible[Math.floor(i*visible.length/this.count)]);
    this.current=new Float32Array(this.count*3);this.previous=new Float32Array(this.count*3);
    this.slots=Array.from({length:kind==='ghost'?budget.ghosts:budget.segments},()=>({positions:new Float32Array(this.count*3),time:-Infinity}));
    this.history=[];this.lastSample=-Infinity;this.initialized=false;
    this.p=new THREE.Vector3();this.a=new THREE.Vector3();this.b=new THREE.Vector3();this.side=new THREE.Vector3();this.eye=new THREE.Vector3();
    this.materials=[];this.objects=[];
    if(kind==='ghost') {
      for(let i=0;i<budget.ghosts;i++) {
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.count*3),3).setUsage(THREE.DynamicDrawUsage));
        const material=new THREE.PointsMaterial({color:'#e4eeff',size:.015*span,sizeAttenuation:true,transparent:true,opacity:.2,depthWrite:false});
        const object=new THREE.Points(geometry,material);this.add(object,material);
      }
    } else {
      const vertices=budget.ribbons*(budget.segments-1)*6,geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(vertices*3),3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(vertices*4),4).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);
      const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
      this.add(new THREE.Mesh(geometry,material),material);
    }
  }
  add(object,material){object.frustumCulled=false;object.raycast=()=>{};object.visible=false;object.renderOrder=2;this.materials.push(material);this.objects.push(object);this.group.add(object);}
  clear(){this.history.length=0;this.initialized=false;this.lastSample=-Infinity;this.objects.forEach(object=>{object.visible=false;});}
  snapshot(){return {history:this.history.map(slot=>({time:slot.time,positions:slot.positions.slice()})),previous:this.previous.slice(),initialized:this.initialized,lastSample:this.lastSample};}
  restore(saved){this.clear();if(!saved)return;this.history=saved.history.map((slot,i)=>{const target=this.slots[i];target.time=slot.time;target.positions.set(slot.positions);return target;});this.previous.set(saved.previous);this.initialized=saved.initialized;this.lastSample=saved.lastSample;}
  update(time, fx, camera, emit=true) {
    if(!this.count)return false;
    const life=.22+fx.length*1.8,interval=life/(this.kind==='ghost'?this.budget.ghosts+1:this.budget.segments-1);
    this.product.updateWorldMatrix(true,false);
    for(let i=0;i<this.count;i++) {
      const index=this.sampleIndices[i];
      this.p.fromArray(this.samples.positions,index*3).applyMatrix4(this.product.matrixWorld).toArray(this.current,i*3);
    }
    let moved=false;
    if(this.initialized)for(let i=0;i<this.current.length;i++)if(Math.abs(this.current[i]-this.previous[i])>this.span*.0002){moved=true;break;}
    if(emit&&time-this.lastSample>=interval&&(moved||!this.initialized)) {
      const slot=this.slots.find(slot=>!this.history.includes(slot))||this.history.pop();
      slot.positions.set(this.current);slot.time=time;this.history.unshift(slot);
      this.previous.set(this.current);this.lastSample=time;this.initialized=true;
    }
    this.history=this.history.filter(slot=>time-slot.time<=life);
    // A single sample seeds the history but is not a visible afterimage.
    const visible=this.history.length>1;
    for(const material of this.materials){material.color.set(fx.color);material.opacity=fx.intensity;}
    if(this.kind==='ghost') {
      this.objects.forEach((object,i)=>{
        const slot=this.history[i];object.visible=visible&&!!slot&&time-slot.time>.02;
        if(!object.visible)return;
        object.geometry.attributes.position.array.set(slot.positions);object.geometry.attributes.position.needsUpdate=true;
        object.geometry.setDrawRange(0,Math.max(1,Math.round(this.count*fx.density)));
        object.material.opacity=fx.intensity*.42*Math.pow(Math.max(0,1-(time-slot.time)/life),1.5);
        object.material.size=this.span*.0035*fx.size;
      });
    } else {
      const object=this.objects[0],geometry=object.geometry,positions=geometry.attributes.position.array,colors=geometry.attributes.color.array;
      let offset=0;const bands=Math.max(1,Math.round(this.count*fx.density));
      const width=this.span*.0025*fx.size*new THREE.Vector3().setFromMatrixScale(this.product.matrixWorld).length()/Math.sqrt(3);
      for(let band=0;band<bands;band++)for(let i=0;i<this.history.length-1;i++) {
        const start=this.history[i],end=this.history[i+1];this.a.fromArray(start.positions,band*3);this.b.fromArray(end.positions,band*3);
        if(this.a.distanceToSquared(this.b)<1e-12)continue;
        this.side.subVectors(this.b,this.a).cross(this.eye.subVectors(camera.position,this.a)).normalize().multiplyScalar(width);
        const alphaA=Math.pow(Math.max(0,1-(time-start.time)/life),1.5),alphaB=Math.pow(Math.max(0,1-(time-end.time)/life),1.5);
        for(const [point,sign,alpha] of [[this.a,-1,alphaA],[this.a,1,alphaA],[this.b,-1,alphaB],[this.a,1,alphaA],[this.b,1,alphaB],[this.b,-1,alphaB]]) {
          this.p.copy(point).addScaledVector(this.side,sign).toArray(positions,offset*3);
          colors.set([1,1,1,alpha*.65],offset*4);offset++;
        }
      }
      geometry.setDrawRange(0,offset);geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;object.visible=visible&&offset>0;
    }
    return this.history.length>0;
  }
  dispose(){this.group.removeFromParent();for(const object of this.objects){object.geometry.dispose();object.material.dispose();}this.history.length=0;}
}
