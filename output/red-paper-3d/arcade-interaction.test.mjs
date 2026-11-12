import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {PinchGrab,nearestGrabTarget,EatCombo,EatingWindow,mouthSample} from './hand-interaction.mjs';
import {feedingMotion} from './character-avatar.mjs';

const gesture=new PinchGrab(),closed={ratio:.32},open={ratio:.8};
assert.equal(gesture.update(closed,true,0),'grab');
assert.equal(gesture.update(closed,true,100),null,'Holding is not repeated input');
assert.equal(gesture.update(null,false,800),null,'Brief tracking loss keeps the doll');
assert.equal(gesture.update(null,false,960),'release');
gesture.update(open,true,1000);
assert.equal(gesture.update(closed,false,1020),null);
assert.equal(gesture.update(closed,true,1040),'grab','Entering the generous range grabs immediately');
const a={p:[50,0]},b={p:[64,0]};
assert.equal(nearestGrabTarget([0,0],[a,b],x=>x.p,100),a);
assert.equal(nearestGrabTarget([0,0],[a,b],x=>x.p,100,b),b,'Small jitter keeps the selected doll');
assert.equal(nearestGrabTarget([500,0],[a,b],x=>x.p,100),null);
const combo=new EatCombo();
assert.equal(combo.hit(0),1);assert.equal(combo.hit(400),1);assert.equal(combo.hit(800),2);
assert.equal(combo.hit(3150),2,'The measured 2.35-second gap now keeps the combo');
assert.equal(combo.active(7151),false);assert.equal(combo.hit(7200),1,'Expired combo resets the bonus');
const window=new EatingWindow();window.update({wide:true},100);
window.update(null,1000);assert.equal(window.active(2099),true,'Mouth may close or disappear during the two-second window');
assert.equal(window.active(2100),false);window.update({wide:true},2200);window.reset();assert.equal(window.active(2300),false);

// Exercise the real scene input/animation functions with synthetic camera samples.
const source=await readFile(new URL('./scene.js',import.meta.url),'utf8');
const input=source.slice(source.indexOf('function receiveHand('),source.indexOf('handOn.onclick='));
const overlay=source.slice(source.indexOf('function updateHandOverlay('),source.indexOf("status.textContent='산책"));
const clock=source.slice(source.indexOf('function updateRoundClock('),source.indexOf('function touchPress('));
const element=()=>({style:{},dataset:{},classList:{toggle(){},add(){}},animate:()=>({}),remove(){}});
function fixture(){
 const actors=[.6,1.5,2.2].map(x=>({position:[x,.5,.65],anchor:[x,.5,.65],scale:.6,phase:0}));
 const c={clock:0,performance:{now:()=>c.clock},characterTargets:()=>({}),handSample:p=>p,comfortableHandSample:p=>p,mouthSample,feedingMotion,
  updateMonitor(){},updateRoundClock(){},roundOver:false,videoAspect:1,videoPlacement:{},currentVP:[],cameraEye:[0,5,26],innerWidth:1000,innerHeight:800,
  videoToWorld:p=>[p.x,p.y,.65],projectPoint:p=>[500+p[0]*50,400-p[1]*50],nearestGrabTarget,
  actorScreenPoint:actor=>c.projectPoint(actor.position),grabbableActors:actors,practice:null,hoveredActor:null,touchedActor:null,
  handPoint:null,latestHand:null,latestMouth:null,lastSeenHand:-Infinity,lastHandResult:0,handMode:true,handReady:false,
  pendingGrab:null,bite:null,flight:null,biteNoticeUntil:0,touchingPractice:false,touchTime:-Infinity,
  gesture:new PinchGrab(),faceReady:true,avatarPose:{paws:[[0,0,0],[0,0,0]],mouth:0},avatarTarget:{},characterMouthWorld:[0,3,2],
  actorCenterHeight:()=>0,floaterPose:actor=>({position:actor.position}),handStatus:element(),faceStatus:element(),mouthCursor:element(),handCursor:element(),grabTarget:element(),
  eatingWindow:new EatingWindow(),eatModeDisplay:element(),combo:new EatCombo(),comboDisplay:element(),scoreDisplay:element(),eatScore:0,playStageSound(){},scatterPaper(){},
  document:{createElement:element,body:{append(){}}},routes:[]};
 vm.createContext(c);vm.runInContext(input+overlay,c);
 return c;
}
const wide=[{x:.5,y:.46},{x:.5,y:.54},{x:.45,y:.5},{x:.55,y:.5}];
const hand={x:.5,y:.5,ratio:.32};
const c=fixture();
c.receiveHand(hand,0,wide);assert.ok(c.bite,'Wide mouth + instant grab starts eating');
const first=c.practice;
c.clock=80;c.receiveHand(hand,80,null);
c.clock=160;c.receiveHand(hand,160,null);
assert.ok(c.pendingGrab,'A held pinch sweeps up the next doll without reopening');
const second=c.pendingGrab.actor;
assert.notEqual(second,first);assert.equal(second.queued,true);
c.clock=200;c.receiveHand(hand,200,null);
assert.equal(c.pendingGrab.actor,second,'Only one pending grab');
assert.equal(c.eatingWindow.until,2000,'Closed/absent mouth does not extend eating mode');
c.clock=400;c.updateHandOverlay();
assert.equal(c.eatScore,1);assert.equal(c.practice,second);assert.ok(c.bite,'Queued bite starts immediately');
assert.equal(first.held,false);assert.ok(first.anchor[0]>=-5&&first.anchor[0]<=5,'Floater respawns in reach');
c.clock=800;c.updateHandOverlay();assert.equal(c.eatScore,2);assert.equal(c.combo.count,2);
c.clock=810;c.updateHandOverlay();assert.equal(c.eatScore,2,'No duplicate score');

