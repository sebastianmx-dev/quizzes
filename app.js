(function(){
'use strict';
var app=document.getElementById('app'), hero=document.getElementById('hero');
var LET='ABCDEF';
var TIMES=[[0,'Sem limite'],[5,'5 s'],[10,'10 s'],[20,'20 s'],[30,'30 s'],[45,'45 s'],[60,'1 min'],[90,'1 min 30 s'],[120,'2 min']];
var CIRC=2*Math.PI*26;
var TRACKS=[
  {id:'playdate',file:'audio/espera-playdate.mp3',title:'Playdate',author:'Geoff Harvey',cat:'lobby'},
  {id:'funny-cartoon',file:'audio/espera-funny-cartoon.mp3',title:'Funny Cartoon Music',author:'Hitslab',cat:'lobby'},
  {id:'cartoon-tata',file:'audio/espera-cartoon-tata.mp3',title:'Cartoon Music',author:'TataMusic',cat:'lobby'},
  {id:'cartoon-run',file:'audio/pergunta-cartoon-run.mp3',title:'Cartoon Run',author:'Elisaveta Stoycheva',cat:'question'},
  {id:'cartoon-maksym',file:'audio/pergunta-cartoon-maksym.mp3',title:'Cartoon Music',author:'Maksym Malko',cat:'question'},
  {id:'funny-andriih',file:'audio/pergunta-funny-andriih.mp3',title:'Funny Music',author:'AndriiH',cat:'question'},
  {id:'cartoon-starostin',file:'audio/pergunta-cartoon-starostin.mp3',title:'Cartoon Music',author:'Starostin',cat:'question'},
  {id:'victory-hitslab',file:'audio/podio-victory-hitslab.mp3',title:'Nomination Victory',author:'Hitslab',cat:'winner'},
  {id:'champions-mfcc',file:'audio/podio-champions-mfcc.mp3',title:'Winner Champions',author:'MFCC',cat:'winner'}
];
var MUSIC_PHASES=[['lobby','Sala de espera'],['question','Perguntas'],['winner','Pódio']];
function trackById(id){return TRACKS.filter(function(t){return t.id===id})[0]||null}
var SET_DEFAULT={defaultTime:20,maxPoints:1000,minPct:50,streakStep:100,streakCap:500,countdown:true,showExplain:true,leaderboard:true,boardSize:10,sfx:true,music:true,
  music_lobby:'auto',music_question:'auto',music_winner:'auto'};
var SET_OPTS={
  maxPoints:[[500,'500'],[1000,'1000'],[2000,'2000']],
  minPct:[[100,'100% (sem prêmio de rapidez)'],[75,'75%'],[50,'50%'],[25,'25%'],[0,'0%']],
  streakStep:[[0,'Sem bônus'],[50,'+50 por acerto seguido'],[100,'+100 por acerto seguido'],[200,'+200 por acerto seguido']],
  streakCap:[[200,'200'],[500,'500'],[1000,'1000']],
  boardSize:[[5,'5 lugares'],[10,'10 lugares'],[20,'20 lugares']]
};
function sanitizeSettings(raw){
  raw=raw||{};
  var out={};
  function pick(k,list){var v=raw[k];return list.some(function(o){return o[0]===v})?v:SET_DEFAULT[k]}
  out.defaultTime=pick('defaultTime',TIMES.filter(function(t){return t[0]>0}));
  ['maxPoints','minPct','streakStep','streakCap','boardSize'].forEach(function(k){out[k]=pick(k,SET_OPTS[k])});
  ['countdown','showExplain','leaderboard','sfx','music'].forEach(function(k){out[k]=typeof raw[k]==='boolean'?raw[k]:SET_DEFAULT[k]});
  MUSIC_PHASES.forEach(function(ph){
    var k='music_'+ph[0], v=raw[k];
    var ok=v==='auto'||v==='none'||(v==='generated'&&ph[0]==='question')||!!trackById(v);
    out[k]=ok?v:SET_DEFAULT[k];
  });
  return out;
}
function cfg(k){return S.settings[k]}
function defTime(){return S.settings.defaultTime}
var store={
  get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},
  set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}
};
var S={
  db:null, canWrite:false, quizzes:[], loaded:false, failed:false,
  view:'library', shuffle:store.get('cq:shuffle')!=='0',
  play:null, refs:{}, raf:0, cd:0,
  draft:null, draftId:null, confirmDelete:false, saving:false,
  toolsOpen:false, toolsText:'', toolsMsg:'', toolsBad:false, toolsBusy:false,
  myId:null, canHost:false, host:null, join:null, hostResume:null, libMsg:'', liveUnsubs:[], joinPin:'',
  avatar:null, settings:sanitizeSettings({}), setDraft:null, adminMsg:'', adminBad:false, adminConfirm:null, adminBusy:false
};
function applySettings(raw){
  S.settings=sanitizeSettings(raw);
  if(store.get('cq:sfx')===null) Snd.sfx=S.settings.sfx;
  if(store.get('cq:music')===null) Snd.music=S.settings.music;
}
var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- utilidades ---------- */
function h(tag,attrs){
  var e=document.createElement(tag), k, v;
  if(attrs){for(k in attrs){
    v=attrs[k];
    if(v==null||v===false) continue;
    if(k==='class') e.className=v;
    else if(k.slice(0,2)==='on') e.addEventListener(k.slice(2),v);
    else if(v===true) e.setAttribute(k,'');
    else e.setAttribute(k,v);
  }}
  var kids=Array.prototype.slice.call(arguments,2).flat(Infinity);
  kids.forEach(function(c){
    if(c==null||c===false) return;
    e.append(c.nodeType?c:document.createTextNode(String(c)));
  });
  return e;
}
function shuffle(a){
  a=a.slice();
  for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}
  return a;
}
function byOrder(a,b){
  var d=(+a.order||0)-(+b.order||0);
  return d||String(a.title||'').localeCompare(String(b.title||''),'pt');
}
function nextOrder(){return Math.max.apply(null,[0].concat(S.quizzes.map(function(q){return +q.order||0})))+1}
function plural(n,one,many){return n+' '+(n===1?one:many)}
function bestOf(id){
  try{var v=JSON.parse(store.get('cq:best:'+id)||'null');return v&&v.total?v:null}catch(e){return null}
}
function fmt(n){return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ')}
function timeLabel(s){
  if(s===0) return 'sem limite de tempo';
  return (s>=60&&s%60===0?(s/60)+' min':s+' s')+' por pergunta';
}
function tpl(markup){var t=document.createElement('template');t.innerHTML=markup;return t.content.firstElementChild}

/* ---------- ícones e formas (markup estático) ---------- */
var ICON={
  sfxOn:'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  sfxOff:'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/>',
  musicOn:'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  musicOff:'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/><path d="M3 3l18 18"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  check:'<path d="m5 12.5 5 5L19 7"/>',
  flame:'<path d="M12 2c1 4 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2 1-3.5 2.2-4.6.2 2 1 3 2.1 3.2C10.3 8 10.2 5 12 2z" fill="currentColor" stroke="none"/>'
};
function icon(name,size){
  size=size||22;
  return tpl('<svg class="'+(name==='check'||name==='close'?'mk':'ic')+'" viewBox="0 0 24 24" width="'+size+'" height="'+size+'" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[name]+'</svg>');
}
var SHAPES=[
  '<path d="M12 3 22 20H2z"/>',
  '<path d="M12 2 22 12 12 22 2 12z"/>',
  '<circle cx="12" cy="12" r="9.5"/>',
  '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/>',
  '<path d="M12 2 21 7v10l-9 5-9-5V7z"/>',
  '<path d="m12 2 3.1 6.6 7.2.9-5.3 5 1.4 7.2-6.4-3.6L5.6 21.7 7 14.5 1.7 9.5l7.2-.9z"/>'
];
function shape(i){
  return tpl('<svg class="shape" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'+SHAPES[i%6]+'</svg>');
}
function tileStyle(i){return '--c:var(--t'+(i%6)+');--ci:var(--ti'+(i%6)+')'}

/* ---------- avatares: desenhados por partes, guardados como "fundo-pele-cabelo-cor-olhos-boca-acessório-camisola" ---------- */
var AV={
  bg:['#C9303F','#1F5BD8','#E5A400','#1B8A4B','#7B3FC4','#0A7B7D','#E86A2E','#5B6785'],
  skin:['#F6D3B3','#E8B48A','#C68A5E','#8D5A3B','#5C3A24','#9ED8C6'],
  hc:['#2B1D14','#6B3E1F','#D9A441','#B5462C','#E6E6E6','#3A63D8','#D94F9A'],
  shirt:['#FFFFFF','#1A2238','#F2B200','#2FA36B','#E2574C','#5B7BE0']
};
var AV_PARTS=[['bg','Fundo',8],['skin','Pele',6],['hair','Cabelo',9],['hc','Cor do cabelo',7],['eyes','Olhos',4],['mouth','Boca',5],['acc','Acessório',6],['shirt','Camiseta',6]];
// Avatares prontos: seis por tom de pele, com cabelos liso, comprido, cacheado/crespo, coque, tranças,
// raspado, careca e lenço/hijab, além de óculos, fones e outros acessórios.
var AV_PRESETS=[
  '1-0-1-1-0-0-0-0','4-0-2-2-1-1-0-3','6-0-3-3-3-0-1-5','3-0-5-0-0-1-0-2','7-0-0-4-1-0-1-1','0-0-7-1-1-4-3-4',
  '2-1-4-0-0-1-3-1','5-1-2-0-1-0-0-4','0-1-1-1-3-4-0-3','6-1-8-5-1-0-0-0','1-1-3-0-1-1-5-2','3-1-6-0-0-1-1-5',
  '3-2-3-0-0-1-0-0','7-2-2-1-3-0-1-2','4-2-7-0-1-0-3-5','1-2-5-0-0-1-0-3','6-2-8-6-0-0-1-3','2-2-4-6-1-4-0-1',
  '2-3-3-0-1-1-0-4','0-3-6-0-0-0-0-5','5-3-1-0-3-1-0-0','4-3-8-0-1-1-0-2','7-3-0-0-0-1-1-3','1-3-2-1-1-0-4-2',
  '1-4-3-0-1-1-0-2','6-4-6-0-3-0-0-3','3-4-7-0-0-1-3-1','5-4-2-0-1-4-1-0','2-4-5-0-1-1-0-5','5-4-8-3-0-0-0-4'
];
var avN=0;
function avParse(s){
  var parts=String(s||'').split('-'), a={};
  AV_PARTS.forEach(function(p,i){var n=parseInt(parts[i],10);a[p[0]]=(n>=0&&n<p[2])?n:0});
  return a;
}
function avStr(a){return AV_PARTS.map(function(p){return a[p[0]]}).join('-')}
function avRandom(){
  return avParse(AV_PRESETS[Math.floor(Math.random()*AV_PRESETS.length)]);
}
function avFromName(name){
  var x=2166136261;
  String(name||'').split('').forEach(function(c){x^=c.charCodeAt(0);x=Math.imul(x,16777619)>>>0});
  return avParse(AV_PRESETS[(Math.imul(x,0x85EBCA6B)>>>0)%AV_PRESETS.length]);
}
function avOf(entry){return entry&&typeof entry.avatar==='string'?avParse(entry.avatar):avFromName(entry&&entry.name)}
function avSvg(a,size){
  var sk=AV.skin[a.skin], hc=AV.hc[a.hc], D='#1B1410', cid='avc'+(++avN), m='';
  m+='<svg class="av" viewBox="0 0 64 64" width="'+size+'" height="'+size+'" aria-hidden="true">';
  m+='<defs><clipPath id="'+cid+'"><circle cx="32" cy="32" r="32"/></clipPath></defs><g clip-path="url(#'+cid+')">';
  m+='<rect width="64" height="64" fill="'+AV.bg[a.bg]+'"/>';
  if(a.hair===2) m+='<path d="M15 30C15 16 24 12 32 12S49 16 49 30L50 50H41V30H23V50H14Z" fill="'+hc+'"/>';
  m+='<path d="M8 66C8 51 19 46 32 46S56 51 56 66Z" fill="'+AV.shirt[a.shirt]+'"/>';
  m+='<rect x="28" y="40" width="8" height="8" fill="'+sk+'"/>';
  m+='<circle cx="17.5" cy="34" r="3.6" fill="'+sk+'"/><circle cx="46.5" cy="34" r="3.6" fill="'+sk+'"/>';
  if(a.hair===6){var br='';for(var by=30;by<=55;by+=5)br+='<circle cx="16" cy="'+by+'" r="3.4"/><circle cx="48" cy="'+by+'" r="3.4"/>';m+='<g fill="'+hc+'">'+br+'</g>'}
  if(a.hair===8) m+='<path d="M13.5 36C13.5 15 23 9.5 32 9.5S50.5 15 50.5 36V50C46 54 40 55.5 32 55.5S18 54 13.5 50Z" fill="'+hc+'"/>';
  m+='<circle cx="32" cy="33" r="15" fill="'+sk+'"/>';
  var SHORT='<path d="M17 31C17 19 24 15 32 15S47 19 47 31C44 25 38 22.5 32 23S20 25 17 31Z"/>';
  var hair=['',SHORT,SHORT,
    '<circle cx="20" cy="24" r="6"/><circle cx="26" cy="18.5" r="6.5"/><circle cx="32" cy="16.5" r="7"/><circle cx="38" cy="18.5" r="6.5"/><circle cx="44" cy="24" r="6"/><circle cx="17.5" cy="30.5" r="4.5"/><circle cx="46.5" cy="30.5" r="4.5"/>',
    '<path d="M17 30L18 20L22 23L24 13L28 19L32 11L36 19L40 13L42 23L46 20L47 30C42 25 38 23 32 23S22 25 17 30Z"/>',
    SHORT+'<circle cx="32" cy="12" r="6"/>',
    SHORT,
    '<path d="M17.6 30C18 20.5 24 17.6 32 17.6S46 20.5 46.4 30C43 26.2 38 24.6 32 24.6S21 26.2 17.6 30Z" opacity=".9"/>',
    '<path d="M16.5 31C16.5 18.5 24 14 32 14S47.5 18.5 47.5 31C44 24.5 38.5 22 32 22S20 24.5 16.5 31Z"/>'][a.hair];
  if(hair) m+='<g fill="'+hc+'">'+hair+'</g>';
  m+='<circle cx="23" cy="38.5" r="2.4" fill="#E2576B" opacity=".3"/><circle cx="41" cy="38.5" r="2.4" fill="#E2576B" opacity=".3"/>';
  var arcL='<path d="M23.5 34Q26 30.5 28.5 34" fill="none" stroke="'+D+'" stroke-width="1.8" stroke-linecap="round"/>';
  var arcR='<path d="M35.5 34Q38 30.5 40.5 34" fill="none" stroke="'+D+'" stroke-width="1.8" stroke-linecap="round"/>';
  var dotL='<circle cx="26" cy="33" r="2" fill="'+D+'"/>', dotR='<circle cx="38" cy="33" r="2" fill="'+D+'"/>';
  function big(x){return '<circle cx="'+x+'" cy="33" r="3.6" fill="#fff"/><circle cx="'+x+'" cy="33.4" r="2.1" fill="'+D+'"/><circle cx="'+(x+.8)+'" cy="32.4" r=".75" fill="#fff"/>'}
  m+=[dotL+dotR,arcL+arcR,dotL+arcR,big(26)+big(38)][a.eyes];
  var grin='<path d="M26 38.5Q32 47 38 38.5Z" fill="#5A1F1F"/>';
  m+=['<path d="M27 39.5Q32 43.5 37 39.5" fill="none" stroke="'+D+'" stroke-width="1.8" stroke-linecap="round"/>',
    grin,
    '<path d="M28 40.5H36" stroke="'+D+'" stroke-width="1.8" stroke-linecap="round"/>',
    '<ellipse cx="32" cy="41" rx="2.4" ry="3" fill="#5A1F1F"/>',
    grin+'<ellipse cx="32" cy="42.6" rx="3" ry="1.9" fill="#E8798A"/>'][a.mouth];
  m+=['',
    '<g fill="none" stroke="#1A1A1A" stroke-width="1.6"><circle cx="26" cy="33" r="4.6"/><circle cx="38" cy="33" r="4.6"/><path d="M30.6 33H33.4"/></g>',
    '<g fill="#111"><rect x="20.5" y="29.5" width="10" height="7" rx="3"/><rect x="33.5" y="29.5" width="10" height="7" rx="3"/></g><path d="M30.5 32H33.5" stroke="#111" stroke-width="1.6"/>',
    '<path d="M15 34C15 17 49 17 49 34" fill="none" stroke="#24242C" stroke-width="3"/><rect x="12" y="29" width="6.5" height="11" rx="2.5" fill="#24242C"/><rect x="45.5" y="29" width="6.5" height="11" rx="2.5" fill="#24242C"/>',
    '<path d="M21 19L23 8L28 14L32 6L36 14L41 8L43 19Z" fill="#F2B200" stroke="#A97A00" stroke-width="1.2" stroke-linejoin="round"/>',
    '<path d="M16 28C16 13 48 13 48 28Z" fill="#C9303F"/><rect x="15" y="24" width="34" height="7" rx="3.5" fill="#F3F0EA"/><circle cx="32" cy="11" r="4.2" fill="#F3F0EA"/>'][a.acc];
  m+='</g></svg>';
  return tpl(m);
}
function setAvatar(a){
  S.avatar=a;store.set('cq:avatar',avStr(a));
  Snd.init();Snd.click();
  rerenderKeepScroll();
}
function avatarPicker(){
  var cur=avStr(S.avatar);
  var presets=h('div',{class:'av-grid',role:'group','aria-label':'Escolha um avatar'},AV_PRESETS.map(function(s,i){
    var b=h('button',{class:'av-opt',id:'avp-'+i,'aria-pressed':String(s===cur),'aria-label':'Avatar '+(i+1),onclick:function(){setAvatar(avParse(s))}});
    b.append(avSvg(avParse(s),52));
    return b;
  }));
  return h('div',{class:'av-picker'},
    h('div',{class:'bar'},
      h('span',{class:'lbl',style:'margin:0'},'Escolha um avatar'),
      h('button',{class:'btn sm',id:'av-rand',onclick:function(){
        var a;do{a=avRandom()}while(AV_PRESETS.length>1&&avStr(a)===avStr(S.avatar));
        setAvatar(a);
      }},'Aleatório')),
    presets);
}

/* ---------- som: efeitos e música gerados no navegador ---------- */
var Snd={
  ctx:null, master:null, mgain:null,
  sfx:store.get('cq:sfx')!=='0', music:store.get('cq:music')!=='0',
  mt:null, step:0, nt:0,
  init:function(){
    if(!this.ctx){
      try{
        var AC=window.AudioContext||window.webkitAudioContext;
        if(!AC) return false;
        this.ctx=new AC();
        this.master=this.ctx.createGain();this.master.gain.value=.8;this.master.connect(this.ctx.destination);
        this.mgain=this.ctx.createGain();this.mgain.gain.value=.11;this.mgain.connect(this.master);
      }catch(e){this.ctx=null;return false}
    }
    if(this.ctx.state==='suspended'){try{this.ctx.resume()}catch(e){}}
    return true;
  },
  tone:function(freq,t,dur,o){
    if(!this.ctx) return;
    o=o||{};
    var c=this.ctx, osc=c.createOscillator(), g=c.createGain(), vol=Math.max(o.vol||.2,.0002);
    osc.type=o.type||'sine';
    osc.frequency.setValueAtTime(freq,t);
    if(o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide,t+dur);
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+.012);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    osc.connect(g);g.connect(o.dest||this.master);
    osc.start(t);osc.stop(t+dur+.05);
  },
  now:function(){return this.ctx?this.ctx.currentTime:0},
  fx:function(fn){if(this.sfx&&this.ctx) fn.call(this,this.now())},
  click:function(){this.fx(function(t){this.tone(560,t,.07,{type:'square',vol:.07})})},
  beep:function(n){this.fx(function(t){this.tone(n===3?440:n===2?523.25:659.25,t,.22,{type:'triangle',vol:.28})})},
  go:function(){this.fx(function(t){this.tone(880,t,.4,{type:'triangle',vol:.3});this.tone(1318.5,t+.05,.35,{type:'sine',vol:.15})})},
  whoosh:function(){this.fx(function(t){this.tone(260,t,.18,{type:'sine',slide:900,vol:.08})})},
  tick:function(secs){this.fx(function(t){this.tone(900+(5-secs)*70,t,.05,{type:'square',vol:.05})})},
  correct:function(){this.fx(function(t){
    [523.25,659.25,783.99,1046.5].forEach(function(f,i){this.tone(f,t+i*.08,.18,{type:'triangle',vol:.26})},this);
  })},
  streak:function(){this.fx(function(t){
    this.tone(1318.5,t+.34,.12,{type:'sine',vol:.14});this.tone(1568,t+.44,.2,{type:'sine',vol:.14});
  })},
  wrong:function(){this.fx(function(t){this.tone(220,t,.4,{type:'sawtooth',slide:110,vol:.14})})},
  timeout:function(){this.fx(function(t){
    this.tone(247,t,.22,{type:'triangle',vol:.22});this.tone(185,t+.24,.4,{type:'triangle',vol:.22});
  })},
  finale:function(ratio){this.fx(function(t){
    var up=[523.25,659.25,783.99,1046.5,783.99,1046.5,1318.5], soft=[392,349.23,329.63,293.66];
    (ratio>=.5?up:soft).forEach(function(f,i){this.tone(f,t+i*.13,.3,{type:'triangle',vol:.24})},this);
  })},
  phase:null,
  musicStart:function(phase){
    phase=phase||'question';
    this.phase=phase;
    if(!this.music) return;
    var src=musicSource(phase);
    if(src==='generated'){Music.stop();this.init();this.genStart()}
    else if(src){this.genStop();Music.play(src,phase!=='winner')}
    else this.silence();
  },
  musicStop:function(){this.phase=null;this.silence()},
  silence:function(){this.genStop();Music.stop()},
  hurry:function(on){Music.hurry(on)},
  genStart:function(){
    var s=this;
    if(!s.music||!s.ctx||s.mt) return;
    s.step=0;s.nt=s.ctx.currentTime+.08;
    s.mt=setInterval(function(){
      while(s.nt<s.ctx.currentTime+.35){s.note(s.step,s.nt);s.nt+=.2;s.step=(s.step+1)%32}
    },80);
  },
  genStop:function(){if(this.mt){clearInterval(this.mt);this.mt=null}},
  note:function(st,t){
    var LEAD=[0,2,4,2,5,4,2,1, 0,2,4,5,7,5,4,2, 3,5,7,5,8,7,5,3, 2,4,5,4,7,5,4,2];
    var SC=[220,261.63,293.66,329.63,392,440,523.25,587.33,659.25];
    var BASS=[110,110,87.31,87.31,98,98,110,82.41];
    this.tone(SC[LEAD[st]],t,.18,{type:'triangle',vol:.5,dest:this.mgain});
    if(st%4===0) this.tone(BASS[Math.floor(st/4)%8],t,.38,{type:'sine',vol:.9,dest:this.mgain});
  }
};
var gamePicks={};
function resetMusicPicks(){gamePicks={}}
function musicSource(phase){
  var v=cfg('music_'+phase);
  if(v==='none') return null;
  if(v==='generated') return 'generated';
  var t=trackById(v);
  if(t) return t;
  if(!gamePicks[phase]){
    var list=TRACKS.filter(function(x){return x.cat===phase});
    gamePicks[phase]=list[Math.floor(Math.random()*list.length)]||null;
  }
  return gamePicks[phase];
}
var Music={
  el:null,cur:null,vol:.6,previewTimer:0,
  play:function(track,loop){
    if(this.cur===track.id&&this.el&&!this.el.paused){this.hurry(false);return}
    this.stop();
    var a=new Audio(track.file);
    a.loop=!!loop;a.preload='auto';
    try{a.preservesPitch=false;a.mozPreservesPitch=false;a.webkitPreservesPitch=false}catch(e){}
    try{a.volume=0}catch(e){}
    this.el=a;this.cur=track.id;
    var pr=a.play();if(pr&&pr.catch)pr.catch(function(){});
    this.fade(a,this.vol,500,false);
  },
  fade:function(a,to,ms,pauseAtEnd){
    var from=a.volume, t0=performance.now();
    (function step(now){
      var k=Math.min(1,(now-t0)/ms);
      try{a.volume=Math.max(0,Math.min(1,from+(to-from)*k))}catch(e){}
      if(k<1) requestAnimationFrame(step); else if(pauseAtEnd){try{a.pause()}catch(e){}}
    })(t0);
    if(pauseAtEnd) setTimeout(function(){try{a.pause()}catch(e){}},ms+150);
  },
  stop:function(){
    clearTimeout(this.previewTimer);
    if(this.el){var a=this.el;this.el=null;this.cur=null;this.fade(a,0,350,true)}
  },
  hurry:function(on){if(this.el){try{this.el.playbackRate=on?1.12:1}catch(e){}}}
};
function playWinner(ratio){
  var src=Snd.music?musicSource('winner'):null;
  if(src&&src!=='generated'&&ratio>=.5) Snd.musicStart('winner');
  else{Snd.musicStop();Snd.finale(ratio)}
}
document.addEventListener('visibilitychange',function(){
  if(!Snd.ctx) return;
  try{if(document.hidden) Snd.ctx.suspend(); else Snd.ctx.resume()}catch(e){}
});

/* ---------- comemoração: confetes em canvas ---------- */
var Confetti={
  cv:null,cx:null,parts:[],raf:0,rainUntil:0,W:0,H:0,dpr:1,last:0,
  COLORS:['#C9303F','#1F5BD8','#E5A400','#1B8A4B','#7B3FC4','#0A7B7D','#F2B200','#E86A2E','#FFFFFF','#FF7AB6'],
  start:function(o){
    if(reduceMotion) return;
    o=o||{};
    this.ensure();
    var n=o.light?40:150;
    this.burst(-0.02*this.W,this.H+10,n/2,1);
    this.burst(1.02*this.W,this.H+10,n/2,-1);
    this.rainUntil=o.light?0:performance.now()+(o.ms||6000);
    if(!this.raf){this.last=performance.now();this.raf=requestAnimationFrame(this.tick.bind(this))}
  },
  ensure:function(){
    if(!this.cv){
      var c=document.createElement('canvas');
      c.className='confetti';c.setAttribute('aria-hidden','true');
      document.body.appendChild(c);
      this.cv=c;this.cx=c.getContext('2d');
      var self=this;this.onResize=function(){self.size()};
      window.addEventListener('resize',this.onResize);
    }
    this.size();
  },
  size:function(){
    this.dpr=Math.min(2,window.devicePixelRatio||1);
    this.W=window.innerWidth;this.H=window.innerHeight;
    this.cv.width=Math.round(this.W*this.dpr);this.cv.height=Math.round(this.H*this.dpr);
    this.cx.setTransform(this.dpr,0,0,this.dpr,0,0);
  },
  piece:function(x,y,vx,vy){
    var r=Math.random(), k=Math.min(1.4,Math.max(.8,this.W/700));
    return {x:x,y:y,vx:vx,vy:vy,
      shape:r<.62?'rect':r<.85?'dot':'ribbon',
      w:(7+Math.random()*7)*k,h:(4+Math.random()*5)*k,
      rot:Math.random()*6.28,vr:(Math.random()-.5)*.25,
      tilt:Math.random()*6.28,vt:.05+Math.random()*.12,
      sway:Math.random()*6.28,
      color:this.COLORS[Math.floor(Math.random()*this.COLORS.length)],
      drag:.985+Math.random()*.01};
  },
  burst:function(x,y,n,dir){
    var sp=Math.max(9,Math.min(17,this.H/48));
    for(var i=0;i<n&&this.parts.length<450;i++){
      var ang=(-Math.PI/2)+dir*(.25+Math.random()*.5);
      var v=sp*(.7+Math.random()*.6);
      this.parts.push(this.piece(x,y,Math.cos(ang)*v,Math.sin(ang)*v));
    }
  },
  tick:function(now){
    var dt=Math.min(2.5,(now-this.last)/16.67);this.last=now;
    if(now<this.rainUntil&&this.parts.length<450){
      var rate=Math.max(1,Math.round(this.W/260));
      for(var i=0;i<rate;i++) this.parts.push(this.piece(Math.random()*this.W,-20,(Math.random()-.5)*1.5,1+Math.random()*2));
    }
    var cx=this.cx;cx.clearRect(0,0,this.W,this.H);
    var keep=[];
    for(var j=0;j<this.parts.length;j++){
      var p=this.parts[j];
      p.vx*=Math.pow(p.drag,dt);p.vy=p.vy*Math.pow(p.drag,dt)+.16*dt;
      if(p.vy>3.2) p.vy=3.2+(p.vy-3.2)*.9;
      p.sway+=.05*dt;
      p.x+=(p.vx+Math.sin(p.sway)*.8)*dt;p.y+=p.vy*dt;
      p.rot+=p.vr*dt;p.tilt+=p.vt*dt;
      if(p.y>this.H+30||p.x<-60||p.x>this.W+60){continue}
      keep.push(p);
      cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);cx.fillStyle=p.color;cx.strokeStyle=p.color;
      var sc=Math.cos(p.tilt);
      if(p.shape==='rect'){cx.scale(1,sc);cx.fillRect(-p.w/2,-p.h/2,p.w,p.h)}
      else if(p.shape==='dot'){cx.scale(sc,1);cx.beginPath();cx.arc(0,0,p.h*.7,0,6.283);cx.fill()}
      else{cx.lineWidth=2.4;cx.lineCap='round';cx.beginPath();cx.moveTo(-p.w,0);cx.bezierCurveTo(-p.w/3,-p.w*.6*sc,p.w/3,p.w*.6*sc,p.w,0);cx.stroke()}
      cx.restore();
    }
    this.parts=keep;
    if(keep.length||now<this.rainUntil) this.raf=requestAnimationFrame(this.tick.bind(this));
    else{this.raf=0;cx.clearRect(0,0,this.W,this.H)}
  },
  stop:function(){
    if(this.raf) cancelAnimationFrame(this.raf);
    this.raf=0;this.parts=[];this.rainUntil=0;
    if(this.cx) this.cx.clearRect(0,0,this.W,this.H);
  }
};

