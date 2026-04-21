// ── 음계 ────────────────────────────────────────────
const SCALES = {
  korean: {
    labels:['청황','황','태','협','고','중','유','임','이','남','무','응','청황2','청태','청중','청임'],
    notes: ['D4','Eb4','F4','F#4','G4','Ab4','Bb4','B4','C5','Db5','D5','Eb5','F5','F#5','Ab5','B5']
  },
  western: {
    labels:['C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5','A5'],
    solfege:['도','레','미','파','솔','라','시','도','레','미','파','솔','라','시','도','레','미','파','솔','라'],
    notes: ['C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5','A5']
  }
};
let currentScale='korean', currentInst='danso';

// ── 녹음 상태 ─────────────────────────────────────────
let recDest=null, recBridgeGain=null;         // 루프 녹음용 (라이브 연주만)
let fullRecDest=null, fullRecBridgeGain=null; // 저장용 (루프+연주 전체)
let mediaRecorder=null, recChunks=[], recBlobUrl=null;
let isRecording=false, recStartTime=0, recTimerId=null;

// ── 루프 스테이션 상태 ───────────────────────────────
let loopDuration=0, loopStartCtxTime=0;
let loopSources=[], loopLayerCount=0;
let isLoopRecording=false;
let loopRecorder=null, loopRecChunks=[], loopRecStartTime=0, loopRecTimerId=null;
const MAX_LOOP_LAYERS=3;

function getNoteAt(pct){
  const arr=SCALES[currentScale].notes;
  return arr[Math.min(Math.max(Math.round((pct/100)*(arr.length-1)),0),arr.length-1)];
}
function getLabelAt(pct){
  const arr=SCALES[currentScale].labels;
  return arr[Math.min(Math.max(Math.round((pct/100)*(arr.length-1)),0),arr.length-1)];
}
function getSolfegeAt(pct){
  const arr=SCALES[currentScale].solfege;
  if(!arr) return getLabelAt(pct);
  return arr[Math.min(Math.max(Math.round((pct/100)*(arr.length-1)),0),arr.length-1)];
}
function snapToNote(pct){
  const n=SCALES[currentScale].notes.length;
  const idx=Math.max(0,Math.min(n-1,Math.round((pct/100)*(n-1))));
  return Math.round((idx/(n-1))*100);
}

// ── Tone.js 샘플러 캐시 ──────────────────────────────
const samplerCache={};
let activeSampler=null;
let dansoNodes=null;

