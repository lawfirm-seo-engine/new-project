export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const assetUrl = new URL('/admin/dashboard.html', url.origin);
  const asset = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  if (!asset.ok) return asset;

  let html = await asset.text();
  const anchor = '<a class="btn" href="/admin/readingroom.html">리딩방 랜딩 생성</a>';
  const whiteboard = `${anchor}\n    <a class="btn" href="/admin/whiteboard.html" style="background:#8c1d18">화이트보드 영상 생성</a>`;
  if (!html.includes('/admin/whiteboard.html')) {
    html = html.replace(anchor, whiteboard);
  }

  const headers = new Headers(asset.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.delete('Content-Length');
  headers.delete('ETag');
  return new Response(html, { status: asset.status, headers });
}