/* ---------- validação e formato dos quizzes (esquema 2) ---------- */
function numOr(v,min,max,fallback){
  return (typeof v==='number'&&isFinite(v)&&v>=min&&v<=max)?Math.round(v):fallback;
}
function normalize(raw){
  function str(v,max){return typeof v==='string'?v.trim().slice(0,max):''}
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) return {ok:false,error:'formato inesperado, esperava um objeto de quiz.'};
  var title=str(raw.title,120);
  if(!title) return {ok:false,error:'falta o título ("title").'};
  if(!Array.isArray(raw.questions)||!raw.questions.length) return {ok:false,error:'faltam perguntas ("questions").'};
  if(raw.questions.length>100) return {ok:false,error:'mais de 100 perguntas num quiz.'};
  var qs=[];
  for(var i=0;i<raw.questions.length;i++){
    var r=raw.questions[i]||{}, n=i+1;
    var q=str(r.q,400);
    if(!q) return {ok:false,error:'a pergunta '+n+' não tem texto ("q").'};
    var opts=Array.isArray(r.options)?r.options.map(function(o){return str(o,200)}):[];
    if(opts.length<2||opts.length>6||opts.some(function(o){return !o})) return {ok:false,error:'a pergunta '+n+' precisa de 2 a 6 opções preenchidas ("options").'};
    if(!Number.isInteger(r.answer)||r.answer<0||r.answer>=opts.length) return {ok:false,error:'na pergunta '+n+', "answer" deve ser o índice da opção certa (0 a '+(opts.length-1)+').'};
    var item={q:q,options:opts,answer:r.answer,explain:str(r.explain,600),double:r.double===true};
    var tm=numOr(r.time,0,300,null);
    if(tm!==null) item.time=tm;
    qs.push(item);
  }
  return {ok:true,quiz:{schema:2,title:title,subject:str(raw.subject,60),level:str(raw.level,20),description:str(raw.description,300),timeLimit:numOr(raw.timeLimit,0,300,null),questions:qs}};
}
function plain(q){
  return {title:q.title||'',subject:q.subject||'',level:q.level||'',description:q.description||'',
    timeLimit:numOr(q.timeLimit,0,300,null),
    questions:(q.questions||[]).map(function(x){return {
      q:x.q||'',options:(x.options||[]).map(String),answer:Number.isInteger(x.answer)?x.answer:0,explain:x.explain||'',
      time:numOr(x.time,0,300,null),double:x.double===true
    }})};
}