const SAMPLER_URLS = {
  piano: {
    baseUrl:'https://tonejs.github.io/audio/salamander/',
    urls:{'A0':'A0.mp3','C1':'C1.mp3','Eb1':'Ds1.mp3','F#1':'Fs1.mp3','A1':'A1.mp3','C2':'C2.mp3','Eb2':'Ds2.mp3','F#2':'Fs2.mp3','A2':'A2.mp3','C3':'C3.mp3','Eb3':'Ds3.mp3','F#3':'Fs3.mp3','A3':'A3.mp3','C4':'C4.mp3','Eb4':'Ds4.mp3','F#4':'Fs4.mp3','A4':'A4.mp3','C5':'C5.mp3','Eb5':'Ds5.mp3','F#5':'Fs5.mp3','A5':'A5.mp3','C6':'C6.mp3','Eb6':'Ds6.mp3','F#6':'Fs6.mp3','A6':'A6.mp3','C7':'C7.mp3'}
  },
  violin: {
    baseUrl:'https://tonejs.github.io/audio/violin/',
    urls:{'A3':'A3.mp3','A4':'A4.mp3','A5':'A5.mp3','A6':'A6.mp3','Ab4':'Ab4.mp3','Ab5':'Ab5.mp3','B3':'B3.mp3','B4':'B4.mp3','B5':'B5.mp3','B6':'B6.mp3','Bb3':'Bb3.mp3','Bb4':'Bb4.mp3','Bb5':'Bb5.mp3','C4':'C4.mp3','C5':'C5.mp3','C6':'C6.mp3','C7':'C7.mp3','D4':'D4.mp3','D5':'D5.mp3','D6':'D6.mp3','Db4':'Db4.mp3','Db5':'Db5.mp3','Db6':'Db6.mp3','E4':'E4.mp3','E5':'E5.mp3','E6':'E6.mp3','Eb4':'Eb4.mp3','Eb5':'Eb5.mp3','F4':'F4.mp3','F5':'F5.mp3','F6':'F6.mp3','G3':'G3.mp3','G4':'G4.mp3','G5':'G5.mp3','G6':'G6.mp3'}
  },
  flute: {
    baseUrl:'https://tonejs.github.io/audio/flute/',
    urls:{'A4':'A4.mp3','A5':'A5.mp3','A6':'A6.mp3','B4':'B4.mp3','B5':'B5.mp3','C4':'C4.mp3','C5':'C5.mp3','C6':'C6.mp3','C7':'C7.mp3','D4':'D4.mp3','D5':'D5.mp3','D6':'D6.mp3','E4':'E4.mp3','E5':'E5.mp3','E6':'E6.mp3','F4':'F4.mp3','F5':'F5.mp3','F6':'F6.mp3','G4':'G4.mp3','G5':'G5.mp3','G6':'G6.mp3'}
  },
  cello: {
    baseUrl:'https://tonejs.github.io/audio/cello/',
    urls:{'A2':'A2.mp3','A3':'A3.mp3','A4':'A4.mp3','B2':'B2.mp3','B3':'B3.mp3','B4':'B4.mp3','C2':'C2.mp3','C3':'C3.mp3','C4':'C4.mp3','C5':'C5.mp3','D2':'D2.mp3','D3':'D3.mp3','D4':'D4.mp3','E2':'E2.mp3','E3':'E3.mp3','E4':'E4.mp3','F2':'F2.mp3','F3':'F3.mp3','F4':'F4.mp3','G2':'G2.mp3','G3':'G3.mp3','G4':'G4.mp3'}
  },
  guitar: {
    baseUrl:'https://tonejs.github.io/audio/guitar-acoustic/',
    urls:{'A2':'A2.mp3','A3':'A3.mp3','A4':'A4.mp3','B2':'B2.mp3','B3':'B3.mp3','B4':'B4.mp3','C3':'C3.mp3','C4':'C4.mp3','C5':'C5.mp3','D2':'D2.mp3','D3':'D3.mp3','D4':'D4.mp3','D5':'D5.mp3','E2':'E2.mp3','E3':'E3.mp3','E4':'E4.mp3','F2':'F2.mp3','F3':'F3.mp3','F4':'F4.mp3','G2':'G2.mp3','G3':'G3.mp3','G4':'G4.mp3'}
  },
  organ: {
    baseUrl:'https://tonejs.github.io/audio/organ/',
    urls:{'C3':'C3.mp3','C4':'C4.mp3','C5':'C5.mp3','C6':'C6.mp3','Db3':'Db3.mp3','Db4':'Db4.mp3','Db5':'Db5.mp3','Db6':'Db6.mp3','D3':'D3.mp3','D4':'D4.mp3','D5':'D5.mp3','Eb3':'Eb3.mp3','Eb4':'Eb4.mp3','Eb5':'Eb5.mp3','E3':'E3.mp3','E4':'E4.mp3','E5':'E5.mp3','F3':'F3.mp3','F4':'F4.mp3','F5':'F5.mp3','Gb3':'Gb3.mp3','Gb4':'Gb4.mp3','Gb5':'Gb5.mp3','G3':'G3.mp3','G4':'G4.mp3','G5':'G5.mp3','Ab3':'Ab3.mp3','Ab4':'Ab4.mp3','Ab5':'Ab5.mp3','A3':'A3.mp3','A4':'A4.mp3','A5':'A5.mp3','Bb3':'Bb3.mp3','Bb4':'Bb4.mp3','Bb5':'Bb5.mp3','B3':'B3.mp3','B4':'B4.mp3','B5':'B5.mp3'}
  }
};

async function loadSampler(inst){
  if(samplerCache[inst]) return samplerCache[inst];
  const cfg=SAMPLER_URLS[inst];
  if(!cfg) return null;
  return new Promise(resolve=>{
    const s=new Tone.Sampler({urls:cfg.urls, baseUrl:cfg.baseUrl,
      onload:()=>{ samplerCache[inst]=s; if(recBridgeGain) s.connect(recBridgeGain); if(fullRecBridgeGain) s.connect(fullRecBridgeGain); resolve(s); }
    }).toDestination();
  });
}

// ── 단소 전자음 (Web Audio API) ─────────────────────
let audioCtx2=null, dansoGain=null, dansoLfo=null, dansoLfoGain=null;
let dansoOscs=[];

