/**
 * Cloudflare Worker — Pinterest Video Resolver + Downloader
 * Untuk joinbib.id/pinterest-downloader
 *
 * Endpoint:
 *   GET /resolve?url=<link pin>   -> { ok, video, title, thumbnail }
 *   GET /download?url=<mp4>&name= -> streaming mp4 (paksa "save as")
 *
 * Kenapa perlu Worker: browser diblokir CORS saat mengambil halaman
 * Pinterest. Worker mengambilnya di sisi server (tanpa batas CORS),
 * jadi jauh lebih andal daripada proxy publik gratisan.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    try {
      if (url.pathname === "/resolve" || url.pathname === "/") {
        return await resolve(url);
      }
      if (url.pathname === "/download") {
        return await download(url);
      }
      return json({ ok: false, error: "Not found" }, 404);
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, 500);
    }
  },
};

/* ---------- /resolve ---------- */
async function resolve(url) {
  const pin = url.searchParams.get("url");
  if (!pin) return json({ ok: false, error: "Parameter 'url' kosong." }, 400);
  if (!/pinterest\.[a-z.]+\/|pin\.it\//i.test(pin)) {
    return json({ ok: false, error: "Itu bukan link Pinterest." }, 400);
  }

  const res = await fetch(pin, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    redirect: "follow",
  });
  if (!res.ok) {
    return json({ ok: false, error: "Gagal membuka pin (" + res.status + ")." }, 502);
  }
  const html = await res.text();

  const video = extractMp4(html);
  if (!video) {
    return json(
      { ok: false, error: "Video tidak ditemukan. Pastikan itu pin VIDEO, bukan gambar." },
      404
    );
  }
  return json({
    ok: true,
    video,
    title: meta(html, "og:title") || "Pinterest Video",
    thumbnail: meta(html, "og:image") || "",
  });
}

/* ---------- /download (paksa unduh) ---------- */
async function download(url) {
  const target = url.searchParams.get("url");
  const name = (url.searchParams.get("name") || "pinterest-video").replace(/[^\w.-]/g, "_");
  if (!target) return json({ ok: false, error: "Parameter 'url' kosong." }, 400);

  let host;
  try {
    host = new URL(target).hostname;
  } catch (e) {
    return json({ ok: false, error: "URL tidak valid." }, 400);
  }
  // hanya izinkan CDN Pinterest supaya ini bukan open proxy
  if (!/(^|\.)pinimg\.com$/i.test(host) && !/(^|\.)pinterest\.[a-z.]+$/i.test(host)) {
    return json({ ok: false, error: "Host tidak diizinkan." }, 403);
  }

  const r = await fetch(target, { headers: { "User-Agent": UA } });
  if (!r.ok) return json({ ok: false, error: "Gagal mengambil video (" + r.status + ")." }, 502);

  const headers = new Headers(CORS);
  headers.set("Content-Type", r.headers.get("Content-Type") || "video/mp4");
  headers.set("Content-Disposition", 'attachment; filename="' + name + '.mp4"');
  const len = r.headers.get("Content-Length");
  if (len) headers.set("Content-Length", len);
  headers.set("Cache-Control", "no-store");

  return new Response(r.body, { status: 200, headers });
}

/* ---------- util ---------- */
function extractMp4(html) {
  const text = html
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
  const re = /https:\/\/[^"'\\\s)]+?\.mp4[^"'\\\s)]*/g;
  const found = new Set();
  let m;
  while ((m = re.exec(text))) found.add(m[0]);
  const urls = [...found];
  if (!urls.length) return null;
  const score = (u) =>
    /1080/.test(u) ? 4 : /720/.test(u) ? 3 : /480/.test(u) ? 2 : /360/.test(u) ? 1 : 0;
  urls.sort((a, b) => score(b) - score(a) || b.length - a.length);
  return urls[0];
}

function meta(html, prop) {
  const m =
    html.match(
      new RegExp('<meta[^>]+property=["\']' + prop + '["\'][^>]+content=["\']([^"\']+)["\']', "i")
    ) ||
    html.match(
      new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']' + prop + '["\']', "i")
    );
  return m ? m[1].replace(/&amp;/g, "&") : "";
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS),
  });
}
