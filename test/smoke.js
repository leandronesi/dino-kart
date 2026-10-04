/* Dino Kart — collaudo. `node test/smoke.js`
   Whole races run in a blink through the same step() the child plays with. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const noop=()=>{},store=new Map(),scenes={},events={};
const context=new Proxy({},{get(t,k){if(k in t)return t[k];if(k==='measureText')return s=>({width:String(s).length*10});if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop:noop});return noop;},set(t,k,v){t[k]=v;return true;}});
const elements={};function element(id){return elements[id]||(elements[id]={style:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},getContext:()=>context,addEventListener:noop,getBoundingClientRect:()=>({left:0,top:0}),focus:noop,blur:noop,select:noop});}
const sandbox={console,Math,Date,JSON,innerWidth:1280,innerHeight:720,devicePixelRatio:2,performance:{now:()=>0},navigator:{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},document:{hidden:false,getElementById:element,documentElement:{},addEventListener:(n,f)=>events[n]=f},addEventListener:(n,f)=>events[n]=f,requestAnimationFrame:noop,setTimeout:noop,clearTimeout:noop,setInterval:noop,matchMedia:()=>({matches:false}),speechSynthesis:{getVoices:()=>[],speak:noop,cancel:noop,addEventListener:noop},SpeechSynthesisUtterance:function(){}};
sandbox.window=sandbox;vm.createContext(sandbox);
const dir=path.join(__dirname,'../src');
for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.js')).sort()){
  vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),sandbox,{filename:file});
  if(file==='00-core.js'){const original=sandbox.G.scene;sandbox.G.scene=(name,s)=>{scenes[name]=s;original(name,s);};}
}
const G=sandbox.G,R=G.race,TR=G.tracks;
const kid=G.accounts.create({name:'Leo',level:2});G.accounts.login(kid.id);
const rules=['20-tracks.js','30-race.js'].map(f=>fs.readFileSync(path.join(dir,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'')).join('');
assert(!/Math\.random/.test(rules),'race rules must use the seeded dice');

// ---- eight tracks, closed, never touching themselves
assert.equal(TR.TRACKS.length,8);assert.equal(TR.CUPS.length,2);
TR.TRACKS.forEach(T=>{const S=TR.sample(T),gap=TR.selfGap(T);assert(gap>T.width+14,T.name+' passes too close to itself: '+gap.toFixed(1));assert(S.L>800&&S.L<1600,T.name+' length '+S.L);
  const F=TR.features(T);assert(F.boxes.length>=8,T.name+' needs item boxes');assert(F.fruits.length>=12);});

function race(ti,level,mode,seed){
  const S=R.create({ti,level,player:{name:'Leo',color:'#57c98a'},seed:seed||3}),P=S.karts[S.player];const ev={};
  for(let f=0;f<60*420&&S.phase!=='done';f++){const inp=mode==='bot'?Object.assign(R.aiControl(S,P),{bot:false}):{};R.step(S,inp);S.events.forEach(e=>{if(e.id===P.id)ev[e.k]=(ev[e.k]||0)+1;});}
  return {S,P,ev};
}
// ---- the bot (racing line + auto-drift) finishes every track at both ages; the passive child never wins
for(const level of [1,2])TR.TRACKS.forEach((T,ti)=>{
  const b1=race(ti,level,'bot',3),b2=race(ti,level,'bot',11),b=b1.P.place<=b2.P.place?b1:b2,p=race(ti,level,'passive');
  console.log(`  ${T.name.padEnd(18)} ${level===1?'Piccolo':'Grande '}  pilota ${b.P.place}° in ${b.S.t.toFixed(0)}s, urti ${b.ev.bump||0}, turbo ${b.ev.turbo||0} · passivo ${p.S.phase==='done'?p.P.place+'°':'fermo'}`);
  assert.equal(b.S.phase,'done',T.name+': the bot must finish');assert(b1.S.phase==='done'&&b2.S.phase==='done');assert(b.P.place<=4,T.name+': a good driver reaches the top four in one of two races: '+b1.P.place+','+b2.P.place);
  assert((b.ev.bump||0)<20,T.name+': the racing line must not live on the barriers');
  if(level===1)assert(p.S.phase!=='done'||p.P.place>=6,T.name+': the passive child cannot do well');
  else assert(p.S.phase!=='done'||p.P.place===8,T.name+': in Grande the passive child gets nowhere');
});

// ---- drift: into a long bend with the wheel all the way, ride it, let go, mini-turbo
{const T=TR.TRACKS[0],Sm=TR.sample(T);let s0=-1;
 for(let i=0;i<Sm.N&&s0<0;i++){let ok=true;for(let k=0;k<35;k++)if(Math.abs(Sm.cv[(i+k)%Sm.N])<.01)ok=false;if(ok)s0=i*2;}
 assert(s0>=0,'the first track has a long bend');
 const S=R.create({ti:0,level:2,player:{name:'L',color:'#57c98a'},seed:5}),P=S.karts[S.player];S.phase='race';
 S.karts.forEach(k=>{if(k!==P){k.s=(s0+300)%Sm.L;}});P.s=s0-6;P.d=0;P.v=24;P.yaw=0;
 const dir=Math.sign(Sm.cv[Math.round(s0/2)]);let turbo=0,drifted=false;
 for(let f=0;f<240&&!turbo;f++){
   let steer;if(f<25)steer=dir;else if(P.drift&&P.charge<1.6){steer=R.aiControl(S,P).steer;if(Math.abs(steer)<.3)steer=.3*dir;}else steer=0;
   if(P.drift)drifted=true;R.step(S,{steer});S.events.forEach(e=>{if(e.k==='turbo'&&e.id===P.id)turbo=e.lvl;});
 }
 assert(drifted,'holding the wheel in a bend starts a drift');assert(turbo>=2,'riding the drift through the bend gives the orange mini-turbo: '+turbo);assert(P.boost>0);}

// ---- items
function arena(){const S=R.create({ti:0,level:2,player:{name:'L',color:'#57c98a'},seed:9});S.phase='race';S.karts.forEach((k,i)=>{k.s=500+i*12;k.d=0;k.v=0;k.yaw=0;});return S;}
{const S=arena(),P=S.karts[S.player],A=S.karts[0];P.s=200;A.s=170;A.d=P.d;P.item='banana';R.step(S,{use:true});assert.equal(S.objs[0].k,'banana');
 A.ai=false;A.v=20;for(let f=0;f<180&&!A.spin;f++)R.step(S,{});assert(A.spin>0,'driving straight over a banana spins you');}
{const S=arena(),P=S.karts[S.player],A=S.karts[0];P.s=200;P.d=0;A.s=230;A.d=0;A.v=0;P.item='verde';R.step(S,{use:true});let hit=false;
 for(let f=0;f<120&&!hit;f++){A.v=0;R.step(S,{});if(A.spin>0)hit=true;}assert(hit,'a green shell thrown straight hits the kart in front');}
{const S=arena(),P=S.karts[S.player];P.s=150;P.item='stella';R.step(S,{use:true});assert(P.star>0);const A=S.karts[0];A.s=P.s+.5;A.d=P.d;A.v=0;R.step(S,{});assert(A.spin>0,'the star knocks others over');}
{const S=arena(),P=S.karts[S.player],b=S.boxes[0];P.s=b.s-.5;P.d=b.d;P.v=10;P.item=null;R.step(S,{});assert(P.pending,'an item box starts the roulette');for(let f=0;f<120;f++)R.step(S,{});assert(R.ITEMS.includes(P.item),'and gives an item: '+P.item);}

// ---- the rainbow road: falling off brings you back, nothing worse
{const ti=TR.TRACKS.findIndex(T=>T.theme==='arcobaleno'),S=R.create({ti,level:1,player:{name:'L',color:'#57c98a'},seed:2}),P=S.karts[S.player];S.phase='race';P.s=200;P.d=TR.TRACKS[ti].width/2+3;P.v=20;
 R.step(S,{});assert(P.fall>0,'off the rainbow you fall');for(let f=0;f<120;f++)R.step(S,{});assert(P.fall<=0&&Math.abs(P.d)<TR.TRACKS[ti].width/2,'and come back on the road: '+P.d);}

// ---- Grand Prix: four races of points, the podium, the trophy, the second cup opens
assert(!G.kartCupOpen(1),'the Coppa Stella starts closed');
G.gpStart(0);
for(let r=0;r<4;r++){
  const S=R.create({ti:TR.CUPS[0].tracks[r],level:2,player:{name:'Leo',color:'#57c98a'},seed:r+1});
  const res=S.karts.map((k,i)=>({id:k.id,name:k.name,col:k.col,time:60+(k.ai?i+1:0),place:0,points:0,player:!k.ai})).sort((a,b)=>a.time-b.time).map((x,i)=>Object.assign(x,{place:i+1,points:R.POINTS[i]}));
  G.gpRecord(res);if(r<3)G.gpState().idx++;
}
G.sceneOf('podio').enter();assert.equal(G.gpState().place,1,'four wins make the champion');
assert.equal(G.kartSave().cups[0][2],1,'the gold trophy is saved');assert(G.kartCupOpen(1),'and the Coppa Stella opens');
G.sceneOf('podio').draw(context);G.sceneOf('classifica').draw(context);
// a sibling has no trophies of his own
const sib=G.accounts.create({name:'Fratello',level:1});G.accounts.login(sib.id);assert(!G.kartCupOpen(1),'sibling save leaked');G.accounts.login(kid.id);assert(G.kartCupOpen(1));

// ---- every scene draws
for(const name of ['accesso','menu','coppe','piste'])G.sceneOf(name).draw(context);
G.gara.quiet(true);G.sceneOf('gara').enter({ti:7,quiet:true});G.sceneOf('gara').update(1);G.sceneOf('gara').draw(context);
console.log('PASS Dino Kart: eight tracks that never cross, a bot finishes and places at both ages, the passive child never wins, drift and mini-turbo, banana, shells, star, item boxes, rainbow respawn, Grand Prix with podium, trophy and unlocks, separate saves');