function initDanso(){
  if(!audioCtx2) audioCtx2=Tone.context.rawContext;
  dansoOscs.forEach(o=>{try{o.stop();o.disconnect();}catch(e){}});
  dansoOscs=[];
  if(dansoGain){try{dansoGain.disconnect();}catch(e){}}
  if(dansoLfo){try{dansoLfo.stop();dansoLfo.disconnect();}catch(e){}}

  dansoGain=audioCtx2.createGain(); dansoGain.gain.value=0;
  dansoGain.connect(audioCtx2.destination);
  if(recBridgeGain) dansoGain.connect(recBridgeGain);
  if(fullRecBridgeGain) dansoGain.connect(fullRecBridgeGain);

  dansoLfo=audioCtx2.createOscillator(); dansoLfo.type='sine'; dansoLfo.frequency.value=5.5;
  dansoLfoGain=audioCtx2.createGain(); dansoLfoGain.gain.value=0;
  dansoLfo.connect(dansoLfoGain); dansoLfo.start();

  const osc1=audioCtx2.createOscillator(); osc1.type='sine'; osc1.frequency.value=530;
  const osc2=audioCtx2.createOscillator(); osc2.type='sine'; osc2.frequency.value=1060;
  const osc3=audioCtx2.createOscillator(); osc3.type='sine'; osc3.frequency.value=1590;
  const g2=audioCtx2.createGain(); g2.gain.value=0.3;
  const g3=audioCtx2.createGain(); g3.gain.value=0.1;

  const bufSize=audioCtx2.sampleRate*0.5;
  const buf=audioCtx2.createBuffer(1,bufSize,audioCtx2.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<bufSize;i++) d[i]=(Math.random()*2-1);
  const noise=audioCtx2.createBufferSource(); noise.buffer=buf; noise.loop=true;
  const nf=audioCtx2.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=900; nf.Q.value=0.9;
  const ng=audioCtx2.createGain(); ng.gain.value=0.05;
  noise.connect(nf); nf.connect(ng); ng.connect(dansoGain); noise.start();

  dansoLfoGain.connect(osc1.frequency);
  osc1.connect(dansoGain); osc2.connect(g2); g2.connect(dansoGain);
  osc3.connect(g3); g3.connect(dansoGain);
  osc1.start(); osc2.start(); osc3.start();
  dansoOscs=[osc1,osc2,osc3];
}

function setDansoFreq(freq){
  if(!dansoOscs.length) return;
  const now=audioCtx2.currentTime;
  dansoOscs[0].frequency.setTargetAtTime(freq,now,0.04);
  dansoOscs[1].frequency.setTargetAtTime(freq*2,now,0.04);
  dansoOscs[2].frequency.setTargetAtTime(freq*3,now,0.04);
}

function noteToFreq(note){
  return Tone.Frequency(note).toFrequency();
}

// ── 상태 ─────────────────────────────────────────────
let volume=60, pitch=50, vibration=50;
let soundActive=false, silenceTimer=null;
let currentNote='D4';
let isLoading=false;

// ── 소리 재생/업데이트 ────────────────────────────────
let lastNote='';
function updateSound(){
  const note=getNoteAt(pitch);
  const freq=noteToFreq(note);

  if(currentInst==='danso'){
    if(!dansoGain) return;
    const now=audioCtx2.currentTime;
    setDansoFreq(freq);
    dansoGain.gain.setTargetAtTime(soundActive?(volume/100)*0.5:0, now, 0.08);
    dansoLfoGain.gain.setTargetAtTime((vibration/100)*freq*0.03, now, 0.05);
  } else {
    if(!activeSampler) return;
    Tone.getDestination().volume.rampTo(Tone.gainToDb((volume/100)*0.9), 0.1);
    if(soundActive){
      if(note!==lastNote){
        activeSampler.triggerRelease(lastNote||note);
        activeSampler.triggerAttack(note, Tone.now(), 0.8);
        lastNote=note;
      }
    } else {
      if(lastNote){ activeSampler.triggerRelease(lastNote); lastNote=''; }
    }
  }
  document.getElementById('soundDot').className='sound-dot'+(soundActive?' on':'');
}

