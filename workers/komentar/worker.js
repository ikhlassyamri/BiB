/*
  Worker komentar artikel joinbib.id — pengganti bagian FAQ (keputusan
  pemilik, Agu 2026), plus BALASAN AI AGENT (keputusan pemilik, Agu 2026):
  agen BiB membalas komentar pembaca, dan pembaca yang berlangganan
  notifikasi diberi tahu saat komentarnya dibalas.

  BUKAN bagian situs statis GitHub Pages; deploy terpisah ke Cloudflare.
  Butuh KV namespace ber-binding KOMENTAR + tiga secret (README.md):
    ADMIN_TOKEN     — kunci pintu /antrean & /balas (dipegang repo agen)
    ONESIGNAL_KEY   — REST API Key OneSignal (push "komentarmu dibalas")
    GH_TOKEN        — token GitHub untuk membangunkan workflow balasan

  Endpoint publik (dipanggil halaman artikel):
    GET  /ambil?slug=<slug>  -> {komentar:[{id,nama,teks,waktu,balasan:[..]}]}
                                (osid & kunci TIDAK pernah ikut keluar)
    POST /kirim              -> {ok:true, id, kunci} | {ok:false, pesan}
         body: {slug, nama, teks, situs(honeypot), osid?, benih?,
                balas_ke?}   <- balas_ke = id komentar induk: masuk UTAS
                                balasan komentar itu (keputusan pemilik,
                                Agu 2026 — pembaca boleh saling balas),
                                dan pemilik komentar induk diberi push
                                siapa pun pembalasnya (BiB atau pembaca).
                                osid karenanya TIDAK lagi sekali pakai.

  Endpoint admin (dipanggil workflow agen, wajib Bearer ADMIN_TOKEN):
    GET  /antrean            -> {antrean:[{slug,id,nama,teks,waktu}]}
    POST /balas              -> body {slug, id, teks}; simpan balasan,
                                kirim push ke osid kalau ada, lalu osid
                                dihapus (tugasnya selesai, tidak disimpan)
*/

const ASAL_SAH = ["https://joinbib.id", "https://www.joinbib.id"];
const MAKS_TEKS = 500;
const MAKS_BALASAN = 800;
const MAKS_NAMA = 40;
const MAKS_PER_SLUG = 300;
const JATAH_PER_MENIT = 5; // komentar + balasan (keputusan pemilik, Agu 2026)
const APP_ID = "b08cc556-e8af-4fd1-a046-0c6ae3e1c065";
const REPO_AGEN = "ikhlassyamri/AI-Agent-Artikel-BiB";
const WORKFLOW_BALAS = "balas-komentar.yml";

// Daftar kata terlarang: kasar, vulgar, hinaan (Indonesia + Inggris umum).
// Dicocokkan pada teks yang SUDAH dinormalkan (huruf kecil, angka->huruf,
// sela dihapus). Menambah kata = menambah satu entri di sini.
const KATA_TERLARANG = [
  "anjing","anjir","anjay","asu","babi","bacot","bagong","bajingan","bangke",
  "bangsat","banci","bencong","bego","bejat","berak","biadab","bispak",
  "bokep","brengsek","cabul","cebong","coli","colmek","cuki","dajal",
  "dongo","dungu","entot","gigolo","goblok","goblog","hencet","idiot",
  "itil","jablay","jancok","jancuk","jembut","jingan","kadrun","kampang",
  "kampret","keparat","kimak","kintil","kondom","kontol","lonte","maho",
  "memek","monyet","ngentot","ngewe","pantek","peju","pelacur","peler",
  "pepek","perek","pukimak","sange","sempak","setan kau","silit","sinting",
  "sundal","tempik","titit","toket","tolol","bodoh kau","bodoh lu",
  "goblok kau","tai","taik","telaso","bstrd",
  "fuck","fucking","shit","bitch","asshole","bastard","dick","pussy",
  "cunt","whore","slut","porn","porno","bokef","hentai","milf","nude",
  "ngtd","kntl","mmk","jncq","anjg","bgst","gblk","tll","bgsd",
];

function normal(teks) {
  let t = (teks || "").toLowerCase();
  t = t.replace(/4/g, "a").replace(/1/g, "i").replace(/0/g, "o")
       .replace(/3/g, "e").replace(/5/g, "s").replace(/7/g, "t")
       .replace(/@/g, "a").replace(/\$/g, "s").replace(/!/g, "i");
  t = t.replace(/(.)\1{2,}/g, "$1$1");
  return t;
}
function rapat(teks) { return normal(teks).replace(/[^a-z]/g, ""); }

