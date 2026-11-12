// 새 티파티 복사본만 제공하는 PC 내부 실행 서버.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const files={'/':'index.html','/index.html':'index.html','/scene.js':'scene.js','/person.png':'person.png','/tea-paper.png':'tea-paper.png'};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
http.createServer((req,res)=>{
 const file=files[req.url.split('?')[0]];
 if(!file){res.writeHead(404);res.end();return;}
 fs.readFile(path.join(__dirname,file),(err,data)=>{
  if(err){res.writeHead(500);res.end('File unavailable');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','Permissions-Policy':'camera=(), microphone=()'});res.end(data);
 });
}).listen(4323,'127.0.0.1',()=>console.log('Collage tea party: http://127.0.0.1:4323/'));