// ── 악기 전환 ─────────────────────────────────────────
async function switchInstrument(inst){
  if(isLoading) return;
  currentInst=inst;

  if(activeSampler && lastNote){ activeSampler.triggerRelease(lastNote); lastNote=''; }
  activeSampler=null;

  if(inst==='danso'){
    initDanso();
    setInstLabel();
    return;
  }

  isLoading=true;
  document.querySelectorAll('.inst-btn').forEach(b=>b.disabled=true);
  document.getElementById('loadBar').style.width='30%';
  document.getElementById('statusBar').textContent='샘플 로딩 중...';

  try{
    activeSampler=await loadSampler(inst);
    document.getElementById('loadBar').style.width='100%';
    setTimeout(()=>document.getElementById('loadBar').style.width='0%',400);
    document.getElementById('statusBar').textContent='손을 카메라에 보여주세요';
  }catch(e){
    document.getElementById('statusBar').textContent='로딩 실패 — 다시 시도';
  }
  isLoading=false;
  document.querySelectorAll('.inst-btn').forEach(b=>b.disabled=false);
  setInstLabel();
}

// ── 녹음 ─────────────────────────────────────────────
function setupRecording(){
  const rawCtx=Tone.context.rawContext;
  recDest=rawCtx.createMediaStreamDestination();
  recBridgeGain=rawCtx.createGain();
  recBridgeGain.connect(recDest);
  fullRecDest=rawCtx.createMediaStreamDestination();
  fullRecBridgeGain=rawCtx.createGain();
  fullRecBridgeGain.connect(fullRecDest);
}

function startRecording(){
  if(!fullRecDest||isRecording) return;
  recChunks=[];
  if(recBlobUrl){URL.revokeObjectURL(recBlobUrl);recBlobUrl=null;}
  mediaRecorder=new MediaRecorder(fullRecDest.stream);
  mediaRecorder.ondataavailable=e=>{if(e.data.size>0) recChunks.push(e.data);};
  mediaRecorder.onstop=()=>{
    const blob=new Blob(recChunks,{type:'audio/webm'});
    recBlobUrl=URL.createObjectURL(blob);
    document.getElementById('recAudio').src=recBlobUrl;
    document.getElementById('playBtn').disabled=false;
    document.getElementById('dlBtn').disabled=false;
  };
  mediaRecorder.start();
  isRecording=true;
  recStartTime=Date.now();
  recTimerId=setInterval(()=>{
    const s=Math.floor((Date.now()-recStartTime)/1000);
    document.getElementById('recTime').textContent=
      String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  },500);
  document.getElementById('recBtn').textContent='■ 정지';
  document.getElementById('recBtn').classList.add('recording');
}

function stopRecording(){
  if(!isRecording) return;
  mediaRecorder.stop();
  isRecording=false;
  clearInterval(recTimerId);
  document.getElementById('recBtn').textContent='● 녹음';
  document.getElementById('recBtn').classList.remove('recording');
}

// ── 루프 스테이션 ────────────────────────────────────
function startLoopRecording(){
  loopRecStartTime=Date.now();
  loopRecChunks=[];
  const mimeType=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/webm']
    .find(t=>MediaRecorder.isTypeSupported(t))||'';
  loopRecorder=new MediaRecorder(recDest.stream, mimeType?{mimeType}:{});
  loopRecorder.ondataavailable=e=>{if(e.data.size>0) loopRecChunks.push(e.data);};
  loopRecorder.start();
  isLoopRecording=true;
  loopRecTimerId=setInterval(()=>{
    const s=Math.floor((Date.now()-loopRecStartTime)/1000);
    document.getElementById('loopStatus').textContent=
      '녹음 '+String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  },200);
  document.getElementById('loopBtn').textContent='⏹ 완성';
  document.getElementById('loopBtn').classList.add('loop-rec');
}

async function finishLoopRecording(){
  clearInterval(loopRecTimerId);
  isLoopRecording=false;
  return new Promise(resolve=>{
    loopRecorder.onstop=async()=>{
      const blob=new Blob(loopRecChunks);
      try{
        const buf=await blob.arrayBuffer();
        const audioBuf=await Tone.context.rawContext.decodeAudioData(buf);
        resolve(audioBuf);
      }catch(e){ console.warn('loop decode:',e); resolve(null); }
    };
    loopRecorder.stop();
  });
}

function addLoopLayer(audioBuf){
  if(!audioBuf) return;
  const rawCtx=Tone.context.rawContext;
  if(loopSources.length===0){
    loopDuration=audioBuf.duration;
    loopStartCtxTime=rawCtx.currentTime;
  }
  const elapsed=rawCtx.currentTime-loopStartCtxTime;
  const phase=loopDuration>0?elapsed%loopDuration:0;
  const g=rawCtx.createGain(); g.gain.value=0.85;
  const src=rawCtx.createBufferSource();
  src.buffer=audioBuf; src.loop=true; src.loopEnd=loopDuration;
  src.connect(g);
  g.connect(rawCtx.destination);
  if(fullRecBridgeGain) g.connect(fullRecBridgeGain);
  src.start(rawCtx.currentTime, phase);
  loopSources.push({src,g});
  loopLayerCount++;
  updateLoopUI();
}

