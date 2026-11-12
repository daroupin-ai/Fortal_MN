import {PinchGrab,handSample,videoToWorld,projectPoint} from './hand-interaction.mjs';
const results=document.querySelector('#results');
function check(name,pass){const li=document.createElement('li');li.textContent=(pass?'PASS · ':'FAIL · ')+name;results.append(li);if(!pass)throw Error(name);}
try{
 const g=new PinchGrab(),open={ratio:.8},closed={ratio:.2};
 check('처음부터 오므린 손은 자동으로 잡지 않음',g.update(closed,true,0)===null&&g.update(closed,true,100)===null);
 g.update(open,true,200);g.update(closed,true,300);check('80ms 이상 집을 때 한 번만 잡음',g.update(closed,true,390)==='grab'&&g.update(closed,true,450)===null);
 check('짧은 인식 끊김에는 유지',g.update(null,false,600)===null&&g.held);
 g.update(open,true,700);check('손을 펴면 내려놓기',g.update(open,true,790)==='release'&&!g.held);
 g.update(closed,false,900);g.update(closed,false,990);check('다른 곳에서 집은 채 다가오면 잡히지 않음',g.update(closed,true,1100)===null);
 g.update(open,true,1200);g.update(closed,true,1300);g.update(closed,true,1390);check('손을 놓치면 자동 반환',g.update(null,false,2000)==='release');
 const left=videoToWorld({x:0,y:1},16/9),right=videoToWorld({x:1,y:0},16/9);
 check('웹캠 거울 반전과 바닥 높이',left[0]>0&&right[0]<0&&Math.abs(left[1]-.28)<1e-8&&right[1]>7);
 check('잘못된 손 인식 값 무시',handSample([],16/9)===null);
 const center=projectPoint([0,0,0],[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],1280,720);
 check('화면 좌표 변환',center[0]===640&&center[1]===360);
 const worker=new Worker('./hand-worker.mjs',{type:'module'});
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{worker.terminate();reject(Error('모델 준비 시간 초과'));},45000);
  worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(Error(e.message));};
  worker.onmessage=async({data})=>{
   if(data.type==='ready'){
    check('로컬 모델과 WASM 실제 초기화',true);
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;canvas.getContext('2d').fillRect(0,0,640,480);
    const image=await createImageBitmap(canvas);worker.postMessage({type:'frame',image,time:1000},[image]);
   }else if(data.type==='hand'){clearTimeout(timeout);worker.terminate();check('별도 작업에서 실제 영상 프레임 인식 실행',data.points===null);resolve();}
   else if(data.type==='error'){clearTimeout(timeout);worker.terminate();reject(Error(data.message));}
  };worker.postMessage({type:'init'});
 });
 document.querySelector('#done').textContent='전체 검사 통과 · 실제 웹캠의 손 집기는 별도 확인이 필요합니다.';
}catch(error){document.querySelector('#done').textContent='검사 실패: '+error.message;}
