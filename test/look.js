/* Real Chrome: screenshots of every world and real multi-touch on the pads.
   node test/look.js  -> test/frames/*.png  (not published, see deploy.yml) */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),assert=require('assert');
const {spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'frames');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let child,ws,server;
async function main(){
  assert(chrome,'Chrome required');fs.mkdirSync(out,{recursive:true});
  server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(fs.readFileSync(f));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  child=spawn(chrome,['--headless=new','--remote-debugging-port=0','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'dino-kart-')),'--no-first-run','--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars','--window-size=1280,720','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let endpoint='';child.stderr.on('data',b=>{const m=b.toString().match(/DevTools listening on (ws:\/\/\S+)/);if(m)endpoint=m[1];});
  for(let i=0;i<100&&!endpoint;i++)await delay(100);assert(endpoint,'Chrome startup timeout');
  const targets=await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list').then(r=>r.json());
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let seq=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  async function run(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
  async function shot(name){await delay(250);const s=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(s.data,'base64'));}
  const touch=(type,pts)=>call('Input.dispatchTouchEvent',{type,touchPoints:pts});
  await call('Runtime.enable');await call('Page.enable');
  // silence: speech goes through the OS voice and ignores --mute-audio
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'try{speechSynthesis.speak=function(){};}catch(e){}window.AudioContext=window.webkitAudioContext=undefined;'});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:origin+'/'});
  for(let i=0;i<100;i++){await delay(50);if(await run("!!(window.G && G.current==='accesso')"))break;}
  const tapAt=async(x,y)=>{await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:9}]});await delay(60);await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(200);};
  await run("const a=G.accounts.create({name:'Leo',color:'#57c98a',level:2});G.accounts.login(a.id);G.go('menu')");await delay(1200);await shot('menu');
  for(let ti=0;ti<8;ti++){
    await run("G.go('gara',{ti:"+ti+"})");await delay(600);
    if(ti===0){await delay(1000);await shot('countdown');}
    await run('G.gara.state().count=0.01;G.gara.state().auto=true');await delay(ti<2?9000:6000);await shot('track'+(ti+1));
  }
  // the show: drift sparks, a turbo, an item in hand, item boxes ahead
  await run("G.go('gara',{ti:2})");await delay(600);
  await run('(()=>{const S=G.gara.state(),P=S.karts[S.player],b=S.boxes[4];S.count=0.01;S.karts.forEach(k=>{if(k.ai)k.s=(b.s+60)%2000;});P.s=b.s-30;P.d=0;P.v=24;P.item="rosso"})()');await delay(700);
  await run('(()=>{const P=G.gara.state().karts[G.gara.state().player];P.drift=1;P.charge=1.8;P.boost=1})()');await delay(150);await shot('show');
  // a real finger on the left half steers left
  // out of the showcase drift first: in a drift, steering the other way only widens the line (as in Mario Kart)
  await run('(()=>{const P=G.gara.state().karts[G.gara.state().player];P.drift=0;P.charge=0;P.boost=0;P.yaw=0;P.hold=0;})()');
  const d0=await run('G.gara.state().karts[G.gara.state().player].d');
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:400,id:3}]});await delay(700);await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const d1=await run('G.gara.state().karts[G.gara.state().player].d');assert(d1<d0-1,'holding the left half steers left: '+d0+' -> '+d1);console.log('touch: left half steers left');
  // the things that only happen mid-race: item boxes ahead, drift sparks, turbo flames, the item button
  await run("G.go('gara',{ti:0})");await delay(500);
  await run("(()=>{const S=G.gara.state();S.count=0.01;const P=S.karts[S.player];const b=S.boxes[0];P.s=b.s-26;S.karts.forEach(k=>{if(k!==P){k.s=P.s+8+k.id*3;}});})()");await delay(400);
  await run("(()=>{const S=G.gara.state(),P=S.karts[S.player];P.item='rosso';P.drift=1;P.charge=2.4;P.boost=1;S.auto=true;})()");await delay(300);await shot('showcase');
  const fps=await run('new Promise(r=>{let t=[],l=performance.now();function f(n){t.push(n-l);l=n;if(t.length<90)requestAnimationFrame(f);else{t.sort((a,b)=>a-b);r({median:+t[45].toFixed(1),p95:+t[85].toFixed(1)});}}requestAnimationFrame(f);})');console.log('frame ms (software GL, not a tablet)',JSON.stringify(fps));
  // a race to the end, then results; then a Grand Prix podium
  await run("G.go('gara',{ti:0})");await delay(500);await run('(()=>{const S=G.gara.state();S.count=0.01;S.auto=true;S.laps=1;S.karts.forEach(k=>{if(!k.ai)k.s=880;})})()');await delay(9000);await shot('results');
  await run("G.go('coppe')");await delay(900);await tapAt(365,350);await delay(800);await run("G.gpRecord(G.gara.state().karts.map((k,i)=>({id:k.id,name:k.name,col:k.col,time:60+i,place:i+1,points:G.race.POINTS[i],player:!k.ai})).sort((a,b)=>a.place-b.place));G.gpState().idx=3;G.go('podio')");await delay(2500);await shot('podium');
  await run("G.go('coppe')");await delay(500);await shot('cups');
  await run("G.go('piste')");await delay(500);await shot('tracks');
  assert.deepEqual(errors,[],'console errors: '+JSON.stringify(errors).slice(0,800));
  console.log('PASS look: frames in test/frames');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{try{ws&&ws.close();}catch(e){}try{child&&child.kill();}catch(e){}try{server&&server.close();}catch(e){}});
