// Gesture decisions are independent of the camera and renderer for repeatable tests.
export function handSample(points,aspect){
 if(!points||points.length!==21||!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
 const distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
 const palm=distance(points[5],points[17]);if(palm<.025)return null;
 return {x:(points[4].x+points[8].x)/2,y:(points[4].y+points[8].y)/2,ratio:distance(points[4],points[8])/palm};
}
export function videoToWorld(sample,aspect,{height=7.05,bottom=.28,z=.65}={}){
 return [(.5-sample.x)*height*aspect,bottom+(1-sample.y)*height,z];
}
export function mouthSample(points,aspect){
 if(!points||points.length!==4||!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
 const [upper,lower,left,right]=points;
 const distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
 const width=distance(left,right);
 if(width<.015)return null;
 const ratio=distance(upper,lower)/width;
 return {x:(upper.x+lower.x)/2,y:(upper.y+lower.y)/2,ratio,open:ratio>=.28,wide:ratio>=.45};
}
// One nearby character must remain at an open mouth; losing the face cancels the bite.
export class MouthBite{
 constructor(){this.reset();}
 reset(){this.candidate=null;this.since=null;this.cooldown=0;}
 update(candidate,open,time){
  if(!open||!candidate||time<this.cooldown){this.candidate=null;this.since=null;return null;}
  if(candidate!==this.candidate){this.candidate=candidate;this.since=time;return null;}
  if(time-this.since<160)return null;
  this.candidate=null;this.since=null;this.cooldown=time+900;
  return candidate;
 }
}
export function projectPoint(point,matrix,width,height){
 const p=[...point,1],v=[0,0,0,0];for(let row=0;row<4;row++)for(let col=0;col<4;col++)v[row]+=matrix[col*4+row]*p[col];
 if(v[3]<=0)return null;return [(v[0]/v[3]+1)*width/2,(1-v[1]/v[3])*height/2];
}
export class PinchGrab{
 constructor(){this.reset();}
 reset(){this.held=false;this.openSince=null;this.lastSeen=null;}
 update(sample,near,now){
  if(!sample){
   this.openSince=null;
   if(this.lastSeen!==null&&now-this.lastSeen>850){const held=this.held;this.reset();return held?'release':null;}
   return null;
  }
  this.lastSeen=now;
  if(this.held){
   if(sample.ratio>.58){this.openSince??=now;if(now-this.openSince>=60){this.held=false;this.openSince=null;return 'release';}}
   else this.openSince=null;
  }else if(sample.ratio<.40&&near){this.held=true;return 'grab';}
  return null;
 }
}
export function nearestGrabTarget(cursor,candidates,project,radius,previous=null){
 const within=actor=>{const p=project(actor);return p?Math.hypot(cursor[0]-p[0],cursor[1]-p[1]):Infinity;};
 let target=null,closest=radius;
 for(const actor of candidates){const distance=within(actor);if(distance<closest){target=actor;closest=distance;}}
 if(previous&&candidates.includes(previous)&&within(previous)<radius*1.15&&within(previous)<closest+24)return previous;
 return target;
}
export class EatCombo{
 constructor(){this.count=0;this.last=-Infinity;}
 hit(now){this.count=now-this.last<=4000?this.count+1:1;this.last=now;return this.count>=3?2:1;}
 active(now){return this.count>=2&&now-this.last<=4000;}
}
export class EatingWindow{
 constructor(){this.reset();}
 reset(){this.until=-Infinity;}
 update(mouth,now){if(mouth?.wide)this.until=now+2000;}
 active(now){return now<this.until;}
}
