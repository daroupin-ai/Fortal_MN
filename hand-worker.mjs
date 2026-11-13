import {FilesetResolver,HandLandmarker} from './vendor/mediapipe/vision_bundle.mjs';
let detector,faceWorker,faceReady=false,faceError='',primaryX=null;
function requestFace(message,transfer=[]){
 return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Face tracking timed out')),15000);
  faceWorker.onmessage=({data})=>{clearTimeout(timeout);data.type==='error'?reject(Error(data.message)):resolve(data);};
  faceWorker.onerror=()=>{clearTimeout(timeout);reject(Error('Face worker failed'));};
  faceWorker.postMessage(message,transfer);
 });
}
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',import.meta.url).href,true);
   detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/hand_landmarker.task',import.meta.url).href,delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.6});
   if(data.face){
    try{
     // Each model needs its own WASM module scope in this bundled runtime.
     faceWorker=new Worker(new URL('./face-worker.mjs',import.meta.url),{type:'module'});
     await requestFace({type:'init'});faceReady=true;
    }catch(error){faceError=error.message||String(error);faceWorker?.terminate();faceWorker=null;}
   }
   self.postMessage({type:'ready',faceReady,faceError});
  }else if(data.type==='frame'){
   try{
    let faceResult=Promise.resolve(null);
    if(data.trackMouth&&faceReady){
     const image=await createImageBitmap(data.image);
     faceResult=requestFace({type:'frame',image,time:data.time},[image]).then(result=>result.mouth);
    }
    // Both models work on this frame concurrently, without accumulating a frame queue.
    const [result,mouth]=await Promise.all([Promise.resolve().then(()=>detector.detectForVideo(data.image,data.time)),faceResult]);
    // Keep the same controlling hand when the second hand enters the frame.
    const hands=result.landmarks;
    const points=primaryX===null?hands[0]:hands.reduce((best,h)=>!best||Math.abs(h[0].x-primaryX)<Math.abs(best[0].x-primaryX)?h:best,null);
    primaryX=points?.[0].x??null;
    self.postMessage({type:'hand',points:points||null,hands,mouth,time:data.time});
   }
   finally{data.image.close();}
  }
 }catch(error){self.postMessage({type:'error',message:error.message||String(error)});}
};