/* ---------- navegação e render ---------- */
function stopGame(){
  cancelAnimationFrame(S.raf);clearTimeout(S.cd);Snd.musicStop();
}
function leave(){
  stopGame();S.play=null;go('library');
}
function go(view){
  if(S.view==='play'&&view!=='play') stopGame();
  if(view!==S.view) Confetti.stop();
  if((S.view==='host'||S.view==='player')&&view!==S.view) liveStop();
  if(S.view==='admin'&&view!=='admin') stopPreview();
  S.view=view;render();window.scrollTo(0,0);
  var f=app.querySelector('[data-focus]');if(f)f.focus({preventScroll:true});
}
function render(){
  var playing=S.view==='play'||S.view==='host'||S.view==='player';
  document.body.classList.toggle('playing',playing);
  app.classList.toggle('wide',playing);
  hero.hidden=playing;
  hero.classList.toggle('compact',S.view!=='library');
  var v=S.view==='host'?viewHost():S.view==='player'?viewPlayer():S.view==='play'?viewPlay():S.view==='edit'?viewEditor():S.view==='admin'?viewAdmin():viewLibrary();
  app.replaceChildren(v);
}

/* ---------- biblioteca ---------- */
function viewLibrary(){
  var root=h('div',{class:'stack'});
  var visible=S.quizzes.filter(function(q){return !q.hidden});
  var hiddenN=S.quizzes.length-visible.length;
  root.append(h('div',{class:'bar'},
    h('h2',{class:'h2',tabindex:'-1','data-focus':''},'Quizzes',visible.length?h('span',{class:'count'},visible.length):null),
    h('div',{class:'qa'},
      S.canWrite?h('button',{class:'btn primary',onclick:function(){openEditor(null)}},'Novo quiz'):null,
      S.canWrite?h('button',{class:'btn',onclick:function(){S.setDraft=null;S.adminMsg='';S.adminConfirm=null;S.seedState=null;go('admin')}},'Gestão'):null,
      S.db?h('button',{class:'btn','aria-expanded':String(S.toolsOpen),onclick:function(){S.toolsOpen=!S.toolsOpen;render()}},'Importar / exportar'):null)));
  if(S.hostResume) root.append(h('div',{class:'panel live-banner'},
    h('div',null,h('strong',null,'Você tem um jogo ao vivo em andamento'),h('div',{class:'muted'},(S.hostResume.title||'Quiz')+' · PIN '+fmtPin(S.hostResume.pin))),
    h('div',{class:'qa'},
      h('button',{class:'btn primary',onclick:function(){Snd.init();hostResume()}},'Retomar'),
      h('button',{class:'btn',onclick:async function(){
        var pin=S.hostResume.pin;S.hostResume=null;store.set('cq:hostPin','');render();
        try{await S.db.doc('games/'+pin).update({status:'ended',cancelled:true,updatedAt:new Date().toISOString()})}catch(e){}
      }},'Terminar'))));
  if(S.db&&S.myId){
    var pinIn=h('input',{id:'join-pin',class:'in pin-in',type:'text',inputmode:'numeric',autocomplete:'off',maxlength:'7',placeholder:'000 000','aria-label':'PIN do jogo',value:S.joinPin||null});
    var pinErr=h('p',{class:'msg bad',id:'pin-err',role:'alert'});
    var doJoin=function(){
      var d=(pinIn.value||'').replace(/\D/g,'');
      if(d.length!==6){pinErr.textContent='O PIN tem 6 dígitos.';pinIn.focus();return}
      S.joinPin='';Snd.init();playerOpen(d);
    };
    pinIn.addEventListener('input',function(){S.joinPin=pinIn.value;pinErr.textContent=''});
    pinIn.addEventListener('keydown',function(e){if(e.key==='Enter')doJoin()});
    root.append(h('div',{class:'panel joinbox'},
      h('label',{class:'lbl',for:'join-pin',style:'margin:0'},'Entrar em um jogo ao vivo'),
      h('div',{class:'joinrow'},pinIn,h('button',{class:'btn primary',onclick:doJoin},'Entrar')),
      pinErr));
  }
  if(S.libMsg) root.append(h('p',{class:'msg bad',role:'alert'},S.libMsg));
  if(S.toolsOpen) root.append(toolsPanel());
  if(!S.loaded) root.append(h('p',{class:'empty'},'Carregando os quizzes…'));
  else if(S.failed) root.append(h('div',{class:'empty'},
    h('strong',null,S.setupMissing?'Este site ainda não está conectado a um banco de dados.':'Não consegui conectar ao banco de dados.'),
    S.setupMissing?'Preencha o arquivo firebase-config.js seguindo o guia do README.':'Verifique sua conexão com a internet e recarregue a página.'+(S.failMsg?' ('+S.failMsg+')':'')));
  else if(!visible.length) root.append(h('div',{class:'empty'},h('strong',null,'Ainda não há quizzes visíveis.'),S.canWrite?(hiddenN?'Há '+plural(hiddenN,'quiz oculto','quizzes ocultos')+'. Mostre-os em “Gestão”.':'Crie o primeiro em “Novo quiz” ou importe um JSON.'):'Quando alguém adicionar quizzes, eles aparecem aqui.'));
  else root.append(h('ul',{class:'list'},visible.map(quizRow)));
  if(S.canWrite&&hiddenN&&visible.length) root.append(h('p',{class:'muted'},plural(hiddenN,'quiz oculto','quizzes ocultos')+' dos jogadores. Gerencie a visibilidade em “Gestão”.'));
  if(S.canWrite&&S.loaded&&!S.failed&&!S.quizzes.length) root.append(h('div',null,h('button',{class:'btn primary',id:'seed-btn',onclick:loadSeed},'Carregar quizzes iniciais')));
  if(S.auth) root.append(accountRow());
  return root;
}
function accountRow(){
  var row=h('div',{class:'acct'});
  if(S.canWrite) row.append(h('span',{class:'muted'},'Gestor: '+S.authEmail),h('button',{class:'btn ghost sm',onclick:adminLogout},'Sair'));
  else if(S.authEmail) row.append(h('span',{class:'muted'},S.authEmail+' não tem permissão de gestor neste site.'),h('button',{class:'btn ghost sm',onclick:adminLogout},'Sair'));
  else row.append(h('button',{class:'btn ghost sm',onclick:adminLogin},'Entrar como gestor'));
  if(S.authErr) row.append(h('p',{class:'msg bad'},'Problema de autenticação: '+S.authErr));
  return row;
}
function loadSeed(){
  var b=document.getElementById('seed-btn');if(b){b.disabled=true;b.textContent='Carregando…'}
  fetch('data/quizzes.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}).then(function(t){
    S.toolsOpen=true;S.toolsText=t;render();
    doImport().then(function(){if(!S.toolsBad){S.toolsOpen=false;render()}});
  }).catch(function(e){S.libMsg='Não consegui ler os quizzes iniciais: '+e.message;render()});
}
function quizRow(q){
  var n=(q.questions||[]).length, b=bestOf(q.id), tl=numOr(q.timeLimit,0,300,defTime());
  return h('li',{class:'quiz'},
    h('div',null,
      h('h3',null,q.title||'Sem título'),
      h('div',{class:'meta'},
        q.subject?h('span',null,q.subject):null,
        q.level?h('span',null,'Nível '+q.level):null,
        h('span',null,plural(n,'pergunta','perguntas')),
        h('span',null,timeLabel(tl)),
        b?h('span',{class:'best'},'Melhor '+(b.points!=null?fmt(b.points)+' pts':b.score+'/'+b.total)):null),
      q.description?h('p',{class:'desc'},q.description):null),
    h('div',{class:'qa'},
      h('button',{class:'btn primary',disabled:!n,onclick:function(){startPlay(q)}},'Jogar'),
      S.canHost?h('button',{class:'btn',disabled:!n,onclick:function(e){
        var b=e.currentTarget;b.disabled=true;b.textContent='Preparando…';
        Snd.init();
        hostCreate(q).catch(function(err){S.libMsg='Não foi possível iniciar o jogo ao vivo: '+(err&&err.message||'erro desconhecido');render()});
      }},'Ao vivo'):null,
      S.canWrite?h('button',{class:'btn',onclick:function(){openEditor(q)}},'Editar'):null));
}

/* ---------- importar / exportar ---------- */
function setToolsMsg(text,bad){
  S.toolsMsg=text;S.toolsBad=!!bad;
  var el=document.getElementById('tools-msg');
  if(el){el.textContent=text;el.className='msg '+(bad?'bad':'good')}
}
function toolsPanel(){
  var ta=h('textarea',{id:'tools-text',class:'in mono',spellcheck:'false',
    placeholder:'{\n  "quizzes": [\n    {\n      "title": "…",\n      "timeLimit": 20,\n      "questions": [\n        { "q": "Eu ___ amanhã.", "options": ["falarei","falei"], "answer": 0, "explain": "…", "time": 15, "double": false }\n      ]\n    }\n  ]\n}'});
  ta.value=S.toolsText;
  ta.addEventListener('input',function(){S.toolsText=ta.value});
  var msg=h('p',{id:'tools-msg',class:'msg '+(S.toolsBad?'bad':'good'),role:'status'},S.toolsMsg);
  return h('div',{class:'panel stack'},
    h('div',null,h('label',{class:'lbl',for:'tools-text'},'JSON dos quizzes'),ta),
    h('p',{class:'muted'},'Aceita um quiz, uma lista de quizzes ou {"quizzes":[…]}. “answer” é o índice da opção certa, a começar em 0. “timeLimit” e “time” são segundos (0 = sem limite) e “double” dobra os pontos da pergunta.'),
    h('div',{class:'qa'},
      h('button',{class:'btn',onclick:function(){
        S.toolsText=JSON.stringify({quizzes:S.quizzes.map(plain)},null,2);ta.value=S.toolsText;
        setToolsMsg('Exportei '+plural(S.quizzes.length,'quiz','quizzes')+'.',false);
      }},'Exportar tudo'),
      h('button',{class:'btn',onclick:function(){
        if(!ta.value) return setToolsMsg('Não há nada para copiar.',true);
        var ok=function(){setToolsMsg('Copiado.',false)};
        var fail=function(){ta.focus();ta.select();setToolsMsg('Selecione o texto e copie com o teclado.',true)};
        try{navigator.clipboard.writeText(ta.value).then(ok,fail)}catch(e){fail()}
      }},'Copiar'),
      S.canWrite?h('button',{class:'btn primary',id:'tools-import',onclick:doImport},'Importar'):null),
    msg);
}
async function doImport(){
  if(S.toolsBusy) return;
  var raw;
  try{raw=JSON.parse(S.toolsText)}catch(e){return setToolsMsg('JSON inválido: '+e.message,true)}
  var list=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.quizzes)?raw.quizzes:[raw]);
  if(!list.length) return setToolsMsg('Não encontrei nenhum quiz.',true);
  var out=[];
  for(var i=0;i<list.length;i++){
    var r=normalize(list[i]);
    if(!r.ok) return setToolsMsg('Quiz '+(i+1)+': '+r.error,true);
    out.push(r.quiz);
  }
  S.toolsBusy=true;
  var btn=document.getElementById('tools-import');if(btn)btn.disabled=true;
  try{
    var order=nextOrder(), now=new Date().toISOString();
    for(var j=0;j<out.length;j++){
      await S.db.collection('quizzes').doc().set(Object.assign({},out[j],{order:order+j,createdAt:now,updatedAt:now}));
    }
    S.toolsText='';
    var ta=document.getElementById('tools-text');if(ta)ta.value='';
    setToolsMsg(out.length===1?'1 quiz importado.':out.length+' quizzes importados.',false);
  }catch(e){
    setToolsMsg('Não foi possível importar: '+(e&&e.message||'erro desconhecido'),true);
  }finally{
    S.toolsBusy=false;
    var b2=document.getElementById('tools-import');if(b2)b2.disabled=false;
  }
}

/* ---------- jogo: preparação ---------- */
function validQs(quiz){
  return (quiz.questions||[]).filter(function(x){
    return x&&x.q&&Array.isArray(x.options)&&x.options.length>=2&&Number.isInteger(x.answer)&&x.answer>=0&&x.answer<x.options.length;
  });
}
function buildQs(quiz){
  var def=numOr(quiz.timeLimit,0,300,defTime());
  var qs=validQs(quiz).map(function(x){
    return {q:x.q,explain:x.explain||'',double:x.double===true,limit:numOr(x.time,0,300,def),
      options:x.options.map(function(t,j){return {t:String(t),ok:j===x.answer}})};
  });
  if(S.shuffle){qs=shuffle(qs);qs.forEach(function(x){x.options=shuffle(x.options)})}
  return qs;
}
function startPlay(quiz){
  var n=validQs(quiz).length;
  if(!n) return;
  var p={quiz:quiz,nq:n,phase:'lobby',name:store.get('cq:name')||'',qs:[],i:0,picked:null,
    score:0,prevScore:0,streak:0,prevStreak:0,bestStreak:0,correct:0,times:[],misses:[],
    gain:0,bonus:0,confirmExit:false,board:null,rank:null,saved:null,myId:null,limitMs:0,t0:0,count:3};
  S.play=p;
  go('play');
  resetMusicPicks();Snd.init();Snd.musicStart('lobby');
  loadBoard(quiz.id).then(function(b){
    if(S.play!==p||p.phase!=='lobby') return;
    p.board=b;
    var el=document.getElementById('lobby-board');
    if(el) el.replaceChildren(boardList(b,null,5,'Ninguém jogou ainda. Seja o primeiro na tabela.'));
  });
}
async function loadBoard(id){
  if(!S.db||!cfg('leaderboard')) return null;
  try{
    var snap=await S.db.collection('quizzes/'+id+'/scores').orderBy('score','desc').limit(cfg('boardSize')).get();
    return snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
  }catch(e){return null}
}
function boardList(entries,myId,max,emptyText){
  if(entries==null) return h('p',{class:'muted'},'Não foi possível carregar a tabela.');
  if(!entries.length) return h('p',{class:'muted'},emptyText);
  return h('ol',{class:'board'},entries.slice(0,max).map(function(e,i){
    return h('li',{class:e.id===myId?'me':null},
      h('span',{class:'rk'},String(i+1)),
      avSvg(avOf(e),30),
      h('span',{class:'nm'},e.name||'Jogador'),
      h('span',{class:'pt'},fmt(e.score||0)));
  }));
}

/* ---------- jogo: barra superior ---------- */
function toggleBtn(kind){
  var on=kind==='sfx'?Snd.sfx:Snd.music;
  var label=kind==='sfx'?'Efeitos sonoros':'Música';
  var btn=h('button',{class:'icon-btn','aria-pressed':String(on),'aria-label':label,title:label});
  function paint(){
    var v=kind==='sfx'?Snd.sfx:Snd.music;
    btn.setAttribute('aria-pressed',String(v));
    btn.replaceChildren(icon(kind==='sfx'?(v?'sfxOn':'sfxOff'):(v?'musicOn':'musicOff')));
  }
  btn.addEventListener('click',function(){
    Snd.init();
    if(kind==='sfx'){Snd.sfx=!Snd.sfx;store.set('cq:sfx',Snd.sfx?'1':'0');if(Snd.sfx)Snd.click()}
    else{
      Snd.music=!Snd.music;store.set('cq:music',Snd.music?'1':'0');
      if(!Snd.music) Snd.silence();
      else if(Snd.phase) Snd.musicStart(Snd.phase);
    }
    paint();
  });
  paint();
  return btn;
}
function countUp(el,from,to){
  if(!el) return;
  if(reduceMotion||from===to){el.textContent=fmt(to);return}
  var t0=performance.now(), dur=700;
  (function step(now){
    var k=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-k,3);
    el.textContent=fmt(from+(to-from)*e);
    if(k<1&&document.body.contains(el)) requestAnimationFrame(step);
  })(t0);
}
function gameBar(p,withCounter){
  var animate=p.phase==='reveal'&&p.gain>0;
  var score=h('span',{class:'chip score'},fmt(animate?p.prevScore:p.score));
  S.refs.score=score;
  if(animate) requestAnimationFrame(function(){countUp(score,p.prevScore,p.score)});
  var exit=h('button',{class:'icon-btn','aria-label':'Sair do quiz',title:'Sair do quiz','aria-expanded':p.phase==='lobby'?null:String(!!p.confirmExit),onclick:function(){
      if(p.phase==='lobby') leave(); else {p.confirmExit=!p.confirmExit;render()}
    }},icon('close'));
  return h('div',{class:'gbar'},
    withCounter?h('span',{class:'chip'},(p.i+1)+' / '+p.qs.length):null,
    h('span',{class:'gtitle'},p.quiz.title||''),
    h('div',{class:'gactions'},p.phase==='lobby'?null:h('span',{class:'gav'},avSvg(S.avatar,36)),p.phase==='lobby'?null:score,toggleBtn('sfx'),toggleBtn('music'),exit),
    p.confirmExit?confirmRow('Sair agora? Você vai perder o progresso deste jogo.','Sair',leave,function(){p.confirmExit=false;render()}):null);
}
function confirmRow(text,yesLabel,onYes,onNo){
  return h('div',{class:'confirm',role:'alert'},
    h('span',null,text),
    h('div',{class:'qa'},
      h('button',{class:'btn danger sm',onclick:onYes},yesLabel),
      h('button',{class:'btn sm',onclick:onNo},'Continuar')));
}

