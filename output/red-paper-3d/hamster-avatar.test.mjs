import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hamsterTargets,easeHamsterPose,hamsterMouthWorld} from './hamster-avatar.mjs';

const rest=hamsterTargets();
const both=hamsterTargets([{x:.8,y:.2},{x:.2,y:.3}],{open:true});
assert.ok(both.paws[0][1]>0&&both.paws[1][1]>0,'Both hands raise independent front paws');
assert.ok(both.paws[0][0]<0&&both.paws[1][0]>0,'Mirrored hands move outward on the correct side');
assert.equal(both.mouth,1);
const pose=easeHamsterPose(structuredClone(rest),both,.016);
assert.ok(pose.mouth>0&&pose.mouth<1,'Movement is smoothed, not an instantaneous jump');
for(let i=0;i<90;i++)easeHamsterPose(pose,rest,.016);
assert.ok(pose.mouth<.001&&pose.paws[0][1]<.001,'Tracking loss/stop returns to rest');
const extreme=hamsterTargets([{x:20,y:-20}],null);
assert.ok(Math.abs(extreme.paws[0][0])<=.24&&extreme.paws[0][1]<=.48,'Paws stay attached near the body');
assert.deepEqual(hamsterTargets([null,{x:NaN,y:0}],null),rest);
assert.ok(hamsterMouthWorld.every(Number.isFinite));
const meta=JSON.parse(await readFile(new URL('./hamster.json',import.meta.url),'utf8'));
const bytes=await readFile(new URL('./hamster.bin',import.meta.url));
assert.equal(bytes.length,meta.vertices*11*4);
let count=0;
for(const group of Object.values(meta.groups)){
 assert.equal(group.first,count);assert.equal(group.count%3,0);assert.ok(group.count>0);count+=group.count;
}
assert.equal(count,meta.vertices,'All Blender geometry groups are in bounds');
const values=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
assert.ok(values.every(Number.isFinite),'Mesh contains no invalid coordinates');
console.log('Passed: two hands, mouth, smoothing, tracking loss, movement limits, exported Blender mesh.');
