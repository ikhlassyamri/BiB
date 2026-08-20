# Worker Komentar Artikel

Menyimpan & menyaring komentar pembaca di bawah artikel joinbib.id
(pengganti bagian FAQ, keputusan pemilik Agu 2026). **BUKAN** bagian situs
statis — deploy terpisah ke Cloudflare, gratis.

## Balasan AI agent (keputusan pemilik, Agu 2026)

Agen BiB membalas komentar (workflow "Balas komentar" di repo agen, otak
11). Worker yang membangunkannya lewat `workflow_dispatch` begitu ada
komentar baru (direm 4 menit), plus cron 6 jam sebagai jaring pengaman.
Pengomentar yang berlangganan notifikasi diberi push "Komentarmu dibalas"
(alamat langganannya disimpan sekali pakai, dihapus setelah terkirim).

## Secret worker (Settings → Variables and Secrets, jenis Secret)

| Nama | Isi |
|---|---|
| `ADMIN_TOKEN` | kunci pintu /antrean & /balas; nilainya SAMA dengan secret `KOMENTAR_ADMIN_TOKEN` di repo agen |
| `ONESIGNAL_KEY` | REST API Key OneSignal (yang sama dengan secret di repo BiB) |
| `GH_TOKEN` | fine-grained PAT GitHub, akses repo agen saja, izin Actions: Read and write |

Tanpa `GH_TOKEN` balasan tetap jalan lewat cron 6 jam; tanpa
`ONESIGNAL_KEY` balasan tetap tersimpan, hanya push-nya yang tidak ada.

**Repo agen pindah ke organisasi `BiB-Agent-Artikel` (Agu 2026)** — jatah
menit Actions akun pribadi habis. Konstanta `REPO_AGEN` di `worker.js`
sudah menunjuk ke sana, tapi `GH_TOKEN`-nya harus PAT yang dibuat dengan
**Resource owner = organisasi itu**, bukan akun pribadi. Token lama yang
cuma sejangkauan akun pribadi gagal DIAM-DIAM: `bangunkanAgen` menelan
galatnya, pembaca tetap melihat komentarnya tersimpan, run "Balas komentar"
cuma tidak pernah muncul sampai cron 6 jam. Ketukannya ada di langkah
terakhir workflow "Deploy worker komentar" (repo agen).

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