/* ---------- jogo: fases ---------- */
function viewPlay(){
  var p=S.play;
  S.refs={};
  if(p.phase==='lobby') return viewLobby(p);
  if(p.phase==='countdown') return viewCountdown(p);
  if(p.phase==='question') return viewQuestion(p);
  if(p.phase==='reveal') return viewReveal(p);
  return viewDone(p);
}
function viewLobby(p){
  var tl=numOr(p.quiz.timeLimit,0,300,defTime());
  var nick=h('input',{id:'nick',class:'in',type:'text',maxlength:'16',autocomplete:'nickname',placeholder:'Jogador',value:p.name||null});
  nick.addEventListener('input',function(){p.name=nick.value});
  var root=h('div',{class:'game stack'});
  root.append(gameBar(p,false));
  root.append(h('div',{class:'gcard'},
    h('div',null,
      h('h2',{class:'qtext',tabindex:'-1','data-focus':''},p.quiz.title||'Quiz'),
      h('div',{class:'meta',style:'margin-top:8px'},
        h('span',null,plural(p.nq,'pergunta','perguntas')),
        h('span',null,timeLabel(tl)),
        p.quiz.level?h('span',null,'Nível '+p.quiz.level):null)),
    h('p',null,(tl>0&&cfg('minPct')<100?'Responda rápido: acertar nos primeiros segundos vale até '+fmt(cfg('maxPoints'))+' pontos.':'Cada resposta certa vale '+fmt(cfg('maxPoints'))+' pontos.')+(cfg('streakStep')>0?' Acertar seguido dá bônus.':'')),
    h('div',{class:'ident'},
      h('div',{class:'ident-av'},avSvg(S.avatar,88)),
      h('div',{class:'ident-main'},
        h('label',{class:'lbl',for:'nick',style:'margin:0'},'Seu nome na tabela'),nick,
        h('div',null,h('button',{class:'btn sm',id:'av-toggle','aria-expanded':String(!!p.pickOpen),onclick:function(){p.pickOpen=!p.pickOpen;rerenderKeepScroll()}},p.pickOpen?'Fechar avatares':'Escolher avatar')))),
    p.pickOpen?avatarPicker():null,
    h('div',{class:'stack',style:'gap:10px'},
      h('label',{class:'check'},h('input',{type:'checkbox',id:'o-sfx',checked:Snd.sfx,onchange:function(e){Snd.sfx=e.target.checked;store.set('cq:sfx',Snd.sfx?'1':'0');Snd.init();if(Snd.sfx)Snd.click()}}),'Efeitos sonoros'),
      h('label',{class:'check'},h('input',{type:'checkbox',id:'o-music',checked:Snd.music,onchange:function(e){Snd.music=e.target.checked;store.set('cq:music',Snd.music?'1':'0');Snd.init();if(!Snd.music)Snd.silence();else if(Snd.phase)Snd.musicStart(Snd.phase)}}),'Música'),
      h('label',{class:'check'},h('input',{type:'checkbox',id:'o-shuffle',checked:S.shuffle,onchange:function(e){S.shuffle=e.target.checked;store.set('cq:shuffle',S.shuffle?'1':'0')}}),'Embaralhar perguntas e opções')),
    h('div',null,h('button',{class:'btn go big',onclick:beginGame},'Começar'))));
  if(cfg('leaderboard')) root.append(h('div',{class:'gcard'},
    h('h3',{class:'lbl',style:'margin:0'},'Melhores pontuações'),
    h('div',{id:'lobby-board'},p.board?boardList(p.board,null,5,'Ninguém jogou ainda. Seja o primeiro na tabela.'):h('p',{class:'muted'},'Carregando a tabela…'))));
  return root;
}
function beginGame(){
  var p=S.play, nick=document.getElementById('nick');
  p.name=((nick?nick.value:p.name)||'').trim().slice(0,16)||'Jogador';
  store.set('cq:name',p.name);
  Snd.init();Snd.click();Snd.musicStop();
  p.qs=buildQs(p.quiz);
  p.i=0;p.score=0;p.prevScore=0;p.streak=0;p.bestStreak=0;p.correct=0;p.times=[];p.misses=[];
  if(!cfg('countdown')){Snd.go();beginQuestion();return}
  p.phase='countdown';p.count=3;
  render();window.scrollTo(0,0);
  Snd.beep(3);
  S.cd=setTimeout(cdStep,1000);
}
function cdStep(){
  var p=S.play;
  if(!p||p.phase!=='countdown') return;
  p.count--;
  if(p.count<=0){Snd.go();beginQuestion();return}
  render();Snd.beep(p.count);
  S.cd=setTimeout(cdStep,1000);
}
function viewCountdown(p){
  return h('div',{class:'game'},
    h('div',{class:'cdown',role:'status'},
      h('div',{class:'s'},p.quiz.title||''),
      h('div',{class:'n'},String(p.count)),
      h('div',{class:'t'},'Prepare-se!')));
}
function beginQuestion(){
  var p=S.play;
  p.phase='question';p.picked=null;p.confirmExit=false;
  p.limitMs=p.qs[p.i].limit*1000;
  p.t0=performance.now();p.lastSec=-1;
  render();window.scrollTo(0,0);
  var f=app.querySelector('[data-focus]');if(f)f.focus({preventScroll:true});
  Snd.whoosh();Snd.musicStart();
  S.raf=requestAnimationFrame(loop);
}
function ringEl(secs){
  var num=h('span',{class:'num'},String(secs));
  var wrap=h('div',{class:'ring',role:'timer','aria-label':'Tempo restante'});
  wrap.append(tpl('<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="trk" cx="32" cy="32" r="26"/><circle class="prg" cx="32" cy="32" r="26"/></svg>'));
  wrap.append(num);
  S.refs.ring=wrap.querySelector('.prg');S.refs.num=num;
  return wrap;
}
function viewQuestion(p){
  var q=p.qs[p.i], timed=p.limitMs>0;
  var root=h('div',{class:'game stack','data-tstate':'ok'});
  S.refs.root=root;
  root.append(gameBar(p,true));
  if(timed){
    var fill=h('i');
    S.refs.bar=fill;
    root.append(h('div',{class:'tbar'},fill));
  }
  root.append(h('div',{class:'qcard'},
    timed?ringEl(q.limit):null,
    h('div',{class:'qbody'},
      q.double?h('span',{class:'tag'},'Pontos ×2'):null,
      h('h2',{class:'qtext',tabindex:'-1','data-focus':''},qText(q,false)))));
  root.append(h('div',{class:'tiles'},q.options.map(function(o,i){return tile(o,i,null,false)})));
  return root;
}
function loop(){
  var p=S.play;
  if(!p||p.phase!=='question') return;
  if(p.limitMs>0){
    var el=performance.now()-p.t0, frac=Math.min(1,el/p.limitMs), r=S.refs;
    if(r.ring) r.ring.style.strokeDashoffset=String(CIRC*frac);
    if(r.bar) r.bar.style.transform='scaleX('+(1-frac)+')';
    var secs=Math.max(0,Math.ceil((p.limitMs-el)/1000));
    if(secs!==p.lastSec){
      p.lastSec=secs;
      if(r.num) r.num.textContent=String(secs);
      if(secs<=5&&secs>0) Snd.tick(secs);
      if(secs<=5) Snd.hurry(true);
    }
    var st=(p.limitMs-el)<=5000||frac>.85?'urgent':frac>.6?'warn':'ok';
    if(r.root&&r.root.getAttribute('data-tstate')!==st) r.root.setAttribute('data-tstate',st);
    if(el>=p.limitMs){answer(-1);return}
  }
  S.raf=requestAnimationFrame(loop);
}
function tile(o,i,state,answered){
  return h('button',{class:'ans'+(state?' '+state:''),style:tileStyle(i),disabled:answered,'aria-keyshortcuts':String(i+1),
    onclick:function(){answer(i)}},
    shape(i),
    h('span',{class:'t'},o.t),
    state==='correct'?icon('check',28):state==='wrong'?icon('close',28):h('span'));
}
function answer(i){
  var p=S.play;
  if(!p||p.phase!=='question') return;
  cancelAnimationFrame(S.raf);Snd.musicStop();
  var q=p.qs[p.i];
  var used=Math.min(performance.now()-p.t0,p.limitMs>0?p.limitMs:Infinity);
  var ok=i>=0&&q.options[i].ok;
  p.prevScore=p.score;p.prevStreak=p.streak;p.gain=0;p.bonus=0;
  if(ok){
    var frac=p.limitMs>0?Math.min(1,used/p.limitMs):0;
    var base=Math.round(cfg('maxPoints')*(1-frac*(1-cfg('minPct')/100)));
    if(q.double) base*=2;
    p.streak++;
    var step=cfg('streakStep');
    p.bonus=p.streak>=2&&step>0?Math.min((p.streak-1)*step,cfg('streakCap')):0;
    p.gain=base+p.bonus;
    p.score+=p.gain;p.correct++;p.times.push(used);
    p.bestStreak=Math.max(p.bestStreak,p.streak);
    Snd.correct();if(p.bonus) Snd.streak();
  }else{
    p.streak=0;
    p.misses.push({q:q,chosen:i>=0?q.options[i].t:null});
    if(i>=0) Snd.wrong(); else Snd.timeout();
  }
  p.picked=i;p.phase='reveal';
  render();
  var nb=document.getElementById('next-btn');if(nb)nb.focus({preventScroll:true});
}
function viewReveal(p){
  var q=p.qs[p.i], ok=p.picked>=0&&q.options[p.picked].ok, last=p.i+1>=p.qs.length;
  var root=h('div',{class:'game stack is-reveal'});
  root.append(gameBar(p,true));
  root.append(h('div',{class:'qcard'},h('div',{class:'qbody'},
    q.double?h('span',{class:'tag'},'Pontos ×2'):null,
    h('h2',{class:'qtext'},qText(q,true)))));
  root.append(h('div',{class:'tiles'},q.options.map(function(o,i){
    return tile(o,i,o.ok?'correct':(i===p.picked?'wrong':'faded'),true);
  })));
  root.append(h('div',{class:'reveal '+(ok?'ok':'bad'),role:'status'},
    h('div',{class:'head'},ok?'Certo!':(p.picked<0?'Tempo esgotado':'Não foi essa.')),
    ok?h('div',{class:'gain'},'+'+fmt(p.gain)):null,
    ok&&q.double?h('div',{class:'note'},'Pontos a dobrar aplicados.'):null,
    ok&&p.bonus?h('div',{class:'streak'},icon('flame',20),'Sequência de '+p.streak+': +'+p.bonus+' de bônus'):null,
    ok&&!p.bonus&&p.streak===1?h('div',{class:'note'},'Acerte a próxima para começar uma sequência.'):null,
    ok?null:h('div',null,'Resposta certa: ',h('b',null,correctOf(q))),
    !ok&&p.prevStreak>=2?h('div',{class:'note'},'Você perdeu a sequência de '+p.prevStreak+'.'):null,
    q.explain&&cfg('showExplain')?h('div',{class:'expl'},q.explain):null,
    h('div',{class:'footbar'},h('button',{class:'btn primary big',id:'next-btn',onclick:next},last?'Ver resultado':'Próxima'))));
  return root;
}
function next(){
  var p=S.play;
  Snd.click();
  if(p.i+1>=p.qs.length) finish();
  else{p.i++;beginQuestion()}
}

/* ---------- jogo: resultado e tabela ---------- */
function finish(){
  var p=S.play;
  p.phase='done';p.confirmExit=false;p.board=null;
  var cur=bestOf(p.quiz.id);
  if(!cur||cur.points==null||p.score>cur.points) store.set('cq:best:'+p.quiz.id,JSON.stringify({points:p.score,score:p.correct,total:p.qs.length}));
  render();window.scrollTo(0,0);
  var f=app.querySelector('[data-focus]');if(f)f.focus({preventScroll:true});
  playWinner(p.correct/p.qs.length);
  Confetti.start(p.correct/p.qs.length>=.5?{}:{light:true});
  saveScore(p);
}
async function saveScore(p){
  if(!cfg('leaderboard')) return;
  var path='quizzes/'+p.quiz.id+'/scores';
  var avg=p.times.length?Math.round(p.times.reduce(function(a,b){return a+b},0)/p.times.length):0;
  try{
    if(S.db&&S.myId){
      var ref=await S.db.collection(path).add({name:p.name,avatar:avStr(S.avatar),score:p.score,correct:p.correct,total:p.qs.length,avgMs:avg,streak:p.bestStreak,at:new Date().toISOString()});
      p.myId=ref.id;p.saved=true;
    }else p.saved=false;
  }catch(e){p.saved=false}
  p.board=await loadBoard(p.quiz.id);
  if(p.board){
    var idx=p.board.findIndex(function(e){return e.id===p.myId});
    if(idx>=0) p.rank=idx+1;
    else{
      try{
        var above=await S.db.collection(path).where('score','>',p.score).get();
        p.rank=above.size+1;
      }catch(e){}
    }
  }
  if(S.play===p&&p.phase==='done') render();
}
function ordinal(n){return n+'º'}
function viewDone(p){
  var n=p.qs.length, acc=Math.round(p.correct/n*100);
  var avg=p.times.length?p.times.reduce(function(a,b){return a+b},0)/p.times.length/1000:0;
  var root=h('div',{class:'game stack'});
  root.append(gameBar(p,false));
  var rankText=p.rank?'Você ficou em '+ordinal(p.rank)+' lugar'+(p.saved?'':' (pontuação não registrada)'):'';
  root.append(h('div',{class:'gcard'},
    h('h2',{class:'final','data-focus':'',tabindex:'-1'},
      avSvg(S.avatar,96),
      h('span',{class:'who'},p.name||'Jogador'),
      h('span',{class:'big-score'},fmt(p.score)),
      h('span',{class:'muted'},'pontos'),
      rankText?h('span',{class:'rank'},rankText):null),
    !p.saved&&p.saved!==null?h('p',{class:'muted',style:'text-align:center'},'Sua pontuação não foi registrada na tabela. Verifique sua conexão com a internet.'):null));
  root.append(h('div',{class:'stats'},
    h('div',{class:'stat'},h('b',null,p.correct+'/'+n),h('span',null,'Certas')),
    h('div',{class:'stat'},h('b',null,acc+'%'),h('span',null,'Precisão')),
    h('div',{class:'stat'},h('b',null,p.times.length?avg.toFixed(1)+' s':'—'),h('span',null,'Tempo médio')),
    h('div',{class:'stat'},h('b',null,String(p.bestStreak)),h('span',null,'Maior sequência'))));
  if(cfg('leaderboard')) root.append(h('div',{class:'gcard'},
    h('h3',{class:'lbl',style:'margin:0'},'Tabela do quiz'),
    p.board===null&&p.saved===null?h('p',{class:'muted'},'Carregando a tabela…'):tableBlock(p)));
  if(p.misses.length){
    root.append(h('h3',{class:'sec-title'},plural(p.misses.length,'erro para rever','erros para rever')));
    root.append(h('ul',{class:'list'},p.misses.map(function(m){
      return h('li',{class:'miss'},
        h('div',{class:'q'},qText(m.q,true)),
        h('div',{class:'row bad'},m.chosen===null?'Sem resposta (tempo esgotado)':['Você escolheu: ',h('b',null,m.chosen)]),
        h('div',{class:'row ok'},'Resposta certa: ',h('b',null,correctOf(m.q))),
        m.q.explain?h('div',{class:'row'},m.q.explain):null);
    })));
  }
  root.append(h('div',{class:'footbar'},
    h('button',{class:'btn go big',onclick:function(){startPlay(p.quiz)}},'Jogar de novo'),
    h('button',{class:'btn wh big',onclick:leave},'Biblioteca')));
  return root;
}
function tableBlock(p){
  var b=p.board;
  if(!b) return h('p',{class:'muted'},'Não foi possível carregar a tabela.');
  if(!b.length) return h('p',{class:'muted'},'Ainda não há pontuações registradas.');
  return podiumBlock(b,p.myId,p);
}
function podiumBlock(b,myId,owner){
  var p={myId:myId};
  var animate=!!owner&&!owner.podiumShown&&!reduceMotion;
  if(owner) owner.podiumShown=true;
  var top=b.slice(0,3), wrap=h('div',{class:'stack'});
  var order=top.length>=3?[1,0,2]:top.map(function(_,i){return i});
  wrap.append(h('div',{class:'podium'+(animate?' anim':'')},order.map(function(i){
    var e=top[i];
    return h('div',{class:'pod p'+(i+1)+(e.id===p.myId?' me':'')},
      avSvg(avOf(e),i===0?60:48),
      h('span',{class:'nm'},e.name||'Jogador'),
      h('span',{class:'pt'},fmt(e.score||0)),
      h('div',{class:'blk'},String(i+1)));
  })));
  if(b.length>3){
    var rest=b.slice(3);
    var ol=h('ol',{class:'board',start:'4'},rest.map(function(e,k){
      return h('li',{class:e.id===p.myId?'me':null},
        h('span',{class:'rk'},String(k+4)),
        avSvg(avOf(e),30),
        h('span',{class:'nm'},e.name||'Jogador'),
        h('span',{class:'pt'},fmt(e.score||0)));
    }));
    wrap.append(ol);
  }
  return wrap;
}