function adaKataTerlarang(teks) {
  const halus = normal(teks);
  const padat = rapat(teks);
  for (const kata of KATA_TERLARANG) {
    const k = kata.replace(/ /g, "");
    const pola = new RegExp("(^|[^a-z])" + kata.replace(/ /g, "[^a-z]*") + "($|[^a-z])");
    if (pola.test(halus)) return kata;
    if (k.length >= 5 && padat.includes(k)) return kata;
  }
  return null;
}
function adaTautan(teks) {
  return /(https?:\/\/|www\.|\.com\b|\.id\b|\.xyz\b|wa\.me)/i.test(teks || "");
}
function jawab(data, status, asal) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": asal,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    },
  });
}
function slugSah(slug) {
  return typeof slug === "string" && /^[a-z0-9-]{3,120}$/.test(slug);
}
function idBaru() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}
function utas(k) {
  // balasan lama tersimpan sebagai objek tunggal {teks,waktu} (balasan BiB
  // generasi pertama) — dinormalkan jadi array supaya satu bentuk
  if (!k.balasan) return [];
  if (Array.isArray(k.balasan)) return k.balasan;
  return [{ id: "bib0", bib: true, teks: k.balasan.teks, waktu: k.balasan.waktu }];
}

function publik(daftar) {
  // osid (alamat push) & kunci (hak hapus) TIDAK pernah keluar lewat /ambil
  return (daftar || []).map(({ osid, kunci, ...sisa }) => {
    sisa.balasan = utas(sisa);
    return sisa;
  });
}

async function bangunkanAgen(env) {
  // Bangunkan workflow balas-komentar di repo agen — event, bukan polling.
  // Direm 4 menit lewat KV supaya hujan komentar tidak jadi hujan run.
  if (!env.GH_TOKEN) return;
  if (await env.KOMENTAR.get("d:bangun")) return;
  await env.KOMENTAR.put("d:bangun", "1", { expirationTtl: 240 });
  try {
    await fetch(`https://api.github.com/repos/${REPO_AGEN}/actions/workflows/${WORKFLOW_BALAS}/dispatches`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.GH_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "bib-komentar-worker",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    });
  } catch (e) { /* gagal membangunkan bukan bencana: ada cron pengaman 6 jam */ }
}

