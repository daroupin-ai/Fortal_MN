import {FilesetResolver,FaceLandmarker} from './vendor/mediapipe/vision_bundle.mjs';
let detector;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',import.meta.url).href,true);
   detector=await FaceLandmarker.createFromOptions(files,{
    baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/face_landmarker.task',import.meta.url).href,delegate:'CPU'},
    runningMode:'VIDEO',numFaces:1
   });
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   try{
    const face=detector.detectForVideo(data.image,data.time).faceLandmarks[0];
    self.postMessage({type:'face',mouth:face?[face[13],face[14],face[61],face[291]]:null});
   }finally{data.image.close();}
  }
 }catch(error){self.postMessage({type:'error',message:error.message||String(error)});}
};