/* ---------- jogo: texto da pergunta ---------- */
function correctOf(q){return q.options.filter(function(o){return o.ok})[0].t}
var BLANK_RE=/_{3,}/;
function cleanQ(s){return String(s).replace(/^\s*\d+[.)]\s+/,'')}
function splitAnswer(a,n){
  if(n<2) return [a];
  var parts=String(a).split(/\s+[-–—|]\s+|\s*[\/;]\s*/).map(function(s){return s.trim()}).filter(Boolean);
  return parts.length===n?parts:null;
}
function qText(q,filled){
  var text=cleanQ(q.q), parts=text.split(BLANK_RE);
  if(parts.length===1) return [text];
  var n=parts.length-1, ans=filled?splitAnswer(correctOf(q),n):null, out=[];
  parts.forEach(function(t,i){
    out.push(t);
    if(i<n){
      var fill=!filled?'    ':ans?ans[i]:(i===0?correctOf(q):'…');
      out.push(h('span',{class:'blank'+(filled?' filled':'')},fill));
    }
  });
  return out;
}

/* ---------- editor ---------- */
function blankQ(){return {q:'',options:['','','',''],answer:0,explain:'',time:null,double:false}}
function openEditor(q){
  S.draft=q?plain(q):{title:'',subject:'',level:'',description:'',timeLimit:null,questions:[blankQ()]};
  S.draftId=q?q.id:null;S.confirmDelete=false;S.saving=false;
  go('edit');
}
function field(label,id,obj,key,o){
  o=o||{};
  var el=h(o.area?'textarea':'input',{id:id,class:'in',placeholder:o.ph||null,maxlength:o.max||null,rows:o.area?String(o.rows||3):null,type:o.area?null:'text'});
  el.value=obj[key];
  el.addEventListener('input',function(){obj[key]=el.value});
  return h('div',null,h('label',{class:'lbl',for:id},label),el);
}
function selectField(label,id,value,opts,onchange){
  var sel=h('select',{id:id,class:'in'},opts.map(function(o){
    return h('option',{value:String(o[0]),selected:String(o[0])===String(value)},o[1]);
  }));
  sel.addEventListener('change',function(){onchange(sel.value)});
  return h('div',null,h('label',{class:'lbl',for:id},label),sel);
}
function moveQ(i,d){
  var a=S.draft.questions, t=a[i];a[i]=a[i+d];a[i+d]=t;render();
}
function qEditor(q,qi){
  var d=S.draft, many=d.questions.length;
  var head=h('div',{class:'qhead'},
    h('span',{class:'lbl'},'Pergunta '+(qi+1)),
    h('div',{class:'qa'},
      qi>0?h('button',{class:'btn ghost sm','aria-label':'Subir a pergunta '+(qi+1),onclick:function(){moveQ(qi,-1)}},'↑'):null,
      qi<many-1?h('button',{class:'btn ghost sm','aria-label':'Descer a pergunta '+(qi+1),onclick:function(){moveQ(qi,1)}},'↓'):null,
      many>1?h('button',{class:'btn ghost sm',onclick:function(){d.questions.splice(qi,1);render()}},'Remover'):null));
  var rows=q.options.map(function(o,oi){
    var inp=h('input',{type:'text',id:'q'+qi+'-o'+oi,class:'in',placeholder:'Opção '+LET[oi],maxlength:'200','aria-label':'Texto da opção '+LET[oi]});
    inp.value=o;
    inp.addEventListener('input',function(){q.options[oi]=inp.value});
    var sb=h('span',{class:'shapeb',style:tileStyle(oi),'aria-hidden':'true'});
    sb.append(shape(oi));
    return h('div',{class:'orow'},
      h('input',{type:'radio',name:'ans'+qi,checked:q.answer===oi,'aria-label':'A opção '+LET[oi]+' é a certa',onchange:function(){q.answer=oi}}),
      sb,
      inp,
      q.options.length>2?h('button',{class:'btn ghost sm','aria-label':'Remover a opção '+LET[oi],onclick:function(){
        q.options.splice(oi,1);
        if(q.answer===oi) q.answer=0; else if(q.answer>oi) q.answer--;
        render();
      }},'×'):h('span'));
  });
  return h('div',{class:'qedit'},
    head,
    field('Texto da pergunta (use ___ para cada lacuna)','q'+qi+'-text',q,'q',{area:true,rows:2,max:400,ph:'Amanhã eu ___ (falar) com o professor.'}),
    h('p',{class:'muted',style:'margin-top:-6px'},'Com duas ou mais lacunas, separe as partes da resposta com “ - ”, por exemplo: éramos - tínhamos.'),
    h('div',{role:'radiogroup','aria-label':'Opções da pergunta '+(qi+1)},
      h('span',{class:'lbl opts-label'},'Opções (marque a certa)'),
      rows,
      h('div',{class:'qa'},
        q.options.length<6?h('button',{class:'btn sm',onclick:function(){
          q.options.push('');render();
          var el=document.getElementById('q'+qi+'-o'+(q.options.length-1));if(el)el.focus();
        }},'Adicionar opção'):null,
        h('button',{class:'btn sm',onclick:function(){
          q.options=['Verdadeiro','Falso'];if(q.answer>1)q.answer=0;render();
        }},'Verdadeiro / Falso'))),
    h('div',{class:'grid2'},
      selectField('Tempo desta pergunta','q'+qi+'-time',q.time==null?'':q.time,[['','Padrão do quiz']].concat(TIMES),function(v){q.time=v===''?null:+v}),
      h('label',{class:'check'},h('input',{type:'checkbox',id:'q'+qi+'-dbl',checked:q.double===true,onchange:function(e){q.double=e.target.checked}}),'Pontos a dobrar (×2)')),
    field('Explicação (aparece depois de responder)','q'+qi+'-explain',q,'explain',{area:true,rows:2,max:600,ph:'Por que esta é a resposta certa.'}));
}
function setEditorErr(t){var el=document.getElementById('editor-err');if(el)el.textContent=t||''}
function viewEditor(){
  var d=S.draft;
  var root=h('div',{class:'stack'});
  root.append(h('div',{class:'bar'},h('button',{class:'btn ghost sm',onclick:function(){go('library')}},'← Biblioteca')));
  root.append(h('h2',{class:'h2',tabindex:'-1','data-focus':''},S.draftId?'Editar quiz':'Novo quiz'));
  root.append(h('div',{class:'panel stack'},
    field('Título','f-title',d,'title',{max:120,ph:'Futuro do indicativo'}),
    h('div',{class:'grid2'},
      field('Disciplina','f-subject',d,'subject',{max:60,ph:'Português'}),
      field('Nível','f-level',d,'level',{max:20,ph:'A2–B1'}),
      selectField('Tempo por pergunta','f-time',d.timeLimit==null?'':d.timeLimit,[['','Padrão das regras']].concat(TIMES),function(v){d.timeLimit=v===''?null:+v})),
    field('Descrição','f-desc',d,'description',{area:true,rows:2,max:300,ph:'Uma frase sobre o que o quiz treina.'})));
  d.questions.forEach(function(q,qi){root.append(qEditor(q,qi))});
  root.append(h('div',null,h('button',{class:'btn',onclick:function(){
    d.questions.push(blankQ());render();
    var el=document.getElementById('q'+(d.questions.length-1)+'-text');if(el)el.focus();
  }},'Adicionar pergunta')));
  root.append(h('p',{id:'editor-err',class:'msg bad',role:'alert'}));
  var foot=h('div',{class:'footbar'},
    h('button',{class:'btn primary',id:'save-btn',onclick:saveDraft},'Salvar quiz'),
    h('button',{class:'btn',onclick:function(){go('library')}},'Cancelar'),
    h('span',{class:'grow'}));
  if(S.draftId){
    if(S.confirmDelete){
      foot.append(h('span',{class:'muted'},'Excluir o quiz e as pontuações dele?'),
        h('button',{class:'btn danger',onclick:deleteQuiz},'Sim, excluir'),
        h('button',{class:'btn',onclick:function(){S.confirmDelete=false;render()}},'Não'));
    }else{
      foot.append(h('button',{class:'btn danger',onclick:function(){S.confirmDelete=true;render()}},'Excluir quiz'));
    }
  }
  root.append(foot);
  return root;
}
async function saveDraft(){
  if(S.saving) return;
  var d=S.draft;
  if(!d.title.trim()) return setEditorErr('Dê um título ao quiz.');
  if(!d.questions.length) return setEditorErr('Adicione pelo menos uma pergunta.');
  for(var i=0;i<d.questions.length;i++){
    var q=d.questions[i];
    if(!q.q.trim()) return setEditorErr('Escreva o texto da pergunta '+(i+1)+'.');
    if(q.options.some(function(o){return !o.trim()})) return setEditorErr('Preencha ou remova as opções vazias da pergunta '+(i+1)+'.');
  }
  var r=normalize(d);
  if(!r.ok) return setEditorErr(r.error);
  S.saving=true;setEditorErr('');
  var btn=document.getElementById('save-btn');if(btn)btn.disabled=true;
  try{
    var existing=S.quizzes.filter(function(x){return x.id===S.draftId})[0];
    var now=new Date().toISOString();
    var id=S.draftId||S.db.collection('quizzes').doc().id;
    var data=Object.assign({},r.quiz,{order:existing&&existing.order!=null?existing.order:nextOrder(),createdAt:(existing&&existing.createdAt)||now,updatedAt:now});
    await S.db.collection('quizzes').doc(id).set(data);
    S.saving=false;go('library');
  }catch(e){
    S.saving=false;
    if(btn)btn.disabled=false;
    setEditorErr('Não foi possível salvar: '+(e&&e.message||'erro desconhecido'));
  }
}
async function deleteQuiz(){
  try{
    try{
      var snap=await S.db.collection('quizzes/'+S.draftId+'/scores').limit(500).get();
      for(var i=0;i<snap.docs.length;i++) await S.db.doc('quizzes/'+S.draftId+'/scores/'+snap.docs[i].id).delete();
    }catch(e){}
    await S.db.collection('quizzes').doc(S.draftId).delete();
    S.confirmDelete=false;go('library');
  }catch(e){
    S.confirmDelete=false;render();
    setEditorErr('Não foi possível excluir: '+(e&&e.message||'erro desconhecido'));
  }
}

