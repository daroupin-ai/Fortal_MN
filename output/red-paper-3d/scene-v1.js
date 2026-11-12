'use strict';
// Small native WebGL scene: no external packages or network assets.
(() => {
const canvas=document.querySelector('#scene'), status=document.querySelector('#status');
const fail=message=>document.querySelector('#error').textContent=message;
const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
if(!gl){fail('이 Chrome에서 3D 화면을 열 수 없습니다. 다른 Chrome 창에서 다시 열어 주세요.');return;}
const vs=`attribute vec3 aPos,aNormal,aColor; attribute vec2 aUV;
uniform mat4 uVP; varying vec3 vPos,vNormal,vColor; varying vec2 vUV;
void main(){vPos=aPos;vNormal=aNormal;vColor=aColor;vUV=aUV;gl_Position=uVP*vec4(aPos,1.);}`;
const fs=`precision highp float;
varying vec3 vPos,vNormal,vColor;varying vec2 vUV;
uniform sampler2D uImage;uniform float uPaper;
float grain(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,39.425)))*43758.5453);}
void main(){
 if(uPaper>0.5){vec4 t=texture2D(uImage,vUV);if(t.a<0.72)discard;gl_FragColor=vec4(t.rgb,1.);return;}
 vec3 n=normalize(vNormal);float key=max(0.,dot(n,normalize(vec3(-.5,1.,.75))));
 float rim=max(0.,dot(n,normalize(vec3(.8,.4,-.6))));
 float shade=.43+.56*key+.18*rim;
 float fiber=grain(floor(vPos*140.));
 float hatch=step(.91,fract((vPos.x+vPos.y+vPos.z)*15.));
 vec3 color=vColor*shade*(.88+.18*fiber-hatch*.07*(1.-key));
 gl_FragColor=vec4(color,1.);
}`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program;
try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}
catch(e){fail('3D 화면을 준비하지 못했습니다: '+e.message);return;}
gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.clearColor(.035,.022,.027,1);
const loc={};for(const n of ['aPos','aNormal','aColor','aUV'])loc[n]=gl.getAttribLocation(program,n);
for(const n of ['uVP','uImage','uPaper'])loc[n]=gl.getUniformLocation(program,n);
const geometry=[];
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
function sphere(x,y,z,rx,ry,rz,color){
 const seg=16,rings=10;
 const point=(i,j)=>{const u=i/seg*Math.PI*2,v=j/rings*Math.PI;return [Math.cos(u)*Math.sin(v),Math.cos(v),Math.sin(u)*Math.sin(v)];};
 for(let j=0;j<rings;j++)for(let i=0;i<seg;i++)for(const [a,b]of [[i,j],[i+1,j],[i+1,j+1],[i,j],[i+1,j+1],[i,j+1]]){const n=point(a,b);vert([x+n[0]*rx,y+n[1]*ry,z+n[2]*rz],norm([n[0]/rx,n[1]/ry,n[2]/rz]),color);}
}
function stairs(x,y,z,dx,dz,count=12,rise=.28,width=1.65){
 const depth=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
 for(let i=0;i<count;i++){
  const height=.23+(i+1)*rise;
  box(x+dx*i,y+height/2,z+dz*i,width,height,depth+.015,i%3===0?scarlet:red,angle);
  // Thin printed paper edging on every tread.
  box(x+dx*i,y+height+.008,z+dz*i,width+.015,.025,depth+.025,[.91,.39,.27],angle);
 }
 return [x+dx*(count-1),y+.23+count*rise,z+dz*(count-1)];
}
function door(x,y,z,angle=0){
 const co=Math.cos(angle),si=Math.sin(angle);
 const b=(lx,ly,lz,w,h,d,c)=>box(x+co*lx+si*lz,y+ly,z-si*lx+co*lz,w,h,d,c,angle);
 b(0,1.9,0,2.7,3.8,.35,red);b(0,1.55,.20,1.63,3.1,.08,ink);b(0,1.52,.26,1.39,2.96,.07,cream);
 b(-.55,1.52,.305,.018,2.78,.01,[.64,.4,.27]);b(.02,1.52,.305,.018,2.96,.01,[.64,.4,.27]);
 const k=[x+co*.43+si*.34,y+1.35,z-si*.43+co*.34];sphere(...k,.075,.075,.075,ink);
 // Printed diamond accents above each door.
 for(let i=-1;i<=1;i++)b(i*.58,3.48,.19,.19,.19,.025,cream);
}
function mascot(x,y,z,s=1){
 sphere(x,y+.57*s,z,.40*s,.53*s,.23*s,cream);
 for(const side of [-1,1]){
  sphere(x+side*.2*s,y+.08*s,z,.12*s,.12*s,.14*s,cream);
  sphere(x+side*.42*s,y+.48*s,z,.12*s,.21*s,.10*s,cream);
  sphere(x+side*.14*s,y+.73*s,z+.215*s,.035*s,.052*s,.025*s,ink);
  sphere(x+side*.24*s,y+.62*s,z+.2*s,.07*s,.033*s,.02*s,[.9,.39,.29]);
 }
 sphere(x,y+.60*s,z+.235*s,.044*s,.062*s,.024*s,ink);
 box(x,y+.37*s,z+.02*s,.76*s,.12*s,.47*s,blue);
 box(x+.42*s,y+.22*s,z+.04*s,.33*s,.12*s,.07*s,blue,.6);
 box(x+.51*s,y+.32*s,z+.03*s,.48*s,.10*s,.06*s,blue,-.45);
}
// A freestanding theatre: every stair has volume, even when viewed from behind.
box(0,-.6,0,23,.5,19,[.105,.057,.065]);
box(0,-.12,1.0,9,.65,6,red);
box(0,.22,1.0,9.12,.06,6.1,scarlet);
// Fine cream ornament around the central stage.
for(let i=-14;i<=14;i++){
 const x=i*.29;sphere(x,.265,3.8,.075,.012,.075,cream);
 if(i%2===0)sphere(x,.267,3.54,.05,.012,.05,cream);
}
for(const x of [-4.25,4.25])for(let i=-6;i<13;i++)sphere(x,.265,i*.28,.06,.012,.06,cream);
stairs(-3.5,-.34,5.6,.38,0,12,.045,1.6);
const left=stairs(-6.4,-.34,4.5,0,-.47,15,.29,2.15);
box(-6.4,left[1]-.16,-3.6,3,.32,3.2,red);door(-6.4,left[1],-4.5);
const right=stairs(6.4,-.34,4.2,0,-.47,13,.3,2.1);
box(6.4,right[1]-.16,-3.0,3.2,.32,3.4,red);door(6.4,right[1],-4.2,-.2);
// Elevated crossing routes behind the person.
const high=stairs(-5.3,4.24,-5.7,.48,0,13,.26,1.8);
box(1.2,7.59,-5.7,2.9,.32,2.8,red);door(1.3,7.75,-6.7,.12);
stairs(7.6,3.8,-3.9,0,-.45,10,.28,1.75);
box(7.6,6.67,-8.4,3,.3,2.5,red);door(7.6,6.82,-9.0,-.35);
stairs(-8.5,3.9,-3.1,0,-.42,10,.27,1.6);
box(-8.5,6.68,-7.5,2.8,.3,2.8,red);door(-8.5,6.83,-8.25,.3);
// Supporting walls with actual open gaps between columns.
for(const [x,h,z]of [[-7.6,4,-4],[-5.2,4,-4],[5.1,3.7,-3],[7.7,3.7,-3],[-9.5,6.6,-7.5],[-7.5,6.6,-7.5],[6.6,6.6,-8.4],[8.6,6.6,-8.4]])box(x,h/2-.35,z,.38,h,.45,darkRed);
box(-5.3,2.3,-5.7,.42,5.2,.65,red);box(1.6,3.5,-5.7,.45,7.7,.65,darkRed);
door(-9.8,-.34,.3,.6);door(9.8,-.34,-.4,-.6);
// Cream medallions across the raised bridge give the paper set a decorative edge.
for(let i=0;i<11;i++){const x=-5.3+.48*i,y=4.24+.23+(i+1)*.26;sphere(x,y-.16,-4.78,.06,.07,.02,cream);}
mascot(-2.8,.26,2.0,1.12);mascot(2.8,.26,2.1,1.04);
mascot(-6.4,1.92,1.25,.88);mascot(6.4,2.22,.95,.88);
mascot(-6.5,left[1],-3.5,.90);mascot(6.4,right[1],-2.5,.85);
mascot(-1.95,6.55,-5.65,.85);mascot(7.65,6.82,-8.0,.85);mascot(-8.5,6.83,-7.3,.85);
const person=[];
quad([[-2.35,.03,.65],[2.35,.03,.65],[2.35,7.08,.65],[-2.35,7.08,.65]],[0,0,1],[1,1,1],person);
function buffer(data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return {b,count:data.length/11};}
const world=buffer(geometry),figure=buffer(person);
function bind(mesh){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.b);for(const [name,size,offset]of [['aPos',3,0],['aNormal',3,3],['aColor',3,6],['aUV',2,9]]){gl.enableVertexAttribArray(loc[name]);gl.vertexAttribPointer(loc[name],size,gl.FLOAT,false,44,offset*4);}}
const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
let imageReady=false;
const photo=new Image();
photo.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,photo);imageReady=true;status.textContent='3D 공간 · 드래그로 회전';render();};
photo.onerror=()=>{status.textContent='인물 이미지를 불러오지 못했어요';};photo.src='person.png';
function norm(v){const l=Math.hypot(...v);return v.map(x=>x/l);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a.reduce((s,x,i)=>s+x*b[i],0);}
function multiply(a,b){const out=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];return out;}
let yaw=.16,pitch=.28,distance=28;
function render(){
 const dpr=Math.min(devicePixelRatio||1,1.75),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);
 const target=[0,3.7,-1.5];
 const eye=[Math.sin(yaw)*Math.cos(pitch)*distance,3.7+Math.sin(pitch)*distance,-1.5+Math.cos(yaw)*Math.cos(pitch)*distance];
 const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);
 const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
 const f=1/Math.tan(Math.PI/7),near=.1,far=150;
 const projection=[f/(w/h),0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];
 gl.uniformMatrix4fv(loc.uVP,false,multiply(projection,view));gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.uniform1f(loc.uPaper,0);bind(world);gl.drawArrays(gl.TRIANGLES,0,world.count);
 if(imageReady){gl.uniform1f(loc.uPaper,1);gl.uniform1i(loc.uImage,0);bind(figure);gl.drawArrays(gl.TRIANGLES,0,figure.count);}
}
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.focus();drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;yaw-=(e.clientX-drag.x)*.006;pitch=Math.max(-.16,Math.min(1.25,pitch+(e.clientY-drag.y)*.005));drag.x=e.clientX;drag.y=e.clientY;render();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
function zoom(factor){distance=Math.max(13,Math.min(48,distance*factor));render();}
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.0015));},{passive:false});
function reset(){yaw=.16;pitch=.28;distance=28;render();}
document.querySelector('#home').onclick=reset;document.querySelector('#in').onclick=()=>zoom(.85);document.querySelector('#out').onclick=()=>zoom(1.18);
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.12;if(e.key==='ArrowRight')yaw+=.12;if(e.key==='ArrowUp')pitch=Math.min(1.25,pitch+.09);if(e.key==='ArrowDown')pitch=Math.max(-.16,pitch-.09);if(e.key==='+')zoom(.9);if(e.key==='-')zoom(1.1);if(e.key==='Home')reset();render();});
window.addEventListener('resize',render);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('3D 화면이 잠시 중단됐어요. 새로고침하면 다시 열립니다.');});
render();
})();
