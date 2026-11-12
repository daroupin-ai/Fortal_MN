'use strict';
// Small native WebGL scene: no external packages or network assets.
(() => {
const canvas=document.querySelector('#scene'), status=document.querySelector('#status');
const fail=message=>document.querySelector('#error').textContent=message;
const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
if(!gl){fail('이 Chrome에서 3D 화면을 열 수 없습니다. 다른 Chrome 창에서 다시 열어 주세요.');return;}
const vs=`attribute vec3 aPos,aNormal,aColor; attribute vec2 aUV;
uniform mat4 uVP;uniform vec4 uActor;uniform vec3 uWalk;
varying vec3 vPos,vNormal,vColor; varying vec2 vUV;
void main(){
 vec3 p=aPos;float stride=sin(uWalk.x),walking=uWalk.z;
 if(p.y<.26){float foot=sign(p.x);p.y+=max(0.,stride*foot)*.12*walking;p.x+=stride*foot*.045*walking;}
 p.x+=sin(uWalk.x)*p.y*.035*walking;
 p.x*=uWalk.y;p.y+=abs(stride)*.028*walking;
 vPos=aPos;vNormal=vec3(aNormal.x*uWalk.y,aNormal.yz);vColor=aColor;vUV=aUV;
 gl_Position=uVP*vec4(p*uActor.w+uActor.xyz,1.);
}`;
const fs=`precision highp float;
varying vec3 vPos,vNormal,vColor;varying vec2 vUV;
uniform sampler2D uImage,uAtlas;uniform float uPaper;
float grain(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,39.425)))*43758.5453);}
void main(){
 if(uPaper>0.5){vec4 t=texture2D(uImage,vUV);if(t.a<0.72)discard;gl_FragColor=vec4(t.rgb,1.);return;}
 vec3 n=normalize(vNormal);float key=max(0.,dot(n,normalize(vec3(-.5,1.,.75))));
 float rim=max(0.,dot(n,normalize(vec3(.8,.4,-.6))));
 float shade=.70+.27*key+.10*rim;
 float fiber=grain(floor(vPos*140.));
 float hatch=step(.91,fract((vPos.x+vPos.y+vPos.z)*15.));
 vec2 p=abs(n.y)>.7?vPos.xz:(abs(n.x)>.7?vPos.zy:vPos.xy);
 vec3 color=vColor;
 if(vColor.r>.3&&vColor.g<.3){
  vec2 tile=vColor.r<.5?vec2(.5,.5):vec2(0.,.5);
  color=texture2D(uAtlas,tile+vec2(.012)+fract(p/3.8)*.476).rgb;
  if(vColor.r<.5)color*=.87;
 }else if(vColor.r>.8&&vColor.g>.65&&vColor.g<.95){
  color=mix(vColor,texture2D(uAtlas,vec2(.012)+fract(p/3.4)*.476).rgb,.62);
 }else if(vColor.r>.08&&vColor.r<.2){
  color=texture2D(uAtlas,vec2(.512,.012)+fract(p/5.)*.476).rgb*.7;
 }
 color*=shade*(.94+.08*fiber-hatch*.12*(1.-key));
 gl_FragColor=vec4(color,1.);
}`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program;
try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}
catch(e){fail('3D 화면을 준비하지 못했습니다: '+e.message);return;}
gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.clearColor(.035,.022,.027,1);
const loc={};for(const n of ['aPos','aNormal','aColor','aUV'])loc[n]=gl.getAttribLocation(program,n);
for(const n of ['uVP','uImage','uPaper','uAtlas','uActor','uWalk'])loc[n]=gl.getUniformLocation(program,n);
const geometry=[],walkRoutes=[];
const red=[.77,.075,.065],scarlet=[.94,.16,.12],darkRed=[.37,.027,.04],cream=[.96,.83,.64],ink=[.065,.034,.037],blue=[.36,.65,.71];
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
  const edge=k=>Math.sin(k*9.14)*.04+Math.sin(k*3.63)*.025;
  quad([t(a,-h/2+edge(i)),t(b,-h/2+edge(i+1)),t(b,h/2+edge(i+24)),t(a,h/2+edge(i+23))],[0,0,1],color);
 }
}
function arch(x,y,z,w,h,color=darkRed,lean=0){
 const outer=w/2,inner=outer*.68,spring=h-outer;
 const t=(u,v,depth=0)=>[x+u+lean*v,y+v,z+depth];
 for(const side of [-1,1])quad([t(side*inner,0),t(side*outer,0),t(side*outer,spring),t(side*inner,spring)],[0,0,1],color);
 for(let i=0;i<40;i++){
  const a=i/40*Math.PI,b=(i+1)/40*Math.PI;
  const at=(r,v,d=0)=>t(Math.cos(v)*r,spring+Math.sin(v)*r,d);
  quad([at(inner,a),at(outer,a),at(outer,b),at(inner,b)],[0,0,1],color);
  quad([at(outer,a,.018),at(outer+.035,a,.018),at(outer+.035,b,.018),at(outer,b,.018)],[0,0,1],cream);
  quad([at(inner,a,.018),at(inner+.025,a,.018),at(inner+.025,b,.018),at(inner,b,.018)],[0,0,1],cream);
  quad([at(inner,a),at(inner,b),at(inner,b,-.06),at(inner,a,-.06)],[0,-1,0],cream);
 }
 for(const side of [-1,1])quad([t(side*inner,0,.018),t(side*inner+.025,0,.018),t(side*inner+.025,spring,.018),t(side*inner,spring,.018)],[0,0,1],cream);
}
function door(x,y,z,angle=0){
 tornCard(x+.13,y+1.5-.12,z-.09,2.2,3.5,ink,angle);
 tornCard(x,y+1.5,z,1.92,3.25,cream,angle);
 tornCard(x,y+1.5,z+.02,1.72,3.02,ink,angle);
 tornCard(x,y+1.5,z+.04,1.56,2.87,cream,angle);
 oval(x+.46,y+1.32,z+.09,.07,.08,ink);
 box(x-.61,y+1.5,z+.08,.014,2.78,.012,ink);
}
function mascot(x,y,z,s=1){
 const o=(a,b,d,rx,ry,c,angle=0)=>oval(x+a*s,y+b*s,z+d,rx*s,ry*s,c,angle);
 for(const side of [-1,1]){o(side*.18,.13,.02,.11,.13,cream);o(side*.4,.53,.03,.1,.2,cream,side*-.5);}
 o(0,.57,0,.42,.53,ink);o(0,.57,.04,.40,.51,cream);
 for(const side of [-1,1]){o(side*.14,.73,.08,.032,.047,ink);o(side*.26,.60,.08,.061,.025,[.86,.41,.32]);}
 o(0,.59,.09,.04,.06,ink);
 tornCard(x,y+.36*s,z+.1,.77*s,.11*s,blue,-.06);
 flatShape([[x+.3*s,y+.39*s],[x+.95*s,y+.23*s],[x+.70*s,y+.12*s],[x+.33*s,y+.31*s]],blue,z+.08);
 for(const side of [-1,1])tornCard(x+side*.16*s,y+1.22*s,z,.035*s,.17*s,cream,side*.4);
}
// Broken, leaning sheets behind the architecture: no enclosing solid room.
tornCard(-8,5.2,-10.8,11,17,[.13,.05,.06],-.12);
tornCard(7.3,6,-12,11,18,[.13,.05,.06],.13);
arch(-8,-1,-8.8,10,16,darkRed,.12);arch(7,-1.5,-9.4,10,16,red,-.13);
arch(-.5,3.2,-12.3,10,15,darkRed,-.04);
arch(-10,-1.8,-2.7,8,13,red,-.10);arch(10,-2,-3.6,8,14,darkRed,.08);
arch(-12,-2,2.8,7,11,darkRed,.14);arch(12,-2,1.8,7,12,red,-.10);
for(const [x,y,z,r]of [[-8,11,-8,2.2],[6.8,11.5,-8,2.5],[.8,12.8,-10,2.1],[-12,6.7,-1.9,1.5],[11.3,5,-2.5,1.8],[-3.7,4,-6.8,1.65],[4,2,-5.2,1.7]])lace(x,y,z,r);
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
stairs(3.1,6.8,-7.6,.48,0,15,.25,1.5);door(10.1,10.78,-8.0,.12);
stairs(-10.0,4.0,-3.1,0,-.42,13,.28,1.6);door(-10,7.87,-8.5,-.1);
stairs(8.7,2.4,2.2,0,-.45,15,.29,1.7);door(8.7,6.98,-4.4,.15);
// Diagonal scraps weave in front of the rear stair flights.
tornCard(-7,1.8,-1.8,6,.48,darkRed,-.24);
tornCard(5.8,2.7,-1.0,7,.36,red,.28);
tornCard(-7.5,8.8,-6.1,7,.28,cream,-.18);
door(-9.5,-.5,.7,.18);door(9.7,-.5,.3,-.14);
walkRoutes.push(
 [[-4.1,.28,2.7],[-1.9,.28,3.1],[1.9,.28,3.1],[4.1,.28,2.5]],
 [[-3.8,.28,-1.7],[-4.2,.28,.2],[-2.3,.28,1.9]],
 [[2.4,.28,-1.6],[4.1,.28,-.4],[3.2,.28,1.7]]
);
// Keep the paper puppet mesh separate; all ten walkers reuse one GPU buffer.
const puppetStart=geometry.length;mascot(0,0,0);
const puppetGeometry=geometry.splice(puppetStart);
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
const world=buffer(geometry),figure=buffer(person),puppet=buffer(puppetGeometry);
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
const paper=new Image();
paper.onload=()=>{gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,atlas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,paper);render();};
paper.onerror=()=>fail('종이 무늬를 불러오지 못했어요. 새로고침해 주세요.');paper.src='collage-paper.png';
let imageReady=false;
const photo=new Image();
photo.onload=()=>{gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,photo);imageReady=true;status.textContent='작은 방문자 10마리 · 드래그로 회전';render();};
photo.onerror=()=>{status.textContent='인물 이미지를 불러오지 못했어요';};photo.src='person.png';
function norm(v){const l=Math.hypot(...v);return v.map(x=>x/l);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a.reduce((s,x,i)=>s+x*b[i],0);}
function multiply(a,b){const out=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];return out;}
let yaw=.07,pitch=.09,distance=24;
function render(){
 const dpr=Math.min(devicePixelRatio||1,1.75),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);
 const target=[0,5.5,-1.5];
 const eye=[Math.sin(yaw)*Math.cos(pitch)*distance,5.5+Math.sin(pitch)*distance,-1.5+Math.cos(yaw)*Math.cos(pitch)*distance];
 const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);
 const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
 const f=1/Math.tan(Math.PI/8.5),near=.1,far=150;
 const projection=[f/(w/h),0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];
 gl.uniformMatrix4fv(loc.uVP,false,multiply(projection,view));gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.uniform4f(loc.uActor,0,0,0,1);gl.uniform3f(loc.uWalk,0,1,0);
 gl.uniform1f(loc.uPaper,0);bind(world);gl.drawArrays(gl.TRIANGLES,0,world.count);
 bind(puppet);
 for(const actor of walkers){
  gl.uniform4f(loc.uActor,...actor.position,actor.scale);gl.uniform3f(loc.uWalk,actor.phase,actor.facing,actor.moving);
  gl.drawArrays(gl.TRIANGLES,0,puppet.count);
 }
 gl.uniform4f(loc.uActor,0,0,0,1);gl.uniform3f(loc.uWalk,0,1,0);
 if(imageReady){gl.uniform1f(loc.uPaper,1);gl.uniform1i(loc.uImage,0);bind(figure);gl.drawArrays(gl.TRIANGLES,0,figure.count);}
}
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.focus();drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;yaw-=(e.clientX-drag.x)*.006;pitch=Math.max(-.16,Math.min(1.25,pitch+(e.clientY-drag.y)*.005));drag.x=e.clientX;drag.y=e.clientY;render();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
function zoom(factor){distance=Math.max(13,Math.min(48,distance*factor));render();}
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.0015));},{passive:false});
function reset(){yaw=.07;pitch=.09;distance=24;render();}
document.querySelector('#home').onclick=reset;document.querySelector('#in').onclick=()=>zoom(.85);document.querySelector('#out').onclick=()=>zoom(1.18);
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.12;if(e.key==='ArrowRight')yaw+=.12;if(e.key==='ArrowUp')pitch=Math.min(1.25,pitch+.09);if(e.key==='ArrowDown')pitch=Math.max(-.16,pitch-.09);if(e.key==='+')zoom(.9);if(e.key==='-')zoom(1.1);if(e.key==='Home')reset();render();});
window.addEventListener('resize',render);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('3D 화면이 잠시 중단됐어요. 새로고침하면 다시 열립니다.');});
let previousFrame=performance.now();
function animate(now){
 const dt=Math.min(.05,Math.max(0,(now-previousFrame)/1000));previousFrame=now;
 if(!document.hidden&&!gl.isContextLost()){updateWalkers(dt);render();}
 requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
render();
})();
