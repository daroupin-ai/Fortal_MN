// Mirror camera movement and amplify a comfortable, central reach.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const stageFloor=.28,shoeBase=-1.62,characterScale=1.33;
export const characterPlacement={position:[0,stageFloor-shoeBase*characterScale,1.30],scale:characterScale};
export const characterMouthWorld=[0,.79,.67].map((coordinate,axis)=>
 characterPlacement.position[axis]+coordinate*characterPlacement.scale
);
export function characterTargets(hands=[],mouth=null){
 const paws=[[0,0,0],[0,0,0]];
 for(const hand of hands||[]){
  if(!hand||!Number.isFinite(hand.x)||!Number.isFinite(hand.y))continue;
  const side=hand.x>.5?0:1,sign=side===0?-1:1;
  paws[side]=[sign*clamp((Math.abs(hand.x-.5)-.17)*3.2,-.22,.76),clamp((.62-hand.y)*2.8,-.38,1.22),.16];
 }
 return {paws,mouth:mouth?.open?1:0};
}
export function comfortableHandSample(sample){
 return sample?{...sample,x:clamp(.5+(sample.x-.5)*1.5,0,1),y:clamp(.5+(sample.y-.5)*1.5,0,1)}:null;
}
export function feedingMotion(elapsed){
 const travel=clamp(elapsed/140,0,1),chew=clamp((elapsed-140)/260,0,1);
 return {travel:travel*travel*(3-2*travel),scale:1-chew,
  jaw:elapsed<140?1:.22+.78*Math.abs(Math.cos(chew*Math.PI*2)),
  crunch:elapsed<140?-1:Math.min(1,Math.floor((elapsed-140)/130)),done:elapsed>=400};
}
export function easeCharacterPose(pose,target,dt){
 const blend=1-Math.exp(-14*Math.min(.1,Math.max(0,dt)));
 pose.mouth+=(target.mouth-pose.mouth)*blend;
 for(let side=0;side<2;side++)for(let axis=0;axis<3;axis++)pose.paws[side][axis]+=(target.paws[side][axis]-pose.paws[side][axis])*blend;
 return pose;
}
