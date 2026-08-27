(()=>{
const RAW='https://raw.githubusercontent.com/lawfirm-seo-engine/srt-whiteboard-animation/main/assets/';
const PRESETS=[
['hook','고수익을 보장한다는 주식 투자 광고, 정말 믿어도 될까요?','고수익 광고와 주식 차트를 확인하는 피해자','stock_card_01.png',1],
['approach','SNS와 메신저에서 투자 전문가를 사칭해 접근합니다.','투자 전문가 사칭 계정과 리딩방 초대 메시지','stock_card_02.png',1],
['invite','비공개 리딩방과 특별 종목 정보를 제공하겠다며 참여를 유도합니다.','비공개 단체 채팅방과 종목 추천 메시지','stock_card_03.png',1],
['trust','다른 참여자의 수익 인증과 성공 사례로 신뢰를 쌓습니다.','가짜 수익 인증과 투자 성공 화면','stock_card_04.png',1],
['platform','전용 거래 사이트나 앱에 가입하도록 안내합니다.','가짜 투자 플랫폼 가입과 계정 생성','stock_card_05.png',1],
['deposit-small','처음에는 비교적 적은 금액의 입금을 요구합니다.','투자 계좌로 첫 입금을 진행하는 장면','stock_card_06.png',1],
['fake-profit','화면에는 수익이 발생한 것처럼 숫자가 표시됩니다.','투자 대시보드에서 허위 수익이 증가하는 장면','stock_card_07.png',1],
['vip','VIP 종목과 특별 프로젝트를 강조하며 투자금을 키우게 합니다.','VIP 투자 프로젝트와 고수익 제안','stock_card_08.png',1],
['deposit-large','수천만 원대의 고액 송금을 반복해서 요구합니다.','고액 투자금이 가짜 플랫폼으로 이동하는 장면','stock_card_09.png',1],
['profit-surge','투자 화면의 수익은 계속 커지지만 실제 출금과는 무관합니다.','비정상적으로 급증하는 허위 수익 그래프','stock_card_10.png',1],
['withdrawal','피해자가 출금을 신청하면 처리가 지연되기 시작합니다.','출금 신청 버튼과 처리 지연 화면','stock_card_11.png',1],
['extra-fee','세금, 보증금, 인증비를 이유로 추가 입금을 요구합니다.','세금 보증금 인증비 추가 납부 요구','stock_card_12.png',1],
['blocked','추가 송금 후에도 출금은 거부되고 연락이 끊길 수 있습니다.','출금 거부와 계정 차단 및 연락 두절','stock_card_13.png',1],
['evidence','채팅, 이체내역, 계좌번호, 사이트 주소를 즉시 보존해야 합니다.','피해 관련 증거 자료를 한곳에 모으는 장면','stock_card_14.png',1],
['cta','피해가 의심된다면 지금 바로 법무법인 선린 사기피해 특화 전문 TF팀에 상담 받으세요.','피해자가 자료를 준비해 법무법인 선린과 상담하는 장면','stock_card_15.png',1.4]
].map((x,i)=>({index:i+1,role:x[0],narration:x[1],visual:x[2],imageUrl:RAW+x[3],weight:x[4]}));
const $=s=>document.querySelector(s);const box=$('#scenes'),tpl=$('#sceneTpl');let job=null,presetPoll=null;
function injectPanel(){
 const notice=document.querySelector('.notice');if(notice){notice.innerHTML='<span class="brand">주식리딩방 기본 이미지 15종 적용 완료</span> · OpenAI 이미지 API를 사용하지 않고 GitHub에 올린 15장의 PNG를 그대로 손그림 영상 장면으로 사용합니다.'}
 const head=document.querySelector('.sceneHead');if(!head||document.querySelector('#presetGrid'))return;
 const section=document.createElement('section');section.className='panel whiteboard-preset-panel';section.innerHTML='<div class="whiteboard-preset-head"><div><strong>주식리딩방 기본 이미지 15종</strong><div class="status">개별 이미지를 누르면 장면 목록 끝에 추가됩니다.</div></div><button class="btn red" id="loadPreset" type="button">15개 전체 불러오기</button></div><div class="whiteboard-preset-grid" id="presetGrid"></div>';head.parentNode.insertBefore(section,head);
 const grid=section.querySelector('#presetGrid');PRESETS.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className='whiteboard-preset-card';b.innerHTML=`<img src="${p.imageUrl}" alt="기본 이미지 ${i+1}"><span>장면 ${String(i+1).padStart(2,'0')}</span>`;b.onclick=()=>addScene({...p});grid.appendChild(b)});section.querySelector('#loadPreset').onclick=resetPreset;
}
function renumber(){[...box.children].forEach((e,i)=>{const n=e.querySelector('.num');if(n)n.textContent=`SCENE ${String(i+1).padStart(2,'0')}`})}
function addScene(d){
 const e=tpl.content.firstElementChild.cloneNode(true);e.dataset.imageUrl=d.imageUrl||'';
 e.querySelector('.role').value=d.role||'custom';e.querySelector('.weight').value=d.weight||1;e.querySelector('.narration').value=d.narration||'';e.querySelector('.visual').value=d.visual||'';
 const preview=document.createElement('div');preview.className='whiteboard-scene-preview';preview.innerHTML=d.imageUrl?`<img src="${d.imageUrl}" alt="장면 이미지">`:'<div class="status" style="padding:70px 15px;text-align:center">이미지 없음</div>';e.querySelector('.sceneTop').after(preview);
 const url=document.createElement('div');url.className='whiteboard-image-url';url.textContent=d.imageUrl||'기본 이미지 없음';e.appendChild(url);
 e.querySelector('.del').onclick=()=>{e.remove();renumber()};e.querySelector('.up').onclick=()=>{if(e.previousElementSibling)box.insertBefore(e,e.previousElementSibling);renumber()};e.querySelector('.down').onclick=()=>{if(e.nextElementSibling)box.insertBefore(e.nextElementSibling,e);renumber()};box.appendChild(e);renumber();
}
function stopPoll(){if(presetPoll)clearInterval(presetPoll);presetPoll=null}
function resetPreset(){stopPoll();box.innerHTML='';PRESETS.forEach(p=>addScene({...p}));job=null;const j=$('#jobText');if(j)j.textContent='주식리딩방 기본 이미지 15종 적용';const s=$('#status');if(s)s.textContent='대기 중';const m=$('#media');if(m)m.style.display='none';const g=$('#generate');if(g)g.disabled=false}
function buildProject(){
 const cards=[...box.children];if(!cards.length)throw Error('장면을 추가하세요.');const scenes=cards.map((c,i)=>({index:i+1,role:c.querySelector('.role').value.trim(),weight:Number(c.querySelector('.weight').value)||1,narration:c.querySelector('.narration').value.trim(),visual:c.querySelector('.visual').value.trim(),imageUrl:c.dataset.imageUrl||''}));
 if(scenes.some(s=>!s.narration||!s.visual))throw Error('모든 장면의 내레이션과 설명을 입력하세요.');if(scenes.some(s=>!s.imageUrl))throw Error('이미지가 없는 장면이 있습니다. 해당 장면을 삭제하거나 기본 이미지를 선택하세요.');
 const total=Number($('#duration').value)*1000,sum=scenes.reduce((a,s)=>a+s.weight,0);let cur=0;scenes.forEach((s,i)=>{const end=i===scenes.length-1?total:Math.round(cur+total*s.weight/sum);s.startMs=cur;s.endMs=end;s.durationMs=end-cur;cur=end});return{title:$('#title').value.trim()||'주식리딩방 사기',durationMs:total,aspect:$('#aspect').value,source:'stock-card-preset-15',scenes};
}
async function parseResponse(r){const text=await r.text();let d;try{d=JSON.parse(text)}catch{throw Error(`서버 응답 오류 HTTP ${r.status}`)}if(!r.ok||!d.ok)throw Error(d.message||`HTTP ${r.status}`);return d}
async function generatePreset(){try{$('#generate').disabled=true;$('#media').style.display='none';const project=buildProject();job=`sunrin-${Date.now()}`;$('#jobText').textContent=`작업 ID: ${job}`;$('#status').textContent='15개 기본 이미지로 영상 작업을 등록하고 있습니다...';const r=await fetch('/api/whiteboard',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({action:'direct',job,project})});await parseResponse(r);$('#status').textContent='기본 이미지 손그림 렌더링을 진행 중입니다.';startPoll()}catch(e){$('#status').textContent='오류: '+e.message;$('#generate').disabled=false}}
async function checkStatus(){if(!job)return;try{const r=await fetch('/api/whiteboard?job='+encodeURIComponent(job),{headers:{Accept:'application/json'},cache:'no-store'}),d=await parseResponse(r);let msg=d.stage||'처리 중';if(d.currentScene)msg+=` · 장면 ${d.currentScene}/${d.totalScenes}`;$('#status').textContent=d.error?'오류: '+d.error:`현재 상태: ${msg}`;if(d.finalReady&&d.finalUrl){stopPoll();$('#generate').disabled=false;$('#media').style.display='block';$('#video').src=d.finalUrl;$('#videoLink').href=d.finalUrl;$('#status').textContent='최종 영상 생성 완료'}else if(d.stage==='error'){stopPoll();$('#generate').disabled=false}}catch(e){stopPoll();$('#status').textContent='상태 확인 오류: '+e.message;$('#generate').disabled=false}}
function startPoll(){stopPoll();checkStatus();presetPoll=setInterval(checkStatus,7000)}
function init(){injectPanel();const d=$('#duration');if(d)d.value='45';const sub=document.querySelector('.top .status');if(sub)sub.textContent='법무법인 선린 · 업로드 이미지 기반 무료 SRT 손그림 렌더러';const flow=document.querySelector('.flow');if(flow)flow.textContent='기본 PNG → drawing annotation → 펜을 쥔 손 드로잉 → 최종 MP4';$('#add').onclick=()=>addScene({role:'custom',weight:1,narration:'',visual:'',imageUrl:''});$('#reset').onclick=resetPreset;$('#generate').onclick=generatePreset;resetPreset()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();