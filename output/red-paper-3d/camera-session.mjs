// Bound camera startup waits without recording or requesting microphone access.
const failure=name=>Object.assign(new Error(name),{name});
export function openCameraStream(mediaDevices,signal,timeout=30000,video=true){
 return new Promise((resolve,reject)=>{
  let settled=false,timer;
  const finish=(error,stream)=>{
   if(settled){stream?.getTracks().forEach(track=>track.stop());return;}
   settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);
   error?reject(error):resolve(stream);
  };
  const abort=()=>finish(failure('AbortError'));
  if(signal.aborted){abort();return;}
  signal.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>finish(failure('CameraRequestTimeout')),timeout);
  // Let the device choose its supported resolution and frame rate.
  try{Promise.resolve(mediaDevices.getUserMedia({audio:false,video})).then(stream=>finish(null,stream),error=>finish(error));}
  catch(error){finish(error);}
 });
}

// A broken/default virtual camera must not prevent another webcam from opening.
export async function listCameras(mediaDevices){
 let timer;
 try{
  const devices=await Promise.race([mediaDevices.enumerateDevices(),new Promise(resolve=>{timer=setTimeout(()=>resolve([]),3000);})]);
  return devices.filter(device=>device.kind==='videoinput');
 }catch{return [];}
 finally{clearTimeout(timer);}
}
export async function connectAvailableCamera(mediaDevices,signal,{deviceId='',onAttempt=()=>{},timeout=30000}={}){
 const retryable=error=>['NotReadableError','OverconstrainedError','NotFoundError'].includes(error.name);
 const simple=deviceId?{deviceId:{exact:deviceId}}:true;
 let lastError;
 onAttempt('카메라에 연결하고 있어요.');
 try{return await openCameraStream(mediaDevices,signal,timeout,simple);}
 catch(error){lastError=error;if(!retryable(error)||signal.aborted)throw error;}
 const cameras=deviceId?[{deviceId,label:'선택한 카메라'}]:await listCameras(mediaDevices);
 for(const [index,camera] of cameras.entries()){
  if(signal.aborted)throw failure('AbortError');
  onAttempt(`${camera.label||'카메라 '+(index+1)} 연결 확인 중… (${index+1}/${cameras.length})`);
  // Explicit device selection avoids repeatedly reopening the failing default.
  const video={deviceId:{exact:camera.deviceId},width:{ideal:640},height:{ideal:480},frameRate:{ideal:24}};
  try{return await openCameraStream(mediaDevices,signal,timeout,video);}
  catch(error){lastError=error;if(!retryable(error)||signal.aborted)throw error;}
 }
 throw lastError;
}

export function waitForCameraPreview(video,signal,timeout=12000){
 return new Promise((resolve,reject)=>{
  let settled=false,timer,poll;
  const events=['loadeddata','canplay','playing','resize'];
  const finish=error=>{
   if(settled)return;
   settled=true;clearTimeout(timer);clearInterval(poll);
   signal.removeEventListener('abort',abort);
   for(const event of events)video.removeEventListener(event,check);
   error?reject(error):resolve();
  };
  const abort=()=>finish(failure('AbortError'));
  const check=()=>{if(!video.paused&&video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0)finish();};
  if(signal.aborted){abort();return;}
  signal.addEventListener('abort',abort,{once:true});
  for(const event of events)video.addEventListener(event,check);
  timer=setTimeout(()=>finish(failure('CameraFrameTimeout')),timeout);
  poll=setInterval(check,100);
  video.muted=true;video.autoplay=true;video.playsInline=true;
  // A pending play() promise must not hide already available camera frames.
  try{Promise.resolve(video.play()).then(check,error=>finish(failure(error.name==='NotAllowedError'?'CameraPlaybackBlocked':error.name)));}
  catch(error){finish(error);}
  check();
 });
}
