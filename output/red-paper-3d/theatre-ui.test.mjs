// Headless contract checks: no browser, server, renderer or camera is opened.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTheatreUI} from './theatre-ui.mjs';

const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(ids.length,new Set(ids).size,'IDs are unique across all five screens');
const controller=await readFile(new URL('./theatre-ui.mjs',import.meta.url),'utf8');
const scene=await readFile(new URL('./scene.js',import.meta.url),'utf8');
for(const match of controller.matchAll(/byId\('([^']+)'\)/g))assert.ok(ids.includes(match[1]),'UI element exists: '+match[1]);
for(const match of scene.matchAll(/querySelector\('#([^']+)'\)/g))assert.ok(ids.includes(match[1]),'Scene element exists: '+match[1]);
for(const file of ['theatre-design.css','theatre-game.css','theatre-art.jpg','theatre-ui.mjs'])assert.ok((await readFile(new URL('./'+file,import.meta.url))).length>0,file+' is present');
const css=await readFile(new URL('./theatre-design.css',import.meta.url),'utf8');
assert.doesNotMatch(css,/@import|https?:\/\//,'The approved fonts and artwork are local');
for(const match of css.matchAll(/url\(['"]([^'"]+)['"]\)/g))assert.ok((await readFile(new URL('./'+match[1],import.meta.url))).length>0,'Local design asset: '+match[1]);
assert.doesNotMatch(html,/aria-disabled="true"|data-variant=|기록 수치는 예시/,'No inert mockup controls or sample results remain');

function element(id=''){
 const events=new Map(),children=new Map(),classes=new Set();
 return {id,dataset:{},style:{},hidden:false,disabled:false,inert:false,textContent:'',parentElement:null,
  addEventListener(type,fn){events.set(type,fn);},
  fire(type='click',event={}){if(type==='click'&&this.disabled)return;return events.get(type)?.(event);},
  append(child){child.parentElement=this;},focus(){},
  querySelector(selector){if(!children.has(selector))children.set(selector,element());return children.get(selector);},
  setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},
  classList:{toggle(name,yes){if(yes)classes.add(name);else classes.delete(name);}},
  showModal(){this.open=true;},close(){this.open=false;},
 };
}
const elements=new Map(ids.map(id=>[id,element(id)]));
const screens=['entry','prepare','practice','play','result'].map(name=>{
 const el=elements.get('screen-'+name);el.dataset.screen=name;el.hidden=name!=='entry';return el;
});
const rows=[element(),element()],documentEvents=new Map();
const previousDocument=globalThis.document,previousWindow=globalThis.window;
globalThis.document={hidden:false,body:{dataset:{}},getElementById:id=>elements.get(id),
 querySelectorAll:selector=>selector==='#screens > .screen'?screens:rows,
 addEventListener(type,fn){documentEvents.set(type,fn);}};
globalThis.window={scrollTo(){}};
const calls={prepare:0,explore:0,pause:0,resume:0,start:0,finish:0,camera:0};
let ui;
const actions={enableSound(){},startCamera(){calls.camera++;},prepare(){calls.prepare++;},explore(){calls.explore++;},stopTracking(){},
 startRound(){calls.start++;return true;},pause(){calls.pause++;},resume(){calls.resume++;},
 finish(message){calls.finish++;ui.finish({score:7,maxCombo:4,message});}};
try{
 ui=createTheatreUI(actions);
 elements.get('start-show').fire();assert.equal(ui.screen,'prepare');assert.equal(calls.prepare,1);assert.equal(calls.start,0);
 elements.get('lesson-next').fire();assert.equal(calls.start,0,'Cannot start before tracker readiness');
 ui.cameraReady(true);assert.equal(elements.get('hand-on').hidden,false);
 ui.trackingReady();assert.equal(ui.screen,'practice');assert.equal(calls.start,0,'Tracker readiness does not start the clock');
 const next=elements.get('lesson-next');
 assert.equal(calls.camera,1,'Entry requests the camera without another confirmation');
 assert.equal(next.disabled,false,'The short guide can be skipped without performing gestures');
 next.fire();assert.equal(calls.start,1);assert.equal(ui.screen,'play');assert.equal(ui.mode,'game');
 assert.equal(elements.get('tracking-monitor').parentElement,elements.get('game-monitor-slot'));
 elements.get('pause-show').fire();assert.equal(calls.pause,1);assert.equal(elements.get('pause-dialog').open,true);
 elements.get('finish-show').fire();assert.equal(calls.finish,1);assert.equal(ui.screen,'result');
 assert.equal(elements.get('result-score').textContent,'7');assert.equal(elements.get('result-combo').textContent,'4');
 assert.equal(elements.get('pause-dialog').open,false);
 elements.get('retry-show').fire();assert.equal(ui.screen,'prepare');assert.equal(calls.prepare,2);
 assert.equal(next.disabled,true,'Replay waits for camera readiness');assert.equal(calls.camera,2);
 ui.trackingReady();assert.equal(next.disabled,false,'Replay also has no gesture gate');
 ui.cameraReady(false);assert.equal(ui.screen,'prepare','Camera loss exits the lesson safely');
 elements.get('prepare-explore').fire();assert.equal(ui.screen,'play');assert.equal(ui.mode,'explore');assert.equal(calls.start,1);
 ui.pause();assert.equal(calls.pause,1,'Exploration does not open the pause dialog');
 assert.equal(screens.filter(screen=>!screen.hidden).length,1);
 console.log('Passed: five-screen assets, local fonts, short guide without gesture gates, result values, retry, camera loss, camera-free exploration.');
}finally{globalThis.document=previousDocument;globalThis.window=previousWindow;}
