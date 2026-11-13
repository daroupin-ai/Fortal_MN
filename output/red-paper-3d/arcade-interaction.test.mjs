import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {PinchGrab,nearestGrabTarget,EatCombo,EatingWindow,mouthSample} from './hand-interaction.mjs';
import {feedingMotion,feedingDuration,characterPlacement} from './character-avatar.mjs';

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
const overlay=source.slice(source.indexOf('function updateHandOverlay('),source.indexOf("status.textContent='극장"));
const clock=source.slice(source.indexOf('function updateRoundClock('),source.indexOf('function touchPress('));
const element=()=>({style:{},dataset:{},classList:{toggle(){},add(){}},animate:()=>({}),setAttribute(){},remove(){}});
function fixture(autoEat=false){
 const actors=[.6,1.5,2.2].map(x=>({position:[x,.5,.65],anchor:[x,.5,.65],scale:.6,phase:0}));
 const c={autoEat,clock:0,performance:{now:()=>c.clock},characterTargets:()=>({paws:[[0,0,0],[0,0,0]],mouth:0}),handSample:p=>p,comfortableHandSample:p=>p,mouthSample,feedingMotion,characterPlacement,
  updateMonitor(){},updateRoundClock(){},ui:null,roundDeadline:60000,roundPausedAt:null,roundOver:false,caughtCount:0,maxCombo:0,videoAspect:1,videoPlacement:{},currentVP:[],cameraEye:[0,5,26],innerWidth:1000,innerHeight:800,
  videoToWorld:p=>[p.x,p.y,.65],projectPoint:p=>[500+p[0]*50,400-p[1]*50],nearestGrabTarget,
  actorScreenPoint:actor=>c.projectPoint(actor.position),grabbableActors:actors,practice:null,hoveredActor:null,touchedActor:null,
  handPoint:null,latestHand:null,latestMouth:null,lastSeenHand:-Infinity,lastHandResult:0,handMode:true,handReady:false,
  pendingGrab:null,bite:null,flight:null,biteNoticeUntil:0,touchingPractice:false,touchTime:-Infinity,
  gesture:new PinchGrab(),faceReady:true,avatarPose:{paws:[[0,0,0],[0,0,0]],mouth:0},avatarTarget:{},characterMouthWorld:[0,3,2],
  actorCenterHeight:()=>0,floaterPose:actor=>({position:actor.position}),handStatus:element(),faceStatus:element(),mouthCursor:element(),handCursor:element(),grabTarget:element(),
  eatingWindow:new EatingWindow(),eatModeDisplay:element(),combo:new EatCombo(),comboDisplay:element(),scoreDisplay:element(),eatScore:0,playStageSound(){},scatterPaper(){},stageBurst(){},reducedMotion:{matches:false},
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
c.clock=470;c.updateHandOverlay();assert.equal(c.eatScore,0,'Hand recovery finishes before scoring');
c.clock=feedingDuration;c.updateHandOverlay();
assert.equal(c.eatScore,1);assert.equal(c.practice,second);assert.ok(c.bite,'Queued bite starts immediately');
assert.equal(first.held,false);assert.ok(first.anchor[0]>=-5&&first.anchor[0]<=5,'Floater respawns in reach');
c.clock=feedingDuration*2;c.updateHandOverlay();assert.equal(c.eatScore,2);assert.equal(c.combo.count,2);
c.clock=feedingDuration*2+10;c.updateHandOverlay();assert.equal(c.eatScore,2,'No duplicate score');

const lost=fixture();lost.receiveHand(hand,0,wide);
lost.clock=80;lost.receiveHand(hand,80,wide);
lost.clock=160;lost.receiveHand(hand,160,wide);
const reserved=lost.pendingGrab.actor;
lost.clock=1100;lost.receiveHand(null,1100,null);lost.updateHandOverlay();
assert.equal(lost.pendingGrab,null);assert.equal(reserved.queued,false);assert.equal(lost.bite,null,'Stale queued input is cancelled');

const expired=fixture();expired.receiveHand(hand,0,wide);expired.clock=feedingDuration;expired.updateHandOverlay();
assert.equal(expired.avatarPose.mouth,0,'Jaw returns to the live face after swallowing');
assert.deepEqual(Array.from(expired.avatarPose.paws[1]),[0,0,0],'Feeding hand returns without snapping');
expired.clock=2100;expired.receiveHand(hand,2100,null);
assert.ok(expired.practice?.held);assert.equal(expired.bite,null,'Expired eating mode holds the doll without eating');
expired.clock=2200;expired.receiveHand(hand,2200,wide);assert.ok(expired.bite,'Opening the mouth reactivates eating');

// Easy mode has no face dependency, while grabs still require a real pinch.
const easy=fixture(true);easy.faceReady=false;
easy.receiveHand({...hand,ratio:.8},0,null);assert.equal(easy.bite,null,'Hovering with an open hand does not eat');
easy.receiveHand(hand,10,null);assert.ok(easy.bite,'A pinch starts feeding without any face landmarks');
const easyFirst=easy.practice;
easy.clock=100;easy.receiveHand(hand,100,null);assert.ok(easy.pendingGrab,'Easy mode keeps the one-item queue');
easy.clock=feedingDuration;easy.updateHandOverlay();assert.equal(easy.eatScore,1);assert.notEqual(easy.practice,easyFirst);assert.ok(easy.bite,'Queued feeding needs no mouth signal');
easy.clock=feedingDuration*2;easy.updateHandOverlay();assert.equal(easy.eatScore,2);
easy.clock=feedingDuration*2+1;easy.updateHandOverlay();assert.equal(easy.eatScore,2,'No duplicate easy-mode score');
const noHands=fixture(true);noHands.faceReady=false;noHands.receiveHand(null,0,null);assert.equal(noHands.bite,null,'No hands never creates a bite');
const classic=fixture(false);classic.receiveHand(hand,0,null);assert.ok(classic.practice?.held);assert.equal(classic.bite,null,'Original mode still requires mouth activation');
const easyLost=fixture(true);easyLost.faceReady=false;easyLost.receiveHand(hand,0,null);easyLost.clock=80;easyLost.receiveHand(hand,80,null);easyLost.clock=1100;easyLost.receiveHand(null,1100,null);easyLost.updateHandOverlay();assert.equal(easyLost.pendingGrab,null);assert.equal(easyLost.bite,null,'Tracking loss cancels the queued easy-mode grab');

// Test the actual 60-second boundary, including cancellation before input can score.
const duration=Number(source.match(/const roundLength=(\d+)/)[1]);assert.equal(duration,60000);
const timer={combo:new EatCombo(),comboDisplay:element(),eatModeDisplay:element(),roundDeadline:duration,roundPausedAt:null,roundOver:false,caughtCount:0,maxCombo:3,timeDisplay:element(),scoreDisplay:element(),eatScore:4,ui:{finish(result){timer.result=result;}},
 savedView:[],stops:0,stopCamera(){this.stops++;},document:{documentElement:element()}};
timer.stopCamera=()=>timer.stops++;
vm.createContext(timer);vm.runInContext(clock,timer);
timer.updateRoundClock(59999);assert.equal(timer.roundOver,false);assert.equal(timer.timeDisplay.textContent,'00:01');
timer.updateRoundClock(60000);assert.equal(timer.roundOver,true);assert.equal(timer.scoreDisplay.textContent,'4');
assert.equal(timer.result.score,4);assert.equal(timer.result.maxCombo,3);
timer.updateRoundClock(60100);assert.equal(timer.stops,1);
timer.roundOver=false;timer.roundDeadline=null;timer.updateRoundClock(120000);
assert.equal(timer.roundOver,false,'Preparation and rehearsal have no deadline');
timer.roundDeadline=60000;timer.roundPausedAt=30000;timer.updateRoundClock(120000);
assert.equal(timer.roundOver,false,'A paused round cannot expire');
const pauseSource=source.slice(source.indexOf('function pauseRound('),source.indexOf('ui=createTheatreUI('));
const pauseState={now:10000,performance:{now:()=>pauseState.now},roundDeadline:60000,roundOver:false,roundPausedAt:null,
 handCursor:element(),grabTarget:element(),mouthCursor:element(),combo:{last:9000},eatingWindow:{until:11000},
 lastHandResult:9900,lastSeenHand:9900,gesture:{lastSeen:9900,openSince:null},biteNoticeUntil:10500,touchTime:9500,
 bite:{time:9800},grabbableActors:[{grabAfter:10200}],lastHandFrame:4,lastHandSubmit:9900};
vm.createContext(pauseState);vm.runInContext(pauseSource,pauseState);
pauseState.pauseRound();assert.equal(pauseState.roundPausedAt,10000);
pauseState.now=25000;pauseState.pauseRound();assert.equal(pauseState.roundPausedAt,10000,'Repeated pause does not lose elapsed time');
pauseState.resumeRound();assert.equal(pauseState.roundDeadline,75000);assert.equal(pauseState.combo.last,24000);
assert.equal(pauseState.bite.time,24800);assert.equal(pauseState.eatingWindow.until,26000);
assert.equal(pauseState.gesture.openSince,null);assert.equal(pauseState.roundPausedAt,null);
pauseState.resumeRound();assert.equal(pauseState.roundDeadline,75000,'Resume is idempotent');
console.log('Passed: instant grab, generous stable target, tracking grace, one queued grab, fast chained eating, combo, respawn, 60-second expiry.');
