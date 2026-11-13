// Screen flow only. Camera permission and game rendering remain in scene.js.
export function createTheatreUI(actions) {
 const byId=id=>document.getElementById(id);
 const screens=[...document.querySelectorAll('#screens > .screen')];
 const monitor=byId('tracking-monitor'),dialog=byId('pause-dialog');
 const next=byId('lesson-next');
 let screen='entry',mode='',countdown=null;
 const ui={
  get screen(){return screen;},
  get mode(){return mode;},
  show,
  trackingReady(){next.disabled=false;show('practice');},
  cameraReady(ready){
   byId('hand-on').hidden=!ready;
   if(!ready){next.disabled=true;if(screen==='practice')show('prepare');}
  },
  finish({score,maxCombo,message}){
   cancelCountdown();if(dialog.open)dialog.close();
   byId('result-score').textContent=String(score);
   byId('result-combo').textContent=String(maxCombo);
   byId('result-message').textContent=message||'당신의 손끝으로 완성한 이야기, 이곳에 소중히 남깁니다.';
   show('result');
  },
  pause,
 };
 function cancelCountdown(){clearTimeout(countdown);countdown=null;byId('resume-show').disabled=false;}
 function show(name,newMode=''){
  screen=name;mode=newMode;
  actions.sceneChanged?.(name,newMode);
  document.body.dataset.screen=name;document.body.dataset.mode=newMode;
  for(const section of screens){section.hidden=section.dataset.screen!==name;section.inert=section.hidden;}
  const exploring=name==='play'&&newMode==='explore';
  byId('scene').inert=name!=='play';
  const slot=byId(name==='play'&&!exploring?'game-monitor-slot':'prepare-monitor-slot');
  if(monitor.parentElement!==slot){
   slot.append(monitor);
   const video=byId('camera-preview');
   if(video.srcObject&&video.paused)video.play().catch(()=>{});
  }
  if(exploring){
   byId('eat-mode').hidden=false;byId('eat-mode').textContent='드래그해서 무대를 둘러보세요.';
   byId('game-instruction').textContent='마우스 휠 · 확대와 축소 / 방향키 · 회전';
  }else if(name==='play'){
   byId('eat-mode').hidden=false;byId('eat-mode').textContent='입을 크게 벌려 주세요.';
   byId('game-instruction').textContent='엄지와 검지를 붙인 채 좌우로 움직여요.';
  }
  actions.refreshInstructions?.();
  window.scrollTo({top:0,left:0,behavior:'auto'});
  if(name==='play'){byId('scene').focus({preventScroll:true});}
  else{
   const heading=byId('screen-'+name).querySelector('h1,h2');
   if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
 }
 function prepare(){cancelCountdown();if(dialog.open)dialog.close();next.disabled=true;actions.prepare();show('prepare');actions.startCamera();}
 function explore(){cancelCountdown();if(dialog.open)dialog.close();actions.explore();show('play','explore');}
 function pause(){
  if(screen!=='play'||mode==='explore')return;
  cancelCountdown();actions.pause();
  byId('pause-message').textContent='시간이 멈췄어요. 준비되면 다시 이어서 놀아요.';
  byId('resume-show').textContent='계속 놀기';
  if(!dialog.open)dialog.showModal();
 }
 byId('start-show').addEventListener('click',()=>{actions.enableSound();prepare();});
 byId('explore-show').addEventListener('click',()=>{actions.enableSound();explore();});
 byId('prepare-explore').addEventListener('click',explore);
 byId('explore-prepare').addEventListener('click',prepare);
 byId('retry-show').addEventListener('click',prepare);
 byId('result-explore').addEventListener('click',explore);
 byId('practice-back').addEventListener('click',()=>{actions.stopTracking();show('prepare');});
 next.addEventListener('click',()=>{
  if(screen==='practice'&&actions.startRound())show('play','game');
 });
 byId('pause-show').addEventListener('click',pause);
 byId('resume-show').addEventListener('click',()=>{
  let remaining=3;byId('resume-show').disabled=true;
  const tick=()=>{
   if(document.hidden){pause();return;}
   byId('pause-message').textContent=remaining+'초 뒤 공연을 이어갑니다.';
   if(remaining-- > 0){countdown=setTimeout(tick,1000);return;}
   countdown=null;dialog.close();byId('resume-show').disabled=false;actions.resume();byId('scene').focus({preventScroll:true});
  };
  tick();
 });
 byId('finish-show').addEventListener('click',()=>{cancelCountdown();actions.finish('이번 공연을 마쳤어요. 다음 이야기에서 다시 만나요.');});
 dialog.addEventListener('cancel',event=>{event.preventDefault();pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&screen==='play'&&mode==='game'){event.preventDefault();pause();}});
 for(const section of screens)section.inert=section.hidden;
 return ui;
}
