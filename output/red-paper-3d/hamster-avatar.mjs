// Camera-independent pose mapping, shared by the renderer and its checks.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const hamsterPlacement={position:[0,.28,-.5],scale:2.3};
export const hamsterMouthWorld=[0,.28+.99*2.3,-.5+1.15*2.3];
export function hamsterTargets(hands=[],mouth=null){
 const paws=[[0,0,0],[0,0,0]];
 for(const hand of hands||[]){
  if(!hand||!Number.isFinite(hand.x)||!Number.isFinite(hand.y))continue;
  const side=hand.x>.5?0:1,sign=side===0?-1:1;
  paws[side]=[sign*clamp((Math.abs(hand.x-.5)-.15)*1.2,-.10,.24),clamp((.72-hand.y)*.9,-.03,.48),.06];
 }
 return {paws,mouth:mouth?.open?1:0};
}
export function easeHamsterPose(pose,target,dt){
 const blend=1-Math.exp(-14*Math.min(.1,Math.max(0,dt)));
 pose.mouth+=(target.mouth-pose.mouth)*blend;
 for(let side=0;side<2;side++)for(let axis=0;axis<3;axis++)pose.paws[side][axis]+=(target.paws[side][axis]-pose.paws[side][axis])*blend;
 return pose;
}
