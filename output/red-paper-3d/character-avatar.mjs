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
export const feedingDuration=640;
export function feedingMotion(elapsed,initialJaw=0){
 const smooth=v=>{const t=clamp(v,0,1);return t*t*t*(t*(t*6-15)+10);};
 const travel=smooth(elapsed/240),consume=smooth((elapsed-280)/190);
 // Ease into the mouth, chew twice, then return control to the live hand/face.
 let jaw=initialJaw+(1-initialJaw)*smooth(elapsed/220);
 if(elapsed>=280&&elapsed<350)jaw=1-.7*smooth((elapsed-280)/70);
 else if(elapsed>=350&&elapsed<400)jaw=.3+.4*smooth((elapsed-350)/50);
 else if(elapsed>=400)jaw=.7-.55*smooth((elapsed-400)/70);
 return {travel,lift:16*travel*travel*(1-travel)*(1-travel),consume,scale:1-consume,jaw,
  release:smooth((elapsed-470)/(feedingDuration-470)),
  crunch:elapsed<320?-1:elapsed<440?0:1,done:elapsed>=feedingDuration};
}
export function easeCharacterPose(pose,target,dt){
 const blend=1-Math.exp(-14*Math.min(.1,Math.max(0,dt)));
 pose.mouth+=(target.mouth-pose.mouth)*blend;
 for(let side=0;side<2;side++)for(let axis=0;axis<3;axis++)pose.paws[side][axis]+=(target.paws[side][axis]-pose.paws[side][axis])*blend;
 return pose;
}
