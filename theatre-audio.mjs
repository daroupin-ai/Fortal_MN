// Original D-minor music-box waltz. Synthesized locally; no recordings or downloads.
const melody=[
 74,null,77,81,77,76, 74,null,69,72,74,null,
 70,null,74,77,74,72, 69,null,73,76,73,null,
 74,77,81,86,81,77, 79,null,77,76,74,72,
 70,74,77,76,73,69, 74,null,77,74,null,null,
];
const bass=[50,50,46,45,50,48,46,45];
const hz=note=>440*2**((note-69)/12);

export function createTheatreAudio(onChange=()=>{}){
 let ctx,output,echo,feedback,wet,timer=null,started=false,muted=false,paused=false,hidden=false,unavailable=false;
 let step=0,nextTime=0;
 const voices=new Set(),lastEffect=new Map();
 const active=()=>started&&!muted&&!paused&&!hidden&&!unavailable;
 const notify=()=>onChange({started,muted,unavailable});
 function clearVoices(){
  for(const voice of voices){try{voice.stop();}catch{} }
  voices.clear();
 }
 function sync(){
  if(!ctx||!output)return;
  const playing=active()&&ctx.state==='running',now=ctx.currentTime;
  output.gain.cancelScheduledValues(now);
  output.gain.setTargetAtTime(playing?.32:0,now,.025);
  if(!playing){clearInterval(timer);timer=null;clearVoices();return;}
  if(timer===null){nextTime=now+.06;schedule();timer=setInterval(schedule,120);}
 }
 function strike(note,time,level=.16,length=1.5,metal=true){
  if(voices.size>100)return;
  const partials=metal?[[1,1],[2.76,.16],[5.4,.035]]:[[1,1]];
  for(const [ratio,amount] of partials){
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type=metal?'sine':'triangle';osc.frequency.setValueAtTime(hz(note)*ratio,time);
   gain.gain.setValueAtTime(.0001,time);
   gain.gain.exponentialRampToValueAtTime(level*amount,time+.006);
   gain.gain.exponentialRampToValueAtTime(.0001,time+length);
   osc.connect(gain);gain.connect(output);gain.connect(echo);
   voices.add(osc);
   osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};
   osc.start(time);osc.stop(time+length+.03);
  }
 }
 function schedule(){
  if(!active()||ctx.state!=='running')return;
  const now=ctx.currentTime;
  if(nextTime<now)nextTime=now+.03; // Never replay missed beats after a suspended tab.
  while(nextTime<now+.28){
   const note=melody[step%melody.length],bar=Math.floor(step/6)%bass.length,beat=step%6;
   if(note!==null)strike(note,nextTime,.13,1.35);
   if(beat===0)strike(bass[bar],nextTime,.12,1.3,false);
   if(beat===2||beat===4)strike(bass[bar]+19,nextTime,.055,.85);
   step++;nextTime+=.36;
  }
 }
 async function enable(){
  if(unavailable)return;
  try{
   if(!ctx){
    const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Context)throw new Error('Audio unavailable');
    ctx=new Context();output=ctx.createGain();output.gain.value=0;
    echo=ctx.createDelay(.5);echo.delayTime.value=.19;
    feedback=ctx.createGain();feedback.gain.value=.16;
    wet=ctx.createGain();wet.gain.value=.12;
    echo.connect(feedback).connect(echo);echo.connect(wet).connect(output);output.connect(ctx.destination);
    ctx.onstatechange=sync;
   }
   started=true;notify();
   await ctx.resume();sync();
  }catch{unavailable=true;sync();notify();}
 }
 return {
  enable,
  toggle(){if(!started){return enable();}muted=!muted;notify();if(!muted)return enable();sync();},
  setPaused(value){paused=value;sync();},
  setHidden(value){hidden=value;sync();},
  play(kind,strength=1){
   if(!ctx||!active()||ctx.state!=='running')return;
   const now=ctx.currentTime;
   if(now-(lastEffect.get(kind)??-Infinity)<.085)return;
   lastEffect.set(kind,now);
   if(kind==='pop'||kind==='land'){strike(kind==='pop'?81:50,now,.12,.12,false);return;}
   if(kind==='bite'){strike(57,now,.2,.07,false);strike(69,now+.045,.12,.1,false);return;}
   const count=Math.max(1,Math.min(10,strength));
   const notes=kind==='finish'?[74,77,81,86,81,74]:kind==='bell'?[62,69,74,77]:kind==='grab'?[81,86]:kind==='combo'?[77,81,84+Math.min(count-3,2),86]:[81,86];
   notes.forEach((note,i)=>strike(note,now+i*(kind==='finish'?.13:.065),kind==='combo'?.24:.19,.65));
  },
 };
}
