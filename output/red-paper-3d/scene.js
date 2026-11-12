'use strict';
// Small native WebGL scene: no external packages or network assets.
(() => {
const canvas=document.querySelector('#scene'), status=document.querySelector('#status');
const fail=message=>document.querySelector('#error').textContent=message;
const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
if(!gl){fail('이 Chrome에서 3D 화면을 열 수 없습니다. 다른 Chrome 창에서 다시 열어 주세요.');return;}
const vs=`attribute vec3 aPos,aNormal,aColor; attribute vec2 aUV;
uniform mat4 uVP,uLightVP;uniform vec4 uActor,uSway;uniform vec3 uWalk,uDrift;uniform vec2 uFloat;
varying vec3 vPos,vWorld,vNormal,vColor; varying vec2 vUV;varying vec4 vLight;
void main(){
 vec3 p=aPos;float stride=sin(uWalk.x),walking=uWalk.z;
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
 vWorld=p*uActor.w+uActor.xyz;vLight=uLightVP*vec4(vWorld,1.);
 gl_Position=uVP*vec4(vWorld,1.);
}`;
const fs=`precision highp float;
varying vec3 vPos,vWorld,vNormal,vColor;varying vec2 vUV;varying vec4 vLight;
uniform sampler2D uImage,uAtlas,uShadow;uniform float uPaper,uShadowPass,uShadowEnabled,uShadowTexel,uPuppet;
uniform vec2 uKey;
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
  photo=texture2D(uImage,vec2(1.-vUV.x,vUV.y));
  float green=(photo.g-max(photo.r,photo.b))/max(photo.g,.02);
  float threshold=mix(.48,.06,uKey.x),softness=mix(.025,.22,uKey.y);
  photo.a=1.-smoothstep(threshold,threshold+softness,green)*smoothstep(.025,.09,photo.g);
  if(photo.a<.035)discard;
  photo.g-=max(0.,photo.g-max(photo.r,photo.b))*.85*(1.-photo.a*.35);
 }
 if(uShadowPass>.5&&uPaper>.5&&photo.a<.5)discard;
 if(uShadowPass>.5){gl_FragColor=packDepth(gl_FragCoord.z);return;}
 vec3 n=normalize(vNormal);float key=max(0.,dot(n,normalize(vec3(-.5,1.,.75))));
 float rim=max(0.,dot(n,normalize(vec3(.8,.4,-.6))));
 float shade=.43+.57*key*visibility(n)+.12*rim;
 if(uPaper>.5){gl_FragColor=vec4(photo.rgb*vec3(1.02,.98,.93),photo.a);return;}
 float fiber=grain(floor(vPos*140.));
 float hatch=step(.91,fract((vPos.x+vPos.y+vPos.z)*15.));
 vec2 p=abs(n.y)>.7?vPos.xz:(abs(n.x)>.7?vPos.zy:vPos.xy);
 vec3 color=vColor;
 if(vColor.r>.3&&vColor.g<.3){
  vec2 tile=vColor.r<.5?vec2(.5,.5):vec2(0.,.5);
  vec3 printed=texture2D(uAtlas,tile+vec2(.012)+fract(p/4.8)*.476).rgb;
  color=mix(vColor,printed,vColor.r<.5?.72:.40);
  if(vColor.r<.5)color*=.86;
 }else if(vColor.r>.8&&vColor.g>.65&&vColor.g<.95){
  color=mix(vColor,texture2D(uAtlas,vec2(.012)+fract(p/3.4)*.476).rgb,uPuppet>.5?.16:.32);
 }else if(vColor.r>.08&&vColor.r<.2){
  color=texture2D(uAtlas,vec2(.512,.012)+fract(p/5.)*.476).rgb*.7;
 }
 color*=vec3(1.04,.98,.91)*shade*(.96+.055*fiber-hatch*.045*(1.-key));
 color=mix(color,vec3(.065,.028,.045),smoothstep(0.,16.,-vWorld.z)*.24);
 gl_FragColor=vec4(color,1.);
}`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program;
try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}
catch(e){fail('3D 화면을 준비하지 못했습니다: '+e.message);return;}
gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.clearColor(.035,.022,.027,1);
const loc={};for(const n of ['aPos','aNormal','aColor','aUV'])loc[n]=gl.getAttribLocation(program,n);
for(const n of ['uVP','uLightVP','uImage','uPaper','uAtlas','uActor','uWalk','uShadow','uShadowPass','uShadowEnabled','uShadowTexel','uPuppet','uSway','uDrift','uFloat','uKey'])loc[n]=gl.getUniformLocation(program,n);
const geometry=[],walkRoutes=[],backgroundLayers=[];
function movingLayer(pivot,kind,build){
 const first=geometry.length/11;build();
 backgroundLayers.push({first,count:geometry.length/11-first,pivot,kind});
}
const red=[.77,.075,.065],scarlet=[.94,.16,.12],darkRed=[.37,.027,.04],cream=[.96,.83,.64],ink=[.065,.034,.037];
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
function stairs(x,y,z,dx,dz,count=12,rise=.28,width=1.65){
 const depth=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
 const path=[];
 for(let i=0;i<count;i++){
  const height=.23+(i+1)*rise;
  path.push([x+dx*i,y+height+.025,z+dz*i]);
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
function lace(x,y,z,r,color=[.96,.96,.81]){
 ring(x,y,z,r,r,.025,color,0,.045);ring(x,y,z,r*.75,r*.75,.045,color);
 ring(x,y,z,r*.3,r*.3,.08,color);
 for(let i=0;i<20;i++){
  const a=i/20*Math.PI*2;
  ring(x+Math.cos(a)*r*.58,y+Math.sin(a)*r*.58,z+.01,r*.29,r*.08,.15,color,a);
  ring(x+Math.cos(a)*r*.91,y+Math.sin(a)*r*.91,z+.015,r*.13,r*.065,.2,color,a);
 }
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
function arch(x,y,z,w,h,color=darkRed,lean=0){
 const first=geometry.length/11;
 const outer=w/2,inner=outer*.68,spring=h-outer;
 const t=(u,v,depth=0)=>[x+u+lean*v,y+v,z+depth];
 for(const side of [-1,1]){
  quad([t(side*inner,0),t(side*outer,0),t(side*outer,spring),t(side*inner,spring)],[0,0,1],color);
  quad([t(side*inner,0,-.24),t(side*outer,0,-.24),t(side*outer,spring,-.24),t(side*inner,spring,-.24)],[0,0,-1],color);
  for(const r of [inner,outer])quad([t(side*r,0),t(side*r,spring),t(side*r,spring,-.24),t(side*r,0,-.24)],[side*(r===inner?-1:1),0,0],cream);
 }
 for(let i=0;i<40;i++){
  const a=i/40*Math.PI,b=(i+1)/40*Math.PI;
  const at=(r,v,d=0)=>t(Math.cos(v)*r,spring+Math.sin(v)*r,d);
  quad([at(inner,a),at(outer,a),at(outer,b),at(inner,b)],[0,0,1],color);
  quad([at(inner,a,-.24),at(outer,a,-.24),at(outer,b,-.24),at(inner,b,-.24)],[0,0,-1],color);
  quad([at(outer,a),at(outer,b),at(outer,b,-.24),at(outer,a,-.24)],[Math.cos((a+b)/2),Math.sin((a+b)/2),0],cream);
  quad([at(outer,a,.018),at(outer+.035,a,.018),at(outer+.035,b,.018),at(outer,b,.018)],[0,0,1],cream);
  quad([at(inner,a,.018),at(inner+.025,a,.018),at(inner+.025,b,.018),at(inner,b,.018)],[0,0,1],cream);
  quad([at(inner,a),at(inner,b),at(inner,b,-.24),at(inner,a,-.24)],[-Math.cos((a+b)/2),-Math.sin((a+b)/2),0],cream);
 }
 for(const side of [-1,1])quad([t(side*inner,0,.018),t(side*inner+.025,0,.018),t(side*inner+.025,spring,.018),t(side*inner,spring,.018)],[0,0,1],cream);
 backgroundLayers.push({first,count:geometry.length/11-first,pivot:[x,y,z],kind:'arch'});
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
movingLayer([-8,13.7,-10.8],'paper',()=>tornCard(-8,5.2,-10.8,11,17,[.13,.05,.06],-.12));
movingLayer([7.3,15,-12],'paper',()=>tornCard(7.3,6,-12,11,18,[.13,.05,.06],.13));
arch(-8,-1,-8.8,10,16,darkRed,.12);arch(7,-1.5,-9.4,10,16,red,-.13);
arch(-.5,3.2,-12.3,10,15,darkRed,-.04);
arch(-10,-1.8,-2.7,8,13,red,-.10);arch(10,-2,-3.6,8,14,darkRed,.08);
arch(-12,-2,2.8,7,11,darkRed,.14);arch(12,-2,1.8,7,12,red,-.10);
for(const [x,y,z,r]of [[-8,11,-8,2.2],[6.8,11.5,-8,2.5],[.8,12.8,-10,2.1],[-12,6.7,-1.9,1.5],[11.3,5,-2.5,1.8],[-3.7,4,-6.8,1.65],[4,2,-5.2,1.7]])movingLayer([x,y,z],'lace',()=>lace(x,y,z,r));
box(0,.12,.6,10.8,.22,6.7,darkRed);
box(0,.25,.6,10.9,.035,6.8,red);
// Scalloped cream lace hung along the front of the stage.
for(let i=-6;i<=6;i++)lace(i*.82,.03,4.03,.53);
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
// Layered paper visitor inspired by the reference's spotted, ribbon-like silhouette.
function floatingVisitor(walking=false){
 const charcoal=[.055,.041,.059],ivory=[.99,.97,.86],coral=[.95,.32,.28],gold=[.98,.67,.20],aqua=[.29,.74,.78];
 if(walking){
  // Separate shoes and short legs leave a clear gap under the spotted body.
  for(const side of [-1,1]){
   oval(side*.19,.27,-.01,.065,.14,ivory,side*-.08);
   oval(side*.22,.095,.055,.155,.09,charcoal);
   oval(side*.23,.105,.08,.135,.072,side<0?coral:aqua);
   oval(side*.25,.127,.10,.065,.013,ivory);
   oval(side*.39,.87,-.015,.10,.22,charcoal,side*.38);
   oval(side*.45,.73,.04,.09,.10,ivory);
  }
  oval(0,.77,.03,.355,.38,charcoal);
  for(const [x,y,r,color]of [[-.17,.87,.065,coral],[.14,.95,.07,gold],[.18,.66,.065,coral],[-.13,.58,.07,aqua],[.01,.77,.06,coral]])oval(x,y,.07,r,r,color);
 }else{
 const spine=t=>[Math.sin(t*5.6)*(.18+t*.5),-.45-t*2.65];
 const radius=t=>.57*Math.pow(1-t,.7)+.035;
 for(let i=0;i<36;i++){
  const t=i/36,u=(i+1)/36,a=spine(t),b=spine(u),ra=radius(t),rb=radius(u);
  quad([[a[0]-ra,a[1],.04],[a[0]+ra,a[1],.04],[b[0]+rb,b[1],.04],[b[0]-rb,b[1],.04]],[0,0,1],charcoal);
  quad([[a[0]-ra,a[1],-.10],[a[0]+ra,a[1],-.10],[b[0]+rb,b[1],-.10],[b[0]-rb,b[1],-.10]],[0,0,-1],charcoal);
  for(const side of [-1,1])quad([[a[0]+ra*side,a[1],.04],[b[0]+rb*side,b[1],.04],[b[0]+rb*side,b[1],-.10],[a[0]+ra*side,a[1],-.10]],[side,0,0],cream);
 }
 for(let i=0;i<12;i++){
  const t=.04+i*.077,p=spine(t),r=radius(t),side=i%2?1:-1;
  oval(p[0]+side*r*.47,p[1],.07,.095*(1-t*.6),.13*(1-t*.6),i%4===0?gold:coral,side*.25);
 }
 }
 const faceStart=geometry.length;
 oval(0,0,.10,.95,1.0,charcoal);
 for(const side of [-1,1]){
  const color=side<0?coral:aqua;
  for(let i=0;i<3;i++)oval(side*(.57+i*.16),.94+i*.13,.14,.12,.45-i*.055,color,-side*(.42+i*.2));
 }
 const scallop=[];for(let i=0;i<120;i++){const a=i/120*Math.PI*2,r=.79+.035*Math.cos(a*12);scallop.push([Math.cos(a)*r,Math.sin(a)*r]);}
 flatShape(scallop,ivory,.19,.055);
 for(const side of [-1,1]){
  const x=side*.32,y=.22+(side>0?.06:0),turn=-side*.16;
  oval(x,y,.23,.225,.32,charcoal,turn);oval(x,y,.25,.197,.289,coral,turn);
  oval(x,y,.27,.145,.235,gold,turn);oval(x,y,.29,.096,.158,aqua,turn);
  oval(x+.018,y-.018,.31,.033,.065,charcoal,turn);
  oval(side*.60,-.18,.23,.16,.20,gold,side*.25);
 }
 // A curved cut-paper grin, with an ink edge and a cream center.
 for(const [z,width,color]of [[.26,.18,charcoal],[.28,.125,ivory]])for(let i=0;i<24;i++){
  const mouth=t=>{const x=(t-.5)*1.13,y=-.35+.32*Math.pow(t*2-1,2);return [x,y];};
  const t=i/24,u=(i+1)/24,a=mouth(t),b=mouth(u);
  quad([[a[0],a[1],z],[b[0],b[1],z],[b[0],b[1]-Math.sin(u*Math.PI)*width,z],[a[0],a[1]-Math.sin(t*Math.PI)*width,z]],[0,0,1],color);
 }
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;oval(Math.cos(a)*.075,Math.sin(a)*.075-.02,.33,.063,.063,coral);}
 oval(0,-.02,.35,.042,.043,gold);
 if(walking)for(let i=faceStart;i<geometry.length;i+=11){geometry[i]*=.50;geometry[i+1]=geometry[i+1]*.50+1.43;geometry[i+2]*=.50;}
}
const visitorStart=geometry.length;floatingVisitor();const visitorGeometry=geometry.splice(visitorStart);
const walkingStart=geometry.length;floatingVisitor(true);const walkingGeometry=geometry.splice(walkingStart);
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
const person=[];
quad([[-2.35,.03,.65],[2.35,.03,.65],[2.35,7.08,.65],[-2.35,7.08,.65]],[0,0,1],[1,1,1],person);
function buffer(data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return {b,count:data.length/11};}
const world=buffer(geometry),figure=buffer(person),visitor=buffer(visitorGeometry),walkingVisitor=buffer(walkingGeometry);
let backgroundTime=0,lastShadowTime=-1;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
function layerPose(layer,index){
 const t=reducedMotion.matches?0:backgroundTime,phase=index*1.73;
 const wave=(speed,offset=0)=>Math.sin(t*speed+phase+offset)-Math.sin(phase+offset);
 return {angle:wave(.34+index%4*.035)*(layer.kind==='lace'?.055:layer.kind==='arch'?.005:.008),
  drift:layer.kind==='lace'?[0,wave(.43,.8)*.045,wave(.29,.4)*.035]:[0,0,0]};
}
function clearSway(){gl.uniform4f(loc.uSway,0,0,0,0);gl.uniform3f(loc.uDrift,0,0,0);}
function floaterPose(actor){
 const t=reducedMotion.matches?0:backgroundTime,p=actor.phase;
 return {position:[actor.anchor[0]+Math.sin(t*.27+p)*.48,actor.anchor[1]+Math.sin(t*.63+p)*.36,actor.anchor[2]+Math.cos(t*.32+p)*.38],
  angle:Math.sin(t*.46+p)*.10,tail:t*1.2+p};
}
function drawFloaters(){
 gl.uniform1f(loc.uPaper,0);gl.uniform1f(loc.uPuppet,1);gl.uniform3f(loc.uWalk,0,1,0);bind(visitor);
 for(const actor of floaters){
  const pose=floaterPose(actor);gl.uniform4f(loc.uActor,...pose.position,actor.scale);
  gl.uniform4f(loc.uSway,0,0,0,pose.angle);gl.uniform3f(loc.uDrift,0,0,0);gl.uniform2f(loc.uFloat,pose.tail,1);
  gl.drawArrays(gl.TRIANGLES,0,visitor.count);
 }
 clearSway();gl.uniform2f(loc.uFloat,0,0);gl.uniform4f(loc.uActor,0,0,0,1);gl.uniform1f(loc.uPuppet,0);
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
};
paper.onerror=()=>fail('종이 무늬를 불러오지 못했어요. 새로고침해 주세요.');paper.src='collage-paper.png';
let imageReady=false,cameraStream=null,cameraRequest=0,lastVideoTime=-1,videoAspect=0;
const video=document.createElement('video');video.muted=true;video.autoplay=true;video.playsInline=true;
const cameraOn=document.querySelector('#camera-on'),cameraOff=document.querySelector('#camera-off'),cameraStatus=document.querySelector('#camera-status');
const keyStrength=document.querySelector('#key-strength'),keySoftness=document.querySelector('#key-softness');
status.textContent='산책하는 친구 10 · 떠다니는 친구 4 · 드래그로 회전';
function updateKey(){
 gl.uniform2f(loc.uKey,Number(keyStrength.value)/100,Number(keySoftness.value)/100);
 document.querySelector('#key-value').textContent=keyStrength.value;document.querySelector('#softness-value').textContent=keySoftness.value;
 shadowDirty=true;
}
keyStrength.addEventListener('input',updateKey);keySoftness.addEventListener('input',updateKey);updateKey();
function stopCamera(message='카메라를 껐어요. 다시 켜서 이어갈 수 있습니다.'){
 cameraRequest++;const stream=cameraStream;cameraStream=null;imageReady=false;
 if(stream)stream.getTracks().forEach(track=>track.stop());
 video.pause();video.srcObject=null;lastVideoTime=-1;videoAspect=0;shadowDirty=true;
 cameraOn.disabled=false;cameraOn.hidden=false;cameraOn.textContent='카메라 켜기';cameraOff.hidden=true;cameraStatus.textContent=message;
}
cameraOn.onclick=async()=>{
 if(!navigator.mediaDevices?.getUserMedia){cameraStatus.textContent='Chrome에서 http://127.0.0.1:4322 로 열어 주세요.';return;}
 const request=++cameraRequest;cameraOn.disabled=true;cameraOn.textContent='권한 확인 중…';cameraOff.hidden=false;cameraOff.textContent='취소';
 cameraStatus.textContent='Chrome의 카메라 권한 창에서 허용을 눌러 주세요.';
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30},facingMode:'user'}});
  if(request!==cameraRequest){stream.getTracks().forEach(track=>track.stop());return;}
  cameraStream=stream;video.srcObject=stream;
  stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(cameraStream===stream)stopCamera('카메라 연결이 끊겼어요. 다시 켜 주세요.');}));
  await video.play();if(request!==cameraRequest)return;
  cameraOn.hidden=true;cameraOn.disabled=false;cameraOff.textContent='카메라 끄기';cameraStatus.textContent='카메라 연결됨 · 초록 배경을 지우고 있어요.';
 }catch(error){
  if(request!==cameraRequest)return;
  const messages={NotAllowedError:'카메라 권한이 필요해요. Chrome 주소창의 카메라 설정에서 허용한 뒤 다시 켜 주세요.',NotFoundError:'연결된 웹캠을 찾지 못했어요. 웹캠 연결을 확인해 주세요.',NotReadableError:'웹캠을 열지 못했어요. 다른 앱에서 카메라를 사용 중인지 확인해 주세요.'};
  stopCamera(messages[error.name]||'카메라를 시작하지 못했어요. 연결을 확인하고 다시 켜 주세요.');
 }
};
cameraOff.onclick=()=>stopCamera();window.addEventListener('pagehide',()=>stopCamera());
function updateVideoTexture(){
 if(!cameraStream||video.readyState<2||video.currentTime===lastVideoTime)return;
 const aspect=video.videoWidth/video.videoHeight;if(!Number.isFinite(aspect)||aspect<=0)return;
 if(aspect!==videoAspect){
  const height=7.05,half=height*aspect/2,vertices=[];
  quad([[-half,.28,.65],[half,.28,.65],[half,height+.28,.65],[-half,height+.28,.65]],[0,0,1],[1,1,1],vertices);
  gl.bindBuffer(gl.ARRAY_BUFFER,figure.b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);videoAspect=aspect;
 }
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);lastVideoTime=video.currentTime;imageReady=true;shadowDirty=true;
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
 if(imageReady){gl.uniform1f(loc.uPaper,1);bind(figure);gl.drawArrays(gl.TRIANGLES,0,figure.count);}
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
 gl.uniformMatrix4fv(loc.uVP,false,multiply(projection,view));gl.clearColor(.026,.018,.027,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.uniform4f(loc.uActor,0,0,0,1);gl.uniform3f(loc.uWalk,0,1,0);
 gl.uniform1f(loc.uPuppet,0);gl.uniform1f(loc.uPaper,0);drawWorld();
 // Soft contact shadows follow the feet, clipped to the depth-tested steps.
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
 gl.uniform1f(loc.uPaper,2);bind(contact);
 for(const actor of walkers){gl.uniform4f(loc.uActor,actor.position[0],actor.position[1]-.012,actor.position[2],.30*actor.scale);gl.drawArrays(gl.TRIANGLES,0,contact.count);}
 if(imageReady){gl.uniform4f(loc.uActor,0,.273,.65,.95);gl.drawArrays(gl.TRIANGLES,0,contact.count);}
 gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(loc.uPaper,0);gl.uniform1f(loc.uPuppet,1);
 bind(walkingVisitor);
 for(const actor of walkers){
  gl.uniform4f(loc.uActor,...actor.position,actor.scale*.68);
  gl.uniform3f(loc.uWalk,actor.phase,actor.facing,reducedMotion.matches?0:actor.moving);gl.uniform2f(loc.uFloat,0,0);
  gl.drawArrays(gl.TRIANGLES,0,walkingVisitor.count);
 }
 gl.uniform4f(loc.uActor,0,0,0,1);gl.uniform3f(loc.uWalk,0,1,0);gl.uniform2f(loc.uFloat,0,0);
 drawFloaters();
 if(imageReady){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.uniform1f(loc.uPaper,1);gl.uniform1i(loc.uImage,0);bind(figure);gl.drawArrays(gl.TRIANGLES,0,figure.count);gl.disable(gl.BLEND);}
}
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.focus();drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;yaw-=(e.clientX-drag.x)*.006;pitch=Math.max(-.16,Math.min(1.25,pitch+(e.clientY-drag.y)*.005));drag.x=e.clientX;drag.y=e.clientY;render();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
function zoom(factor){distance=Math.max(13,Math.min(48,distance*factor));render();}
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.0015));},{passive:false});
function reset(){yaw=.20;pitch=.18;distance=26;render();}
document.querySelector('#home').onclick=reset;document.querySelector('#in').onclick=()=>zoom(.85);document.querySelector('#out').onclick=()=>zoom(1.18);
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.12;if(e.key==='ArrowRight')yaw+=.12;if(e.key==='ArrowUp')pitch=Math.min(1.25,pitch+.09);if(e.key==='ArrowDown')pitch=Math.max(-.16,pitch-.09);if(e.key==='+')zoom(.9);if(e.key==='-')zoom(1.1);if(e.key==='Home')reset();render();});
window.addEventListener('resize',render);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopCamera();fail('3D 화면이 잠시 중단됐어요. 새로고침하면 다시 열립니다.');});
let previousFrame=performance.now();
function animate(now){
 const dt=Math.min(.05,Math.max(0,(now-previousFrame)/1000));previousFrame=now;
 if(!document.hidden&&!gl.isContextLost()){backgroundTime+=dt;updateWalkers(dt);render();}
 requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
render();
})();
