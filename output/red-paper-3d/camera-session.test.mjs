import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {openCameraStream,connectAvailableCamera,waitForCameraPreview} from './camera-session.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const stream=()=>{
 const track=new EventTarget();track.stops=0;track.stop=()=>track.stops++;
 return {getTracks:()=>[track],getVideoTracks:()=>[track],track};
};
class Video extends EventTarget{
 constructor(){super();this.srcObject=null;this.readyState=0;this.paused=true;this.videoWidth=0;this.videoHeight=0;}
 play(){this.paused=false;return Promise.resolve();}
 pause(){this.paused=true;}
 frame(){this.readyState=2;this.videoWidth=640;this.videoHeight=480;this.dispatchEvent(new Event('loadeddata'));}
}

test('camera request times out and closes a stream that arrives too late',async()=>{
 const pending=deferred(),controller=new AbortController(),late=stream();let constraints;
 await assert.rejects(openCameraStream({getUserMedia(value){constraints=value;return pending.promise;}},controller.signal,10),{name:'CameraRequestTimeout'});
 assert.deepEqual(constraints,{audio:false,video:true});
 pending.resolve(late);await Promise.resolve();assert.equal(late.track.stops,1);
});
test('cancelling a pending permission request also closes its late stream',async()=>{
 const pending=deferred(),controller=new AbortController(),late=stream();
 const result=openCameraStream({getUserMedia:()=>pending.promise},controller.signal);
 controller.abort();await assert.rejects(result,{name:'AbortError'});
 pending.resolve(late);await Promise.resolve();assert.equal(late.track.stops,1);
});
test('first frame releases startup even if play promise never resolves',async()=>{
 const video=new Video();video.play=()=>{video.paused=false;return new Promise(()=>{});};
 const result=waitForCameraPreview(video,new AbortController().signal,100);
 video.frame();await result;assert.equal(video.muted,true);
});
test('play completion alone is not camera readiness',async()=>{
 await assert.rejects(waitForCameraPreview(new Video(),new AbortController().signal,10),{name:'CameraFrameTimeout'});
});
test('playback rejection and cancellation are handled without waiting indefinitely',async()=>{
 const video=new Video();video.play=()=>Promise.reject(Object.assign(new Error(),{name:'NotAllowedError'}));
 await assert.rejects(waitForCameraPreview(video,new AbortController().signal),{name:'CameraPlaybackBlocked'});
 const controller=new AbortController(),result=waitForCameraPreview(new Video(),controller.signal);
 controller.abort();await assert.rejects(result,{name:'AbortError'});
});