function clearLoop(){
  loopSources.forEach(({src,g})=>{try{src.stop();src.disconnect();g.disconnect();}catch(e){}});
  loopSources=[];loopLayerCount=0;loopDuration=0;loopStartCtxTime=0;
  updateLoopUI();
}

function updateLoopUI(){
  const btn=document.getElementById('loopBtn');
  const clr=document.getElementById('loopClearBtn');
  const lyr=document.getElementById('loopLayerTxt');
  const sts=document.getElementById('loopStatus');
  if(loopLayerCount===0){
    btn.textContent='⏺ 루프 녹음'; btn.disabled=false; clr.disabled=true;
    lyr.textContent=''; sts.textContent='대기중';
  } else if(loopLayerCount<MAX_LOOP_LAYERS){
    btn.textContent='⏺ 레이어 추가'; btn.disabled=false; clr.disabled=false;
    lyr.textContent='레이어 '+loopLayerCount+'/'+MAX_LOOP_LAYERS;
    if(!isLoopRecording) sts.textContent='루프 재생 중';
  } else {
    btn.textContent='레이어 최대'; btn.disabled=true; clr.disabled=false;
    lyr.textContent='레이어 '+loopLayerCount+'/'+MAX_LOOP_LAYERS;
    sts.textContent='루프 재생 중';
  }
}

function setInstLabel(){
  const names={danso:'단소',piano:'피아노',violin:'바이올린',flute:'플루트',cello:'첼로',guitar:'기타',organ:'오르간'};
  const sn={korean:'국악',western:'서양'};
  const el=document.getElementById('instLabel');
  if(el) el.textContent=(names[currentInst]||currentInst)+' · '+sn[currentScale];
}

// ── UI ───────────────────────────────────────────────
let animPhase=0;
const vibBars=[];
const vibRing=document.getElementById('vibRing');
for(let i=0;i<20;i++){
  const b=document.createElement('div'); b.className='vib-bar'; b.style.height='4px';
  vibRing.appendChild(b); vibBars.push(b);
}
function animVib(){
  animPhase+=0.12;
  vibBars.forEach((b,i)=>{
    const w=Math.sin(animPhase*3+i*0.6)*0.5+0.5;
    b.style.height=Math.round(4+w*(vibration/100)*44)+'px';
  });
  if(loopDuration>0&&loopStartCtxTime>0&&Tone.context){
    const pct=((Tone.context.rawContext.currentTime-loopStartCtxTime)%loopDuration/loopDuration)*100;
    const el=document.getElementById('loopBar');
    if(el) el.style.width=pct+'%';
  }
  requestAnimationFrame(animVib);
}
animVib();

function updateUI(){
  document.getElementById('volFill').style.height=volume+'%';
  document.getElementById('volVal').textContent=Math.round(volume);
  document.getElementById('pitchFill').style.height=pitch+'%';
  const lbl=getLabelAt(pitch);
  const sol=getSolfegeAt(pitch);
  document.getElementById('pitchVal').textContent=sol;
  document.getElementById('cardVol').textContent=Math.round(volume)+'%';
  document.getElementById('cardPitch').textContent=currentScale==='western'? sol+' ('+lbl+')' : lbl;
  document.getElementById('cardVib').textContent=Math.round(vibration)+'%';
}

// 악기 버튼
document.getElementById('instRow').addEventListener('click',async e=>{
  const btn=e.target.closest('.inst-btn');
  if(!btn||isLoading) return;
  document.querySelectorAll('.inst-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  await switchInstrument(btn.dataset.inst);
});

// 음계 버튼
document.querySelector('.scale-row').addEventListener('click',e=>{
  const btn=e.target.closest('.scale-btn');
  if(!btn) return;
  document.querySelectorAll('.scale-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  currentScale=btn.dataset.scale;
  lastNote='';
  setInstLabel();
  updateUI();
});

// ── 손 인식 ──────────────────────────────────────────
function getSpread(lm){
  const w=lm[0]; let max=0;
  [4,8,12,16,20].forEach(i=>{
    const dx=lm[i].x-w.x, dy=lm[i].y-w.y;
    max=Math.max(max,Math.sqrt(dx*dx+dy*dy));
  });
  return Math.min(max*3,1);
}
function drawHand(lm,color){
  const W=overlayCanvas.width, H=overlayCanvas.height;
  const conn=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]];
  ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.lineCap='round';
  conn.forEach(([a,b])=>{ctx.beginPath();ctx.moveTo(lm[a].x*W,lm[a].y*H);ctx.lineTo(lm[b].x*W,lm[b].y*H);ctx.stroke();});
  lm.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x*W,p.y*H,i===0?7:4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();});
}
function lerp(a,b,t){return a+(b-a)*t;}

