// Real-time, canvas-only capture. Codec support is selected at runtime.
export const VIDEO_TYPES=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
export function videoType(Recorder=globalThis.MediaRecorder){return Recorder?.isTypeSupported?VIDEO_TYPES.find(type=>Recorder.isTypeSupported(type))||null:null;}
export function videoSettings(input={}) {
  const size=input.size===1080?1080:720,aspect=['16:9','9:16','1:1'].includes(input.aspect)?input.aspect:'16:9';
  const fps=[24,30,60].includes(input.fps)?input.fps:30,duration=Math.max(2,Math.min(20,Number.isFinite(input.duration)?input.duration:6));
  const wide=Math.round(size*16/9/2)*2;
  return {width:aspect==='16:9'?wide:size,height:aspect==='9:16'?wide:size,fps,duration};
}
export function canRecordVideo(){return !!videoType()&&typeof globalThis.HTMLCanvasElement?.prototype.captureStream==='function';}

export async function recordCanvas(source,renderFrame,options) {
  const {width,height,fps,duration}=videoSettings(options),mimeType=videoType();
  if(!mimeType)throw new Error('Registrazione video non supportata da questo browser.');
  const signal=options.signal;
  const aborted=()=>new DOMException('Playblast annullato','AbortError');
  if(signal?.aborted)throw aborted();
  const output=document.createElement('canvas');output.width=width;output.height=height;
  const context=output.getContext('2d',{alpha:false});if(!context)throw new Error('Impossibile preparare il video.');
  renderFrame(0);context.drawImage(source,0,0,width,height);
  let stream=output.captureStream(0),track=stream.getVideoTracks()[0];
  if(!track?.requestFrame){stream.getTracks().forEach(t=>t.stop());stream=output.captureStream(fps);track=stream.getVideoTracks()[0];}
  let recorder;
  try{recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:Math.round(width*height*fps*.2)});}
  catch(error){stream.getTracks().forEach(t=>t.stop());throw error;}
  return new Promise((resolve,reject)=>{
    const chunks=[];let frameId,last=-1,failure=null,finished=false,start=0;
    const cleanup=()=>{cancelAnimationFrame(frameId);signal?.removeEventListener('abort',abort);document.removeEventListener('visibilitychange',visibility);stream.getTracks().forEach(t=>t.stop());};
    const stop=error=>{if(finished)return;finished=true;failure=error||null;cancelAnimationFrame(frameId);if(recorder.state!=='inactive')recorder.stop();else{cleanup();reject(failure||new Error('Registrazione interrotta.'));}};
    const abort=()=>stop(aborted());
    const visibility=()=>{if(document.hidden)stop(new Error('Playblast interrotto: mantieni questa scheda visibile.'));};
    recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
    recorder.onerror=e=>stop(e.error||new Error('La registrazione video non è riuscita.'));
    recorder.onstop=()=>{cleanup();if(failure){reject(failure);return;}const blob=new Blob(chunks,{type:recorder.mimeType||mimeType});if(!blob.size){reject(new Error('Il browser ha prodotto una clip vuota.'));return;}resolve({blob,extension:mimeType.startsWith('video/mp4')?'mp4':'webm',...videoSettings(options)});};
    const tick=now=>{
      if(finished)return;
      try{
        const elapsed=Math.min(duration,(now-start)/1000),index=Math.floor(elapsed*fps);
        if(index!==last){last=index;renderFrame(index/fps);context.drawImage(source,0,0,width,height);track.requestFrame?.();options.onProgress?.(elapsed/duration);}
        if(elapsed>=duration){frameId=requestAnimationFrame(()=>stop());return;}
        frameId=requestAnimationFrame(tick);
      }catch(error){stop(error);}
    };
    signal?.addEventListener('abort',abort,{once:true});document.addEventListener('visibilitychange',visibility);
    try{recorder.start(1000);start=performance.now();track.requestFrame?.();frameId=requestAnimationFrame(tick);}
    catch(error){finished=true;cleanup();reject(error);}
  });
}