const source=await readFile(new URL('./scene.js',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('function stopCamera('),source.indexOf('cameraOff.onclick='));
function setup(getUserMedia){
 const video=new Video();
 const c={navigator:{mediaDevices:{getUserMedia}},document:{},AbortController,
  connectAvailableCamera:(devices,signal,options)=>connectAvailableCamera(devices,signal,{...options,timeout:20}),
  waitForCameraPreview:(preview,signal)=>waitForCameraPreview(preview,signal,20),
  roundDeadline:null,roundOver:false,cameraRequest:0,cameraStartup:null,cameraStream:null,imageReady:false,
  video,lastVideoTime:-1,videoAspect:0,shadowDirty:false,autoEat:true,handMode:false,
  cameraOn:{disabled:false},cameraOff:{},cameraStatus:{},monitorState:{},monitorStart:{},monitorHint:{},cameraChoice:{value:''},cameraProblem:{},refreshCameraChoices(){},
  handOn:{click(){c.trackingStarts++;}},trackingStarts:0,ready:[],
  ui:{cameraReady(value){c.ready.push(value);}},stopHandInteraction(){c.handMode=false;},updateMonitor(){},console:{warn(){}},
 };
 vm.createContext(c);vm.runInContext(handler,c);return c;
}
test('real camera handler advances on frames without the render loop or play resolution',async()=>{
 const connected=stream(),c=setup(()=>Promise.resolve(connected));
 c.video.play=()=>{c.video.paused=false;c.video.frame();return new Promise(()=>{});};
 await c.cameraOn.onclick();
 assert.equal(c.imageReady,true);assert.equal(c.trackingStarts,1);assert.equal(c.cameraOn.hidden,true);assert.equal(c.cameraStartup,null);
 c.stopCamera();assert.equal(connected.track.stops,1);assert.equal(c.video.srcObject,null);
});
test('request timeout restores retry; a stale result cannot replace the new camera',async()=>{
 const old=deferred(),late=stream(),current=stream();let calls=0;
 const c=setup(()=>++calls===1?old.promise:Promise.resolve(current));
 await c.cameraOn.onclick();
 assert.equal(c.cameraOn.disabled,false);assert.match(c.cameraStatus.textContent,/응답이 없어요/);
 c.video.play=()=>{c.video.paused=false;c.video.frame();return Promise.resolve();};
 await c.cameraOn.onclick();old.resolve(late);await Promise.resolve();
 assert.equal(c.cameraStream,current);assert.equal(late.track.stops,1);assert.equal(c.trackingStarts,1);
 c.stopCamera();
});
test('no video frames stops the camera and exposes retry instead of starting tracking',async()=>{
 const connected=stream(),c=setup(()=>Promise.resolve(connected));
 await c.cameraOn.onclick();assert.match(c.cameraStatus.textContent,/영상이 오지 않아요/);
 assert.equal(c.cameraOn.disabled,false);assert.equal(c.cameraStream,null);assert.equal(c.trackingStarts,0);assert.equal(connected.track.stops,1);
});
test('permission denial and busy device display distinct guidance',async()=>{
 for(const [name,message] of [['NotAllowedError',/권한/],['NotReadableError',/다른 앱/]]){
  const c=setup(()=>Promise.reject(Object.assign(new Error(),{name})));
  await c.cameraOn.onclick();assert.match(c.cameraStatus.textContent,message);assert.equal(c.cameraOn.disabled,false);
 }
});
test('cancel during video startup releases the camera without starting tracking',async()=>{
 const connected=stream(),c=setup(()=>Promise.resolve(connected));
 const starting=c.cameraOn.onclick();await Promise.resolve();await Promise.resolve();
 c.stopCamera();await starting;
 assert.equal(c.trackingStarts,0);assert.equal(c.cameraStream,null);assert.equal(connected.track.stops,1);
});

test('unreadable default camera falls back to a working explicit webcam',async()=>{
 const connected=stream(),attempts=[];
 const mediaDevices={enumerateDevices:async()=>[{kind:'videoinput',deviceId:'broken',label:'Virtual Camera'},{kind:'videoinput',deviceId:'working',label:'USB Webcam'}],
  getUserMedia:async constraints=>{attempts.push(constraints);if(constraints.video.deviceId?.exact==='working')return connected;throw Object.assign(new Error(),{name:'NotReadableError'});}};
 const result=await connectAvailableCamera(mediaDevices,new AbortController().signal);
 assert.equal(result,connected);assert.equal(attempts.length,3);assert.equal(attempts[2].video.deviceId.exact,'working');assert.equal(attempts[2].audio,false);
});
test('an explicitly chosen camera is never replaced with another device',async()=>{
 const attempts=[];
 const mediaDevices={getUserMedia:async constraints=>{attempts.push(constraints.video);throw Object.assign(new Error(),{name:'NotReadableError'});},enumerateDevices:()=>{throw new Error('must not choose other devices');}};
 await assert.rejects(connectAvailableCamera(mediaDevices,new AbortController().signal,{deviceId:'chosen'}),{name:'NotReadableError'});
 assert.equal(attempts.length,2);assert.ok(attempts.every(video=>video.deviceId.exact==='chosen'));
});
test('permission denial never probes more cameras',async()=>{
 let calls=0;
 await assert.rejects(connectAvailableCamera({getUserMedia:async()=>{calls++;throw Object.assign(new Error(),{name:'NotAllowedError'});}},new AbortController().signal),{name:'NotAllowedError'});
 assert.equal(calls,1);
});
