import { INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY } from "../_seo.js";
import {
  BOARD_HOST,
  BOARD_SITE_URL,
  boardListUrl,
  boardPostUrl,
  boardImageUrl,
  deleteBoardPost,
  getBoardPost,
  listBoardPosts,
  saveBoardPost,
} from "../_board.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") || "";

  try {
    if (slug) {
      const post = await getBoardPost(env, slug);
      if (!post) return json({ ok: false, message: "게시글을 찾을 수 없습니다." }, 404);
      return json({ ok: true, post });
    }

    const posts = await listBoardPosts(env);
    return json({ ok: true, posts });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const post = await saveBoardPost(env, body);
    const key = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
    context.waitUntil?.(warmBoardPost(post).then(() => pingIndexNow([boardPostUrl(post.slug), boardListUrl(), `${BOARD_SITE_URL}/sitemap.xml`], key)).catch(() => {}));
    return json({ ok: true, post, message: "게시글이 저장되었습니다." });
  } catch (error) {
    return json({ ok: false, message: error.message }, 400);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    let slug = url.searchParams.get("slug") || "";
    if (!slug) {
      const body = await request.json().catch(() => ({}));
      slug = body.slug || "";
    }
    const deletedSlug = await deleteBoardPost(env, slug);
    const key = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
    context.waitUntil?.(pingIndexNow([boardPostUrl(deletedSlug), boardListUrl(), `${BOARD_SITE_URL}/sitemap.xml`], key).catch(() => {}));
    return json({ ok: true, slug: deletedSlug, message: "게시글이 삭제되었습니다." });
  } catch (error) {
    return json({ ok: false, message: error.message }, 400);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

async function warmBoardPost(post) {
  await Promise.allSettled([
    fetch(boardPostUrl(post.slug), { method: "GET" }),
    fetch(boardImageUrl(post), { method: "GET" }),
  ]);
}

async function pingIndexNow(urlList, key) {
  if (!key) return null;
  const response = await fetch("https://searchadvisor.naver.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: BOARD_HOST,
      key,
      keyLocation: `${BOARD_SITE_URL}/${key}.txt`,
      urlList,
    }),
  });
  return {
    ok: response.ok,
    status: response.status,
    body: (await response.text().catch(() => "")).slice(0, 160),
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
