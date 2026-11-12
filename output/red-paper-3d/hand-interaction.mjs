// Gesture decisions are independent of the camera and renderer for repeatable tests.
export function handSample(points,aspect){
 if(!points||points.length!==21||!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
 const distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
 const palm=distance(points[5],points[17]);if(palm<.025)return null;
 return {x:(points[4].x+points[8].x)/2,y:(points[4].y+points[8].y)/2,ratio:distance(points[4],points[8])/palm};
}
export function videoToWorld(sample,aspect){return [( .5-sample.x)*7.05*aspect,.28+(1-sample.y)*7.05,.65];}
export function projectPoint(point,matrix,width,height){
 const p=[...point,1],v=[0,0,0,0];for(let row=0;row<4;row++)for(let col=0;col<4;col++)v[row]+=matrix[col*4+row]*p[col];
 if(v[3]<=0)return null;return [(v[0]/v[3]+1)*width/2,(1-v[1]/v[3])*height/2];
}
export class PinchGrab{
 constructor(){this.reset();}
 reset(){this.held=false;this.armed=false;this.closeSince=null;this.openSince=null;this.lastSeen=null;}
 update(sample,near,now){
  if(!sample){
   this.closeSince=null;this.openSince=null;
   if(this.lastSeen!==null&&now-this.lastSeen>550){const held=this.held;this.reset();return held?'release':null;}
   return null;
  }
  this.lastSeen=now;
  if(this.held){
   if(sample.ratio>.52){this.openSince??=now;if(now-this.openSince>=80){this.held=false;this.armed=true;this.openSince=null;return 'release';}}
   else this.openSince=null;
  }else if(sample.ratio>.52){this.armed=true;this.closeSince=null;}
  else if(sample.ratio<.30&&this.armed){
   this.closeSince??=now;
   if(now-this.closeSince>=80){this.armed=false;this.closeSince=null;if(near){this.held=true;return 'grab';}}
  }else this.closeSince=null;
  return null;
 }
}