async function kirimPush(env, osid, isiPesan, alamat) {
  if (!env.ONESIGNAL_KEY || !osid) return;
  const muatan = {
    app_id: APP_ID,
    include_subscription_ids: [osid],
    headings: { en: "Komentarmu dibalas" },
    contents: { en: isiPesan },
    url: alamat,
  };
  for (const skema of ["Key", "Basic"]) {
    try {
      const r = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `${skema} ${env.ONESIGNAL_KEY}`,
        },
        body: JSON.stringify(muatan),
      });
      const h = await r.json();
      if (h && h.id) return;                 // terkirim
    } catch (e) { /* coba skema berikutnya */ }
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const asalReq = req.headers.get("Origin") || "";
    const asal = ASAL_SAH.includes(asalReq) ? asalReq : ASAL_SAH[0];

    if (req.method === "OPTIONS") {
      // 204 DILARANG membawa badan — Response(JSON, {status:204}) melempar
      // galat di runtime Workers, preflight gagal, dan browser membacanya
      // sebagai "jaringan bermasalah" (kejadian, Agu 2026: GET jalan,
      // POST mati semua).
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": asal,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ── publik: daftar komentar (osid disembunyikan) ──────────────────
    if (req.method === "GET" && url.pathname === "/ambil") {
      const slug = url.searchParams.get("slug") || "";
      if (!slugSah(slug)) return jawab({ komentar: [] }, 200, asal);
      const isi = await env.KOMENTAR.get("k:" + slug, "json");
      return jawab({ komentar: publik(isi) }, 200, asal);
    }

    // ── publik: kirim komentar ────────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/kirim") {
      let b;
      try { b = await req.json(); } catch { return jawab({ ok: false, pesan: "Format salah." }, 400, asal); }
      if (b.situs) return jawab({ ok: true, id: idBaru() }, 200, asal);   // bot honeypot

      const slug = (b.slug || "").trim();
      const nama = (b.nama || "").trim().slice(0, MAKS_NAMA) || "Pembaca";
      const teks = (b.teks || "").trim();
      const osid = /^[0-9a-f-]{10,64}$/i.test(b.osid || "") ? b.osid : "";
      // benih avatar: 8 hex penentu pola & warna avatar (identitas tanpa
      // akun — menempel di browser pengomentar). Tidak sah -> diturunkan
      // dari id supaya semua komentar tetap punya avatar.
      const benih = /^[0-9a-f]{8}$/i.test(b.benih || "") ? b.benih.toLowerCase() : "";

      if (!slugSah(slug)) return jawab({ ok: false, pesan: "Artikel tidak dikenal." }, 400, asal);
      if (teks.length < 3) return jawab({ ok: false, pesan: "Tulis dulu pertanyaannya." }, 400, asal);
      if (teks.length > MAKS_TEKS) return jawab({ ok: false, pesan: `Maksimal ${MAKS_TEKS} huruf.` }, 400, asal);
      if (adaKataTerlarang(teks) || adaKataTerlarang(nama)) {
        return jawab({ ok: false, pesan: "Komentarnya ditahan: ada kata yang tidak pantas. Tulis ulang dengan bahasa yang sopan ya." }, 400, asal);
      }
      if (adaTautan(teks) || adaTautan(nama)) {
        return jawab({ ok: false, pesan: "Komentar tidak boleh berisi tautan." }, 400, asal);
      }

      const ip = req.headers.get("CF-Connecting-IP") || "?";
      // jendela per MENIT (keputusan pemilik, Agu 2026 — jatah per jam
      // membuat pengunjung yang wajar kena tahan): kuncinya bermenit,
      // TTL 120 dtk karena KV minimal 60 dan menitnya bisa sisa sedikit
      const kunciJatah = "j:" + ip + ":" + Math.floor(Date.now() / 60000);
      const dipakai = parseInt((await env.KOMENTAR.get(kunciJatah)) || "0", 10);
      if (dipakai >= JATAH_PER_MENIT) {
        return jawab({ ok: false, pesan: "Terlalu cepat. Tunggu semenit, coba lagi ya." }, 429, asal);
      }
      await env.KOMENTAR.put(kunciJatah, String(dipakai + 1), { expirationTtl: 120 });

      const kunci = "k:" + slug;
      const daftar = (await env.KOMENTAR.get(kunci, "json")) || [];
      const id = idBaru();

      // ── balasan pembaca ke komentar lain (utas) ─────────────────────
      if (b.balas_ke) {
        const induk = daftar.find(x => x.id === b.balas_ke);
        if (!induk) return jawab({ ok: false, pesan: "Komentarnya sudah tidak ada." }, 404, asal);
        const isiUtas = utas(induk);
        if (isiUtas.length >= 20) {
          return jawab({ ok: false, pesan: "Utasnya sudah penuh." }, 400, asal);
        }
        isiUtas.push({ id, nama, benih: benih || id.slice(0, 8),
                       teks, waktu: new Date().toISOString() });
        induk.balasan = isiUtas;
        await env.KOMENTAR.put(kunci, JSON.stringify(daftar));
        // pemilik komentar induk diberi tahu — kecuali membalas dirinya
        if (induk.osid && induk.osid !== osid) {
          await kirimPush(env, induk.osid,
            `${nama} membalas komentarmu. Ketuk untuk membacanya.`,
            `https://joinbib.id/artikel/${slug}#komen`);
        }
        return jawab({ ok: true, id }, 200, asal);
      }

      const kunciHapus = idBaru() + idBaru();
      const entri = { id, nama, teks, waktu: new Date().toISOString(),
                      benih: benih || id.slice(0, 8), kunci: kunciHapus,
                      balasan: null };
      if (osid) entri.osid = osid;
      daftar.unshift(entri);
      await env.KOMENTAR.put(kunci, JSON.stringify(daftar.slice(0, MAKS_PER_SLUG)));
      await bangunkanAgen(env);
      return jawab({ ok: true, id, kunci: kunciHapus }, 200, asal);
    }

    // ── publik: hapus komentar sendiri ───────────────────────────────
    // Hanya pemegang kunci (browser pengirimnya) yang bisa. Balasan BiB
    // yang menempel ikut terhapus — itu jawaban untuk komentar itu.
    if (req.method === "POST" && url.pathname === "/hapus") {
      let b;
      try { b = await req.json(); } catch { return jawab({ ok: false }, 400, asal); }
      const slug = (b.slug || "").trim();
      if (!slugSah(slug) || !b.id || !b.kunci) return jawab({ ok: false }, 400, asal);

      const ip = req.headers.get("CF-Connecting-IP") || "?";
      const kunciH = "h:" + ip;
      const dipakaiH = parseInt((await env.KOMENTAR.get(kunciH)) || "0", 10);
      if (dipakaiH >= 10) return jawab({ ok: false, pesan: "Terlalu sering." }, 429, asal);
      await env.KOMENTAR.put(kunciH, String(dipakaiH + 1), { expirationTtl: 3600 });

      const kunci = "k:" + slug;
      const daftar = (await env.KOMENTAR.get(kunci, "json")) || [];
      const k = daftar.find(x => x.id === b.id);
      if (!k) return jawab({ ok: true }, 200, asal);
      if (!k.kunci || k.kunci !== b.kunci) return jawab({ ok: false }, 403, asal);
      await env.KOMENTAR.put(kunci, JSON.stringify(daftar.filter(x => x.id !== b.id)));
      return jawab({ ok: true }, 200, asal);
    }

    // ── publik: susulkan alamat notifikasi ke komentar yang baru ──────
    // Pembaca menyalakan notifikasi SESUDAH berkomentar (pop-up ajakan
    // pasca-kirim) — osid-nya disusulkan supaya push "komentarmu dibalas"
    // tetap sampai. Dibatasi ketat: komentar harus masih muda (<1 jam),
    // belum ber-osid, belum terbalas.
    if (req.method === "POST" && url.pathname === "/tandai") {
      let b;
      try { b = await req.json(); } catch { return jawab({ ok: false }, 400, asal); }
      const slug = (b.slug || "").trim();
      const osid = /^[0-9a-f-]{10,64}$/i.test(b.osid || "") ? b.osid : "";
      if (!slugSah(slug) || !b.id || !osid) return jawab({ ok: false }, 400, asal);

      const ip = req.headers.get("CF-Connecting-IP") || "?";
      const kunciT = "t:" + ip;
      const dipakaiT = parseInt((await env.KOMENTAR.get(kunciT)) || "0", 10);
      if (dipakaiT >= 10) return jawab({ ok: false }, 429, asal);
      await env.KOMENTAR.put(kunciT, String(dipakaiT + 1), { expirationTtl: 3600 });

      const kunci = "k:" + slug;
      const daftar = (await env.KOMENTAR.get(kunci, "json")) || [];
      const k = daftar.find(x => x.id === b.id);
      if (!k || k.osid) return jawab({ ok: true }, 200, asal);
      if (Date.now() - Date.parse(k.waktu || 0) > 3600 * 1000) {
        return jawab({ ok: false }, 400, asal);
      }
      k.osid = osid;
      await env.KOMENTAR.put(kunci, JSON.stringify(daftar));
      return jawab({ ok: true }, 200, asal);
    }

    // ── admin: wajib token ────────────────────────────────────────────
    const kunciAdmin = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const adminSah = env.ADMIN_TOKEN && kunciAdmin === env.ADMIN_TOKEN;

    if (req.method === "GET" && url.pathname === "/antrean") {
      if (!adminSah) return jawab({ pesan: "?" }, 401, asal);
      const antrean = [];
      let cursor;
      do {
        const hal = await env.KOMENTAR.list({ prefix: "k:", cursor });
        for (const kk of hal.keys) {
          const slug = kk.name.slice(2);
          const isi = (await env.KOMENTAR.get(kk.name, "json")) || [];
          for (const k of isi) {
            if (!utas(k).some(x => x.bib)) antrean.push({ slug, id: k.id, nama: k.nama, teks: k.teks, waktu: k.waktu });
            if (antrean.length >= 20) break;
          }
          if (antrean.length >= 20) break;
        }
        cursor = hal.list_complete ? null : hal.cursor;
      } while (cursor && antrean.length < 20);
      return jawab({ antrean }, 200, asal);
    }

    if (req.method === "POST" && url.pathname === "/balas") {
      if (!adminSah) return jawab({ pesan: "?" }, 401, asal);
      let b;
      try { b = await req.json(); } catch { return jawab({ ok: false, pesan: "Format salah." }, 400, asal); }
      const slug = (b.slug || "").trim();
      const teks = (b.teks || "").trim().slice(0, MAKS_BALASAN);
      if (!slugSah(slug) || !b.id || teks.length < 3) {
        return jawab({ ok: false, pesan: "slug/id/teks kurang." }, 400, asal);
      }
      // balasan resmi pun tetap lewat saringan yang sama — tidak ada
      // pintu belakang untuk kata kasar, dari siapa pun datangnya
      if (adaKataTerlarang(teks)) return jawab({ ok: false, pesan: "balasan mengandung kata terlarang" }, 400, asal);

      const kunci = "k:" + slug;
      const daftar = (await env.KOMENTAR.get(kunci, "json")) || [];
      const k = daftar.find(x => x.id === b.id);
      if (!k) return jawab({ ok: false, pesan: "komentar tidak ditemukan" }, 404, asal);
      const isiUtas = utas(k);
      if (isiUtas.some(x => x.bib)) return jawab({ ok: true, pesan: "sudah terbalas" }, 200, asal);

      isiUtas.push({ id: idBaru(), bib: true, teks,
                     waktu: new Date().toISOString() });
      k.balasan = isiUtas;
      // osid DIPERTAHANKAN: utas bisa terus hidup (pembaca lain membalas)
      // dan tiap balasan baru tetap perlu diberitahukan ke pemiliknya
      await env.KOMENTAR.put(kunci, JSON.stringify(daftar));

      const alamat = `https://joinbib.id/artikel/${slug}#komen`;
      await kirimPush(env, k.osid || "",
        `BiB menjawab pertanyaanmu di "${b.judul || slug}". Ketuk untuk membacanya.`,
        alamat);
      return jawab({ ok: true }, 200, asal);
    }

    return jawab({ pesan: "?" }, 404, asal);
  },
};
