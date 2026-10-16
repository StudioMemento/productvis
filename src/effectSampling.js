import { Matrix3, Matrix4, Vector3, Mesh } from 'three';
import { visibleSurfaceHit } from './surfacePicking.js';

export function effectRandom(seed) {
  let a = seed | 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15,1 | a); t = t + Math.imul(t ^ t >>> 7,61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Remember triangle + barycentric coordinates, not just vertex positions: the
// same samples remain attached to skinned and morphed GLB surfaces on animation.
export class SurfaceSamples {
  constructor(meshes, product, count, seed = 19) {
    this.product=product;this.entries=[];this.count=count;
    this.positions=new Float32Array(count*3);this.normals=new Float32Array(count*3);this.seeds=new Float32Array(count);
    this.visibility=new Float32Array(count);
    this.inverse=new Matrix4();this.instance=new Matrix4();this.matrix=new Matrix4();this.normalMatrix=new Matrix3();
    this.a=new Vector3();this.b=new Vector3();this.c=new Vector3();this.p=new Vector3();this.n=new Vector3();
    const random=effectRandom(seed),sources=[],cdfCache=new Map();let totalArea=0;
    product.updateWorldMatrix(true,true);this.inverse.copy(product.matrixWorld).invert();
    for (const mesh of meshes) {
      if (!mesh.geometry?.attributes.position || !mesh.visible) continue;
      const geo=mesh.geometry;let data=cdfCache.get(geo);
      if (!data) {
        const vertices=geo.attributes.position,indices=geo.index,total=Math.floor((indices?.count||vertices.count)/3),cdf=new Float64Array(total);let area=0;
        for (let i=0;i<total;i++) {
          this.a.fromBufferAttribute(vertices,indices?indices.getX(i*3):i*3);
          this.b.fromBufferAttribute(vertices,indices?indices.getX(i*3+1):i*3+1);
          this.c.fromBufferAttribute(vertices,indices?indices.getX(i*3+2):i*3+2);
          area+=this.b.sub(this.a).cross(this.c.sub(this.a)).length()*.5;cdf[i]=area;
        }
        data={cdf,area};cdfCache.set(geo,data);
      }
      if (!(data.area>0)) continue;
      const instances=mesh.isInstancedMesh?mesh.count:1;
      // Avoid expanding instance lists: choose each sample's instance directly.
      this.matrix.multiplyMatrices(this.inverse,mesh.matrixWorld);
      const scale=new Vector3().setFromMatrixScale(this.matrix),area=data.area*(scale.x*scale.y+scale.x*scale.z+scale.y*scale.z)/3*instances;
      sources.push({mesh,data,instances,area});totalArea+=area;
    }
    if (!sources.length) {this.count=0;return;}
    const assigned=sources.map(()=>0);
    // Area-weighted allocation; a small guaranteed share preserves tiny details.
    const floor=Math.min(3,Math.floor(count/sources.length));let remaining=count-floor*sources.length;
    for (let i=0;i<assigned.length;i++) assigned[i]=floor;
    for (let i=0;i<remaining;i++) {
      let value=random()*totalArea,index=0;
      while(index<sources.length-1 && (value-=sources[index].area)>0)index++;
      assigned[index]++;
    }
    const order=Array.from({length:count},(_,i)=>i);
    for(let i=count-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    let output=0;
    sources.forEach((source,sourceIndex)=>{
      const byInstance=new Map();
      for(let i=0;i<assigned[sourceIndex];i++) {
        const instance=source.instances>1?Math.floor(random()*source.instances):-1;
        if(!byInstance.has(instance))byInstance.set(instance,[]);
        byInstance.get(instance).push(order[output++]);
      }
      for(const [instance,outputs] of byInstance) {
        const size=outputs.length,indices=new Uint32Array(size*3),weights=new Float32Array(size*2),materialIndices=new Uint16Array(size),geo=source.mesh.geometry;
        for(let i=0;i<size;i++) {
          const value=random()*source.data.area,cdf=source.data.cdf;let lo=0,hi=cdf.length-1;
          while(lo<hi){const mid=(lo+hi)>>>1;if(cdf[mid]<value)lo=mid+1;else hi=mid;}
          for(let k=0;k<3;k++)indices[i*3+k]=geo.index?geo.index.getX(lo*3+k):lo*3+k;
          const r=Math.sqrt(random());weights[i*2]=1-r;weights[i*2+1]=random()*r;
          materialIndices[i]=geo.groups.find(group=>lo*3>=group.start&&lo*3<group.start+group.count)?.materialIndex||0;
          this.seeds[outputs[i]]=random();
        }
        const unique=[...new Set(indices)],lookup=new Map(unique.map((index,i)=>[index,i]));
        const entry={mesh:source.mesh,instance,outputs,indices,weights,materialIndices,unique,remap:Array.from(indices,index=>lookup.get(index)),
          vertices:unique.map(()=>new Vector3()),local:new Float32Array(size*3),normals:new Float32Array(size*3),last:new Matrix4(),initialized:false,
          deforming:!!(source.mesh.isSkinnedMesh||source.mesh.morphTargetInfluences?.length)};
        if(instance>=0 && source.mesh.morphTexture){entry.proxy=new Mesh(geo);entry.deforming=true;}
        this.entries.push(entry);
      }
    });
    this.refresh(true,true);
    this.updateVisibility();
  }

  updateVisibility() {
    const barycoord=new Vector3(),face={a:0,b:0,c:0,materialIndex:0};
    for(const entry of this.entries)for(let i=0;i<entry.outputs.length;i++){
      face.a=entry.indices[i*3];face.b=entry.indices[i*3+1];face.c=entry.indices[i*3+2];face.materialIndex=entry.materialIndices[i];
      const a=entry.weights[i*2],b=entry.weights[i*2+1];barycoord.set(a,b,1-a-b);
      this.visibility[entry.outputs[i]]=visibleSurfaceHit({object:entry.mesh,face,barycoord})?1:0;
    }
  }

  refresh(force=false,deforming=false) {
    this.product.updateWorldMatrix(true,true);this.inverse.copy(this.product.matrixWorld).invert();let changed=false;
    for(const entry of this.entries) {
      const mesh=entry.mesh;
      this.matrix.multiplyMatrices(this.inverse,mesh.matrixWorld);
      if(entry.instance>=0){mesh.getMatrixAt(entry.instance,this.instance);this.matrix.multiply(this.instance);}
      const updateShape=force||!entry.initialized||(deforming&&entry.deforming);
      if(!updateShape&&this.matrix.equals(entry.last))continue;
      if(updateShape) {
        let source=mesh;
        if(entry.proxy){mesh.getMorphAt(entry.instance,entry.proxy);source=entry.proxy;}
        if(mesh.isSkinnedMesh)mesh.skeleton.update();
        for(let i=0;i<entry.unique.length;i++)source.getVertexPosition(entry.unique[i],entry.vertices[i]);
        const normal=mesh.geometry.attributes.normal;
        for(let i=0;i<entry.outputs.length;i++) {
          const a=entry.vertices[entry.remap[i*3]],b=entry.vertices[entry.remap[i*3+1]],c=entry.vertices[entry.remap[i*3+2]];
          const wa=entry.weights[i*2],wb=entry.weights[i*2+1],wc=1-wa-wb;
          this.p.copy(a).multiplyScalar(wa).addScaledVector(b,wb).addScaledVector(c,wc).toArray(entry.local,i*3);
          if(normal&&!entry.deforming) {
            this.n.fromBufferAttribute(normal,entry.indices[i*3]).multiplyScalar(wa);
            this.n.addScaledVector(this.a.fromBufferAttribute(normal,entry.indices[i*3+1]),wb);
            this.n.addScaledVector(this.a.fromBufferAttribute(normal,entry.indices[i*3+2]),wc);
          } else this.n.subVectors(b,a).cross(this.a.subVectors(c,a));
          this.n.normalize().toArray(entry.normals,i*3);
        }
      }
      this.normalMatrix.getNormalMatrix(this.matrix);
      for(let i=0;i<entry.outputs.length;i++) {
        const out=entry.outputs[i]*3;
        this.p.fromArray(entry.local,i*3).applyMatrix4(this.matrix).toArray(this.positions,out);
        this.n.fromArray(entry.normals,i*3).applyNormalMatrix(this.normalMatrix).toArray(this.normals,out);
      }
      entry.last.copy(this.matrix);entry.initialized=true;changed=true;
    }
    return changed;
  }
  dispose(){for(const entry of this.entries)entry.proxy?.material.dispose();this.entries.length=0;}
}
