// 이 폴더의 실습 파일만, 이 PC 안에서 제공합니다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = {'/':'index.html','/index.html':'index.html','/scene.js':'scene.js','/person.png':'person.png','/collage-paper.png':'collage-paper.png'};
for(const name of ['theatre-ui.mjs','theatre-audio.mjs','camera-session.mjs','theatre-design.css','theatre-game.css','theatre-art.jpg'])files['/'+name]=name;
for(const name of fs.readdirSync(path.join(__dirname,'fonts')).filter(name=>/\.(ttf|txt)$/.test(name)))files['/fonts/'+name]='fonts/'+name;
for(const name of ['hamster.bin','hamster.json','hamster-avatar.mjs','face-worker.mjs'])files['/'+name]=name;
for(const name of ['theatre-character.bin','theatre-character.json','character-avatar.mjs'])files['/'+name]=name;
for(const name of ['hand-interaction.mjs','hand-worker.mjs','hand-check.html','hand-check.mjs'])files['/'+name]=name;
for(const name of ['vision_bundle.mjs','hand_landmarker.task','face_landmarker.task','selfie_segmenter.tflite','wasm/vision_wasm_internal.js','wasm/vision_wasm_internal.wasm','wasm/vision_wasm_module_internal.js','wasm/vision_wasm_module_internal.wasm'])files['/vendor/mediapipe/'+name]='vendor/mediapipe/'+name;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.jpg':'image/jpeg','.json':'application/json; charset=utf-8','.bin':'application/octet-stream','.wasm':'application/wasm','.task':'application/octet-stream','.tflite':'application/octet-stream','.png':'image/png'};
http.createServer((req,res)=>{
  let requestPath;
  try{requestPath=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400);res.end();return;}
  const filename=Object.hasOwn(files,requestPath)?files[requestPath]:null;
  if(!filename){res.writeHead(404);res.end();return;}
  fs.readFile(path.join(__dirname,filename),(err,data)=>{
    if(err){res.writeHead(500);res.end('File unavailable');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(filename)],'Cache-Control':'no-store','Permissions-Policy':'camera=(self), microphone=()'});
    res.end(data);
  });
}).listen(4322,'127.0.0.1',()=>console.log('Paper labyrinth: http://127.0.0.1:4322'));
