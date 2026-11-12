import {FilesetResolver,HandLandmarker} from './vendor/mediapipe/vision_bundle.mjs';
let detector;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',import.meta.url).href,true);
   detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/hand_landmarker.task',import.meta.url).href,delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.6});
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   try{const result=detector.detectForVideo(data.image,data.time);self.postMessage({type:'hand',points:result.landmarks[0]||null,time:data.time});}
   finally{data.image.close();}
  }
 }catch(error){self.postMessage({type:'error',message:error.message||String(error)});}
};
