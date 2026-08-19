/*
  Worker komentar artikel joinbib.id — pengganti bagian FAQ (keputusan
  pemilik, Agu 2026): pembaca menulis pertanyaan/komentar di bawah artikel.

  BUKAN bagian situs statis GitHub Pages; deploy terpisah ke Cloudflare
  (gratis). Butuh satu KV namespace dengan binding bernama KOMENTAR
  (cara lengkap di README.md folder ini).

  Endpoint:
    GET  /ambil?slug=<slug>   -> {komentar: [{nama, teks, waktu}, ...]}
    POST /kirim               -> {ok: true} | {ok: false, pesan: "..."}
         body JSON: {slug, nama, teks, situs}  (situs = honeypot, wajib kosong)

  Penyaring tiga lapis, ditegakkan DI SERVER (klien bisa dibongkar):
    1. kata kasar/vulgar/hinaan — daftar + normalisasi gaya tulisan
       (4->a, 1->i, 0->o, @->a, huruf berulang dirapatkan, spasi/titik
       di sela huruf dihapus) supaya "b4b1" dan "a n j i n g" ikut kena
    2. tautan dilarang (sarang spam judi/obat)
    3. jatah 5 komentar per alamat IP per jam
*/

const ASAL_SAH = ["https://joinbib.id", "https://www.joinbib.id"];
const MAKS_TEKS = 500;
const MAKS_NAMA = 40;
const MAKS_PER_SLUG = 300;
const JATAH_PER_JAM = 5;

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
  t = t.replace(/(.)\1{2,}/g, "$1$1");       // anjiiiing -> anjiing
  return t;
}

function rapat(teks) {
  // "a n j i n g" / "a.n.j.i.n.g" -> "anjing"
  return normal(teks).replace(/[^a-z]/g, "");
}

function adaKataTerlarang(teks) {
  const halus = normal(teks);
  const padat = rapat(teks);
  for (const kata of KATA_TERLARANG) {
    const k = kata.replace(/ /g, "");
    // batas kata di teks normal, ATAU muncul utuh di teks yang dirapatkan
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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const asalReq = req.headers.get("Origin") || "";
    const asal = ASAL_SAH.includes(asalReq) ? asalReq : ASAL_SAH[0];

    if (req.method === "OPTIONS") return jawab({}, 204, asal);

    if (req.method === "GET" && url.pathname === "/ambil") {
      const slug = url.searchParams.get("slug") || "";
      if (!slugSah(slug)) return jawab({ komentar: [] }, 200, asal);
      const isi = await env.KOMENTAR.get("k:" + slug, "json");
      return jawab({ komentar: isi || [] }, 200, asal);
    }

    if (req.method === "POST" && url.pathname === "/kirim") {
      let b;
      try { b = await req.json(); } catch { return jawab({ ok: false, pesan: "Format salah." }, 400, asal); }

      // honeypot: manusia tidak pernah mengisi kolom tersembunyi ini
      if (b.situs) return jawab({ ok: true }, 200, asal);

      const slug = (b.slug || "").trim();
      const nama = (b.nama || "").trim().slice(0, MAKS_NAMA) || "Pembaca";
      const teks = (b.teks || "").trim();

      if (!slugSah(slug)) return jawab({ ok: false, pesan: "Artikel tidak dikenal." }, 400, asal);
      if (teks.length < 3) return jawab({ ok: false, pesan: "Tulis dulu pertanyaannya." }, 400, asal);
      if (teks.length > MAKS_TEKS) return jawab({ ok: false, pesan: `Maksimal ${MAKS_TEKS} huruf.` }, 400, asal);

      const kotor = adaKataTerlarang(teks) || adaKataTerlarang(nama);
      if (kotor) {
        return jawab({ ok: false, pesan: "Komentarnya ditahan: ada kata yang tidak pantas. Tulis ulang dengan bahasa yang sopan ya." }, 400, asal);
      }
      if (adaTautan(teks) || adaTautan(nama)) {
        return jawab({ ok: false, pesan: "Komentar tidak boleh berisi tautan." }, 400, asal);
      }

      // jatah per IP per jam
      const ip = req.headers.get("CF-Connecting-IP") || "?";
      const kunciJatah = "j:" + ip;
      const dipakai = parseInt((await env.KOMENTAR.get(kunciJatah)) || "0", 10);
      if (dipakai >= JATAH_PER_JAM) {
        return jawab({ ok: false, pesan: "Terlalu sering. Coba lagi sejam lagi." }, 429, asal);
      }
      await env.KOMENTAR.put(kunciJatah, String(dipakai + 1), { expirationTtl: 3600 });

      const kunci = "k:" + slug;
      const daftar = (await env.KOMENTAR.get(kunci, "json")) || [];
      daftar.unshift({ nama, teks, waktu: new Date().toISOString() });
      await env.KOMENTAR.put(kunci, JSON.stringify(daftar.slice(0, MAKS_PER_SLUG)));
      return jawab({ ok: true }, 200, asal);
    }

    return jawab({ pesan: "?" }, 404, asal);
  },
};
