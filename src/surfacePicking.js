import { Triangle, Vector2 } from 'three';
const alphaImages=new WeakMap();

// Read the source texture once, never the rendered viewport. This lets picking
// pass through cutout pixels instead of selecting invisible grille/interior faces.
function sourcePixels(image) {
  if (!image || typeof image!=='object') return null;
  if (alphaImages.has(image)) return alphaImages.get(image);
  let result=null;
  try {
    const width=image.width,height=image.height;
    if (image.data?.length===width*height*4) result={width,height,data:image.data};
    else if(width&&height) {
      const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
      const rgba=context.getImageData(0,0,width,height).data,alpha=new Uint8Array(width*height);
      for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
      result={width,height,alpha};
    }
  } catch { /* Unsupported/tainted source: fall back to geometry picking. */ }
  alphaImages.set(image,result);return result;
}

export function visibleSurfaceHit(hit) {
  const originals=hit.object.userData.pvBaseMaterials||hit.object.material;
  const material=Array.isArray(originals)?originals[hit.face.materialIndex]:originals;
  if (!material) return false;
  const opacity=material.opacity??1;
  if (material.transparent && opacity<.01) return false;
  const map=material.map;
  if (!map || (!material.transparent&&!material.alphaTest)) return true;
  const attribute=hit.object.geometry.getAttribute(map.channel?`uv${map.channel}`:'uv');
  if (!attribute || !hit.barycoord) return true;
  const uv=Triangle.getInterpolatedAttribute(attribute,hit.face.a,hit.face.b,hit.face.c,hit.barycoord,new Vector2());
  if (map.matrixAutoUpdate) map.updateMatrix();map.transformUv(uv);
  const pixels=sourcePixels(map.image);if(!pixels)return true;
  const x=Math.min(pixels.width-1,Math.max(0,Math.floor(uv.x*pixels.width)));
  const y=Math.min(pixels.height-1,Math.max(0,Math.floor(uv.y*pixels.height)));
  const index=y*pixels.width+x,alpha=(pixels.alpha?pixels.alpha[index]:pixels.data[index*4+3])/255;
  return alpha*opacity>=Math.max(material.alphaTest||0,.01);
}
