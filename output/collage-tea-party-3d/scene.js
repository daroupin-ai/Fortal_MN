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
 float shade=.82+.17*key+.04*rim;
 float fiber=grain(floor(vPos*140.));
 float hatch=step(.91,fract((vPos.x+vPos.y+vPos.z)*15.));
 vec2 p=abs(n.y)>.7?vPos.xz:(abs(n.x)>.7?vPos.zy:vPos.xy);
 vec3 color=vColor;
 if(vColor.r<-.5){
  vec2 tile=vec2(0.,.5);
  if(vColor.r< -1.5)tile=vec2(.5,.5);
  if(vColor.r< -2.5)tile=vec2(.5,0.);
  if(vColor.r< -3.5)tile=vec2(0.,0.);
  color=texture2D(uAtlas,tile+vec2(.014)+fract(p/5.6)*.472).rgb;
 }
 color*=shade*(.96+.06*fiber-hatch*.045*(1.-key));
 gl_FragColor=vec4(color,1.);
}`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program;
try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}
catch(e){fail('3D 화면을 준비하지 못했습니다: '+e.message);return;}
gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.clearColor(.105,.16,.16,1);
const loc={};for(const n of ['aPos','aNormal','aColor','aUV'])loc[n]=gl.getAttribLocation(program,n);
for(const n of ['uVP','uImage','uPaper','uAtlas','uActor','uWalk'])loc[n]=gl.getUniformLocation(program,n);
const geometry=[],walkRoutes=[];
const floral=[-1,0,0],garden=[-2,0,0],patchwork=[-3,0,0],parchment=[-4,0,0];
const cream=[.98,.92,.77],ink=[.12,.25,.27],blue=[.48,.72,.76],teal=[.26,.52,.55],pink=[.97,.66,.75],rose=[.85,.23,.48],lemon=[1,.86,.12],mint=[.72,.84,.63];
function vert(p,n,c,uv=[0,0],out=geometry){out.push(...p,...n,...c,...uv);}
function quad(p,n,c,out=geometry,uv=[[0,0],[1,0],[1,1],[0,1]]){for(const i of [0,1,2,0,2,3])vert(p[i],n,c,uv[i],out);}
function box(x,y,z,w,h,d,color=teal,angle=0){
 const co=Math.cos(angle),si=Math.sin(angle);
 const t=p=>[x+co*p[0]+si*p[2],y+p[1],z-si*p[0]+co*p[2]];
 const nt=n=>[co*n[0]+si*n[2],n[1],-si*n[0]+co*n[2]];
 const a=w/2,b=h/2,c=d/2;
 const faces=[[[[-a,-b,c],[a,-b,c],[a,b,c],[-a,b,c]],[0,0,1]],[[[a,-b,-c],[-a,-b,-c],[-a,b,-c],[a,b,-c]],[0,0,-1]],[[[-a,b,c],[a,b,c],[a,b,-c],[-a,b,-c]],[0,1,0]],[[[-a,-b,-c],[a,-b,-c],[a,-b,c],[-a,-b,c]],[0,-1,0]],[[[a,-b,c],[a,-b,-c],[a,b,-c],[a,b,c]],[1,0,0]],[[[-a,-b,-c],[-a,-b,c],[-a,b,c],[-a,b,-c]],[-1,0,0]]];
 for(const [p,n]of faces)quad(p.map(t),nt(n),color);
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

// Curved furniture and flat fabric scraps share the same paper-stage renderer.
function cylinder(x,y,z,rx,rz,height,color){
 const count=64;
 for(let i=0;i<count;i++){
  const a=i/count*Math.PI*2,b=(i+1)/count*Math.PI*2;
  const p=(angle,h)=>[x+rx*Math.cos(angle),y+h,z+rz*Math.sin(angle)];
  quad([p(a,0),p(b,0),p(b,height),p(a,height)],norm([Math.cos(a),0,Math.sin(a)]),color);
  for(const v of [[x,y+height,z],p(a,height),p(b,height)])vert(v,[0,1,0],color);
  for(const v of [[x,y,z],p(b,0),p(a,0)])vert(v,[0,-1,0],color);
 }
}
function ellipsoid(x,y,z,rx,ry,rz,color){
 const point=(a,b)=>[Math.cos(a)*Math.sin(b),Math.cos(b),Math.sin(a)*Math.sin(b)];
 for(let j=0;j<14;j++)for(let i=0;i<28;i++)for(const [u,v]of [[i,j],[i+1,j],[i+1,j+1],[i,j],[i+1,j+1],[i,j+1]]){
  const n=point(u/28*Math.PI*2,v/14*Math.PI);vert([x+n[0]*rx,y+n[1]*ry,z+n[2]*rz],norm([n[0]/rx,n[1]/ry,n[2]/rz]),color);
 }
}
function place(x,y,z,angle,build){
 const start=geometry.length;build();const c=Math.cos(angle),s=Math.sin(angle);
 for(let i=start;i<geometry.length;i+=11){
  const px=geometry[i],pz=geometry[i+2],nx=geometry[i+3],nz=geometry[i+5];
  geometry[i]=x+c*px+s*pz;geometry[i+1]+=y;geometry[i+2]=z-s*px+c*pz;
  geometry[i+3]=c*nx+s*nz;geometry[i+5]=-s*nx+c*nz;
 }
}
function horizontalLace(x,y,z,r){
 const start=geometry.length;lace(0,0,0,r,cream);
 for(let i=start;i<geometry.length;i+=11){const py=geometry[i+1],pz=geometry[i+2],ny=geometry[i+4],nz=geometry[i+5];geometry[i]+=x;geometry[i+1]=y+pz;geometry[i+2]=z+py;geometry[i+4]=nz;geometry[i+5]=ny;}
}
function chair(x,z,angle,material=floral){
 place(x,0,z,angle,()=>{
  for(const lx of [-.88,.88])for(const lz of [-.1,1.25])box(lx,.85,lz,.12,1.7,.12,ink);
  box(0,1.75,.55,2.15,.19,1.7,teal);
  oval(0,3.7,-.05,1.23,2.35,ink);oval(0,3.7,.015,1.14,2.25,blue);
  oval(0,3.7,.06,.98,2.03,material);
  ring(0,3.7,.1,1.08,2.16,.018,cream);
  for(let i=-3;i<=3;i++)oval(i*.22,2.4,.12,.035,.035,cream);
 });
}
function balloon(x,y,z,color){
 ellipsoid(x,y,z,.7,.98,.48,color);
 oval(x-.24,y+.38,z+.43,.12,.28,[1,.96,.85],-.25);
 flatShape([[x,y-.88],[x-.12,y-1.12],[x+.12,y-1.12]],color,z);
 for(let i=0;i<26;i++){
  const yy=y-1.1-i*.15,xx=x+Math.sin(i*.23)*.12;
  quad([[xx,yy,z],[xx+.018,yy,z],[x+Math.sin((i+1)*.23)*.12+.018,yy-.15,z],[x+Math.sin((i+1)*.23)*.12,yy-.15,z]],[0,0,1],cream);
 }
}
function cup(x,z,color){
 cylinder(x,2.92,z,.69,.53,.035,cream);
 cylinder(x,2.96,z,.38,.33,.48,color);
 cylinder(x,3.43,z,.36,.31,.026,cream);
 cylinder(x,3.46,z,.29,.24,.005,[.37,.22,.12]);
 ring(x+.43,3.2,z+.02,.23,.23,.27,color);
}
// A circular paper floor, with printed pastel tiles under the party.
cylinder(0,-.18,0,12.5,9.7,.22,parchment);
for(let x=-12;x<=12;x++)for(let z=-9;z<=9;z++)if((x*x)/(12*12)+(z*z)/(9*9)<1){
 const tone=(x+z)%2===0?[.88,.89,.79]:[.68,.79,.74];box(x,.052,z,.985,.025,.985,tone);
}
// Tall overlapping wallpaper strips, varied in depth and slightly tilted.
for(const [x,y,z,w,h,material,tilt]of [
 [-10,5.4,-7.3,5.6,12.3,patchwork,-.08],[-6.2,5.7,-8.4,5.6,13,floral,.045],[-1.8,5.6,-9.0,5.6,12.8,garden,-.025],[2.5,5.6,-8.6,5.9,13,floral,.065],[7.3,5.5,-7.8,5.8,12.6,garden,-.055],[11,5,-6.5,4.4,11.6,patchwork,.09]]){
 tornCard(x+.08,y-.08,z-.07,w+.10,h+.1,cream,tilt);tornCard(x,y,z,w,h,material,tilt);
}
place(-11.9,5.2,-.3,.95,()=>tornCard(0,0,0,7,11.8,floral,-.025));
place(11.9,5.2,-.3,-.95,()=>tornCard(0,0,0,7,11.8,garden,.025));
// Visible stitched seams and mismatched pasted fragments.
for(const x of [-8,-4,1,5.4,9.1])for(let i=0;i<36;i++)tornCard(x, i*.31-.2,-6.95,.11,.035,rose,.35);
tornCard(-8,2.1,-6.8,3.3,4.5,garden,.23);tornCard(8.7,2.8,-6.7,3.6,5.1,floral,-.17);
tornCard(-3.7,8.8,-7.1,2.6,3.4,patchwork,-.2);
lace(-9.6,8.7,-6.5,1.2);lace(9.4,8.8,-6.2,1.3);lace(1.5,10.7,-7.0,.85);
// Paper bunting strung across the flowered walls.
for(let i=0;i<18;i++){
 const x=-10.5+i*1.25,y=10.7-Math.sin(i/17*Math.PI)*.9;
 flatShape([[x-.5,y],[x+.5,y],[x,y-.85]],[pink,blue,mint,cream][i%4],-5.8,.025);
 box(x,y+.025,-5.8,1.27,.025,.025,cream);
}
// Rounded chairs frame the table in the same way as the reference image.
chair(-6.6,2.8,.45);chair(6.6,2.5,-.45);
chair(-3.6,-4.0,.18,parchment);chair(3.7,-4.1,-.18,floral);
// Dark teal pedestal and a low, scalloped blue tablecloth.
cylinder(0,.09,0,1.65,1.2,.18,ink);cylinder(0,.27,0,.42,.38,2.43,ink);
cylinder(0,2.7,0,5.45,3.5,.18,teal);cylinder(0,2.88,0,5.36,3.43,.035,parchment);
for(let i=0;i<144;i++){
 const a=i/144*Math.PI*2,b=(i+1)/144*Math.PI*2;
 const p=(t,y)=>[Math.cos(t)*5.46,y,Math.sin(t)*3.51];
 const hem=t=>2.68-.32*(.5+.5*Math.cos(t*24));
 quad([p(a,2.9),p(b,2.9),p(b,hem(b)),p(a,hem(a))],norm([Math.cos(a),0,Math.sin(a)]),blue);
}
horizontalLace(.1,2.93,-.2,2.5);
// Layer cake with paper strawberries and a single candle.
cylinder(.5,2.94,-.4,1.6,1.35,.08,cream);
cylinder(.5,3.02,-.4,1.36,1.16,.38,pink);
cylinder(.5,3.4,-.4,1.38,1.18,.13,cream);
cylinder(.5,3.53,-.4,1.31,1.11,.42,pink);
cylinder(.5,3.95,-.4,1.34,1.14,.12,cream);
for(let i=0;i<20;i++){const a=i/20*Math.PI*2;ellipsoid(.5+Math.cos(a)*1.26,3.97,-.4+Math.sin(a)*1.07,.15,.18,.12,cream);}
for(let i=0;i<7;i++){
 const a=i/7*Math.PI*2,x=.5+Math.cos(a)*.95,z=-.4+Math.sin(a)*.79;
 ellipsoid(x,4.24,z,.17,.24,.15,rose);
 for(let j=0;j<4;j++)oval(x+(j%2-.5)*.11,4.2+Math.floor(j/2)*.11,z+.15,.014,.02,cream);
}
box(.5,4.45,-.4,.085,.76,.085,blue);oval(.5,4.99,-.36,.09,.17,lemon);
cup(-3.6,.7,pink);cup(3.5,.85,blue);cup(-2.8,-1.5,mint);cup(2.9,-1.5,pink);
// A flat printed teapot stands between the little saucers.
oval(-1.9,3.57,-.8,.65,.49,blue);ring(-2.56,3.6,-.8,.36,.34,.23,teal);
flatShape([[-1.45,3.5],[-.85,3.95],[-.91,4.10],[-1.6,3.87]],blue,-.78);
oval(-1.9,4.02,-.76,.46,.10,cream);oval(-1.9,4.17,-.76,.09,.10,rose);
balloon(-6.9,8.6,-3.8,lemon);balloon(6.8,7.3,-3.0,rose);
balloon(-9.2,6.6,.3,pink);balloon(9.2,9,-3.9,blue);balloon(3.3,9.3,-6.1,lemon);
// Ten separate strolling paths: six around the floor, four on the table rim.
for(let i=0;i<6;i++){
 const route=[],start=-Math.PI*.98+i*Math.PI/3,rx=8.3+(i%2)*.6,rz=6.3;
 for(let j=0;j<=18;j++){const a=start+j/18*.95;route.push([Math.cos(a)*rx,.09,Math.sin(a)*rz]);}
 walkRoutes.push(route);
}
for(let i=0;i<4;i++){
 const route=[],start=i*Math.PI/2+.16;
 for(let j=0;j<=16;j++){const a=start+j/16*1.12;route.push([Math.cos(a)*4.35,2.94,Math.sin(a)*2.65]);}
 walkRoutes.push(route);
}
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
 return {route,distance,target:distance<route.total*.5?route.total:0,speed:.45+Math.random()*.45,pause:0,phase:Math.random()*Math.PI*2,facing:1,moving:1,scale:index<6?.86+Math.random()*.14:.58+Math.random()*.10,position:routePosition(route,distance)};
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
quad([[-3.25,.03,-4.55],[1.45,.03,-4.55],[1.45,7.08,-4.55],[-3.25,7.08,-4.55]],[0,0,1],[1,1,1],person);
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
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([160,192,170,255]));
gl.uniform1i(loc.uAtlas,1);gl.uniform1i(loc.uImage,0);
const paper=new Image();
paper.onload=()=>{gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,atlas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,paper);render();};
paper.onerror=()=>fail('종이 무늬를 불러오지 못했어요. 새로고침해 주세요.');paper.src='tea-paper.png';
let imageReady=false;
const photo=new Image();
photo.onload=()=>{gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,photo);imageReady=true;status.textContent='작은 방문자 10마리 · 드래그로 회전';render();};
photo.onerror=()=>{status.textContent='인물 이미지를 불러오지 못했어요';};photo.src='person.png';
function norm(v){const l=Math.hypot(...v);return v.map(x=>x/l);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a.reduce((s,x,i)=>s+x*b[i],0);}
function multiply(a,b){const out=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];return out;}
let yaw=.12,pitch=.24,distance=24;
function render(){
 const dpr=Math.min(devicePixelRatio||1,1.75),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);
 const target=[0,4.0,-1.1];
 const eye=[Math.sin(yaw)*Math.cos(pitch)*distance,4.0+Math.sin(pitch)*distance,-1.1+Math.cos(yaw)*Math.cos(pitch)*distance];
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
function reset(){yaw=.12;pitch=.24;distance=24;render();}
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
