# Worker Komentar Artikel

Menyimpan & menyaring komentar pembaca di bawah artikel joinbib.id
(pengganti bagian FAQ, keputusan pemilik Agu 2026). **BUKAN** bagian situs
statis — deploy terpisah ke Cloudflare, gratis.

## Deploy (sekali saja, ±5 menit)

1. `npm i -g wrangler` lalu `wrangler login` (akun Cloudflare yang sama
   dengan worker pinterest).
2. Buat penyimpanannya:
   `wrangler kv namespace create KOMENTAR`
   Salin `id` yang muncul ke `wrangler.toml` (ganti `GANTI-INI`).
3. `wrangler deploy` dari folder ini.
4. Alamatnya harus `https://komentar-artikel.ikhlassyamribusiness.workers.dev`
   (nama worker `komentar-artikel` + subdomain akun). Kalau beda, samakan
   dengan konstanta `WORKER` di templat artikel repo agen
   (`templat/berita.html` & `templat/edukasi.html`) dan artikel terbit.

## Yang dijaga worker

- **Kata kasar/vulgar/hinaan ditolak** — daftar `KATA_TERLARANG` +
  normalisasi gaya tulisan (b4b1, a n j i n g, huruf berulang).
  Menambah kata = satu entri di daftar itu.
- Tautan ditolak (sarang spam), jatah 5 komentar per IP per jam,
  honeypot untuk bot, maksimal 500 huruf.
- Komentar tersimpan per artikel (maksimal 300, yang terbaru di atas).

## Menghapus komentar (manual)

Dasbor Cloudflare → Workers & Pages → KV → KOMENTAR → kunci `k:<slug>`.
Isinya JSON array; hapus barisnya lalu simpan.