const lost=fixture();lost.receiveHand(hand,0,wide);
lost.clock=80;lost.receiveHand(hand,80,wide);
lost.clock=160;lost.receiveHand(hand,160,wide);
const reserved=lost.pendingGrab.actor;
lost.clock=1100;lost.receiveHand(null,1100,null);lost.updateHandOverlay();
assert.equal(lost.pendingGrab,null);assert.equal(reserved.queued,false);assert.equal(lost.bite,null,'Stale queued input is cancelled');

const expired=fixture();expired.receiveHand(hand,0,wide);expired.clock=400;expired.updateHandOverlay();
expired.clock=2100;expired.receiveHand(hand,2100,null);
assert.ok(expired.practice?.held);assert.equal(expired.bite,null,'Expired eating mode holds the doll without eating');
expired.clock=2200;expired.receiveHand(hand,2200,wide);assert.ok(expired.bite,'Opening the mouth reactivates eating');

// Test the actual 60-second boundary, including cancellation before input can score.
const duration=Number(source.match(/const roundLength=(\d+)/)[1]);assert.equal(duration,60000);
const timer={combo:new EatCombo(),comboDisplay:element(),roundDeadline:duration,roundOver:false,timeDisplay:element(),scoreDisplay:element(),eatScore:4,
 savedView:[],stops:0,stopCamera(){this.stops++;},document:{documentElement:element()}};
timer.stopCamera=()=>timer.stops++;
vm.createContext(timer);vm.runInContext(clock,timer);
timer.updateRoundClock(59999);assert.equal(timer.roundOver,false);assert.equal(timer.timeDisplay.textContent,'1초');
timer.updateRoundClock(60000);assert.equal(timer.roundOver,true);assert.equal(timer.scoreDisplay.textContent,'최종 점수 4점');
timer.updateRoundClock(60100);assert.equal(timer.stops,1);
console.log('Passed: instant grab, generous stable target, tracking grace, one queued grab, fast chained eating, combo, respawn, 60-second expiry.');