/* ---------- ao vivo: comum ---------- */
function siteUrl(){return location.origin+location.pathname}
var QR_SRC=['https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js','https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'];
var qrLoading=null;
function joinUrl(pin){return siteUrl()+'#jogo-'+pin}
function fmtPin(p){p=String(p);return p.slice(0,3)+' '+p.slice(3)}
function hashPin(){var m=/^#jogo-(\d{6})$/.exec(location.hash||'');return m?m[1]:null}
function loadQR(){
  if(typeof window.qrcode==='function') return Promise.resolve(window.qrcode);
  if(qrLoading) return qrLoading;
  qrLoading=new Promise(function(res){
    var i=0;
    (function next(){
      if(i>=QR_SRC.length) return res(null);
      var s=document.createElement('script');s.src=QR_SRC[i++];s.async=true;
      s.onload=function(){typeof window.qrcode==='function'?res(window.qrcode):next()};
      s.onerror=next;
      (document.head||document.documentElement).appendChild(s);
    })();
    setTimeout(function(){res(typeof window.qrcode==='function'?window.qrcode:null)},12000);
  });
  return qrLoading;
}
function qrSvg(text){
  var q=window.qrcode(0,'M');q.addData(text);q.make();
  var n=q.getModuleCount(), m=3, d='';
  for(var r=0;r<n;r++) for(var c=0;c<n;c++) if(q.isDark(r,c)) d+='M'+(c+m)+' '+(r+m)+'h1v1h-1z';
  var size=n+m*2;
  return tpl('<svg class="qr" viewBox="0 0 '+size+' '+size+'" role="img" aria-label="Código QR para entrar no jogo" shape-rendering="crispEdges"><rect width="'+size+'" height="'+size+'" fill="#fff"/><path d="'+d+'" fill="#0B1226"/></svg>');
}
function liveStop(){
  cancelAnimationFrame(S.raf);Snd.musicStop();
  (S.liveUnsubs||[]).forEach(function(u){try{u()}catch(e){}});
  S.liveUnsubs=[];
}
function sub(u){(S.liveUnsubs=S.liveUnsubs||[]).push(u);return u}
function pointsFor(ms,limitSec,dbl,streak){
  var frac=limitSec>0?Math.min(1,ms/(limitSec*1000)):0;
  var base=Math.round(cfg('maxPoints')*(1-frac*(1-cfg('minPct')/100)));
  if(dbl) base*=2;
  var step=cfg('streakStep');
  var bonus=streak>=2&&step>0?Math.min((streak-1)*step,cfg('streakCap')):0;
  return {base:base,bonus:bonus,total:base+bonus};
}
function ranked(scores){
  return Object.keys(scores).map(function(k){return Object.assign({id:k},scores[k])})
    .sort(function(a,b){return (b.score||0)-(a.score||0)||String(a.name||'').localeCompare(String(b.name||''),'pt')});
}
function liveQ(text,options,correct){
  return {q:String(text||''),options:(options||[]).map(function(t,i){return {t:String(t),ok:i===correct}})};
}
function staticTile(t,i,state){
  return h('div',{class:'ans'+(state?' '+state:''),style:tileStyle(i)},
    shape(i),h('span',{class:'t'},t),
    state==='correct'?icon('check',28):h('span'));
}
function liveBar(chips,title,exitNode,scoreNode){
  return h('div',{class:'gbar'},chips,h('span',{class:'gtitle'},title||''),
    h('div',{class:'gactions'},scoreNode||null,toggleBtn('sfx'),toggleBtn('music'),exitNode));
}
function playerRows(list,myId,max,showLast){
  return h('ol',{class:'board'},list.slice(0,max).map(function(e,i){
    return h('li',{class:e.id===myId?'me':null},
      h('span',{class:'rk'},String(i+1)),
      avSvg(avOf(e),30),
      h('span',{class:'nm'},e.name||'Jogador'),
      h('span',{class:'pt'},fmt(e.score||0),showLast&&e.last&&e.last.points?h('small',{class:'delta'},' +'+fmt(e.last.points)):null));
  }));
}
function rankOf(list,id){var i=list.findIndex(function(e){return e.id===id});return i<0?null:i+1}

/* ---------- ao vivo: anfitrião ---------- */
function validTimeMode(v){
  if(v==='default'||v==='quiz') return v;
  if(typeof v==='string'&&/^t\d+$/.test(v)&&TIMES.some(function(t){return 't'+t[0]===v})) return v;
  return 'default';
}
function liveLimit(H,q){
  if(H.timeMode==='quiz') return q.limit;
  if(H.timeMode==='default') return defTime();
  return parseInt(H.timeMode.slice(1),10);
}
function quizTimeSummary(qs){
  var set={};qs.forEach(function(q){set[q.limit]=1});
  var ks=Object.keys(set).map(Number);
  if(ks.length===1) return ks[0]===0?'sem limite':(ks[0]>=60&&ks[0]%60===0?ks[0]/60+' min':ks[0]+' s');
  return 'varia por pergunta';
}
function liveTimeSelect(H){
  var opts=[['default','Padrão das regras ('+timeLabel(defTime()).replace(' por pergunta','')+')'],['quiz','Definido no quiz ('+quizTimeSummary(H.qs)+')']]
    .concat(TIMES.map(function(t){return ['t'+t[0],t[0]===0?'Sem limite para todas':t[1]+' para todas']}));
  return selectField('Tempo por pergunta','live-time',H.timeMode,opts,function(v){
    H.timeMode=validTimeMode(v);
    hostSet({timeMode:H.timeMode}).catch(function(){});
  });
}
async function hostCreate(quiz){
  S.libMsg='';resetMusicPicks();
  var qs=buildQs(quiz).map(function(x){
    return {q:x.q,explain:x.explain,double:x.double,limit:x.limit,options:x.options.map(function(o){return o.t}),answer:x.options.findIndex(function(o){return o.ok})};
  });
  if(!qs.length) return;
  var pin=null;
  for(var t=0;t<8&&!pin;t++){
    var c=String(100000+Math.floor(Math.random()*900000));
    var s=await S.db.doc('games/'+c).get();
    if(!s.exists) pin=c;
  }
  if(!pin) throw new Error('não consegui gerar um PIN livre.');
  var now=new Date().toISOString();
  await S.db.doc('gamekeys/'+pin).set({qs:qs,quizId:quiz.id,at:now});
  var game={pin:pin,quizId:quiz.id,title:quiz.title||'Quiz',hostId:S.myId||'',status:'lobby',i:-1,n:qs.length,q:null,reveal:null,timeMode:'default',createdAt:now,updatedAt:now};
  await S.db.doc('games/'+pin).set(game);
  store.set('cq:hostPin',pin);
  hostOpen(pin,qs,game);
}
async function hostResume(){
  var r=S.hostResume;if(!r) return;
  try{
    var k=await S.db.doc('gamekeys/'+r.pin).get();
    if(!k.exists) throw new Error('as respostas deste jogo já não existem.');
    S.hostResume=null;
    hostOpen(r.pin,k.data().qs||[],r);
  }catch(e){S.libMsg='Não foi possível retomar: '+(e&&e.message||'erro desconhecido');render()}
}
function hostOpen(pin,qs,game){
  liveStop();
  var H={pin:pin,qs:qs,title:game.title||'Quiz',status:game.status,i:typeof game.i==='number'?game.i:-1,
    players:{},scores:{},answers:{},reveal:game.reveal||null,t0:0,limitMs:0,curLimit:0,busy:false,qr:null,qrFailed:false,confirmExit:false,err:'',ansUnsub:null,
    timeMode:validTimeMode(game.timeMode)};
  S.host=H;
  go('host');
  sub(S.db.collection('games/'+pin+'/players').onSnapshot(function(snap){
    if(S.host!==H) return;
    var o={};snap.docs.forEach(function(d){if(d.exists)o[d.id]=d.data()});
    var grew=Object.keys(o).length>Object.keys(H.players).length;
    H.players=o;
    if(H.status==='lobby'){if(grew)Snd.click();hostPaint()}
    else if(H.status==='question') hostCheckAll();
  },function(){}));
  S.db.collection('games/'+pin+'/scores').get().then(function(snap){
    if(S.host!==H) return;
    snap.docs.forEach(function(d){if(d.exists)H.scores[d.id]=d.data()});
    if(H.status!=='question') hostPaint();
  }).catch(function(){});
  loadQR().then(function(lib){
    if(S.host!==H) return;
    if(lib){try{H.qr=qrSvg(joinUrl(pin))}catch(e){H.qrFailed=true}} else H.qrFailed=true;
    if(H.status==='lobby') hostPaint();
  });
  if(H.status==='question'){H.i=H.i-1;H.status=H.i<0?'lobby':'board';render()}
  if(H.status==='lobby') Snd.musicStart('lobby');
}
function hostPaint(){if(S.view==='host') rerenderKeepScroll()}
function hostErr(e){var H=S.host;if(!H) return;H.err='Não foi possível atualizar o jogo: '+(e&&e.message||'erro desconhecido');hostPaint()}
async function hostSet(fields){
  fields.updatedAt=new Date().toISOString();
  await S.db.doc('games/'+S.host.pin).update(fields);
}
async function hostNextQuestion(){
  var H=S.host;if(!H||H.busy) return;
  if(H.i+1>=H.qs.length) return hostEnd();
  H.busy=true;H.err='';
  try{
    var i=H.i+1, q=H.qs[i];
    H.answers={};
    var lim=liveLimit(H,q);
    await hostSet({status:'question',i:i,q:{text:q.q,options:q.options,limit:lim,double:q.double},reveal:null});
    H.i=i;H.status='question';H.curLimit=lim;H.limitMs=lim*1000;H.t0=performance.now();H.lastSec=-1;H.reveal=null;
    if(H.ansUnsub) H.ansUnsub();
    H.ansUnsub=sub(S.db.collection('games/'+H.pin+'/answers').where('q','==',i).onSnapshot(function(snap){
      if(S.host!==H||H.i!==i) return;
      snap.docs.forEach(function(d){
        var a=d.exists?d.data():null;
        if(a&&typeof a.pid==='string'&&d.id===i+'-'+a.pid&&!(a.pid in H.answers)) H.answers[a.pid]=a;
      });
      hostCheckAll();
    },function(){}));
    render();window.scrollTo(0,0);
    Snd.whoosh();Snd.musicStart();
    cancelAnimationFrame(S.raf);S.raf=requestAnimationFrame(hostLoop);
  }catch(e){hostErr(e)}
  finally{H.busy=false}
}
function hostCheckAll(){
  var H=S.host;if(!H||H.status!=='question') return;
  var total=Object.keys(H.players).length;
  var got=Object.keys(H.answers).filter(function(pid){return pid in H.players}).length;
  var el=document.getElementById('ans-count');
  if(el) el.textContent=got+' de '+total+' responderam';
  if(total>0&&got>=total) hostReveal();
}
function hostLoop(){
  var H=S.host;
  if(!H||H.status!=='question'||S.view!=='host') return;
  if(H.limitMs>0){
    var el=performance.now()-H.t0, frac=Math.min(1,el/H.limitMs), r=S.refs;
    if(r.ring) r.ring.style.strokeDashoffset=String(CIRC*frac);
    if(r.bar) r.bar.style.transform='scaleX('+(1-frac)+')';
    var secs=Math.max(0,Math.ceil((H.limitMs-el)/1000));
    if(secs!==H.lastSec){H.lastSec=secs;if(r.num)r.num.textContent=String(secs);if(secs<=5&&secs>0)Snd.tick(secs);if(secs<=5)Snd.hurry(true)}
    var st=(H.limitMs-el)<=5000||frac>.85?'urgent':frac>.6?'warn':'ok';
    if(r.root&&r.root.getAttribute('data-tstate')!==st) r.root.setAttribute('data-tstate',st);
    if(el>=H.limitMs+400){hostReveal();return}
  }
  S.raf=requestAnimationFrame(hostLoop);
}
async function hostReveal(){
  var H=S.host;if(!H||H.status!=='question'||H.revealing) return;
  H.revealing=true;
  cancelAnimationFrame(S.raf);Snd.musicStop();
  if(H.ansUnsub){H.ansUnsub();H.ansUnsub=null}
  var q=H.qs[H.i], counts=q.options.map(function(){return 0}), writes=[];
  Object.keys(H.players).forEach(function(pid){
    var pl=H.players[pid]||{}, prev=H.scores[pid]||{}, a=H.answers[pid];
    var choice=a&&Number.isInteger(a.choice)&&a.choice>=0&&a.choice<q.options.length?a.choice:-1;
    if(choice>=0) counts[choice]++;
    var ok=choice===q.answer, streak=ok?(prev.streak||0)+1:0;
    var pts=ok?pointsFor(Math.max(0,+a.ms||0),H.curLimit,q.double,streak):{total:0,bonus:0};
    var doc={name:String(pl.name||'Jogador').slice(0,16),avatar:typeof pl.avatar==='string'?pl.avatar.slice(0,40):'',
      score:(prev.score||0)+pts.total,streak:streak,correct:(prev.correct||0)+(ok?1:0),
      last:{i:H.i,ok:ok,points:pts.total,bonus:pts.bonus,choice:choice}};
    H.scores[pid]=doc;
    writes.push(S.db.doc('games/'+H.pin+'/scores/'+pid).set(doc));
  });
  H.reveal={correct:q.answer,counts:counts,explain:cfg('showExplain')?(q.explain||''):''};
  try{
    await Promise.all(writes);
    await hostSet({status:'reveal',reveal:H.reveal});
  }catch(e){H.err='Não foi possível publicar a resposta: '+(e&&e.message||'erro desconhecido')}
  H.status='reveal';H.revealing=false;
  render();window.scrollTo(0,0);
  Snd.correct();
}
async function hostBoard(){
  var H=S.host;if(!H||H.busy) return;
  H.busy=true;
  try{await hostSet({status:'board'});H.status='board';H.busy=false;Snd.whoosh();render();window.scrollTo(0,0)}
  catch(e){H.busy=false;hostErr(e)}
}
async function hostEnd(){
  var H=S.host;if(!H) return;
  try{await hostSet({status:'ended'})}catch(e){}
  H.status='ended';H.confirmExit=false;
  store.set('cq:hostPin','');
  cancelAnimationFrame(S.raf);Snd.musicStop();
  render();window.scrollTo(0,0);
  playWinner(1);
  Confetti.start({ms:8000});
}
async function hostQuit(){
  var H=S.host;
  if(H&&H.status!=='ended'){try{await hostSet({status:'ended',cancelled:true})}catch(e){}}
  store.set('cq:hostPin','');
  S.host=null;go('library');
}
function hostExitNode(H){
  if(H.status==='ended') return h('button',{class:'icon-btn','aria-label':'Voltar à biblioteca',title:'Voltar à biblioteca',onclick:function(){S.host=null;go('library')}},icon('close'));
  return h('button',{class:'icon-btn','aria-label':'Terminar o jogo',title:'Terminar o jogo','aria-expanded':String(!!H.confirmExit),onclick:function(){H.confirmExit=!H.confirmExit;render()}},icon('close'));
}
function viewHost(){
  var H=S.host;
  S.refs={};
  if(!H) return h('div',{class:'game'},h('p',null,'Sem jogo ativo.'));
  var root;
  if(H.status==='lobby') root=hostLobby(H);
  else if(H.status==='question') root=hostQuestion(H);
  else if(H.status==='reveal') root=hostRevealView(H);
  else if(H.status==='board') root=hostBoardView(H);
  else root=hostEndView(H);
  if(H.confirmExit&&H.status!=='ended'){
    var bar=root.querySelector('.gbar');
    if(bar) bar.append(confirmRow('Terminar o jogo para todos os jogadores?','Terminar',hostQuit,function(){H.confirmExit=false;render()}));
  }
  if(H.err) root.insertBefore(h('p',{class:'live-err',role:'alert'},H.err),root.children[1]||null);
  return root;
}
function hostLobby(H){
  var list=Object.keys(H.players).map(function(k){return Object.assign({id:k},H.players[k])})
    .sort(function(a,b){return String(a.at||'').localeCompare(String(b.at||''))});
  var url=joinUrl(H.pin);
  var urlField=h('input',{id:'join-url',class:'in mono-in',type:'text',readonly:true,value:url,'aria-label':'Link do jogo'});
  var copyMsg=h('span',{class:'muted',role:'status',id:'copy-msg'});
  var qrNode=H.qr?H.qr.cloneNode(true):h('div',{class:'qr-fallback'},H.qrFailed?'Não consegui gerar o QR. Use o link ou o PIN.':'Gerando o QR…');
  var root=h('div',{class:'game stack'});
  root.append(liveBar(h('span',{class:'chip'},'Ao vivo'),H.title,hostExitNode(H)));
  root.append(h('div',{class:'hl'},
    h('section',{class:'gcard joincard','aria-labelledby':'join-h'},
      h('h2',{class:'lbl',id:'join-h',style:'margin:0',tabindex:'-1','data-focus':''},'Entre no jogo'),
      h('div',{class:'pinbox'},h('span',{class:'pinlbl'},'PIN do jogo'),h('span',{class:'pinbig'},fmtPin(H.pin))),
      h('div',{class:'qrbox'},qrNode),
      h('p',{class:'muted'},'Aponte a câmera do celular para o QR. No computador, abra a página e digite o PIN em “Entrar em um jogo ao vivo”.'),
      h('div',{class:'copyrow'},urlField,h('button',{class:'btn sm',onclick:function(){
        var ok=function(){copyMsg.textContent='Link copiado.'};
        var fail=function(){urlField.focus();urlField.select();copyMsg.textContent='Selecione o link e copie com o teclado.'};
        try{navigator.clipboard.writeText(url).then(ok,fail)}catch(e){fail()}
      }},'Copiar')),
      copyMsg),
    h('section',{class:'gcard','aria-labelledby':'pl-h'},
      h('div',{class:'bar'},h('h2',{class:'lbl',id:'pl-h',style:'margin:0'},'Jogadores'),h('span',{class:'count'},String(list.length))),
      list.length
        ?h('ul',{class:'plist'},list.map(function(pl){return h('li',{class:'pchip'},avSvg(avOf(pl),40),h('span',null,pl.name||'Jogador'))}))
        :h('p',{class:'waiting'},'Esperando jogadores…'),
      liveTimeSelect(H),
      h('div',{class:'footbar'},
        h('button',{class:'btn go big',disabled:!list.length||H.busy,onclick:hostNextQuestion},'Começar'),
        h('span',{class:'muted'},plural(H.qs.length,'pergunta','perguntas'))))));
  return root;
}
function hostQuestion(H){
  var q=H.qs[H.i], timed=H.limitMs>0, total=Object.keys(H.players).length;
  var ringSecs=H.curLimit;
  var got=Object.keys(H.answers).filter(function(pid){return pid in H.players}).length;
  var root=h('div',{class:'game stack','data-tstate':'ok'});
  S.refs.root=root;
  root.append(liveBar(h('span',{class:'chip'},(H.i+1)+' / '+H.qs.length),H.title,hostExitNode(H)));
  if(timed){var fill=h('i');S.refs.bar=fill;root.append(h('div',{class:'tbar'},fill))}
  root.append(h('div',{class:'qcard'},
    timed?ringEl(ringSecs):null,
    h('div',{class:'qbody'},
      q.double?h('span',{class:'tag'},'Pontos ×2'):null,
      h('h2',{class:'qtext',tabindex:'-1','data-focus':''},qText(liveQ(q.q,q.options,q.answer),false)))));
  root.append(h('div',{class:'tiles'},q.options.map(function(t,i){return staticTile(t,i,null)})));
  root.append(h('div',{class:'footbar'},
    h('span',{class:'chip big-chip',id:'ans-count',role:'status'},got+' de '+total+' responderam'),
    h('span',{class:'grow'}),
    h('button',{class:'btn wh',onclick:hostReveal},'Mostrar resposta já')));
  return root;
}
function hostRevealView(H){
  var q=H.qs[H.i], rv=H.reveal||{counts:[],correct:q.answer};
  var max=Math.max.apply(null,[1].concat(rv.counts||[]));
  var answered=(rv.counts||[]).reduce(function(a,b){return a+b},0), total=Object.keys(H.players).length;
  var right=(rv.counts||[])[q.answer]||0;
  var root=h('div',{class:'game stack'});
  root.append(liveBar(h('span',{class:'chip'},(H.i+1)+' / '+H.qs.length),H.title,hostExitNode(H)));
  root.append(h('div',{class:'qcard'},h('div',{class:'qbody'},h('h2',{class:'qtext',tabindex:'-1','data-focus':''},qText(liveQ(q.q,q.options,q.answer),true)))));
  root.append(h('div',{class:'gcard'},
    h('div',{class:'dist',role:'img','aria-label':'Respostas: '+q.options.map(function(t,i){return t+' '+((rv.counts||[])[i]||0)}).join(', ')},
      q.options.map(function(t,i){
        var n=(rv.counts||[])[i]||0, ok=i===q.answer;
        return h('div',{class:'dcol'+(ok?' ok':' dim'),style:tileStyle(i)},
          h('span',{class:'dn'},String(n)),
          h('div',{class:'dtrack'},h('div',{class:'dbar',style:'height:'+Math.max(4,n/max*100)+'%'})),
          h('div',{class:'dkey'},shape(i),ok?icon('check',20):null));
      })),
    h('ul',{class:'dlegend'},q.options.map(function(t,i){
      return h('li',{class:i===q.answer?'ok':null},h('span',{class:'shapeb',style:tileStyle(i)},shape(i)),h('span',null,t));
    })),
    h('p',{class:'muted'},right+' de '+total+' acertaram'+(answered<total?' · '+(total-answered)+' sem resposta':'')+'.'),
    rv.explain?h('p',null,rv.explain):null));
  root.append(h('div',{class:'footbar'},h('button',{class:'btn go big',disabled:H.busy,onclick:hostBoard},'Ver classificação')));
  return root;
}
function hostBoardView(H){
  var list=ranked(H.scores), last=H.i+1>=H.qs.length;
  var root=h('div',{class:'game stack'});
  root.append(liveBar(h('span',{class:'chip'},(H.i+1)+' / '+H.qs.length),H.title,hostExitNode(H)));
  root.append(h('div',{class:'gcard'},
    h('h2',{class:'h2',tabindex:'-1','data-focus':''},'Classificação'),
    list.length?playerRows(list,null,5,true):h('p',{class:'muted'},'Sem pontuações.')));
  root.append(h('div',{class:'footbar'},
    h('button',{class:'btn go big',disabled:H.busy,onclick:last?hostEnd:hostNextQuestion},last?'Ver pódio':'Próxima pergunta')));
  return root;
}
function hostEndView(H){
  var list=ranked(H.scores);
  var root=h('div',{class:'game stack'});
  root.append(liveBar(h('span',{class:'chip'},'Fim'),H.title,hostExitNode(H)));
  root.append(h('div',{class:'gcard'},
    h('h2',{class:'h2',tabindex:'-1','data-focus':''},'Pódio'),
    list.length?podiumBlock(list,null,H):h('p',{class:'muted'},'Ninguém pontuou neste jogo.')));
  root.append(h('div',{class:'footbar'},h('button',{class:'btn wh big',onclick:function(){S.host=null;go('library')}},'Biblioteca')));
  return root;
}

/* ---------- ao vivo: jogador ---------- */
function playerOpen(pin){
  liveStop();
  var J={pin:pin,game:null,missing:false,loaded:false,joined:false,name:store.get('cq:name')||'',pickOpen:false,
    scores:{},lastQ:-1,arrive:0,choice:null,sent:false,timeUp:false,busy:false,err:'',soundFor:-1};
  S.join=J;
  go('player');
  if(!S.db||!S.myId){J.loaded=true;J.err='Não consegui conectar ao servidor do jogo. Verifique sua conexão e recarregue a página.';render();return}
  sub(S.db.doc('games/'+pin).onSnapshot(function(s){
    if(S.join!==J) return;
    J.loaded=true;
    if(!s.exists){J.missing=true;J.game=null;playerPaint();return}
    var g=s.data(), prev=J.game;
    J.game=g;J.missing=false;
    if(g.status==='question'&&g.i!==J.lastQ){
      J.lastQ=g.i;J.arrive=performance.now();J.choice=null;J.sent=false;J.timeUp=false;
      if(J.joined){render();window.scrollTo(0,0);Snd.whoosh();cancelAnimationFrame(S.raf);S.raf=requestAnimationFrame(playerLoop)}
      return;
    }
    if(prev&&prev.status===g.status&&prev.i===g.i) return;
    if(g.status!=='question') cancelAnimationFrame(S.raf);
    if(g.status==='ended'){Snd.finale(1);Confetti.start({})}
    playerSound();
    render();window.scrollTo(0,0);
  },function(){J.loaded=true;J.err='A conexão com o jogo caiu. Recarregue a página.';playerPaint()}));
  S.db.doc('games/'+pin+'/players/'+S.myId).get().then(function(s){
    if(S.join!==J||!s.exists) return;
    J.joined=true;J.name=s.data().name||J.name;
    playerScores();playerPaint();
  }).catch(function(){});
}
function playerPaint(){if(S.view==='player') rerenderKeepScroll()}
function playerScores(){
  var J=S.join;
  sub(S.db.collection('games/'+J.pin+'/scores').onSnapshot(function(snap){
    if(S.join!==J) return;
    var o={};snap.docs.forEach(function(d){if(d.exists)o[d.id]=d.data()});
    J.scores=o;
    var st=J.game&&J.game.status;
    if(st==='reveal'){playerSound();playerPaint()}
    else if(st==='board'||st==='ended') playerPaint();
  },function(){}));
}
function playerSound(){
  var J=S.join, g=J.game, me=J.scores[S.myId];
  if(!J.joined||!g||g.status!=='reveal'||J.soundFor===g.i) return;
  if(!me||!me.last||me.last.i!==g.i){
    if(g.reveal&&J.choice===null){J.soundFor=g.i;Snd.timeout()}
    return;
  }
  J.soundFor=g.i;
  if(me.last.ok){Snd.correct();if(me.last.bonus)Snd.streak()} else Snd.wrong();
}
async function playerJoin(){
  var J=S.join;if(J.busy) return;
  var nick=document.getElementById('jnick');
  J.name=((nick?nick.value:J.name)||'').trim().slice(0,16)||'Jogador';
  store.set('cq:name',J.name);
  Snd.init();J.busy=true;J.err='';render();
  try{
    await S.db.doc('games/'+J.pin+'/players/'+S.myId).set({name:J.name,avatar:avStr(S.avatar),at:new Date().toISOString()});
    J.joined=true;Snd.click();
    playerScores();
    var g=J.game;
    if(g&&g.status==='question'&&g.i===J.lastQ&&!J.sent){cancelAnimationFrame(S.raf);S.raf=requestAnimationFrame(playerLoop)}
  }catch(e){J.err='Não consegui entrar no jogo. Verifique sua conexão e tente de novo.'}
  J.busy=false;render();window.scrollTo(0,0);
}
async function playerAnswer(i){
  var J=S.join, g=J&&J.game;
  if(!g||g.status!=='question'||J.sent||J.timeUp||!g.q||!g.q.options[i]) return;
  var ms=Math.round(performance.now()-J.arrive), qi=g.i;
  J.choice=i;J.sent=true;cancelAnimationFrame(S.raf);Snd.click();render();
  try{
    await S.db.doc('games/'+J.pin+'/answers/'+qi+'-'+S.myId).set({q:qi,pid:S.myId,choice:i,ms:ms,at:new Date().toISOString()});
  }catch(e){
    if(J.game&&J.game.i===qi&&J.game.status==='question'){J.sent=false;J.choice=null;J.err='A resposta não foi enviada. Tente de novo.';render()}
  }
}
function playerLoop(){
  var J=S.join, g=J&&J.game;
  if(!g||g.status!=='question'||J.sent||S.view!=='player') return;
  var limit=(g.q&&g.q.limit||0)*1000;
  if(limit>0){
    var el=performance.now()-J.arrive, frac=Math.min(1,el/limit), r=S.refs;
    if(r.bar) r.bar.style.transform='scaleX('+(1-frac)+')';
    var secs=Math.max(0,Math.ceil((limit-el)/1000));
    if(secs!==J.lastSec){J.lastSec=secs;if(r.num)r.num.textContent=String(secs);if(secs<=5&&secs>0)Snd.tick(secs)}
    var st=(limit-el)<=5000||frac>.85?'urgent':frac>.6?'warn':'ok';
    if(r.root&&r.root.getAttribute('data-tstate')!==st) r.root.setAttribute('data-tstate',st);
    if(el>=limit){J.timeUp=true;Snd.timeout();render();return}
  }
  S.raf=requestAnimationFrame(playerLoop);
}
function playerLeave(){S.join=null;go('library')}
function viewPlayer(){
  var J=S.join;
  S.refs={};
  var g=J&&J.game, me=J&&J.scores[S.myId];
  var exit=h('button',{class:'icon-btn','aria-label':'Sair do jogo',title:'Sair do jogo',onclick:playerLeave},icon('close'));
  var scoreChip=J&&J.joined&&g&&g.status!=='lobby'?h('span',{class:'chip score'},fmt(me&&me.score||0)):null;
  var avChip=J&&J.joined?h('span',{class:'gav'},avSvg(S.avatar,36)):null;
  var chips=g&&g.status!=='lobby'&&g.i>=0?h('span',{class:'chip'},(g.i+1)+' / '+g.n):h('span',{class:'chip'},'PIN '+fmtPin(J.pin));
  var root=h('div',{class:'game stack','data-tstate':'ok'});
  S.refs.root=root;
  root.append(liveBar(chips,g?g.title:'',exit,[avChip,scoreChip]));
  if(J.err) root.append(h('p',{class:'live-err',role:'alert'},J.err));
  if(!J.loaded){root.append(h('div',{class:'gcard'},h('p',{'data-focus':'',tabindex:'-1'},'Procurando o jogo '+fmtPin(J.pin)+'…')));return root}
  if(J.missing||!g){
    root.append(h('div',{class:'gcard'},
      h('h2',{class:'h2',tabindex:'-1','data-focus':''},'Jogo não encontrado'),
      h('p',null,'Não há nenhum jogo com o PIN '+fmtPin(J.pin)+'. Confira o número na tela do anfitrião.'),
      h('div',null,h('button',{class:'btn primary',onclick:playerLeave},'Voltar'))));
    return root;
  }
  if(!J.joined){
    if(g.status==='ended'){
      root.append(h('div',{class:'gcard'},h('h2',{class:'h2',tabindex:'-1','data-focus':''},'Este jogo já terminou'),h('div',null,h('button',{class:'btn primary',onclick:playerLeave},'Voltar'))));
      return root;
    }
    var nick=h('input',{id:'jnick',class:'in',type:'text',maxlength:'16',autocomplete:'nickname',placeholder:'Jogador',value:J.name||null});
    nick.addEventListener('input',function(){J.name=nick.value});
    nick.addEventListener('keydown',function(e){if(e.key==='Enter')playerJoin()});
    root.append(h('div',{class:'gcard'},
      h('div',null,
        h('span',{class:'lbl',style:'margin:0'},'Jogo ao vivo'),
        h('h2',{class:'qtext',tabindex:'-1','data-focus':''},g.title||'Quiz')),
      h('div',{class:'ident'},
        h('div',{class:'ident-av'},avSvg(S.avatar,88)),
        h('div',{class:'ident-main'},
          h('label',{class:'lbl',for:'jnick',style:'margin:0'},'Seu nome'),nick,
          h('div',null,h('button',{class:'btn sm',id:'jav-toggle','aria-expanded':String(J.pickOpen),onclick:function(){J.pickOpen=!J.pickOpen;rerenderKeepScroll()}},J.pickOpen?'Fechar avatares':'Escolher avatar')))),
      J.pickOpen?avatarPicker():null,
      h('div',null,h('button',{class:'btn go big',disabled:J.busy,onclick:playerJoin},J.busy?'Entrando…':'Entrar no jogo'))));
    return root;
  }
  var list=ranked(J.scores), rank=rankOf(list,S.myId);
  if(g.status==='lobby'){
    root.append(h('div',{class:'gcard center'},
      avSvg(S.avatar,112),
      h('h2',{class:'h2',tabindex:'-1','data-focus':''},'Você entrou, '+(J.name||'Jogador')+'!'),
      h('p',null,'Veja seu nome na tela do anfitrião. O jogo já vai começar.')));
    return root;
  }
  if(g.status==='question'&&g.q){
    if(J.sent||J.timeUp){
      root.append(h('div',{class:'gcard center',role:'status'},
        J.sent?h('span',{class:'shapeb big',style:tileStyle(J.choice)},shape(J.choice)):null,
        h('h2',{class:'h2',tabindex:'-1','data-focus':''},J.sent?'Resposta enviada':'Tempo esgotado'),
        h('p',{class:'muted'},'Aguarde os outros jogadores…')));
      return root;
    }
    if((g.q.limit||0)>0){var fill=h('i');S.refs.bar=fill;root.append(h('div',{class:'tbar'},fill))}
    root.append(h('div',{class:'qcard'},
      (g.q.limit||0)>0?ringEl(g.q.limit):null,
      h('div',{class:'qbody'},
        g.q.double?h('span',{class:'tag'},'Pontos ×2'):null,
        h('h2',{class:'qtext',tabindex:'-1','data-focus':''},qText(liveQ(g.q.text,g.q.options,-1),false)))));
    root.append(h('div',{class:'tiles'},(g.q.options||[]).map(function(t,i){
      return h('button',{class:'ans',style:tileStyle(i),'aria-keyshortcuts':String(i+1),onclick:function(){playerAnswer(i)}},
        shape(i),h('span',{class:'t'},t),h('span'));
    })));
    return root;
  }
  if(g.status==='reveal'){
    var rv=g.reveal||{}, last=me&&me.last&&me.last.i===g.i?me.last:null;
    var correctText=g.q&&g.q.options?g.q.options[rv.correct]:'';
    var ok=last?last.ok:false;
    root.append(h('div',{class:'reveal '+(last?(ok?'ok':'bad'):''),role:'status'},
      h('div',{class:'head',tabindex:'-1','data-focus':''},!last?'Calculando…':ok?'Certo!':(last.choice<0?'Sem resposta':'Não foi essa.')),
      last&&ok?h('div',{class:'gain'},'+'+fmt(last.points)):null,
      last&&ok&&last.bonus?h('div',{class:'streak'},icon('flame',20),'Sequência de '+me.streak+': +'+last.bonus+' de bônus'):null,
      last&&!ok?h('div',null,'Resposta certa: ',h('b',null,correctText)):null,
      rv.explain?h('div',{class:'expl'},rv.explain):null,
      rank?h('div',{class:'note'},'Você está em '+rank+'º lugar com '+fmt(me.score||0)+' pontos.'):null));
    return root;
  }
  if(g.status==='board'){
    root.append(h('div',{class:'gcard'},
      h('h2',{class:'h2',tabindex:'-1','data-focus':''},rank?'Você está em '+rank+'º lugar':'Classificação'),
      list.length?playerRows(list,S.myId,5,true):null,
      rank&&rank>5?h('p',{class:'muted'},'Você tem '+fmt(me.score||0)+' pontos.'):null));
    return root;
  }
  root.append(h('div',{class:'gcard'},
    h('h2',{class:'final','data-focus':'',tabindex:'-1'},
      avSvg(S.avatar,96),
      h('span',{class:'who'},J.name||'Jogador'),
      h('span',{class:'big-score'},fmt(me&&me.score||0)),
      h('span',{class:'muted'},'pontos'),
      rank?h('span',{class:'rank'},'Você ficou em '+rank+'º lugar'+(g.cancelled?' (jogo interrompido)':'')):null),
    list.length?podiumBlock(list,S.myId,J):null));
  root.append(h('div',{class:'footbar'},h('button',{class:'btn wh big',onclick:playerLeave},'Biblioteca')));
  return root;
}

/* ---------- gestão ---------- */
function setAdminMsg(text,bad){
  S.adminMsg=text;S.adminBad=!!bad;
  var el=document.getElementById('admin-msg');
  if(el){el.textContent=text;el.className='msg '+(bad?'bad':'good')}
}
async function adminDo(fn,okText){
  if(S.adminBusy) return;
  S.adminBusy=true;
  try{await fn();setAdminMsg(okText,false)}
  catch(e){setAdminMsg('Não foi possível salvar: '+(e&&e.message||'erro desconhecido'),true)}
  finally{S.adminBusy=false}
}
function numSelect(label,id,obj,key,opts){
  return selectField(label,id,obj[key],opts,function(v){obj[key]=+v});
}
function boolCheck(label,id,obj,key){
  return h('label',{class:'check'},h('input',{type:'checkbox',id:id,checked:obj[key],onchange:function(e){obj[key]=e.target.checked}}),label);
}
function scoringExample(d){
  var fast=d.maxPoints, slow=Math.round(d.maxPoints*d.minPct/100);
  var s='Resposta certa: '+fmt(fast)+' pontos no primeiro instante, '+fmt(slow)+' no último segundo.';
  if(d.streakStep>0) s+=' Sequência: +'+d.streakStep+' por cada acerto seguido, até +'+d.streakCap+'.';
  return s;
}
function musicOpts(ph){
  var own=TRACKS.filter(function(t){return t.cat===ph}), other=TRACKS.filter(function(t){return t.cat!==ph});
  var o=[['auto','Aleatória']];
  own.forEach(function(t){o.push([t.id,t.title+' · '+t.author])});
  other.forEach(function(t){o.push([t.id,t.title+' · '+t.author+' (outra categoria)'])});
  if(ph==='question') o.push(['generated','Gerada pelo navegador']);
  o.push(['none','Sem música']);
  return o;
}
function stopPreview(){
  if(S.previewPh){S.previewPh=null;Music.stop();Snd.genStop()}
}
function previewMusic(ph,val){
  var was=S.previewPh;
  stopPreview();
  if(was===ph){rerenderKeepScroll();return}
  Snd.init();
  var t=val==='auto'?(function(){var l=TRACKS.filter(function(x){return x.cat===ph});return l[Math.floor(Math.random()*l.length)]})():trackById(val);
  if(val==='generated'){Snd.genStart()}
  else if(t){Music.play(t,false)}
  else{rerenderKeepScroll();return}
  S.previewPh=ph;
  clearTimeout(Music.previewTimer);
  Music.previewTimer=setTimeout(function(){if(S.previewPh===ph){stopPreview();if(S.view==='admin')rerenderKeepScroll()}},15000);
  rerenderKeepScroll();
}
function musicSettings(d){
  return h('div',{class:'stack',style:'gap:10px'},
    h('h4',{class:'lbl',style:'margin:8px 0 0'},'Música'),
    h('div',{class:'music-grid'},MUSIC_PHASES.map(function(ph){
      var k='music_'+ph[0];
      return h('div',{class:'mrow'},
        selectField(ph[1],'s-mus-'+ph[0],d[k],musicOpts(ph[0]),function(v){d[k]=v;if(S.previewPh===ph[0])stopPreview()}),
        h('button',{class:'btn sm',id:'s-mus-'+ph[0]+'-play','aria-pressed':String(S.previewPh===ph[0]),onclick:function(){previewMusic(ph[0],d[k])}},S.previewPh===ph[0]?'Parar':'Ouvir'));
    })),
    h('p',{class:'muted'},'“Aleatória” sorteia uma faixa a cada jogo. Nas perguntas, a música acelera nos últimos 5 segundos. No jogo ao vivo, a música toca só na tela do anfitrião.'));
}
function viewAdmin(){
  var d=S.setDraft||(S.setDraft=Object.assign({},S.settings));
  var root=h('div',{class:'stack'});
  root.append(h('div',{class:'bar'},h('button',{class:'btn ghost sm',onclick:function(){go('library')}},'← Biblioteca')));
  root.append(h('h2',{class:'h2',tabindex:'-1','data-focus':''},'Gestão'));
  root.append(h('p',{id:'admin-msg',class:'msg '+(S.adminBad?'bad':'good'),role:'status'},S.adminMsg));

  var ex=h('p',{class:'muted',id:'score-example'},scoringExample(d));
  function refreshEx(){ex.textContent=scoringExample(d)}
  var rules=h('section',{class:'panel stack','aria-labelledby':'rules-h'},
    h('h3',{class:'lbl',id:'rules-h',style:'margin:0'},'Regras do jogo'),
    h('div',{class:'grid2'},
      numSelect('Tempo padrão por pergunta','s-time',d,'defaultTime',TIMES.filter(function(t){return t[0]>0})),
      numSelect('Pontos por resposta certa','s-max',d,'maxPoints',SET_OPTS.maxPoints),
      numSelect('Pontos no último segundo','s-min',d,'minPct',SET_OPTS.minPct),
      numSelect('Bônus de sequência','s-step',d,'streakStep',SET_OPTS.streakStep),
      numSelect('Bônus máximo','s-cap',d,'streakCap',SET_OPTS.streakCap),
      numSelect('Tamanho da tabela','s-board',d,'boardSize',SET_OPTS.boardSize)),
    ex,
    h('div',{class:'checks'},
      boolCheck('Contagem 3-2-1 antes da primeira pergunta','s-cd',d,'countdown'),
      boolCheck('Mostrar a explicação depois de responder','s-expl',d,'showExplain'),
      boolCheck('Tabela de pontuações','s-lb',d,'leaderboard'),
      boolCheck('Efeitos sonoros ligados por padrão','s-sfx',d,'sfx'),
      boolCheck('Música ligada por padrão','s-music',d,'music')),
    musicSettings(d),
    h('p',{class:'muted'},'O tempo padrão vale para os quizzes marcados com “Padrão”. Som e música são o ponto de partida: cada jogador pode mudar no próprio aparelho.'),
    h('div',{class:'qa'},
      h('button',{class:'btn primary',onclick:function(){
        var clean=sanitizeSettings(d);
        adminDo(function(){return S.db.doc('config/settings').set(clean)},'Regras salvas.');
      }},'Salvar regras'),
      h('button',{class:'btn',onclick:function(){
        S.setDraft=Object.assign({},SET_DEFAULT);render();
        setAdminMsg('Valores padrão restaurados. Clique em “Salvar regras” para aplicar.',false);
      }},'Restaurar padrão')));
  rules.addEventListener('change',refreshEx);
  root.append(rules);

  var rows=S.quizzes.map(function(q,idx){return adminRow(q,idx)});
  root.append(h('section',{class:'panel stack','aria-labelledby':'quiz-h'},
    h('h3',{class:'lbl',id:'quiz-h',style:'margin:0'},'Quizzes'),
    S.quizzes.length?h('ul',{class:'alist'},rows):h('p',{class:'muted'},'Ainda não há quizzes.')));
  root.append(seedSection());
  root.append(h('section',{class:'panel stack','aria-labelledby':'live-h'},
    h('h3',{class:'lbl',id:'live-h',style:'margin:0'},'Jogos ao vivo'),
    h('p',{class:'muted'},'Cada jogo ao vivo armazena jogadores, respostas e pontos. Exclua os jogos encerrados de vez em quando para manter a página leve.'),
    h('div',null,h('button',{class:'btn',onclick:function(){
      adminDo(async function(){var n=await cleanGames();S.adminCleanN=n},'Jogos encerrados excluídos.').then(function(){
        if(S.adminCleanN!=null) setAdminMsg(S.adminCleanN?plural(S.adminCleanN,'jogo encerrado excluído.','jogos encerrados excluídos.'):'Não havia jogos encerrados.',false);
      });
    }},'Excluir jogos encerrados'))));
  return root;
}
function adminRow(q,idx){
  var n=(q.questions||[]).length;
  var overrides=(q.questions||[]).filter(function(x){return typeof x.time==='number'}).length;
  var doubles=(q.questions||[]).filter(function(x){return x.double===true}).length;
  var tval=typeof q.timeLimit==='number'?q.timeLimit:'';
  var ref=S.db.doc('quizzes/'+q.id);
  var opts=[['','Padrão ('+timeLabel(defTime()).replace(' por pergunta','')+')']].concat(TIMES);
  var details=[plural(n,'pergunta','perguntas')];
  if(overrides) details.push(plural(overrides,'com tempo próprio','com tempo próprio'));
  if(doubles) details.push(plural(doubles,'a dobrar','a dobrar'));
  var confirming=S.adminConfirm===q.id;
  return h('li',{class:'arow'+(q.hidden?' off':'')},
    h('div',{class:'ahead'},
      h('div',{class:'atitle'},h('strong',null,q.title||'Sem título'),q.hidden?h('span',{class:'pill'},'Oculto'):null),
      h('span',{class:'muted'},details.join(' · '))),
    h('div',{class:'actrl'},
      selectField('Tempo','a-time-'+q.id,tval,opts,function(v){
        adminDo(function(){return ref.update({timeLimit:v===''?null:+v,updatedAt:new Date().toISOString()})},'Tempo de “'+q.title+'” atualizado.');
      }),
      h('label',{class:'check'},h('input',{type:'checkbox',id:'a-vis-'+q.id,checked:!q.hidden,onchange:function(e){
        var vis=e.target.checked;
        adminDo(function(){return ref.update({hidden:!vis})},vis?'“'+q.title+'” está visível.':'“'+q.title+'” ficou oculto.');
      }}),'Visível')),
    h('div',{class:'qa'},
      idx>0?h('button',{class:'btn sm','aria-label':'Subir '+q.title,onclick:function(){adminDo(function(){return moveQuiz(idx,-1)},'Ordem atualizada.')}},'↑'):null,
      idx<S.quizzes.length-1?h('button',{class:'btn sm','aria-label':'Descer '+q.title,onclick:function(){adminDo(function(){return moveQuiz(idx,1)},'Ordem atualizada.')}},'↓'):null,
      h('button',{class:'btn sm',onclick:function(){openEditor(q)}},'Editar'),
      overrides?h('button',{class:'btn sm',onclick:function(){
        var qs=(q.questions||[]).map(function(x){var y=Object.assign({},x);delete y.time;return y});
        adminDo(function(){return ref.update({questions:qs,updatedAt:new Date().toISOString()})},'Todas as perguntas de “'+q.title+'” usam agora o tempo do quiz.');
      }},'Mesmo tempo em todas'):null,
      confirming
        ?[h('span',{class:'muted'},'Excluir todas as pontuações?'),
          h('button',{class:'btn danger sm',onclick:function(){S.adminConfirm=null;adminDo(function(){return clearScores(q.id)},'Tabela de “'+q.title+'” limpa.').then(render)}},'Sim, limpar'),
          h('button',{class:'btn sm',onclick:function(){S.adminConfirm=null;render()}},'Não')]
        :h('button',{class:'btn sm',onclick:function(){S.adminConfirm=q.id;render()}},'Limpar tabela')));
}
async function moveQuiz(idx,d){
  var list=S.quizzes.slice(), t=list[idx];list[idx]=list[idx+d];list[idx+d]=t;
  for(var i=0;i<list.length;i++){
    if(list[i].order!==i+1) await S.db.doc('quizzes/'+list[i].id).update({order:i+1});
  }
}
/* ---------- quizzes iniciais: comparar e atualizar ---------- */
function quizSig(q){
  var p=plain(q);
  return JSON.stringify([p.title,p.subject,p.level,p.description,p.timeLimit,p.questions]);
}
function normTitle(t){return String(t||'').trim().toLowerCase()}
function loadSeedCompare(){
  S.seedState='loading';render();
  fetch('data/quizzes.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(function(raw){
    var list=Array.isArray(raw)?raw:(raw&&raw.quizzes)||[];
    S.seedRaw=list.map(normalize).filter(function(r){return r.ok}).map(function(r){return r.quiz});
    S.seedState='ready';rerenderKeepScroll();
  }).catch(function(e){S.seedState='error';S.seedErr=e.message;rerenderKeepScroll()});
}
function seedSection(){
  var sec=h('section',{class:'panel stack','aria-labelledby':'seed-h'},
    h('h3',{class:'lbl',id:'seed-h',style:'margin:0'},'Quizzes iniciais'),
    h('p',{class:'muted'},'Compara os quizzes do site com a versão mais recente publicada no GitHub. Substituir troca o conteúdo do quiz e mantém a tabela de pontuações.'));
  if(S.seedState!=='ready'){
    sec.append(h('div',null,h('button',{class:'btn',disabled:S.seedState==='loading',onclick:loadSeedCompare},S.seedState==='loading'?'Comparando…':'Comparar')));
    if(S.seedState==='error') sec.append(h('p',{class:'msg bad'},'Não consegui ler os quizzes iniciais: '+S.seedErr));
    return sec;
  }
  sec.append(h('ul',{class:'alist'},S.seedRaw.map(function(sq){
    var match=S.quizzes.filter(function(q){return normTitle(q.title)===normTitle(sq.title)})[0];
    var same=match&&quizSig(match)===quizSig(sq);
    var status=!match?'Não está no site':same?'Atualizado':'Há uma versão mais recente';
    var btn=null;
    if(!match) btn=h('button',{class:'btn sm primary',onclick:function(){
      var now=new Date().toISOString();
      adminDo(function(){return S.db.collection('quizzes').doc().set(Object.assign({},sq,{order:nextOrder(),createdAt:now,updatedAt:now}))},'“'+sq.title+'” adicionado.');
    }},'Adicionar');
    else if(!same) btn=S.adminConfirm==='seed-'+match.id
      ?[h('span',{class:'muted'},'Substituir o conteúdo atual?'),
        h('button',{class:'btn sm danger',onclick:function(){
          S.adminConfirm=null;
          var now=new Date().toISOString();
          var data=Object.assign({},sq,{order:match.order!=null?match.order:nextOrder(),createdAt:match.createdAt||now,updatedAt:now});
          if(match.hidden) data.hidden=true;
          adminDo(function(){return S.db.doc('quizzes/'+match.id).set(data)},'“'+sq.title+'” atualizado.');
        }},'Sim, substituir'),
        h('button',{class:'btn sm',onclick:function(){S.adminConfirm=null;render()}},'Não')]
      :h('button',{class:'btn sm',onclick:function(){S.adminConfirm='seed-'+match.id;render()}},'Substituir');
    return h('li',{class:'arow'},
      h('div',{class:'ahead'},h('div',{class:'atitle'},h('strong',null,sq.title),h('span',{class:'pill'},status)),
        h('span',{class:'muted'},plural(sq.questions.length,'pergunta','perguntas'))),
      btn?h('div',{class:'qa'},btn):null);
  })));
  return sec;
}
async function cleanGames(){
  var snap=await S.db.collection('games').where('status','==','ended').limit(100).get();
  for(var i=0;i<snap.docs.length;i++){
    var pin=snap.docs[i].id;
    for(var k=0;k<3;k++){
      var subc=['players','scores','answers'][k];
      var ds=await S.db.collection('games/'+pin+'/'+subc).limit(1000).get();
      for(var j=0;j<ds.docs.length;j++) await S.db.doc('games/'+pin+'/'+subc+'/'+ds.docs[j].id).delete();
    }
    try{await S.db.doc('gamekeys/'+pin).delete()}catch(e){}
    await S.db.doc('games/'+pin).delete();
  }
  return snap.docs.length;
}
async function clearScores(id){
  var snap=await S.db.collection('quizzes/'+id+'/scores').limit(500).get();
  for(var i=0;i<snap.docs.length;i++) await S.db.doc('quizzes/'+id+'/scores/'+snap.docs[i].id).delete();
}

