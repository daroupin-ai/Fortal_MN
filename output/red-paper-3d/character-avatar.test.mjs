import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {characterTargets,easeCharacterPose,characterMouthWorld,characterPlacement,comfortableHandSample,feedingMotion,feedingDuration} from './character-avatar.mjs';
import {mouthSample} from './hand-interaction.mjs';
const rest=characterTargets(),active=characterTargets([{x:.8,y:.2},{x:.2,y:.3}],{open:true});
assert.ok(active.paws[0][1]>0&&active.paws[1][1]>0);
assert.ok(active.paws[0][0]<0&&active.paws[1][0]>0);
const pose=easeCharacterPose(structuredClone(rest),active,.016);
assert.ok(pose.mouth>0&&pose.mouth<1);
for(let i=0;i<90;i++)easeCharacterPose(pose,rest,.016);
assert.ok(pose.mouth<.001&&pose.paws[0][1]<.001,'Tracking loss returns hands and jaw to rest');
assert.deepEqual(characterTargets([null,{x:NaN,y:0}],null),rest);
const reach=characterTargets([{x:.8,y:.3}]);
assert.ok(reach.paws[0][1]>.85&&reach.paws[0][0]<-.4,'Comfortable camera reach moves the hand widely');
const amplified=comfortableHandSample({x:.7,y:.3,ratio:.2});
assert.ok(Math.abs(amplified.x-.8)<1e-6&&Math.abs(amplified.y-.2)<1e-6);
assert.equal(amplified.ratio,.2,'Reach gain does not affect pinch detection');
assert.equal(comfortableHandSample(null),null);
assert.equal(comfortableHandSample({x:1,y:0}).x,1);
const lips=[{x:.5,y:.48},{x:.5,y:.52},{x:.45,y:.5},{x:.55,y:.5}];
const mouth=mouthSample(lips,1);
assert.ok(mouth.open&&Math.abs(mouth.ratio-.4)<1e-6,'Meter and open state agree');
assert.equal(mouth.wide,false,'Normal opening does not trigger automatic feeding');
assert.equal(mouthSample([{x:.5,y:.47},{x:.5,y:.53},...lips.slice(2)],1).wide,true);
assert.equal(feedingMotion(0,.35).jaw,.35,'Jaw starts from the current pose');
assert.equal(feedingMotion(120).travel,.5);
assert.equal(feedingMotion(240).travel,1);
assert.equal(feedingMotion(280).scale,1,'The doll stays full-size until it reaches the mouth');
assert.equal(feedingMotion(319).crunch,-1,'Chew sound waits for mouth contact');
assert.equal(feedingMotion(320).crunch,0);assert.equal(feedingMotion(440).crunch,1);
assert.equal(feedingMotion(470).scale,0);assert.equal(feedingMotion(470).release,0);
assert.equal(feedingMotion(feedingDuration-1).done,false);
assert.equal(feedingMotion(feedingDuration).done,true);
assert.equal(feedingMotion(feedingDuration).release,1,'Hand and jaw fully return to tracking');
let previous=feedingMotion(0);
for(let t=1;t<=feedingDuration;t++){
 const m=feedingMotion(t);
 for(const key of ['travel','scale','lift','jaw','release','consume'])assert.ok(Number.isFinite(m[key])&&m[key]>=-1e-8&&m[key]<=1.00000001,key+' stays bounded');
 assert.ok(m.travel>=previous.travel&&m.scale<=previous.scale,'No backward movement or regrowth');
 previous=m;
}
for(const boundary of [220,240,280,350,400,470,feedingDuration]){
 const before=feedingMotion(boundary-.001,.35),after=feedingMotion(boundary+.001,.35);
 for(const key of ['travel','scale','lift','jaw','release'])assert.ok(Math.abs(before[key]-after[key])<.0001,'Continuous '+key+' at '+boundary);
}
const meta=JSON.parse(await readFile(new URL('./theatre-character.json',import.meta.url),'utf8'));
const bytes=await readFile(new URL('./theatre-character.bin',import.meta.url));
assert.equal(bytes.length,meta.vertices*11*4);
let count=0;
for(const name of ['body','leftPaw','rightPaw','jaw','mouth','miniature']){
 const group=meta.groups[name];assert.equal(group.first,count);assert.ok(group.count>0);assert.equal(group.count%3,0);count+=group.count;
}
assert.equal(count,meta.vertices);
const values=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
assert.ok(values.every(Number.isFinite));
const cavity=meta.groups.mouth;
for(let i=cavity.first;i<cavity.first+cavity.count;i++)assert.equal(values[i*11+9],2,'Cavity stretches with the lower jaw');
meta.mouth.forEach((v,i)=>assert.ok(Math.abs(v*characterPlacement.scale+characterPlacement.position[i]-characterMouthWorld[i])<1e-6,'Bite target matches the new face'));
assert.equal(meta.jawTravel,.22);
console.log('Passed: two hands, mouth easing, tracking loss, all mesh groups, jaw cavity and bite position.');
