// Scheduler/lifecycle checks with a silent fake AudioContext. No audio device is opened.
import assert from 'node:assert/strict';
import {createTheatreAudio} from './theatre-audio.mjs';
const original={AudioContext:globalThis.AudioContext,setInterval,clearInterval};
const timers=new Map(),contexts=[];
let timerId=0;
function param(){return {value:0,setValueAtTime(value){assert.ok(Number.isFinite(value));this.value=value;},exponentialRampToValueAtTime(value){assert.ok(value>0&&Number.isFinite(value));},cancelScheduledValues(){},setTargetAtTime(value){this.value=value;}};}
function node(){return {gain:param(),delayTime:param(),connect(target){return target;},disconnect(){}};}
class FakeContext{
 constructor(){this.currentTime=0;this.state='suspended';this.destination={};this.notes=[];this.gains=[];contexts.push(this);}
 createGain(){const gain=node();this.gains.push(gain);return gain;}
 createDelay(){return node();}
 createOscillator(){const voice={...node(),frequency:param(),start:time=>{assert.ok(time>=this.currentTime);this.notes.push(voice);},stop:time=>{voice.end=time??this.currentTime;if(time===undefined)voice.onended?.();}};return voice;}
 async resume(){this.state='running';this.onstatechange?.();}
 advance(time){this.currentTime=time;for(const note of this.notes)if(note.end<=time)note.onended?.();for(const tick of timers.values())tick();}
}
globalThis.AudioContext=FakeContext;
globalThis.setInterval=fn=>{timers.set(++timerId,fn);return timerId;};
globalThis.clearInterval=id=>timers.delete(id);
try{
 let state;const audio=createTheatreAudio(value=>state=value);
 audio.play('grab');assert.equal(contexts.length,0,'Loading the page never opens an audio device');
 await audio.enable();const ctx=contexts[0];assert.equal(timers.size,1);assert.equal(state.started,true);assert.ok(ctx.notes.length>0);
 await audio.enable();assert.equal(contexts.length,1);assert.equal(timers.size,1,'Repeated starts do not layer music loops');
 const opening=ctx.notes.length;ctx.advance(3);assert.ok(ctx.notes.length-opening<15,'Delayed scheduling does not replay missed notes');
 let count=ctx.notes.length;audio.play('grab');assert.ok(ctx.notes.length>count);count=ctx.notes.length;
 audio.play('grab');assert.equal(ctx.notes.length,count,'Duplicate input is rate limited');
 await audio.toggle();assert.equal(state.muted,true);assert.equal(timers.size,0);assert.equal(ctx.gains[0].gain.value,0);
 count=ctx.notes.length;audio.play('combo',4);ctx.advance(100);assert.equal(ctx.notes.length,count,'Muted music and effects stay silent');
 await audio.enable();assert.equal(state.muted,true,'Starting another round respects mute');assert.equal(timers.size,0);
 await audio.toggle();assert.equal(timers.size,1);assert.equal(state.muted,false);
 audio.setPaused(true);assert.equal(timers.size,0);audio.setHidden(true);audio.setPaused(false);assert.equal(timers.size,0,'Hidden tabs stay silent after scene changes');
 audio.setHidden(false);assert.equal(timers.size,1);audio.setPaused(true);audio.setHidden(true);audio.setHidden(false);assert.equal(timers.size,0,'Returning to a paused round stays silent');
 audio.setPaused(false);count=ctx.notes.length;audio.play('finish');assert.ok(ctx.notes.length>count,'Result has its own flourish');
 for(let i=0;i<150;i++)ctx.advance(ctx.currentTime+.24);
 assert.ok(ctx.notes.length<800,'Music voices stay bounded over a full loop');
 audio.setHidden(true);assert.equal(timers.size,0);
 globalThis.AudioContext=undefined;const missing=createTheatreAudio(value=>state=value);await missing.enable();assert.equal(state.unavailable,true,'Audio failure is nonfatal');
 console.log('Passed: user-gesture start, single music loop, mute persistence, pause/visibility, no catch-up burst, effects and unsupported audio.');
}finally{Object.assign(globalThis,original);}