/* ---------- teclado ---------- */
document.addEventListener('keydown',function(e){
  var t=e.target&&e.target.tagName;
  if(t==='INPUT'||t==='TEXTAREA'||t==='SELECT'||e.metaKey||e.ctrlKey||e.altKey) return;
  if(!/^[1-6]$/.test(e.key)) return;
  var k=+e.key-1;
  if(S.view==='player'){playerAnswer(k);return}
  var p=S.play;
  if(S.view!=='play'||!p||p.phase!=='question') return;
  if(p.qs[p.i].options[k]) answer(k);
});

/* ---------- arranque ---------- */
(function(){
  var saved=store.get('cq:avatar');
  S.avatar=saved?avParse(saved):avRandom();
  if(!saved) store.set('cq:avatar',avStr(S.avatar));
})();
function onSnap(snap){
  S.quizzes=snap.docs.filter(function(d){return d.exists}).map(function(d){return Object.assign({id:d.id},d.data())}).sort(byOrder);
  S.loaded=true;S.failed=false;
  if(S.view==='library'||S.view==='admin') rerenderKeepScroll();
}
function onErr(){
  S.loaded=true;S.failed=true;
  if(S.view==='library'||S.view==='admin') render();
}
function rerenderKeepScroll(){
  var y=window.scrollY, id=document.activeElement&&document.activeElement.id;
  render();window.scrollTo(0,y);
  if(id){var el=document.getElementById(id);if(el)el.focus({preventScroll:true})}
}
render();
function getBackend(){
  return new Promise(function(res){
    if(window.QBackend) return res(window.QBackend);
    window.addEventListener('qbackend',function(){res(window.QBackend)},{once:true});
    setTimeout(function(){res(window.QBackend||null)},20000);
  });
}
function applyAuth(){
  var a=S.auth.get()||{};
  var wasAdmin=S.canWrite, prevId=S.myId;
  S.myId=a.uid||null;
  S.canWrite=S.canHost=!!a.isAdmin;
  S.authEmail=a.email||'';
  S.authErr=a.error||'';
  if(S.canHost&&(!wasAdmin||prevId!==S.myId)) checkHostResume();
  if(!S.canHost) S.hostResume=null;
}
function checkHostResume(){
  var hpin=store.get('cq:hostPin');
  if(!hpin||!S.db) return;
  S.db.doc('games/'+hpin).get().then(function(s){
    var d=s.exists?s.data():null;
    if(d&&d.status!=='ended'&&d.hostId===S.myId){S.hostResume=Object.assign({},d,{pin:hpin});if(S.view==='library')render()}
    else store.set('cq:hostPin','');
  }).catch(function(){});
}
function adminLogin(){
  S.libMsg='';
  S.auth.signInGoogle().catch(function(e){
    if(e&&/popup-closed|cancelled-popup/.test(e.code||'')) return;
    S.libMsg='Não foi possível entrar: '+(e&&e.message||'erro desconhecido');render();
  });
}
function adminLogout(){
  if(S.view==='admin'||S.view==='edit'||S.view==='host') go('library');
  S.auth.signOut().catch(function(){});
}
(async function(){
  var B=await getBackend();
  if(!B||B.error||!B.db){
    S.loaded=true;S.failed=true;S.setupMissing=!!(B&&B.error==='config');
    S.failMsg=B&&B.message||'';
    render();return;
  }
  var db=B.db;
  S.db=db;S.auth=B.auth;
  applyAuth();
  B.auth.onChange(function(){
    applyAuth();
    if(S.view==='library'||S.view==='admin') rerenderKeepScroll();
  });
  if(S.view==='library') render();
  var hp=hashPin();
  if(hp) playerOpen(hp);
  window.addEventListener('hashchange',function(){var p=hashPin();if(p&&!(S.view==='player'&&S.join&&S.join.pin===p))playerOpen(p)});
  try{db.collection('quizzes').onSnapshot(onSnap,onErr)}catch(e){onErr()}
  try{db.doc('config/settings').onSnapshot(function(s){
    applySettings(s.exists?s.data():{});
    if(S.view==='library'||S.view==='admin') rerenderKeepScroll();
  },function(){})}catch(e){}
})();
})();
