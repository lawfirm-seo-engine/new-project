import {
  criminalBoardListUrl,
  criminalBoardPostUrl,
  deleteCriminalBoardPost,
  getCriminalBoardPost,
  listCriminalBoardPosts,
  saveCriminalBoardPost,
} from "../_criminalBoard.js";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") || "";
    if (slug) {
      const post = await getCriminalBoardPost(env, slug);
      if (!post || post.status === "hidden") return json({ ok: false, message: "게시글을 찾을 수 없습니다." }, 404);
      return json({ ok: true, post });
    }
    return json({ ok: true, posts: await listCriminalBoardPosts(env) });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const post = await saveCriminalBoardPost(env, await request.json());
    return json({ ok: true, post, url: criminalBoardPostUrl(post.slug), listUrl: criminalBoardListUrl(), message: "게시글이 저장되었습니다." });
  } catch (error) {
    return json({ ok: false, message: error.message }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const url = new URL(request.url);
    let slug = url.searchParams.get("slug") || "";
    if (!slug) slug = (await request.json().catch(() => ({}))).slug || "";
    const deletedSlug = await deleteCriminalBoardPost(env, slug);
    return json({ ok: true, slug: deletedSlug, message: "게시글이 삭제되었습니다." });
  } catch (error) {
    return json({ ok: false, message: error.message }, 400);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
