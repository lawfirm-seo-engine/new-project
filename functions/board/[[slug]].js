import {
  CRIMINAL_BOARD_SITE_URL,
  criminalBoardDescription,
  criminalBoardLastModified,
  criminalBoardPostUrl,
  criminalBoardTitle,
  getCriminalBoardPost,
  listCriminalBoardPosts,
  sortCriminalBoardPosts,
} from "../_criminalBoard.js";

export async function onRequest({ request, env, params }) {
  const url = new URL(request.url);
  if (url.hostname !== "gnlaw-criminal.co.kr" && url.hostname !== "www.gnlaw-criminal.co.kr") return new Response("Not Found", { status: 404 });

  const slug = String(params?.slug || "").replace(/^\/+|\/+$/g, "");
  if (!slug) return renderList(env);

  const post = await getCriminalBoardPost(env, slug);
  if (!post || post.status !== "published") return html(notFound(), 404);
  return html(renderPost(post));
}

async function renderList(env) {
  const posts = sortCriminalBoardPosts((await listCriminalBoardPosts(env)).filter((p) => p.status === "published"));
  const cards = posts.length ? posts.map((post) => `<article class="row"><a href="${esc(criminalBoardPostUrl(post.slug))}"><span class="category">${esc(post.category || "피해 대응")}</span><h2>${esc(post.title)}</h2><p>${esc(post.excerpt || "")}</p><time>${esc(post.publishedAt || post.updatedAt || "")}</time></a></article>`).join("") : `<div class="empty">등록된 게시글이 없습니다.</div>`;
  return html(layout({ title: "법률정보 게시판 | 법무법인 선린", description: "법무법인 선린의 금융·투자사기 피해 대응 및 사건 진행 관련 법률정보 게시판입니다.", canonical: `${CRIMINAL_BOARD_SITE_URL}/board/`, body: `<section class="hero"><div><span>LEGAL INSIGHT</span><h1>법률정보 게시판</h1><p>금융·투자사기 피해 대응과 사건 진행에 필요한 정보를 안내합니다.</p></div></section><main class="list"><div class="list-head"><strong>전체 게시글</strong><span>${posts.length}건</span></div>${cards}</main>` }));
}

function renderPost(post) {
  const title = criminalBoardTitle(post);
  const description = criminalBoardDescription(post);
  const body = renderMarkdown(post.body || "");
  return layout({ title: `${title} | 법무법인 선린`, description, canonical: criminalBoardPostUrl(post.slug), body: `<main class="article"><nav><a href="/board/">법률정보</a> / ${esc(post.category || "피해 대응")}</nav><header><span class="category">${esc(post.category || "피해 대응")}</span><h1>${esc(post.title)}</h1><div class="date">${esc(post.publishedAt || criminalBoardLastModified(post))}</div></header>${post.thumbnailUrl ? `<figure><img src="${esc(post.thumbnailUrl)}" alt="${esc(post.title)}" loading="eager"></figure>` : ""}<section class="content">${body}</section><div class="back"><a href="/board/">← 목록으로</a></div></main>` });
}

