// Check the real initialization and round gates without a camera, renderer or worker.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./scene.js',import.meta.url),'utf8');
const init=source.slice(source.indexOf('handOn.onclick='),source.indexOf('async function submitHandFrame('));
const start=source.slice(source.indexOf('function startRound('),source.indexOf('function pauseRound('));
function setup(autoEat){
 const context={autoEat,imageReady:true,handMode:false,handReady:false,faceReady:false,handOn:{},handOff:{},
  handStatus:{},faceStatus:{},gesture:{reset(){}},eatingWindow:{reset(){}},gatherFriends(){},
  yaw:1,pitch:1,distance:20,drag:null,savedView:null,handWorker:null,handTimer:null,lastHandResult:0,lastHandFrame:0,lastHandSubmit:0,
  performance:{now:()=>1000},setTimeout:()=>1,clearTimeout(){},updateMonitor(){},
  ready:0,failures:[],ui:{trackingReady(){context.ready++;},show(){}},stopHandInteraction(message){context.failures.push(message);},
  document:{querySelector:()=>({})},
  Worker:class{postMessage(message){this.request=message;}},
  cameraStream:{},latestHand:null,latestMouth:null,lastSeenHand:0,eatScore:0,caughtCount:0,maxCombo:0,combo:{},
  scoreDisplay:{},timeDisplay:{},roundOver:false,roundPausedAt:null,roundDeadline:null,roundLength:60000,playStageSound(){},
 };
 vm.createContext(context);vm.runInContext(init+start,context);return context;
}
const easy=setup(true);easy.handOn.onclick();assert.equal(easy.handWorker.request.face,false,'Easy mode does not initialize the face model');
easy.handWorker.onmessage({data:{type:'ready',faceReady:false}});
assert.equal(easy.ready,1);assert.equal(easy.failures.length,0);assert.equal(easy.startRound(),true,'Hand readiness alone can start');
const classic=setup(false);classic.handOn.onclick();assert.equal(classic.handWorker.request.face,true);
classic.handWorker.onmessage({data:{type:'ready',faceReady:false}});assert.equal(classic.ready,0);assert.equal(classic.failures.length,1);
assert.equal(classic.startRound(),false,'Mouth mode checks face readiness');
classic.faceReady=true;assert.equal(classic.startRound(),true);
const noHand=setup(true);assert.equal(noHand.startRound(),false,'Easy mode still requires hand tracking');
const modeCode=source.slice(source.indexOf('function updateEatingMode('),source.indexOf('let previousFrame='));
const choices=[0,1].map(()=>({value:'auto',addEventListener(type,fn){this.change=fn;}}));
const nodes=new Map();
const selection={autoEat:true,handMode:true,imageReady:true,stops:0,restarts:[],eatModeDisplay:{},eatingWindow:{reset(){}},
 document:{body:{dataset:{}},querySelectorAll:()=>choices,getElementById(id){if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}},
 stopHandInteraction(){selection.stops++;selection.handMode=false;},handOn:{click(){selection.restarts.push(selection.autoEat);selection.handMode=true;}},
 ui:{screen:'practice',show(name){this.screen=name;selection.updateEatingMode();}},
};
vm.createContext(selection);vm.runInContext(modeCode,selection);
choices[1].value='mouth';choices[1].change();assert.equal(selection.autoEat,false);assert.equal(selection.stops,1);assert.deepEqual(selection.restarts,[false]);assert.equal(choices[0].value,'mouth');
assert.match(nodes.get('lesson-instruction').textContent,/입을 벌리고/);
choices[0].value='auto';choices[0].change();assert.equal(selection.autoEat,true);assert.equal(selection.stops,2);assert.deepEqual(selection.restarts,[false,true]);assert.equal(choices[1].value,'auto');
assert.match(nodes.get('lesson-instruction').textContent,/입을 벌리지 않아도/);
selection.ui.screen='play';choices[0].value='mouth';choices[0].change();assert.equal(selection.autoEat,true,'A round cannot change tracker modes mid-bite');
const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
assert.equal((html.match(/value="auto" selected/g)||[]).length,2,'Both mode pickers default to easy');
assert.match(source,/let ui=null,autoEat=true/);
assert.match(source,/trackMouth:!autoEat&&faceReady/,'Easy frames skip mouth inference');
console.log('Passed: hand-only model initialization, missing-face readiness, classic mode gating and easy defaults.');
