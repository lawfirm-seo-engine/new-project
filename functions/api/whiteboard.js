const RENDER_REPO = "srt-whiteboard-animation";
const WORKFLOW = "sunrin-render.yml";
const RENDER_STYLES = ["hand","slide","zoom","parallax","cinematic","callout","card-stack","news","glitch"];

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const owner = env.GITHUB_REPO_OWNER;
    const token = env.WHITEBOARD_GITHUB_TOKEN;
    if (!owner || !token) return json({ok:false,message:"Cloudflare Pages에 GITHUB_REPO_OWNER 또는 WHITEBOARD_GITHUB_TOKEN 환경변수가 없습니다."},500);
    if (request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ok:false,message:"요청 JSON을 읽지 못했습니다."},400); }
      const action = body.action || "create";
      const job = safeJob(body.job || `${Date.now()}`);
      if (action === "create" || action === "direct") {
        if (body.project) {
          const project = normalizeProject(body.project);
          await putFile(owner,token,`projects/${job}/project.json`,JSON.stringify(project,null,2),`project: ${job}`);
          await putFile(owner,token,`projects/${job}/status.json`,JSON.stringify({stage:"project-ready",imagesReady:false,previewReady:false,finalReady:false,error:null,renderMode:project.renderMode,useHandDrawing:project.useHandDrawing},null,2),`status: ${job}`);
        }
        if (action === "direct") {
          await dispatch(owner,token,"direct",job);
          return json({ok:true,job,stage:"direct-queued"});
        }
        return json({ok:true,job,stage:"project-ready"});
      }
      if (!["images","preview","final"].includes(action)) return json({ok:false,message:"지원하지 않는 작업입니다."},400);
      await dispatch(owner,token,action,job);
      return json({ok:true,job,stage:`${action}-queued`});
    }
    if (request.method === "GET") {
      const job=safeJob(url.searchParams.get("job")||"");
      if(!job)return json({ok:false,message:"job이 필요합니다."},400);
      const status=await getJson(owner,token,`projects/${job}/status.json`)||{};
      const base=`https://raw.githubusercontent.com/${owner}/${RENDER_REPO}/main/projects/${job}`;
      return json({ok:true,job,...status,previewUrl:status.previewReady?`${base}/preview.mp4?v=${Date.now()}`:null,finalUrl:status.finalReady?`${base}/final.mp4?v=${Date.now()}`:null,sceneBase:`${base}/scenes/`});
    }
    return json({ok:false,message:"Method not allowed"},405);
  } catch (e) {
    return json({ok:false,message:e?.message||String(e)},500);
  }
}
function normalizeProject(p){
  const scenes=Array.isArray(p.scenes)?p.scenes:[];
  if(!scenes.length)throw new Error("장면이 없습니다.");
  let renderMode=String(p.renderMode||"").trim();
  if(!RENDER_STYLES.includes(renderMode)) renderMode=p.useHandDrawing===false?"slide":"hand";
  const useHandDrawing=renderMode==="hand";
  return{
    title:p.title||"화이트보드 영상",
    durationMs:Number(p.durationMs)||30000,
    aspect:["16:9","9:16","1:1"].includes(p.aspect)?p.aspect:"16:9",
    source:p.source||"admin",
    renderMode,
    useHandDrawing,
    brand:{name:"법무법인 선린",canvasColor:"#F5EBD7",handAsset:"assets/drawing-hand.png",renderer:"scripts/render_stream_whiteboard.py",finalCta:"지금 바로 법무법인 선린 사기피해 특화 전문 TF팀에 상담 받으세요"},
    scenes
  }
}
function safeJob(v){return String(v).replace(/[^0-9a-zA-Z_-]/g,"-").replace(/-+/g,"-").slice(0,80)}
function headers(token){return{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","Content-Type":"application/json","User-Agent":"sunrin-whiteboard-admin"}}
async function putFile(owner,token,path,content,message){const url=`https://api.github.com/repos/${owner}/${RENDER_REPO}/contents/${path}`;let sha;const old=await fetch(url+"?ref=main",{headers:headers(token)});if(old.ok)sha=(await old.json()).sha;const r=await fetch(url,{method:"PUT",headers:headers(token),body:JSON.stringify({message,content:b64(content),branch:"main",...(sha?{sha}:{})})});if(!r.ok)throw new Error(`GitHub 저장 실패 ${r.status}: ${await r.text()}`)}
async function dispatch(owner,token,mode,job){const r=await fetch(`https://api.github.com/repos/${owner}/${RENDER_REPO}/actions/workflows/${WORKFLOW}/dispatches`,{method:"POST",headers:headers(token),body:JSON.stringify({ref:"main",inputs:{mode,job}})});if(!r.ok)throw new Error(`렌더 작업 시작 실패 ${r.status}: ${await r.text()}`)}
async function getJson(owner,token,path){const r=await fetch(`https://api.github.com/repos/${owner}/${RENDER_REPO}/contents/${path}?ref=main`,{headers:headers(token)});if(!r.ok)return null;const d=await r.json();return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((d.content||"").replace(/\n/g,"")),c=>c.charCodeAt(0))))}
function b64(v){const b=new TextEncoder().encode(v);let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s)}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