const startBtn=document.getElementById('startBtn');
const camVideo=document.getElementById('camVideo');
const overlayCanvas=document.getElementById('overlayCanvas');
const ctx=overlayCanvas.getContext('2d');

startBtn.addEventListener('click',async()=>{
  startBtn.textContent='연결 중...';
  startBtn.disabled=true;

  await Tone.start();
  setupRecording();
  initDanso();

  let stream;
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:true});
  }catch(e){
    startBtn.disabled=false;
    startBtn.textContent='카메라 접근 실패 — 다시 시도';
    alert('카메라 권한을 허용해 주세요.\n\n오류: '+e.message);
    return;
  }

  camVideo.srcObject=stream;
  await camVideo.play();
  document.getElementById('mainStage').style.display='block';
  document.getElementById('infoRow').style.display='grid';
  document.getElementById('recRow').style.display='flex';
  document.getElementById('loopRow').style.display='flex';
  startBtn.style.display='none';
  overlayCanvas.width=480; overlayCanvas.height=360;
  setInstLabel();

  const hands=new Hands({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
  hands.setOptions({maxNumHands:2, modelComplexity:0, minDetectionConfidence:0.7, minTrackingConfidence:0.5});

  hands.onResults(results=>{
    ctx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
    const statusBar=document.getElementById('statusBar');
    if(!results.multiHandLandmarks||results.multiHandLandmarks.length===0){
      if(!isLoading) statusBar.textContent='손을 카메라에 보여주세요';
      if(soundActive&&!silenceTimer){
        silenceTimer=setTimeout(()=>{soundActive=false;updateSound();silenceTimer=null;},400);
      }
      return;
    }
    if(silenceTimer){clearTimeout(silenceTimer);silenceTimer=null;}
    soundActive=true;

    let parts=[];
    results.multiHandLandmarks.forEach((lm,idx)=>{
      const label=results.multiHandedness[idx].label;
      const wristY=lm[0].y;
      if(label==='Left'){
        drawHand(lm,'#9FE1CB');
        pitch=snapToNote(lerp(pitch,Math.min(Math.max((1-wristY)*100,0),100),0.15));
        vibration=Math.round(lerp(vibration,getSpread(lm)*100,0.2));
        parts.push('오른손 — 음역대·진동');
      }else{
        drawHand(lm,'#CECBF6');
        volume=Math.round(lerp(volume,Math.min(Math.max((1-wristY)*100,0),100),0.2));
        parts.push('왼손 — 볼륨');
      }
    });
    if(!isLoading) statusBar.textContent=parts.join('  |  ');
    updateSound();
    updateUI();
  });

  let frameCount=0;
  const camera=new Camera(camVideo,{
    onFrame:async()=>{
      frameCount++;
      if(frameCount%3!==0) return;
      await hands.send({image:camVideo});
    },
    width:640, height:480
  });
  camera.start();
});

// ── 녹음 버튼 이벤트 ─────────────────────────────────
document.getElementById('recBtn').addEventListener('click',()=>{
  isRecording?stopRecording():startRecording();
});
document.getElementById('playBtn').addEventListener('click',()=>{
  document.getElementById('recAudio').play();
});
document.getElementById('dlBtn').addEventListener('click',()=>{
  if(!recBlobUrl) return;
  const a=document.createElement('a');
  a.href=recBlobUrl;
  a.download='visual-dj-'+new Date().toISOString().slice(0,19).replace(/[:.]/g,'-')+'.webm';
  a.click();
});

// ── 루프 버튼 이벤트 ─────────────────────────────────
document.getElementById('loopBtn').addEventListener('click',async()=>{
  if(!recDest) return;
  if(!isLoopRecording){
    if(loopLayerCount>=MAX_LOOP_LAYERS) return;
    startLoopRecording();
  } else {
    document.getElementById('loopBtn').disabled=true;
    document.getElementById('loopBtn').classList.remove('loop-rec');
    const buf=await finishLoopRecording();
    addLoopLayer(buf);
  }
});
document.getElementById('loopClearBtn').addEventListener('click',()=>clearLoop());
