'use strict';
import {PinchGrab,nearestGrabTarget,EatCombo,EatingWindow,handSample,mouthSample,videoToWorld,projectPoint} from './hand-interaction.mjs';
import {characterPlacement,characterMouthWorld,characterTargets,easeCharacterPose,comfortableHandSample,feedingMotion} from './character-avatar.mjs';
// Small native WebGL scene: no external packages or network assets.
(() => {
const canvas=document.querySelector('#scene'), status=document.querySelector('#status');
const startShow=document.querySelector('#start-show');
let audioContext,soundOutput,lastSoundEnd=0;
startShow.onclick=()=>{
 startShow.hidden=true;
 try{
  audioContext=new AudioContext();
  soundOutput=audioContext.createGain();
  soundOutput.gain.value=.18;
  soundOutput.connect(audioContext.destination);
  audioContext.resume().catch(()=>{});
 }catch(error){console.warn('Sound unavailable',error);}
 openCurtains();
};
function playStageSound(kind,strength=1){
 if(!soundOutput||audioContext.state!=='running')return;
 const now=audioContext.currentTime;
 if(now<lastSoundEnd&&(kind==='pop'||kind==='land'))return;
 const paper=kind==='paper',bell=kind==='bell',landing=kind==='land',chewing=kind==='bite';
 const duration=paper?2.35:bell?.48:chewing?.15:landing?.13:.095;
 const envelope=audioContext.createGain();
 let source;
 if(paper||chewing){
  const buffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*duration),audioContext.sampleRate);
  const samples=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++){
   const t=i/audioContext.sampleRate;
   samples[i]=(Math.random()*2-1)*(chewing?Math.exp(-t*22)*(.35+.65*Math.abs(Math.sin(t*210))):(.65+.22*Math.sin(t*49)+.12*Math.sin(t*113)));
  }
  source=audioContext.createBufferSource();
  source.buffer=buffer;
  const filter=audioContext.createBiquadFilter();
  filter.type=chewing?'lowpass':'bandpass';
  filter.frequency.setValueAtTime(chewing?2400:1100,now);
  filter.frequency.linearRampToValueAtTime(chewing?320:680,now+duration);
  source.connect(filter).connect(envelope);
 }else{
  source=audioContext.createOscillator();
  source.type=bell?'sine':'triangle';
  source.frequency.setValueAtTime(bell?1046.5:landing?225+110*strength:460,now);
  if(!bell)source.frequency.exponentialRampToValueAtTime(150,now+duration);
  source.connect(envelope);
 }
 envelope.gain.setValueAtTime(.001,now);
 envelope.gain.linearRampToValueAtTime(paper?.15:bell?.22:chewing?.65:landing?.06+.13*strength:.17,now+(paper?.45:.008));
 if(landing&&strength>.5){
  envelope.gain.exponentialRampToValueAtTime(.008,now+.048);
  envelope.gain.linearRampToValueAtTime(.045*strength,now+.06);
 }
 envelope.gain.exponentialRampToValueAtTime(.001,now+duration);
 envelope.connect(soundOutput);
 source.start(now);
 source.stop(now+duration);
 lastSoundEnd=now+duration;
}
function openCurtains(){
 const root=document.documentElement,left=document.querySelector('.curtain-left');
 const finish=e=>{
  if(e.propertyName!=='transform')return;
  root.classList.remove('curtain-waiting');canvas.inert=false;
  playStageSound('bell');
  canvas.focus({preventScroll:true});
  left.removeEventListener('transitionend',finish);left.removeEventListener('transitioncancel',finish);
 };
 left.addEventListener('transitionend',finish);left.addEventListener('transitioncancel',finish);
 // Let the textured stage paint behind the closed paper before revealing it.
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  root.classList.add('curtain-opening');
  if(!reducedMotion.matches)playStageSound('paper');
 }));
}
const fail=message=>document.querySelector('#error').textContent=message;
const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
if(!gl){fail('이 Chrome에서 3D 화면을 열 수 없습니다. 다른 Chrome 창에서 다시 열어 주세요.');return;}
const vs=`attribute vec3 aPos,aNormal,aColor; attribute vec2 aUV;
uniform mat4 uVP,uLightVP;uniform vec4 uActor,uSway;uniform vec3 uWalk,uDrift;uniform vec2 uFloat;uniform float uPress,uHamster,uAvatarMouth;
varying vec3 vPos,vWorld,vNormal,vColor; varying vec2 vUV;varying vec4 vLight;
void main(){
 vec3 p=aPos;float stride=sin(uWalk.x),walking=uWalk.z;
 if(uHamster>.5&&aUV.x>1.5)p.y-=uAvatarMouth*.22*clamp((1.12-p.y)/.69,0.,1.);
 if(p.y<.42){float foot=sign(p.x),leg=1.-smoothstep(.26,.42,p.y);p.y+=max(0.,stride*foot)*.15*walking*leg;p.x+=stride*foot*.075*walking*leg;}
 p.x+=stride*max(0.,p.y-.42)*.025*walking;
 p.x*=uWalk.y;
 p.x+=sin(uFloat.x+p.y*2.1)*(1.-smoothstep(-2.8,-.45,p.y))*.15*uFloat.y;
 vec3 normal=vec3(aNormal.x*uWalk.y,aNormal.yz);
 float co=cos(uSway.w),si=sin(uSway.w);
 vec2 local=p.xy-uSway.xy;
 p.xy=uSway.xy+vec2(co*local.x-si*local.y,si*local.x+co*local.y);p+=uDrift;
 normal.xy=vec2(co*normal.x-si*normal.y,si*normal.x+co*normal.y);
 vPos=aPos;vNormal=normal;vColor=aColor;vUV=aUV;
 p.xy*=vec2(1.+uPress*.45,1.-uPress);
 vWorld=p*uActor.w+uActor.xyz;vLight=uLightVP*vec4(vWorld,1.);
 gl_Position=uVP*vec4(vWorld,1.);
}`;
const fs=`precision highp float;
varying vec3 vPos,vWorld,vNormal,vColor;varying vec2 vUV;varying vec4 vLight;
uniform sampler2D uImage,uAtlas,uShadow;uniform float uPaper,uShadowPass,uShadowEnabled,uShadowTexel,uPuppet;
uniform float uChromaThreshold,uHamster,uHighlight;
float grain(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,39.425)))*43758.5453);}
vec4 packDepth(float d){vec4 p=fract(d*vec4(1.,255.,65025.,16581375.));return p-p.yzww*vec4(1./255.,1./255.,1./255.,0.);}
float visibility(vec3 n){
 if(uShadowEnabled<.5)return 1.;
 vec3 q=vLight.xyz/vLight.w*.5+.5;
 if(q.x<0.||q.x>1.||q.y<0.||q.y>1.||q.z>1.)return 1.;
 float bias=max(.00035,.0012*(1.-max(0.,dot(n,normalize(vec3(-.5,1.,.75))))));
 float sum=0.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
  float d=dot(texture2D(uShadow,q.xy+vec2(float(x),float(y))*uShadowTexel),vec4(1.,1./255.,1./65025.,1./16581375.));
  sum+=step(q.z-bias,d);
 }
 return sum/9.;
}
void main(){
 if(uPaper>1.5){float a=(1.-smoothstep(.05,1.,length(vUV*2.-1.)))*.34;gl_FragColor=vec4(.035,.012,.019,a);return;}
 vec4 photo=vec4(1.);if(uPaper>.5){
  if(any(lessThan(vUV,vec2(0.)))||any(greaterThan(vUV,vec2(1.))))discard;
  photo=texture2D(uImage,vec2(1.-vUV.x,vUV.y));
  float greenExcess=max(0.,photo.g-max(photo.r,photo.b));
  float greenStrength=greenExcess/max(.18,photo.g);
  photo.a=1.-smoothstep(uChromaThreshold,uChromaThreshold+.13,greenStrength);
  if(photo.a<.035)discard;
  photo.g-=greenExcess*smoothstep(uChromaThreshold*.5,uChromaThreshold+.13,greenStrength);
 }
 if(uShadowPass>.5&&uPaper>.5&&photo.a<.5)discard;
 if(uShadowPass>.5){gl_FragColor=packDepth(gl_FragCoord.z);return;}
 vec3 n=normalize(vNormal);float key=max(0.,dot(n,normalize(vec3(-.5,1.,.75))));
 float rim=max(0.,dot(n,normalize(vec3(.8,.4,-.6))));
 float shade=.43+.57*key*visibility(n)+.12*rim;
 if(uHamster>.5){
  float eyes=1.-smoothstep(.12,.24,max(vColor.r,max(vColor.g,vColor.b)));
  float shine=pow(max(0.,dot(reflect(-normalize(vec3(-.5,1.,.75)),n),vec3(0.,0.,1.))),48.);
  gl_FragColor=vec4(vColor*(.56+.44*key+.08*rim)+vec3(shine*.65*eyes)+uHighlight*vec3(.24,.17,.035),1.);return;
 }
 if(uPaper>.5){gl_FragColor=photo;return;}
 float fiber=grain(floor(vPos*140.));
 float hatch=step(.91,fract((vPos.x+vPos.y+vPos.z)*15.));
 vec2 p=abs(n.y)>.7?vPos.xz:(abs(n.x)>.7?vPos.zy:vPos.xy);
 vec3 color=vColor;
 if(vColor.r>.25&&vColor.r>vColor.g*2.5&&vColor.g<.28){
  // Printed crimson damask on the scenery; character meshes use their own material.
  vec2 cell=fract(p/1.15)-.5;
  float petal=length(cell)*(1.+.23*cos(atan(cell.y,cell.x)*8.));
  float flower=1.-smoothstep(.14,.17,petal);
  vec2 leaf=abs(cell)-vec2(.26,.26);
  float leaves=1.-smoothstep(.07,.09,length(vec2((leaf.x+leaf.y)*.55,(leaf.x-leaf.y)*1.5)));
  float motif=max(flower,leaves);
  float weave=dot(texture2D(uAtlas,vec2(.512,.012)+fract(p/4.)*.476).rgb,vec3(.299,.587,.114));
  color=vColor*(.76+.24*weave)*(1.-.38*motif);
 }else if(vColor.r>.55&&vColor.r>vColor.g*1.6&&vColor.g>.28){
  vec2 tile=vColor.r<.5?vec2(.5,.5):vec2(0.,.5);
  vec3 printed=texture2D(uAtlas,tile+vec2(.012)+fract(p/4.8)*.476).rgb;
  color=vColor*mix(vec3(.78),vec3(1.12),dot(printed,vec3(.299,.587,.114)));
  if(vColor.r<.5)color*=.86;
 }else if(vColor.r>.99&&vColor.g>.88){
  shade=max(shade,.86);
 }else if(vColor.r>.8&&vColor.g>.65&&vColor.g<.95){
  color=mix(vColor,texture2D(uAtlas,vec2(.012)+fract(p/3.4)*.476).rgb,uPuppet>.5?.16:.32);
 }else if(vColor.r>.08&&vColor.r<.2){
  float pattern=dot(texture2D(uAtlas,vec2(.512,.012)+fract(p/5.)*.476).rgb,vec3(.299,.587,.114));
  color=vColor*(.48+pattern*1.35);
 }
 color*=vec3(1.04,.98,.91)*shade*(.96+.055*fiber-hatch*.045*(1.-key));
 color=mix(color,vec3(.018,.009,.013),smoothstep(0.,16.,-vWorld.z)*.16);
 gl_FragColor=vec4(color,1.);
}`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program;
try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}
catch(e){fail('3D 화면을 준비하지 못했습니다: '+e.message);return;}
gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.clearColor(.035,.022,.027,1);
const loc={};for(const n of ['aPos','aNormal','aColor','aUV'])loc[n]=gl.getAttribLocation(program,n);
for(const n of ['uVP','uLightVP','uImage','uPaper','uAtlas','uActor','uWalk','uShadow','uShadowPass','uShadowEnabled','uShadowTexel','uPuppet','uSway','uDrift','uFloat'])loc[n]=gl.getUniformLocation(program,n);
loc.uPress=gl.getUniformLocation(program,'uPress');
loc.uHamster=gl.getUniformLocation(program,'uHamster');
loc.uHighlight=gl.getUniformLocation(program,'uHighlight');
loc.uAvatarMouth=gl.getUniformLocation(program,'uAvatarMouth');
const chromaStrength=document.querySelector('#chroma-strength');
const chromaThreshold=gl.getUniformLocation(program,'uChromaThreshold');
function updateChromaStrength(){
 gl.uniform1f(chromaThreshold,.28-.24*Number(chromaStrength.value)/100);
}
chromaStrength.addEventListener('input',updateChromaStrength);
updateChromaStrength();
const geometry=[],walkRoutes=[],backgroundLayers=[];
function movingLayer(pivot,kind,build){
 const first=geometry.length/11;build();
 backgroundLayers.push({first,count:geometry.length/11-first,pivot,kind});
}
const red=[.78,.10,.12],scarlet=[.92,.17,.16],darkRed=[.48,.045,.075],cream=[.96,.82,.61],ink=[.105,.045,.055];
const laceIvory=[1.,.90,.72];
function vert(p,n,c,uv=[0,0],out=geometry){out.push(...p,...n,...c,...uv);}
function quad(p,n,c,out=geometry,uv=[[0,0],[1,0],[1,1],[0,1]]){for(const i of [0,1,2,0,2,3])vert(p[i],n,c,uv[i],out);}
function box(x,y,z,w,h,d,color=red,angle=0){
 const co=Math.cos(angle),si=Math.sin(angle);
 const t=p=>[x+co*p[0]+si*p[2],y+p[1],z-si*p[0]+co*p[2]];
 const nt=n=>[co*n[0]+si*n[2],n[1],-si*n[0]+co*n[2]];
 const a=w/2,b=h/2,c=d/2;
 const faces=[[[[-a,-b,c],[a,-b,c],[a,b,c],[-a,b,c]],[0,0,1]],[[[a,-b,-c],[-a,-b,-c],[-a,b,-c],[a,b,-c]],[0,0,-1]],[[[-a,b,c],[a,b,c],[a,b,-c],[-a,b,-c]],[0,1,0]],[[[-a,-b,-c],[a,-b,-c],[a,-b,c],[-a,-b,c]],[0,-1,0]],[[[a,-b,c],[a,-b,-c],[a,b,-c],[a,b,c]],[1,0,0]],[[[-a,-b,-c],[-a,-b,c],[-a,b,c],[-a,b,-c]],[-1,0,0]]];
 for(const [p,n]of faces)quad(p.map(t),nt(n),color);
}
const landingSurfaces=[{x:0,y:.2675,z:.6,width:10.9,depth:6.8,angle:0}];
function stairs(x,y,z,dx,dz,count=12,rise=.28,width=1.65){
 const depth=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
 const path=[];
 for(let i=0;i<count;i++){
  const height=.23+(i+1)*rise;
  path.push([x+dx*i,y+height+.025,z+dz*i]);
  landingSurfaces.push({x:x+dx*i,y:y+height,z:z+dz*i,width,depth:depth+.025,angle});
  // Folded paper treads and risers, with open space beneath each flight.
  box(x+dx*i,y+height-.045,z+dz*i,width,.09,depth+.025,i%3===0?scarlet:red,angle);
  box(x+dx*i-dx*.48,y+height-rise*.5-.05,z+dz*i-dz*.48,width,rise+.04,.055,darkRed,angle);
  box(x+dx*i-dx*.47,y+height+.009,z+dz*i-dz*.47,width+.025,.022,.033,cream,angle);
  for(const side of [-1,1])box(x+dx*i+Math.cos(angle)*width*.49*side,y+height-.28,z+dz*i-Math.sin(angle)*width*.49*side,.035,.5,depth+.03,red,angle);
 }
 walkRoutes.push(path);
 return [x+dx*(count-1),y+.23+count*rise,z+dz*(count-1)];
}
// Each pasted shape is its own shallow layer, separated by real depth.
function flatShape(points,color,z,depth=.035){
 const center=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  for(const p of [center,a,b])vert([...p,z],[0,0,1],color);
  for(const p of [center,b,a])vert([...p,z-depth],[0,0,-1],cream);
  quad([[...a,z],[...b,z],[...b,z-depth],[...a,z-depth]],norm([b[1]-a[1],a[0]-b[0],0]),cream);
 }
}
function oval(x,y,z,rx,ry,color,turn=0){
 const p=[];for(let i=0;i<36;i++){const a=i/36*Math.PI*2,r=1+.013*Math.sin(i*7);const u=rx*Math.cos(a)*r,v=ry*Math.sin(a)*r;p.push([x+u*Math.cos(turn)-v*Math.sin(turn),y+u*Math.sin(turn)+v*Math.cos(turn)]);}flatShape(p,color,z,.025);
}
function ring(x,y,z,rx,ry,thickness,color,turn=0,scallop=0){
 const p=(a,r)=>{const u=rx*r*Math.cos(a),v=ry*r*Math.sin(a);return [x+u*Math.cos(turn)-v*Math.sin(turn),y+u*Math.sin(turn)+v*Math.cos(turn),z];};
 for(let i=0;i<64;i++){const a=i/64*Math.PI*2,b=(i+1)/64*Math.PI*2;
  quad([p(a,1+scallop*Math.cos(a*16)),p(b,1+scallop*Math.cos(b*16)),p(b,1-thickness),p(a,1-thickness)],[0,0,1],color);
 }
}
function lace(x,y,z,r,color=laceIvory){
 ring(x,y,z,r,r,.025,color,0,.045);ring(x,y,z,r*.75,r*.75,.045,color);
 ring(x,y,z,r*.3,r*.3,.08,color);
 for(let i=0;i<20;i++){
  const a=i/20*Math.PI*2;
  ring(x+Math.cos(a)*r*.58,y+Math.sin(a)*r*.58,z+.01,r*.29,r*.08,.15,color,a);
  ring(x+Math.cos(a)*r*.91,y+Math.sin(a)*r*.91,z+.015,r*.13,r*.065,.2,color,a);
 }
 for(let i=0;i<40;i++){
  const a=i/40*Math.PI*2;
  laceLoop(x+Math.cos(a)*r*1.055,y+Math.sin(a)*r*1.055,z+.02,r*.058,r*.042,a,r*.012);
 }
}
// Narrow flat threads form real cut-out lace, leaving the stage visible through the holes.
function laceThread(points,width=.018,color=laceIvory){
 width*=1.25;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
  const dx=-(b[1]-a[1])/length*width/2,dy=(b[0]-a[0])/length*width/2;
  quad([[a[0]+dx,a[1]+dy,a[2]],[b[0]+dx,b[1]+dy,b[2]],
   [b[0]-dx,b[1]-dy,b[2]],[a[0]-dx,a[1]-dy,a[2]]],[0,0,1],color);
 }
}
function laceLoop(x,y,z,rx,ry,angle=0,width=.018){
 const points=[],co=Math.cos(angle),si=Math.sin(angle);
 for(let i=0;i<=20;i++){
  const t=i/20*Math.PI*2,u=Math.cos(t)*rx,v=Math.sin(t)*ry;
  points.push([x+u*co-v*si,y+u*si+v*co,z]);
 }
 laceThread(points,width);
}
function laceFlower(x,y,z,r){
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;
  laceLoop(x+Math.cos(a)*r*.52,y+Math.sin(a)*r*.52,z,r*.48,r*.19,a,.026);
 }
 laceLoop(x,y,z+.02,r*.22,r*.22,0,.035);
 oval(x,y,z+.025,r*.11,r*.11,laceIvory);
}
function lacePendant(x,y,z,size){
 laceThread([[x,y,z],[x,y-size*.48,z]],.018);
 for(const side of [-1,1])laceLoop(x+side*size*.11,y-size*.54,z,size*.10,size*.23,side*.4,.018);
 laceLoop(x,y-size*.82,z,size*.10,size*.20,0,.022);
}
function laceSwag(x,y,z,width,drop){
 const at=(t,offset=0)=>[x+(t-.5)*width,y-Math.sin(t*Math.PI)*drop-offset,z];
 for(const offset of [0,.10,.28])laceThread(Array.from({length:49},(_,i)=>at(i/48,offset)),.023);
 const count=Math.max(12,Math.round(width*6));
 for(let i=0;i<count;i++){
  const t=i/count,u=(i+1)/count;
  laceThread([at(t),at((t+u)/2,.28),at(u)],.014);
  const p=at((t+u)/2,.33);
  laceLoop(...p,width/count*.48,.12,0,.018);
  if(i%4===2)lacePendant(p[0],p[1]-.12,z,.46);
 }
 for(const side of [-.5,.5])laceFlower(x+side*width,y+.02,z+.035,.27);
}
function tornCard(x,y,z,w,h,color,angle=0){
 const t=(u,v)=>[x+u*Math.cos(angle)-v*Math.sin(angle),y+u*Math.sin(angle)+v*Math.cos(angle),z];
 for(let i=0;i<20;i++){
  const a=-w/2+w*i/20,b=-w/2+w*(i+1)/20;
  const roughness=Math.min(.035,Math.min(w,h)*.035);
  const edge=k=>(Math.sin(k*9.14)+Math.sin(k*3.63)*.6)*roughness;
  quad([t(a,-h/2+edge(i)),t(b,-h/2+edge(i+1)),t(b,h/2+edge(i+24)),t(a,h/2+edge(i+23))],[0,0,1],color);
  const bottom=[t(a,-h/2+edge(i)),t(b,-h/2+edge(i+1))],top=[t(a,h/2+edge(i+23)),t(b,h/2+edge(i+24))];
  const back=p=>[p[0],p[1],p[2]-.055];
  quad([back(bottom[1]),back(bottom[0]),back(top[0]),back(top[1])],[0,0,-1],color);
  for(const pair of [bottom,top])quad([pair[0],pair[1],back(pair[1]),back(pair[0])],[0,pair===top?1:-1,0],cream);
 }
}
function arch(x,y,z,w,h,color=darkRed,lean=0,profile){
 const first=geometry.length/11;
 const outer=w/2,inner=outer*(profile?.innerRatio??.68);
 const capHeight=profile?.capHeight??outer,spring=h-capHeight;
 const t=(u,v,depth=0)=>[x+u+lean*v,y+v,z+depth];
 for(const side of [-1,1]){
  quad([t(side*inner,0),t(side*outer,0),t(side*outer,spring),t(side*inner,spring)],[0,0,1],color);
  quad([t(side*inner,0,-.24),t(side*outer,0,-.24),t(side*outer,spring,-.24),t(side*inner,spring,-.24)],[0,0,-1],color);
  for(const r of [inner,outer])quad([t(side*r,0),t(side*r,spring),t(side*r,spring,-.24),t(side*r,0,-.24)],[side*(r===inner?-1:1),0,0],cream);
 }
 for(let i=0;i<40;i++){
  const a=i/40*Math.PI,b=(i+1)/40*Math.PI;
  const at=(r,v,d=0)=>t(Math.cos(v)*r,spring+Math.sin(v)*r*capHeight/outer,d);
  quad([at(inner,a),at(outer,a),at(outer,b),at(inner,b)],[0,0,1],color);
  quad([at(inner,a,-.24),at(outer,a,-.24),at(outer,b,-.24),at(inner,b,-.24)],[0,0,-1],color);
  quad([at(outer,a),at(outer,b),at(outer,b,-.24),at(outer,a,-.24)],[Math.cos((a+b)/2),Math.sin((a+b)/2),0],cream);
  quad([at(outer,a,.018),at(outer+.035,a,.018),at(outer+.035,b,.018),at(outer,b,.018)],[0,0,1],cream);
  quad([at(inner,a,.018),at(inner+.025,a,.018),at(inner+.025,b,.018),at(inner,b,.018)],[0,0,1],cream);
  quad([at(inner,a),at(inner,b),at(inner,b,-.24),at(inner,a,-.24)],[-Math.cos((a+b)/2),-Math.sin((a+b)/2),0],cream);
 }
 for(const side of [-1,1])quad([t(side*inner,0,.018),t(side*inner+.025,0,.018),t(side*inner+.025,spring,.018),t(side*inner,spring,.018)],[0,0,1],cream);
 // The crown and its stitching sway with this same arch, never across the central opening.
 const crown=(a,offset=0)=>t(Math.cos(a)*(outer+offset),spring+Math.sin(a)*(capHeight+offset),.055);
 laceThread(Array.from({length:65},(_,i)=>crown(i/64*Math.PI,.08)),.032);
 const loops=profile?36:28;
 for(let i=0;i<=loops;i++){
  const a=i/loops*Math.PI,p=crown(a,.18);
  laceLoop(...p,.23,.14,a,.024);
  if(i%4===0)laceFlower(...crown(a,.40),.22);
 }
 if(!profile){
  const top=t(0,h,.08);
  for(const side of [-1,1]){
   const p=t(side*outer*.55,spring+capHeight*.7,.09);
   laceSwag(p[0],p[1],p[2],outer*.86,.55);
   const foot=t(side*(inner+outer)/2,.25,.08);
   laceSwag(foot[0],foot[1],foot[2],outer-inner+.15,.30);
  }
  laceFlower(...top,.42);
 }
 if(!profile)backgroundLayers.push({first,count:geometry.length/11-first,pivot:[x,y,z],kind:'arch'});
}
const webcamStage={bottom:.28,z:.65,width:11.3,height:6,innerRatio:.82,capHeight:1.65};
const stageHalfWidth=webcamStage.width*webcamStage.innerRatio/2;
const stageRise=webcamStage.capHeight*webcamStage.innerRatio;
const stageSpring=webcamStage.bottom+webcamStage.height-webcamStage.capHeight;
const stageOpeningHeight=stageSpring+stageRise-webcamStage.bottom;
function fillStageOpening(out,z,color,uv){
 const normal=[0,0,1];
 const lower=[[-stageHalfWidth,webcamStage.bottom,z],[stageHalfWidth,webcamStage.bottom,z],
  [stageHalfWidth,stageSpring,z],[-stageHalfWidth,stageSpring,z]];
 quad(lower,normal,color,out,lower.map(uv));
 const center=[0,stageSpring,z];
 for(let i=0;i<40;i++){
  const a=i*Math.PI/40,b=(i+1)*Math.PI/40;
  const left=[Math.cos(a)*stageHalfWidth,stageSpring+Math.sin(a)*stageRise,z];
  const right=[Math.cos(b)*stageHalfWidth,stageSpring+Math.sin(b)*stageRise,z];
  for(const point of [center,left,right])vert(point,normal,color,uv(point),out);
 }
}
function door(x,y,z,angle=0){
 tornCard(x+.13,y+1.5-.12,z-.09,2.2,3.5,ink,angle);
 tornCard(x,y+1.5,z,1.92,3.25,cream,angle);
 tornCard(x,y+1.5,z+.02,1.72,3.02,ink,angle);
 tornCard(x,y+1.5,z+.04,1.56,2.87,cream,angle);
 oval(x+.46,y+1.32,z+.09,.07,.08,ink);
 box(x-.61,y+1.5,z+.08,.014,2.78,.012,ink);
}
// Broken, leaning sheets behind the architecture: no enclosing solid room.
movingLayer([-8,13.7,-10.8],'paper',()=>tornCard(-8,5.2,-10.8,11,17,ink,-.12));
movingLayer([7.3,15,-12],'paper',()=>tornCard(7.3,6,-12,11,18,ink,.13));
arch(-8,-1,-8.8,10,16,darkRed,.12);arch(7,-1.5,-9.4,10,16,red,-.13);
arch(-.5,3.2,-12.3,10,15,darkRed,-.04);
arch(-10,-1.8,-2.7,8,13,red,-.10);arch(10,-2,-3.6,8,14,darkRed,.08);
arch(-12,-2,2.8,7,11,darkRed,.14);arch(12,-2,1.8,7,12,red,-.10);
for(const [x,y,z,r]of [[-8,11,-8,2.2],[6.8,11.5,-8,2.5],[.8,12.8,-10,2.1],[-12,6.7,-1.9,1.5],[11.3,5,-2.5,1.8],[-3.7,4,-6.8,1.65],[4,2,-5.2,1.7]])movingLayer([x,y,z],'lace',()=>lace(x,y,z,r));
box(0,.12,.6,10.8,.22,6.7,darkRed);
box(0,.25,.6,10.9,.035,6.8,red);
arch(0,webcamStage.bottom,webcamStage.z+.16,webcamStage.width,webcamStage.height,darkRed,0,webcamStage);
// Layered lace rosettes replace the solid paper fans around the scenery.
for(const [x,y,z,r] of [[-11,8,2.9,1.1],[11,8.5,1.9,1.1],[-5,11,-6,1.2],[5,12,-7,1.2],[0,16,-11,1.45],[-3,.10,4.08,.75],[0,.10,4.08,.95],[3,.10,4.08,.75]]){
 lace(x,y-r*.6,z,r);
 laceFlower(x,y,z+.04,r*.36);
 lacePendant(x,y-r*1.65,z,.75);
}
// Scalloped cream lace hung along the front of the stage.
for(let i=-6;i<=6;i++)lace(i*.82,.03,4.03,.53);
for(let i=-2;i<=2;i++){
 laceSwag(i*2.1,-.23,4.14,2.1,.65);
 laceSwag(i*2.1,-.65,4.10,2.1,.72);
}
stairs(-8.4,-1.1,5.2,.47,0,14,.17,1.5);
const left=stairs(-5.6,-.3,4.2,0,-.43,16,.29,2.0);
box(-5.6,left[1]-.06,-3.2,3,.12,2.8,red);door(-5.7,left[1],-3.9,-.10);
const right=stairs(5.7,-.3,4.3,0,-.46,14,.3,1.95);
box(5.7,right[1]-.06,-2.6,3,.12,2.8,darkRed);door(5.8,right[1],-3.5,.12);
stairs(-8.3,3.8,-5.4,.45,0,16,.28,1.7);
box(-1.4,8.42,-5.4,2.8,.14,2.8,red);door(-1.4,8.5,-6.3,-.08);
const upper=stairs(3.1,6.8,-7.6,.48,0,15,.25,1.5);
box(upper[0],upper[1]-.07,upper[2],2.7,.14,2.2,darkRed);door(upper[0],upper[1],-8.15,.12);
const farLeft=stairs(-10.0,4.0,-3.1,0,-.42,13,.28,1.6);
box(-10,farLeft[1]-.07,farLeft[2]-.2,2.6,.14,2.2,red);door(-10,farLeft[1],-8.5,-.1);
const farRight=stairs(8.7,2.4,2.2,0,-.45,15,.29,1.7);
box(8.7,farRight[1]-.07,farRight[2]-.2,2.6,.14,2.2,darkRed);door(8.7,farRight[1],-4.7,.15);
// Diagonal scraps weave in front of the rear stair flights.
movingLayer([-7,1.8,-1.8],'paper',()=>tornCard(-7,1.8,-1.8,6,.48,darkRed,-.24));
movingLayer([5.8,2.7,-1],'paper',()=>tornCard(5.8,2.7,-1.0,7,.36,red,.28));
movingLayer([-7.5,8.8,-6.1],'paper',()=>tornCard(-7.5,8.8,-6.1,7,.28,cream,-.18));
door(-9.5,-.5,.7,.18);door(9.7,-.5,.3,-.14);
walkRoutes.push(
 [[-4.1,.28,2.7],[-1.9,.28,3.1],[1.9,.28,3.1],[4.1,.28,2.5]],
 [[-3.8,.28,-1.7],[-4.2,.28,.2],[-2.3,.28,1.9]],
 [[2.4,.28,-1.6],[4.1,.28,-.4],[3.2,.28,1.7]]
);
const floaters=[
 {anchor:[-3.1,9.6,-3.4],scale:1.05,phase:.4},
 {anchor:[7.4,10.2,-2.1],scale:.70,phase:2.2},
 {anchor:[-8.3,7.0,5.0],scale:.67,phase:4.1},
 {anchor:[3.1,5.5,1.7],scale:.57,phase:5.7}
];
const routes=walkRoutes.map(points=>{
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(...points[i].map((n,j)=>n-points[i-1][j])));
 return {points,lengths,total:lengths[lengths.length-1]};
});
function routePosition(route,distance){
 const d=Math.max(0,Math.min(route.total,distance));let segment=1;
 while(segment<route.lengths.length-1&&route.lengths[segment]<d)segment++;
 const a=route.points[segment-1],b=route.points[segment];
 const t=(d-route.lengths[segment-1])/(route.lengths[segment]-route.lengths[segment-1]);
 // Rise at the tread edge so the feet follow the folded staircase.
 const lift=Math.max(0,Math.min(1,(t-.4)/.2)),step=lift*lift*(3-2*lift);
 return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*step,a[2]+(b[2]-a[2])*t];
}
const walkers=routes.map((route,index)=>{
 const distance=Math.random()*route.total;
 return {route,distance,target:distance<route.total*.5?route.total:0,speed:.45+Math.random()*.45,pause:0,phase:Math.random()*Math.PI*2,facing:1,moving:1,scale:index<7?.85+Math.random()*.13:1.05+Math.random()*.15,position:routePosition(route,distance)};
});
function updateWalkers(dt){
 for(const actor of walkers){
  actor.moving=0;
  if(actor.held||actor.queued)continue;
  if(actor.returning){
   const r=actor.returning;r.elapsed=Math.min(.65,r.elapsed+dt);const t=r.elapsed/.65,e=t*t*(3-2*t);
   actor.position=r.from.map((n,i)=>n+(r.to[i]-n)*e);
   if(t===1){actor.returning=null;actor.pause=.6;}
   continue;
  }
  if(actor.pause>0){actor.pause-=dt;continue;}
  const remaining=actor.target-actor.distance;
  if(Math.abs(remaining)<.015){
   actor.pause=.45+Math.random()*2.0;actor.target=Math.random()*actor.route.total;
   if(Math.abs(actor.target-actor.distance)<.75)actor.target=actor.distance<actor.route.total*.5?actor.route.total:0;
   actor.speed=.45+Math.random()*.45;continue;
  }
  const before=actor.position;
  actor.distance+=Math.sign(remaining)*Math.min(Math.abs(remaining),actor.speed*dt);
  actor.position=routePosition(actor.route,actor.distance);
  const dx=actor.position[0]-before[0];
  actor.facing=Math.abs(dx)>.00001?Math.sign(dx):Math.sign(remaining);
  actor.phase+=dt*actor.speed*13;actor.moving=1;
 }
}
function buffer(data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return {b,count:data.length/11};}
const world=buffer(geometry),figure=buffer([]);
let character=null,paperReady=false;
const avatarPose=characterTargets();let avatarTarget=characterTargets();
// Reuse the native renderer: true mesh geometry exported from the user's .blend.
Promise.all([fetch('theatre-character.bin').then(r=>{if(!r.ok)throw Error('mesh');return r.arrayBuffer();}),fetch('theatre-character.json').then(r=>{if(!r.ok)throw Error('metadata');return r.json();})]).then(([data,meta])=>{
 const vertices=new Float32Array(data);
 if(vertices.length!==meta.vertices*11||!vertices.every(Number.isFinite))throw Error('invalid mesh');
 character={mesh:buffer(vertices),meta};startShow.disabled=!paperReady;render();
}).catch(error=>{console.error(error);fail('캐릭터 모델을 불러오지 못했어요. 새로고침해 주세요.');});
function drawCharacter(){
 if(!character)return;
 gl.uniform1f(loc.uHighlight,0);
 const {position,scale}=characterPlacement;
 clearSway();gl.uniform1f(loc.uHamster,1);gl.uniform1f(loc.uPaper,0);gl.uniform1f(loc.uPress,0);gl.uniform3f(loc.uWalk,0,1,0);gl.uniform2f(loc.uFloat,0,0);
 gl.uniform1f(loc.uAvatarMouth,avatarPose.mouth);
 gl.uniform4f(loc.uActor,...position,scale);bind(character.mesh);
 for(const name of ['body','leftPaw','rightPaw','jaw','mouth']){
  const part=character.meta.groups[name];
  const offset=name==='leftPaw'?avatarPose.paws[0]:name==='rightPaw'?avatarPose.paws[1]:name==='jaw'?[0,-character.meta.jawTravel*avatarPose.mouth,0]:[0,0,0];
  gl.uniform3f(loc.uDrift,...offset);gl.drawArrays(gl.TRIANGLES,part.first,part.count);
 }
 clearSway();gl.uniform1f(loc.uAvatarMouth,0);gl.uniform1f(loc.uHamster,0);gl.uniform4f(loc.uActor,0,0,0,1);
}
let backgroundTime=0,lastShadowTime=-1;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
function layerPose(layer,index){
 const t=reducedMotion.matches?0:backgroundTime,phase=index*1.73;
 const wave=(speed,offset=0)=>Math.sin(t*speed+phase+offset)-Math.sin(phase+offset);
 return {angle:wave(.34+index%4*.035)*(layer.kind==='lace'?.055:layer.kind==='arch'?.005:.008),
  drift:layer.kind==='lace'?[0,wave(.43,.8)*.045,wave(.29,.4)*.035]:[0,0,0]};
}
function clearSway(){gl.uniform4f(loc.uSway,0,0,0,0);gl.uniform3f(loc.uDrift,0,0,0);}
const miniatureCenter=1.10;
const walkerScale=.68;
function floaterPose(actor){
 if(actor.queued)return {position:actor.position,angle:0};
 const t=reducedMotion.matches?0:backgroundTime,p=actor.phase;
 return {position:[actor.anchor[0]+Math.sin(t*.27+p)*.48,actor.anchor[1]+Math.sin(t*.63+p)*.36,actor.anchor[2]+Math.cos(t*.32+p)*.38],
  angle:Math.sin(t*.46+p)*.10};
}
function drawFloaters(){
 if(roundOver||!character)return;
 const part=character.meta.groups.miniature;
 gl.uniform1f(loc.uPaper,0);gl.uniform1f(loc.uHamster,1);gl.uniform3f(loc.uWalk,0,1,0);bind(character.mesh);
 for(const actor of floaters){
  const pose=actor.held?{position:actor.position,angle:0}:floaterPose(actor);
  const highlight=actor===hoveredActor||actor===pendingGrab?.actor;
  gl.uniform1f(loc.uHighlight,highlight?1:0);
  const scale=actor.scale*1.35*(highlight?1.15:1)*(actor===practice&&bite?bite.scale:1);
  const [x,y,z]=pose.position;
  gl.uniform4f(loc.uActor,x,y-miniatureCenter*scale,z,scale);
  gl.uniform1f(loc.uPress,actor===touchedActor?touchPress():0);
  gl.uniform4f(loc.uSway,0,miniatureCenter,0,pose.angle);gl.uniform3f(loc.uDrift,0,0,0);gl.uniform2f(loc.uFloat,0,0);
  gl.drawArrays(gl.TRIANGLES,part.first,part.count);
 }
 gl.uniform1f(loc.uHighlight,0);gl.uniform1f(loc.uPress,0);clearSway();gl.uniform2f(loc.uFloat,0,0);gl.uniform4f(loc.uActor,0,0,0,1);gl.uniform1f(loc.uHamster,0);
}
function drawWorld(){
 bind(world);let first=0;
 for(let i=0;i<backgroundLayers.length;i++){
  const layer=backgroundLayers[i],pose=layerPose(layer,i);
  clearSway();if(layer.first>first)gl.drawArrays(gl.TRIANGLES,first,layer.first-first);
  gl.uniform4f(loc.uSway,...layer.pivot,pose.angle);gl.uniform3f(loc.uDrift,...pose.drift);
  gl.drawArrays(gl.TRIANGLES,layer.first,layer.count);first=layer.first+layer.count;
 }
 clearSway();if(first<world.count)gl.drawArrays(gl.TRIANGLES,first,world.count-first);
}
const contactVertices=[];
quad([[-1,0,1],[1,0,1],[1,0,-1],[-1,0,-1]],[0,1,0],[0,0,0],contactVertices);
const contact=buffer(contactVertices);
function bind(mesh){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.b);for(const [name,size,offset]of [['aPos',3,0],['aNormal',3,3],['aColor',3,6],['aUV',2,9]]){gl.enableVertexAttribArray(loc[name]);gl.vertexAttribPointer(loc[name],size,gl.FLOAT,false,44,offset*4);}}
const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
const atlas=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,atlas);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([155,39,24,255]));
gl.uniform1i(loc.uAtlas,1);gl.uniform1i(loc.uImage,0);
// Refresh the moving paper shadows at 15 Hz while rendering motion every frame.
const shadowSize=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE));
const shadowTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,shadowSize,shadowSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const shadowFrame=gl.createFramebuffer(),shadowDepth=gl.createRenderbuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFrame);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadowTexture,0);
gl.bindRenderbuffer(gl.RENDERBUFFER,shadowDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);
gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,shadowDepth);
const shadowAvailable=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
gl.bindFramebuffer(gl.FRAMEBUFFER,null);
gl.uniform1i(loc.uShadow,2);gl.uniform1f(loc.uShadowTexel,1/shadowSize);gl.uniform1f(loc.uShadowEnabled,shadowAvailable?1:0);
let shadowDirty=true;
const paper=new Image();
paper.onload=()=>{
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,atlas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,paper);
 if((paper.width&(paper.width-1))===0&&(paper.height&(paper.height-1))===0){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
 render();
 paperReady=true;startShow.disabled=!character;
};
paper.onerror=()=>fail('종이 무늬를 불러오지 못했어요. 새로고침해 주세요.');paper.src='collage-paper.png';
let imageReady=false,cameraStream=null,cameraRequest=0,lastVideoTime=-1,videoAspect=0,videoPlacement;
const video=document.querySelector('#camera-preview');video.muted=true;video.autoplay=true;video.playsInline=true;
const monitorStart=document.querySelector('#monitor-start'),monitorStop=document.querySelector('#monitor-stop'),monitorState=document.querySelector('#monitor-state'),monitorHint=document.querySelector('#monitor-hint');
const trackingOverlay=document.querySelector('#tracking-overlay'),trackingCtx=trackingOverlay.getContext('2d');
const previewEmpty=document.querySelector('#preview-empty'),mouthMeter=document.querySelector('#mouth-meter');
function updateMonitor(hands=[],mouth=null){
 const w=trackingOverlay.width,h=trackingOverlay.height;
 trackingCtx.clearRect(0,0,w,h);
 const waiting=!cameraStream?'대기':!handMode?'연결 전':!handReady?'준비 중':'안 보임';
 const signal=(id,text,state='')=>{const el=document.querySelector(id);el.querySelector('strong').textContent=text;el.dataset.state=state;};
 signal('#signal-left',waiting);signal('#signal-right',waiting);signal('#signal-mouth',waiting);mouthMeter.value=0;
 // Match object-fit:contain so landmarks stay aligned for 4:3 and 16:9 cameras.
 const aspect=videoAspect||16/9,vw=Math.min(w,h*aspect),vh=vw/aspect,ox=(w-vw)/2,oy=(h-vh)/2;
 const xy=p=>[ox+(1-p.x)*vw,oy+p.y*vh];
 const chains=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];
 for(const points of hands||[]){
  const sample=handSample(points,aspect);if(!sample)continue;
  const left=sample.x>.5;
  signal(left?'#signal-left':'#signal-right',sample.ratio<.30?'집기 모양':'인식됨',sample.ratio<.30?'active':'seen');
  trackingCtx.strokeStyle=left?'#a9c4db':'#efa585';trackingCtx.fillStyle=trackingCtx.strokeStyle;trackingCtx.lineWidth=2;
  for(const chain of chains){trackingCtx.beginPath();chain.forEach((index,i)=>{const p=xy(points[index]);i?trackingCtx.lineTo(...p):trackingCtx.moveTo(...p);});trackingCtx.stroke();}
  for(const point of points){trackingCtx.beginPath();trackingCtx.arc(...xy(point),2.4,0,Math.PI*2);trackingCtx.fill();}
 }
 const sample=mouthSample(mouth,aspect);
 if(sample){
  signal('#signal-mouth',sample.open?'열림 ✓':'닫힘 · 인식됨',sample.open?'active':'seen');mouthMeter.value=sample.ratio;
  const center=xy(sample),a=xy(mouth[2]),b=xy(mouth[3]);trackingCtx.strokeStyle=sample.open?'#ffe197':'#a5eed3';trackingCtx.lineWidth=2;
  trackingCtx.beginPath();trackingCtx.ellipse(...center,Math.max(5,Math.hypot(a[0]-b[0],a[1]-b[1])*.65),Math.max(4,sample.ratio*vw*.06),0,0,Math.PI*2);trackingCtx.stroke();
 }else if(handReady&&!faceReady)signal('#signal-mouth','준비 실패');
 monitorState.textContent=!cameraStream?'카메라 꺼짐':!handMode?'내 모습 확인 중':!handReady?'인식 준비 중…':'움직임 연결됨';
 monitorHint.textContent=!cameraStream?'카메라를 켜고 손과 입을 확인해 보세요.':!handMode?'내 모습이 보이면 ‘움직임 연결’을 눌러 주세요.':!handReady?'손과 얼굴 인식을 준비하고 있어요.':!hands?.length?'얼굴 양옆으로 손을 들어 주세요.':!sample?'얼굴 전체가 보이도록 앉아 주세요.':'작게 움직여도 넓게 따라와요 · 입을 벌려 노란 표시를 확인하세요.';
 monitorStart.textContent=!cameraStream?'카메라 켜기':!handMode?'움직임 연결':'연결 중';
 monitorStart.disabled=handMode;monitorStop.hidden=!cameraStream;previewEmpty.hidden=!!cameraStream;
}
const cameraOn=document.querySelector('#camera-on'),cameraOff=document.querySelector('#camera-off'),cameraStatus=document.querySelector('#camera-status');
const handOn=document.querySelector('#hand-on'),handOff=document.querySelector('#hand-off'),handStatus=document.querySelector('#hand-status');
const handCursor=document.querySelector('#hand-cursor'),grabTarget=document.querySelector('#grab-target');
const gesture=new PinchGrab();
const faceStatus=document.querySelector('#face-status'),mouthCursor=document.querySelector('#mouth-cursor');
const grabbableActors=[...walkers,...floaters];
let practice=null,hoveredActor=null,touchedActor=null;
const actorCenterHeight=actor=>actor.route?actor.scale*walkerScale*miniatureCenter:0;
function actorScreenPoint(actor){
 const position=actor.route||actor.held?actor.position:floaterPose(actor).position;
 return projectPoint([position[0],position[1]+actorCenterHeight(actor),position[2]],currentVP,innerWidth,innerHeight);
}
let handMode=false,handWorker=null,handReady=false,handBusy=false,handTimer=null,lastHandFrame=-1,lastHandSubmit=0,lastHandResult=0,handPoint=null,currentVP=null,cameraEye=null,savedView=null;
let faceReady=false,bite=null,biteNoticeUntil=0;
let touchingPractice=false,touchTime=-Infinity;
let flight=null;
let eatScore=0,pendingGrab=null,latestHand=null,latestMouth=null,lastSeenHand=-Infinity;
const combo=new EatCombo(),comboDisplay=document.querySelector('#combo-count');
const eatingWindow=new EatingWindow(),eatModeDisplay=document.querySelector('#eat-mode');
const scoreDisplay=document.querySelector('#throw-score');
const timeDisplay=document.querySelector('#round-time');
const roundLength=60000;
let roundDeadline=null,roundOver=false;
let caughtCount=0;
function updateRoundClock(now){
 comboDisplay.hidden=!combo.active(now)||roundOver;
 if(roundDeadline===null||roundOver)return;
 const remaining=Math.max(0,Math.ceil((roundDeadline-now)/1000));
 const label=remaining+'초';
 if(timeDisplay.textContent!==label)timeDisplay.textContent=label;
 if(now<roundDeadline&&caughtCount<10)return;
 roundOver=true;
 if(caughtCount>=10){
  const root=document.documentElement;
  root.classList.add('finale');
  setTimeout(()=>root.classList.remove('curtain-opening'),reducedMotion.matches?0:1400);
 }
 savedView=null;
 stopCamera();
 timeDisplay.hidden=true;
 scoreDisplay.textContent='최종 점수 '+eatScore+'점';
 document.documentElement.classList.add('round-over');
}
function touchPress(){
 const age=(performance.now()-touchTime)/210;
 return age<1&&!reducedMotion.matches?.16*Math.sin(Math.PI*age):0;
}
function scatterPaper(position,strength,kind='land'){
 const point=projectPoint(position,currentVP,innerWidth,innerHeight);
 if(!point||reducedMotion.matches)return;
 const chewing=kind==='bite';
 for(let i=0;i<(chewing?14:7);i++){
  const scrap=document.createElement('span');
  scrap.className='landing-scrap';
  scrap.style.cssText=`position:fixed;pointer-events:none;z-index:2;left:${point[0]}px;top:${point[1]}px;width:5px;height:3px;background:${i%2?'#ffd395':'#df664b'}`;
  if(chewing){
   scrap.style.width=(5+Math.random()*10)+'px';scrap.style.height=(4+Math.random()*8)+'px';
   scrap.style.background=['#9e0926','#e32b3e','#26070e','#ffe4bc'][i%4];
   scrap.style.clipPath='polygon(0 0,44% 18%,100% 0,72% 54%,100% 100%,36% 75%,0 100%,18% 41%)';
  }
  scrap.setAttribute('aria-hidden','true');
  document.body.append(scrap);
  const x=(i-(chewing?6.5:3))*(5+strength*4),y=8+Math.random()*(chewing?32:13);
  const motion=scrap.animate([
   {transform:'translate(0,0)',opacity:1},
   {transform:`translate(${x*.55}px,${-y}px) rotate(${x*6}deg)`,opacity:1,offset:.45},
   {transform:`translate(${x}px,${chewing?48:9}px) rotate(${x*12}deg)`,opacity:0}
  ],{duration:chewing?560:380});
  motion.onfinish=()=>scrap.remove();
 }
}
function updateFlight(dt){
 if(!flight)return;
 const [x,y,z]=practice.position;
 flight.vy-=18*dt;
 const nextX=x+flight.vx*dt,nextY=y+flight.vy*dt;
 const footOffset=practice.route?0:3.1*practice.scale;
 let floor=-Infinity;
 if(flight.vy<0){
  for(const surface of landingSurfaces){
   const landingY=surface.y+footOffset;
   if(y<landingY||nextY>landingY)continue;
   const co=Math.cos(surface.angle),si=Math.sin(surface.angle);
   const crossingX=x+(nextX-x)*(y-landingY)/(y-nextY);
   const dx=crossingX-surface.x,dz=z-surface.z;
   if(Math.abs(co*dx-si*dz)<=surface.width/2&&Math.abs(si*dx+co*dz)<=surface.depth/2){
    floor=Math.max(floor,landingY);
   }
  }
 }
 practice.position=[nextX,nextY,z];
 if(Number.isFinite(floor)){
  practice.position[1]=floor;
  if(!flight.bounced){
   const strength=Math.min(1,Math.hypot(flight.vx,flight.vy)/11);
   scatterPaper([nextX,floor-footOffset,z],strength);
   playStageSound('land',strength);
   flight.bounced=true;
   flight.vy=Math.max(1.15,Math.min(2.6,-flight.vy*.27));
   flight.vx*=.22;
   return;
  }
  handStatus.textContent='착지했어요! 친구가 발판으로 돌아갑니다.';
 }else if(nextY>-3&&Math.abs(nextX)<16)return;
 flight=null;
 returnPractice();
 biteNoticeUntil=performance.now()+850;
}
function returnPractice(){
 if(!practice?.held)return;practice.held=false;
 if(!practice.route)return;
 const route=practice.route;let best=Infinity,bestDistance=0;
 for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[2]-a[2];
  const t=Math.max(0,Math.min(1,((practice.position[0]-a[0])*dx+(practice.position[2]-a[2])*dz)/(dx*dx+dz*dz||1)));
  const d=(practice.position[0]-a[0]-dx*t)**2+(practice.position[2]-a[2]-dz*t)**2;
  if(d<best){best=d;bestDistance=route.lengths[i-1]+t*(route.lengths[i]-route.lengths[i-1]);}
 }
 practice.distance=bestDistance;practice.target=bestDistance<route.total/2?route.total:0;
 practice.returning={from:[...practice.position],to:routePosition(route,bestDistance),elapsed:0};
}
function stopHandInteraction(message='손 조작을 마쳤어요.'){
 avatarTarget=characterTargets();
 returnPractice();gesture.reset();handMode=false;handReady=false;handBusy=false;handPoint=null;
 faceReady=false;bite=null;biteNoticeUntil=0;
 if(pendingGrab)pendingGrab.actor.queued=false;
 pendingGrab=null;latestHand=null;latestMouth=null;lastSeenHand=-Infinity;
 eatingWindow.reset();eatModeDisplay.hidden=true;
 mouthCursor.hidden=true;faceStatus.textContent='입 인식 대기 중';
 touchingPractice=false;touchTime=-Infinity;hoveredActor=null;touchedActor=null;
 flight=null;
 clearTimeout(handTimer);if(handWorker)handWorker.terminate();handWorker=null;
 handCursor.hidden=true;grabTarget.hidden=true;handOn.hidden=false;handOn.disabled=!imageReady;handOff.hidden=true;handStatus.textContent=message;
 for(const id of ['#home','#in','#out'])document.querySelector(id).disabled=false;
 if(savedView){[yaw,pitch,distance]=savedView;savedView=null;}
 updateMonitor();
 if(cameraStream)monitorHint.textContent=message;
}
function receiveHand(points,time,mouth,hands){
 const now=performance.now();lastHandResult=now;
 avatarTarget=characterTargets((hands||(points?[points]:[])).map(p=>handSample(p,videoAspect)),mouthSample(mouth,videoAspect));
 updateMonitor(hands||(points?[points]:[]),mouth);
 updateRoundClock(now);
 if(roundOver)return;
 const sample=comfortableHandSample(handSample(points,videoAspect));
 latestMouth=mouth;
 eatingWindow.update(mouthSample(mouth,videoAspect),now);
 if(sample){latestHand=sample;lastSeenHand=now;}
 else if(now-lastSeenHand>850)latestHand=null;
 let near=false;
 const previousTarget=hoveredActor;hoveredActor=null;
 if(sample&&currentVP&&videoAspect){
  const point=videoToWorld(sample,videoAspect,videoPlacement);
  handPoint=handPoint?handPoint.map((v,i)=>v+(point[i]-v)*.75):point;
  const cursor=projectPoint(handPoint,currentVP,innerWidth,innerHeight);
  if(cursor&&(!practice?.held||bite)&&!pendingGrab){
   const radius=Math.max(80,Math.min(140,innerHeight*.12));
   const candidates=grabbableActors.filter(actor=>!actor.held&&!actor.queued&&!actor.returning&&now>=(actor.grabAfter||0));
   hoveredActor=nearestGrabTarget(cursor,candidates,actorScreenPoint,radius,previousTarget);
  }
  near=!!hoveredActor;
 }else if(!latestHand){handPoint=null;}
 const touching=near&&(!practice?.held||bite);
 if(touching&&(!touchingPractice||touchedActor!==hoveredActor)&&now-touchTime>250){
  touchedActor=hoveredActor;
  touchTime=now;
  playStageSound('pop');
 }
 touchingPractice=touching;
 if(bite){
  if(!pendingGrab&&gesture.update(sample,near,time)==='grab'){
   const actor=hoveredActor;
   if(!actor.route)actor.position=floaterPose(actor).position;
   actor.queued=true;pendingGrab={actor,hand:{...sample}};
   gesture.held=false;handStatus.textContent='다음 친구 잡기 예약!';
  }
  return;
 }
 const action=gesture.update(sample,near,time);
 if(action==='grab')grabActor(hoveredActor);
 if(action==='release'){
  if(sample){
   flight={vx:0,vy:0,bounced:false};
   handStatus.textContent='내려놓았어요.';
  }else{
   returnPractice();
   handStatus.textContent='손이 보이지 않아 친구를 발판으로 돌려보냈어요.';
  }
 }
 if(!practice?.held&&action!=='release'&&now>=biteNoticeUntil)handStatus.textContent=sample?(near?'엄지와 검지를 오므려 친구를 집어 보세요.':'손끝의 원을 아무 친구에게 가져가세요.'):'손바닥과 손가락이 카메라에 보이게 들어 주세요.';
 handCursor.className=practice?.held?'holding':near?'ready':'';
 checkBite(mouth,latestHand);
}
function grabActor(actor){
 practice=actor;
 if(!actor.route)actor.position=floaterPose(actor).position;
 actor.held=true;actor.queued=false;actor.moving=0;actor.facing=1;
 // Snap the selected friend into the hand instead of chasing a moving target.
 if(handPoint&&cameraEye){
  const z=characterMouthWorld[2]+.35,t=(z-cameraEye[2])/(handPoint[2]-cameraEye[2]);
  actor.position=handPoint.map((v,i)=>cameraEye[i]+(v-cameraEye[i])*t);
  actor.position[1]-=actorCenterHeight(actor);
 }
 handStatus.textContent='잡았어요! 입을 한 번 크게 벌리고 쥔 손으로 훑어 보세요.';
}
function respawnNearHand(actor){
 actor.held=false;actor.returning=null;actor.grabAfter=performance.now()+220;
 const hand=handPoint||[-2,3,2];
 if(!actor.route){
  actor.anchor=[(hand[0]<0?-1:1)*(2.8+combo.count%2*.6),Math.max(2.2,Math.min(5.2,hand[1])),3];
  return;
 }
 const cursor=projectPoint(hand,currentVP,innerWidth,innerHeight);
 let best=Infinity;
 // Reappear on a real tread near the hand, so walking and landing still line up.
 for(const route of routes.slice(-2))for(let i=0;i<=16;i++){
  const distance=route.total*i/16,position=routePosition(route,distance);
  const p=projectPoint([position[0],position[1]+actorCenterHeight(actor),position[2]],currentVP,innerWidth,innerHeight);
  if(!p||p[0]<innerWidth*.15||p[0]>innerWidth*.85||p[1]<innerHeight*.18||p[1]>innerHeight*.85)continue;
  const score=Math.hypot(p[0]-(cursor?.[0]??innerWidth*.4),p[1]-(cursor?.[1]??innerHeight*.6));
  if(score<best){best=score;actor.route=route;actor.distance=distance;actor.position=position;}
 }
 if(!Number.isFinite(best)){actor.route=routes[routes.length-1];actor.distance=actor.route.total*.5;actor.position=routePosition(actor.route,actor.distance);}
 actor.target=actor.distance<actor.route.total*.5?actor.route.total:0;actor.pause=.22;
}
function showEatPoints(points){
 const p=projectPoint(characterMouthWorld,currentVP,innerWidth,innerHeight);if(!p)return;
 const label=document.createElement('span');label.className='eat-points';label.textContent='+'+points;
 label.style.left=p[0]+'px';label.style.top=(p[1]-35)+'px';document.body.append(label);
 const motion=label.animate([{transform:'translate(-50%,0) scale(.85)',opacity:1},{transform:'translate(-50%,-55px) scale(1.15)',opacity:0}],{duration:500});
 motion.onfinish=()=>label.remove();
}
function checkBite(mouth,hand){
 const active=eatingWindow.active(performance.now()),sample=mouthSample(mouth,videoAspect);
 mouthCursor.hidden=true;
 faceStatus.textContent=active?'먹기 모드 · 쥔 손으로 인형을 쓸어 담으세요.':!faceReady?'입 인식을 준비하지 못했어요. 캐릭터 움직이기를 다시 눌러 주세요.':!sample?'얼굴이 카메라에 보이도록 해 주세요.':'입을 한 번 크게 벌리면 2초간 자동으로 먹어요.';
 if(!currentVP)return;
 const screen=projectPoint(characterMouthWorld,currentVP,innerWidth,innerHeight);
 if(screen){
  mouthCursor.hidden=false;mouthCursor.classList.toggle('open',active);
  mouthCursor.style.left=screen[0]+'px';mouthCursor.style.top=screen[1]+'px';
  mouthCursor.style.width=mouthCursor.style.height='64px';
 }
 if(!active||!practice?.held||!gesture.held||!hand||flight||bite)return;
 const target=[...characterMouthWorld],height=actorCenterHeight(practice);
 const start=[practice.position[0],practice.position[1]+height,practice.position[2]];
 const side=hand.x>.5?0:1,sign=side===0?-1:1;
 // Move the grabbing hand to the character's mouth while keeping the other hand live.
 const pawTarget=[sign*.18-sign*1.395,.79-.70,.67-.30+.13];
 bite={start,target,height,side,pawStart:[...avatarPose.paws[side]],pawTarget,time:performance.now(),scale:1,crunch:-1};
 gesture.held=false;
 handStatus.textContent='와작! 손이 입으로 이동해 친구를 먹어요.';
}
function gatherFriends(){
 // Keep walking friends on the two existing front-stage paths, within a small reach.
 walkers.forEach((actor,i)=>{
  actor.route=routes[routes.length-2+i%2];
  actor.distance=(Math.floor(i/2)+.5)/5*actor.route.total;
  actor.position=routePosition(actor.route,actor.distance);actor.target=actor.route.total;
  actor.returning=null;actor.held=false;actor.queued=false;actor.pause=0;actor.grabAfter=0;
 });
 floaters.forEach((actor,i)=>{actor.anchor=[i%2?-3.4:3.4,2.8+Math.floor(i/2)*1.8,3];actor.held=false;actor.queued=false;actor.grabAfter=0;});
}
handOn.onclick=()=>{
 if(!imageReady){handStatus.textContent='먼저 카메라 영상을 켜 주세요.';return;}
 handMode=true;gesture.reset();eatingWindow.reset();gatherFriends();savedView=[yaw,pitch,distance];yaw=0;pitch=0;distance=26;drag=null;
 for(const id of ['#home','#in','#out'])document.querySelector(id).disabled=true;
 handOn.hidden=true;handOff.hidden=false;handStatus.textContent='손과 얼굴 인식을 준비하고 있어요…';faceStatus.textContent='입 인식 준비 중…';lastHandResult=performance.now();lastHandFrame=-1;lastHandSubmit=0;
 const worker=new Worker('./hand-worker.mjs',{type:'module'});handWorker=worker;
 const failHand=()=>{if(handWorker===worker)stopHandInteraction('손 인식을 준비하지 못했어요. 캐릭터 움직이기를 다시 눌러 주세요.');};
 handTimer=setTimeout(failHand,30000);worker.onerror=failHand;
 worker.onmessage=({data})=>{
  if(handWorker!==worker)return;
  if(data.type==='ready'){
   clearTimeout(handTimer);handReady=true;faceReady=data.faceReady;
   if(roundDeadline===null){
    roundDeadline=performance.now()+roundLength;
    setTimeout(()=>updateRoundClock(performance.now()),roundLength);
   }
   handStatus.textContent=faceReady?'손을 들고 입을 벌려 보세요. 캐릭터가 따라 해요. 입을 한 번 크게 벌리고 쥔 손으로 좌우를 훑으면 연속으로 먹어요.':'입 인식은 준비되지 않았어요. 작은 손 움직임과 손으로 집기는 할 수 있어요.';
  }
  else if(data.type==='hand'){handBusy=false;receiveHand(data.points,data.time,data.mouth,data.hands);}
  else if(data.type==='error')failHand();
 };
 worker.postMessage({type:'init',face:true});
 updateMonitor();
};
handOff.onclick=()=>stopHandInteraction();
async function submitHandFrame(now){
 if(!handMode||!handReady||handBusy||!cameraStream||video.readyState<2||now-lastHandSubmit<33||video.currentTime===lastHandFrame)return;
 handBusy=true;lastHandSubmit=now;lastHandFrame=video.currentTime;const worker=handWorker;
 try{
  const image=await createImageBitmap(video,{resizeWidth:640,resizeHeight:Math.max(1,Math.round(640/videoAspect))});
  if(handWorker!==worker){image.close();return;}
  worker.postMessage({type:'frame',image,time:now,trackMouth:faceReady},[image]);
 }catch(error){if(handWorker===worker)stopHandInteraction('손 영상을 읽지 못했어요. 캐릭터 움직이기를 다시 눌러 주세요.');}
}
function updateHandOverlay(){
 if(!handMode)return;
 const feeding=eatingWindow.active(performance.now());
 eatModeDisplay.hidden=false;eatModeDisplay.dataset.active=String(feeding);
 eatModeDisplay.textContent=feeding?'먹기 모드 '+Math.ceil((eatingWindow.until-performance.now())/100)/10+'초 · 쥔 손으로 훑으세요':'입을 한 번 크게 벌리세요 · 2초 먹기 모드';
 if(handReady&&performance.now()-lastHandResult>850)receiveHand(null,performance.now());
 if(bite){
  const motion=feedingMotion(performance.now()-bite.time);
  bite.scale=motion.scale;
  practice.position=bite.start.map((value,i)=>value+(bite.target[i]-value)*motion.travel);
  practice.position[1]-=bite.height*bite.scale;
  avatarPose.paws[bite.side]=bite.pawStart.map((v,i)=>v+(bite.pawTarget[i]-v)*motion.travel);
  avatarPose.mouth=motion.jaw;
  if(motion.crunch>bite.crunch){
   bite.crunch=motion.crunch;
   playStageSound('bite');scatterPaper(bite.target,.8,'bite');
  }
  if(motion.done){
   const now=performance.now(),points=combo.hit(now);
   eatScore+=points;scoreDisplay.textContent='점수 '+eatScore;
   if(++caughtCount===10){
    updateRoundClock(now);
    return;
   }
   comboDisplay.textContent=combo.count+' COMBO';comboDisplay.hidden=!combo.active(now);
   showEatPoints(points);
   bite=null;respawnNearHand(practice);practice=null;
   handStatus.textContent='꿀꺽! +'+points+'점';biteNoticeUntil=now+450;
   const queued=pendingGrab;pendingGrab=null;
   if(queued){
    queued.actor.queued=false;
    if(latestHand&&now-lastSeenHand<=850){
     grabActor(queued.actor);gesture.held=true;gesture.lastSeen=now;
     checkBite(latestMouth,queued.hand);
    }else gesture.reset();
   }

  }
 }else if(practice?.held&&!flight&&handPoint&&cameraEye){
  // Intersect the visible fingertip ray with a plane just in front of the person.
  const z=characterMouthWorld[2]+.35,t=(z-cameraEye[2])/(handPoint[2]-cameraEye[2]);
  const held=[cameraEye[0]+(handPoint[0]-cameraEye[0])*t,cameraEye[1]+(handPoint[1]-cameraEye[1])*t-actorCenterHeight(practice),z];
  practice.position=practice.position.map((v,i)=>v+(held[i]-v)*.7);
 }
 const cursor=handPoint&&projectPoint(handPoint,currentVP,innerWidth,innerHeight);
 handCursor.hidden=!cursor;if(cursor){handCursor.style.left=cursor[0]+'px';handCursor.style.top=cursor[1]+'px';}
 const selected=pendingGrab?.actor||hoveredActor;
 const target=selected&&(!practice?.held||bite)&&actorScreenPoint(selected);
 grabTarget.hidden=!target;
 if(target){grabTarget.dataset.label=pendingGrab?'다음 차례':'잡을 친구';grabTarget.style.left=target[0]+'px';grabTarget.style.top=target[1]+'px';}
}
status.textContent='산책하는 친구 10 · 떠다니는 친구 4 · 드래그로 회전';
function stopCamera(message='카메라를 껐어요. 다시 켜서 이어갈 수 있습니다.'){
 cameraRequest++;const stream=cameraStream;cameraStream=null;imageReady=false;
 if(stream)stream.getTracks().forEach(track=>track.stop());
 video.pause();video.srcObject=null;lastVideoTime=-1;videoAspect=0;shadowDirty=true;
 stopHandInteraction('카메라를 켠 뒤 캐릭터 움직이기를 눌러 주세요.');
 cameraOn.disabled=false;cameraOn.hidden=false;cameraOn.textContent='카메라 켜기';cameraOff.hidden=true;cameraStatus.textContent=message;
 monitorHint.textContent=message;
}
cameraOn.onclick=async()=>{
 if(!navigator.mediaDevices?.getUserMedia){cameraStatus.textContent=monitorHint.textContent='Chrome에서 http://127.0.0.1:4322 로 열어 주세요.';return;}
 const request=++cameraRequest;cameraOn.disabled=true;cameraOn.textContent='권한 확인 중…';cameraOff.hidden=false;cameraOff.textContent='취소';
 cameraStatus.textContent='Chrome의 카메라 권한 창에서 허용을 눌러 주세요.';
 monitorState.textContent='카메라 연결 중…';monitorStart.disabled=true;monitorHint.textContent='권한 창이 나오면 직접 허용해 주세요.';
 try{
  let stream;
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30},facingMode:'user'}});
  }catch(error){
   if(request!==cameraRequest)return;
   if(error.name!=='NotReadableError'&&error.name!=='OverconstrainedError')throw error;
   cameraStatus.textContent='기본 카메라 설정으로 다시 연결하고 있어요.';
   stream=await navigator.mediaDevices.getUserMedia({audio:false,video:true});
  }
  if(request!==cameraRequest){stream.getTracks().forEach(track=>track.stop());return;}
  cameraStream=stream;video.srcObject=stream;
  stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(cameraStream===stream)stopCamera('카메라 연결이 끊겼어요. 다시 켜 주세요.');}));
  await video.play();if(request!==cameraRequest)return;
  cameraOn.hidden=true;cameraOn.disabled=false;cameraOff.textContent='카메라 끄기';
  cameraStatus.textContent='카메라 연결됨 · 아래 확인창에서 내 모습과 손·입 인식을 확인하세요.';
  updateMonitor();
 }catch(error){
  if(request!==cameraRequest)return;
  console.warn('Webcam setup failed:',error.name,error.message);
  const messages={NotAllowedError:'카메라 권한이 필요해요. Chrome 주소창의 카메라 설정에서 허용한 뒤 다시 켜 주세요.',NotFoundError:'연결된 웹캠을 찾지 못했어요. 웹캠 연결을 확인해 주세요.',NotReadableError:'Chrome이 웹캠을 열지 못했어요. 카메라를 쓰는 다른 앱이나 탭을 닫고 다시 켜 주세요.'};
  stopCamera(messages[error.name]||'카메라를 시작하지 못했어요. 연결을 확인하고 다시 켜 주세요.');
 }
};
cameraOff.onclick=()=>stopCamera();window.addEventListener('pagehide',()=>stopCamera());
monitorStart.onclick=()=>{if(!cameraStream)cameraOn.click();else if(imageReady&&!handMode)handOn.click();};
monitorStop.onclick=()=>stopCamera();
function updateVideoTexture(){
 if(!cameraStream||video.readyState<2||video.currentTime===lastVideoTime)return;
 const aspect=video.videoWidth/video.videoHeight;
 if(!Number.isFinite(aspect)||aspect<=0)return;
 if(aspect!==videoAspect){
  const height=Math.min(stageOpeningHeight,2*stageHalfWidth/aspect);
  const width=height*aspect;
  const bottom=webcamStage.bottom+(stageOpeningHeight-height)/2;
  videoPlacement={height,bottom,z:webcamStage.z};
  videoAspect=aspect;
  const vertices=[];
  fillStageOpening(vertices,webcamStage.z,[1,1,1],([x,y])=>[.5+x/width,(y-bottom)/height]);
  gl.bindBuffer(gl.ARRAY_BUFFER,figure.b);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
  figure.count=vertices.length/11;
 }
 // The same local video also appears in the small movement monitor.
 lastVideoTime=video.currentTime;
 imageReady=true;
 if(!handMode)handOn.disabled=false;
}
function norm(v){const l=Math.hypot(...v);return v.map(x=>x/l);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a.reduce((s,x,i)=>s+x*b[i],0);}
function multiply(a,b){const out=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];return out;}
function lookAt(eye,target){
 const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);
 return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
}
const lightVP=multiply([1/24,0,0,0,0,1/24,0,0,0,0,-2/100,0,0,0,-1,1],lookAt([-24,53,34],[0,5,-2]));
function bakeShadow(){
 if(!shadowAvailable||!shadowDirty)return;
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,null);
 gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFrame);gl.viewport(0,0,shadowSize,shadowSize);
 gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.uniform1f(loc.uShadowPass,1);gl.uniformMatrix4fv(loc.uVP,false,lightVP);
 gl.uniform4f(loc.uActor,0,0,0,1);gl.uniform3f(loc.uWalk,0,1,0);gl.uniform1f(loc.uPaper,0);
 drawWorld();
 drawFloaters();
 gl.uniform1f(loc.uShadowPass,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,shadowTexture);shadowDirty=false;lastShadowTime=backgroundTime;
}
let yaw=.20,pitch=.18,distance=26;
function render(){
 updateVideoTexture();
 if(!reducedMotion.matches&&backgroundTime-lastShadowTime>=1/15)shadowDirty=true;
 gl.uniformMatrix4fv(loc.uLightVP,false,lightVP);bakeShadow();
 const dpr=Math.min(devicePixelRatio||1,1.75),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);
 const target=[0,5.5,-1.5];
 const eye=[Math.sin(yaw)*Math.cos(pitch)*distance,5.5+Math.sin(pitch)*distance,-1.5+Math.cos(yaw)*Math.cos(pitch)*distance];
 const view=lookAt(eye,target);
 const f=1/Math.tan(Math.PI/8.5),near=.1,far=150;
 const projection=[f/(w/h),0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];
 currentVP=multiply(projection,view);cameraEye=eye;updateHandOverlay();
 gl.uniformMatrix4fv(loc.uVP,false,currentVP);gl.clearColor(.018,.009,.013,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.uniform4f(loc.uActor,0,0,0,1);gl.uniform3f(loc.uWalk,0,1,0);
 gl.uniform1f(loc.uHighlight,0);gl.uniform1f(loc.uPuppet,0);gl.uniform1f(loc.uPaper,0);drawWorld();
 drawCharacter();
 if(roundOver||!character)return;
 // Soft contact shadows follow the feet, clipped to the depth-tested steps.
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
 gl.uniform1f(loc.uPaper,2);bind(contact);
 for(const actor of walkers){if(actor.held||actor.returning)continue;gl.uniform4f(loc.uActor,actor.position[0],actor.position[1]-.012,actor.position[2],.30*actor.scale);gl.drawArrays(gl.TRIANGLES,0,contact.count);}
 gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(loc.uPaper,0);gl.uniform1f(loc.uHamster,1);
 bind(character.mesh);
 const miniature=character.meta.groups.miniature;
 const press=touchPress();
 for(const actor of walkers){
  gl.uniform1f(loc.uPress,actor===touchedActor?press:0);
  const highlight=actor===hoveredActor||actor===pendingGrab?.actor;
  gl.uniform1f(loc.uHighlight,highlight?1:0);
  gl.uniform4f(loc.uActor,...actor.position,actor.scale*walkerScale*(highlight?1.15:1)*(actor===practice&&bite?bite.scale:1));
  gl.uniform3f(loc.uWalk,actor.phase,actor.facing,reducedMotion.matches?0:actor.moving);gl.uniform2f(loc.uFloat,0,0);
  gl.drawArrays(gl.TRIANGLES,miniature.first,miniature.count);
 }
 gl.uniform1f(loc.uHighlight,0);gl.uniform1f(loc.uPress,0);gl.uniform1f(loc.uHamster,0);
 gl.uniform4f(loc.uActor,0,0,0,1);gl.uniform3f(loc.uWalk,0,1,0);gl.uniform2f(loc.uFloat,0,0);
 drawFloaters();
}
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(handMode||e.button!==0)return;canvas.focus();drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;yaw-=(e.clientX-drag.x)*.006;pitch=Math.max(-.16,Math.min(1.25,pitch+(e.clientY-drag.y)*.005));drag.x=e.clientX;drag.y=e.clientY;render();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
function zoom(factor){if(handMode)return;distance=Math.max(13,Math.min(48,distance*factor));render();}
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.0015));},{passive:false});
function reset(){if(handMode)return;yaw=.20;pitch=.18;distance=26;render();}
document.querySelector('#home').onclick=reset;document.querySelector('#in').onclick=()=>zoom(.85);document.querySelector('#out').onclick=()=>zoom(1.18);
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();if(handMode)return;if(e.key==='ArrowLeft')yaw-=.12;if(e.key==='ArrowRight')yaw+=.12;if(e.key==='ArrowUp')pitch=Math.min(1.25,pitch+.09);if(e.key==='ArrowDown')pitch=Math.max(-.16,pitch-.09);if(e.key==='+')zoom(.9);if(e.key==='-')zoom(1.1);if(e.key==='Home')reset();render();});
window.addEventListener('resize',render);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopCamera();fail('3D 화면이 잠시 중단됐어요. 새로고침하면 다시 열립니다.');});
let previousFrame=performance.now();
function animate(now){
 const dt=Math.min(.05,Math.max(0,(now-previousFrame)/1000));previousFrame=now;
 updateRoundClock(now);
 if(!document.hidden&&!gl.isContextLost()){
  backgroundTime+=dt;
  easeCharacterPose(avatarPose,avatarTarget,dt);
  if(!roundOver){updateWalkers(dt);updateFlight(dt);}
  render();submitHandFrame(now);
 }
 requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
render();
})();