const GA_TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-KK457HFNPS"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-KK457HFNPS');
</script>`;

function layout({ title, description, canonical, body }) {
  return `<!doctype html><html lang="ko"><head>${GA_TAG}<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="article"><link rel="stylesheet" href="/assets/style.css?v=20260825-mobile-header-match"><style>${styles()}</style></head><body class="domain-a">${siteHeader()}${body}${siteFooter()}</body></html>`;
}

function siteHeader() {
  return `<header class="site-header">
    <a class="brand" href="/" aria-label="법무법인 선린 홈페이지">
      <img src="/assets/logo.png" alt="법무법인 선린" loading="lazy" decoding="async">
    </a>
    <nav class="center-nav" aria-label="주요 메뉴">
      <details class="center-nav-group">
        <summary class="center-nav-parent">선린소개</summary>
        <div class="center-nav-sub" aria-label="선린소개 하위 메뉴">
          <a href="/about/greeting/">인사말</a>
          <a href="/about/members/">선린의 구성원</a>
        </div>
      </details>
      <a href="/#practice">업무분야</a>
      <a href="/prosecute/">진행사건</a>
      <a href="/board/">성공사례</a>
      <a class="center-nav-call" href="tel:0263480406">상담문의</a>
    </nav>
  </header>`;
}

function siteFooter() {
  return `<footer class="site-footer">
    <div class="footer-inner">
      <address class="footer-info">
        <span>법무법인 선린 ｜ 사업자등록번호 : 420-87-0032 ｜ 대표변호사 : 김상수</span>
        <span>서울특별시 서초구 반포대로 108 양원빌딩 4층 ｜ 대표번호 : <a href="tel:0263480406">02-6348-0406</a></span>
      </address>
      <nav class="footer-policy">
        <a href="/privacy-policy/">개인정보처리방침</a>
      </nav>
      <p class="copyright">Copyright ⓒ법무법인 선린 All Right Reserved.</p>
    </div>
  </footer>`;
}

function renderMarkdown(source) {
  const lines = String(source).replace(/\r\n/g, "\n").split("\n");
  let out = "", list = false;
  const closeList = () => { if (list) { out += "</ul>"; list = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const img = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)(?:\s+"([^"]*)")?\)$/);
    if (img) { closeList(); out += `<figure><img src="${esc(img[2])}" alt="${esc(img[1])}" loading="lazy">${img[3] ? `<figcaption>${esc(img[3])}</figcaption>` : ""}</figure>`; continue; }
    if (line.startsWith("#### ")) { closeList(); out += `<h4>${esc(line.slice(5))}</h4>`; continue; }
    if (line.startsWith("### ")) { closeList(); out += `<h3>${esc(line.slice(4))}</h3>`; continue; }
    if (line.startsWith("## ")) { closeList(); out += `<h2>${esc(line.slice(3))}</h2>`; continue; }
    if (line.startsWith("- ")) { if (!list) { out += "<ul>"; list = true; } out += `<li>${esc(line.slice(2))}</li>`; continue; }
    closeList(); out += `<p>${esc(line)}</p>`;
  }
  closeList(); return out;
}

function notFound() { return layout({ title:"게시글을 찾을 수 없습니다 | 법무법인 선린", description:"요청하신 게시글을 찾을 수 없습니다.", canonical:`${CRIMINAL_BOARD_SITE_URL}/board/`, body:`<main class="article"><h1>게시글을 찾을 수 없습니다.</h1><div class="back"><a href="/board/">게시판으로 이동</a></div></main>` }); }
function html(body,status=200){return new Response(body,{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=60, s-maxage=300"}})}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function styles(){return `*{box-sizing:border-box}body{margin:0;color:#18202a;font-family:Arial,'Noto Sans KR',sans-serif;background:#fff}.hero{background:#102f42;color:#fff;padding:78px 24px}.hero>div{max-width:1180px;margin:auto}.hero span{font-size:12px;letter-spacing:2px;color:#9eb9c9}.hero h1{font-size:44px;margin:12px 0}.hero p{color:#d8e2e8}.list,.article{max-width:1040px;margin:0 auto;padding:55px 24px 90px}.list-head{display:flex;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #153e55}.row{border-bottom:1px solid #e6e9ed}.row a{display:block;padding:25px 4px;text-decoration:none;color:inherit}.row h2{font-size:22px;margin:8px 0}.row p{margin:0 0 10px;color:#64707d}.row time,.date{font-size:13px;color:#89939d}.category{font-size:12px;font-weight:800;color:#17618a}.article nav{font-size:13px;color:#7a8792;margin-bottom:32px}.article nav a,.back a{color:#164d6b}.article header{padding-bottom:30px;border-bottom:1px solid #e6e9ed}.article h1{font-size:38px;line-height:1.35;margin:10px 0 14px}.article>figure img,.content figure img{max-width:100%;height:auto}.content{font-size:17px;line-height:1.9;padding-top:35px}.content h2{font-size:27px;margin-top:48px}.content h3{font-size:22px;margin-top:38px}.content li{margin:8px 0}.back{margin-top:60px;padding-top:24px;border-top:1px solid #e6e9ed}.empty{padding:60px;text-align:center;color:#8a949d}@media(max-width:700px){.hero{padding:55px 20px}.hero h1{font-size:34px}.article h1{font-size:30px}.list,.article{padding-left:20px;padding-right:20px}}`}
