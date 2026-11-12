// 이 폴더의 실습 파일만, 이 PC 안에서 제공합니다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = {'/':'index.html','/index.html':'index.html','/scene.js':'scene.js','/person.png':'person.png','/collage-paper.png':'collage-paper.png'};
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
http.createServer((req,res)=>{
  const filename=files[req.url.split('?')[0]];
  if(!filename){res.writeHead(404);res.end();return;}
  fs.readFile(path.join(__dirname,filename),(err,data)=>{
    if(err){res.writeHead(500);res.end('File unavailable');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(filename)],'Cache-Control':'no-store','Permissions-Policy':'camera=(self), microphone=()'});
    res.end(data);
  });
}).listen(4322,'127.0.0.1',()=>console.log('Paper labyrinth: http://127.0.0.1:4322'));
