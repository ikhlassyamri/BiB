# BiB (joinbib.id) — Panduan untuk Claude

Situs statis GitHub Pages (branch `main` = live di joinbib.id). Semua halaman HTML satu file, tanpa build step.

## DNA Brand BiB
- Jujur & anti-hype: tidak ada janji kaya instan; "Skip coba-cobanya, pelajari polanya."
- Sistem > bakat: materi step-by-step, produk siap jual, mentor seumur hidup.
- Visual: dark (#0B0C0E), aksen neon #76B900, font Space Grotesk + Inter, motif kotak kecil sebelum heading.
- Sub-brand **IkhlasClip** (folder `/clipper/`): branding clipper, produk utama E-Book Ngeclip Cuan (`/clipper/ngeclip-cuan`), checkout via Lynk.id.

## 🗺️ Peta Folder (struktur & fungsi)
> Peta wilayah repo, bukan inventaris file. **Aturan: tiap bikin folder baru → catat 1 baris di sini** (path + fungsi + aturan singkat). Update kalau fungsi folder berubah.

- **`/` (root)** — landing utama (`index.html`) + aset bersama (OG image `og-*.jpg`, thumbnail `thumb-*.webp`, video `lv_*.mp4`, gambar kelas/testi, `logo-white.png`, `favicon.png`, `notif-icon-192.png` — ikon push OneSignal). Juga berisi **file redirect** artikel lama (mis. `bebas-judol.html` → `/artikel/bebas-judol`) — jangan dihapus, itu penjaga link lama yang sudah tersebar. File `*-PREVIEW.html` = draft, **bukan** versi live. Juga landing produk e-book **Bangkit dari Titik Nol** (`titiknol.html` = joinbib.id/titiknol, aksen emas kisah sukses, checkout Lynk.id; aset `titiknol-cover.jpg` + `og-titiknol.jpg`). Juga landing produk **Trilogi Kecerdasan Buatan** (`trilogi-ai.html` = joinbib.id/trilogi-ai, aksen cyan `#22D3EE` seperti seri Ilmu AI; aset `trilogi-ai-cover.jpg` 1:1 tiga sampul, `og-trilogi-ai.jpg`, dan `trilogi-ai-b1..b3.jpg`). **Harga halaman itu berganti SENDIRI**: satu konstanta `AKHIR_PO` di `<head>` menentukan modenya. Sebelum tenggat = pre-order Rp149.000 (coret Rp250.000) dengan tombol ke WhatsApp; sesudah tenggat = Rp250.000 (coret Rp350.000) dengan tombol ke Lynk.id. Saklarnya memasang kelas `po`/`ls` di elemen `<html>` sebelum halaman dilukis, jadi tidak ada kedipan harga salah, dan hitung mundurnya ikut berpindah sendiri tanpa muat ulang. **Memperpanjang masa pre-order = mengubah satu baris `AKHIR_PO` itu saja**, jangan menyunting harganya satu per satu.
- **`/artikel/`** — **rumah semua artikel umum** + halaman katalog (`index.html` = joinbib.id/artikel). Artikel baru non-clipper ditaruh di sini (`/artikel/<slug>.html`, URL extensionless).
  - **Katalog otomatis:** daftar artikel diatur lewat array `ARTIKEL` di dalam `artikel/index.html` (ada blok komentar "TAMBAH ARTIKEL BARU DI SINI"). Tiap artikel punya `niche` (topik: AI/Clipper/Keuangan/Bisnis — boleh >1) + `jenis` (Panduan/Tutorial/Edukasi/Rekomendasi). **Tombol filter dibuat otomatis dari data**, jadi topik/jenis baru langsung muncul sendiri tanpa ngoding.
  - **Wajib tiap nambah artikel:** (1) taruh file di `/artikel/`, (2) tambah 1 objek ke array `ARTIKEL`, (3) tambah link ke `<noscript>` di file yang sama, (4) update `sitemap.xml`.
  - _Artikel clipper TIDAK dipindah_ — tetap di `/clipper/`, tapi ikut tampil di katalog ini.
  - **Warna:** halaman ini sengaja **monokrom (aksen putih, var `--ac`)**, bukan hijau neon — supaya jadi wadah netral: warna tiap sub-brand (hijau IkhlasClip, dst) yang menonjol lewat thumbnail, dan tidak bentrok kalau nanti ada sub-brand warna baru.
  - **Notifikasi:** 2 kartu langganan. (1) Saluran WhatsApp — selalu aktif. (2) Push browser via OneSignal — baru muncul setelah `ONESIGNAL_APP_ID` di `artikel/index.html` diisi; selama masih `GANTI-INI` kartunya sengaja disembunyikan. Service worker-nya `/OneSignalSDKWorker.js` di root (jangan dipindah).
- **`/.github/workflows/`** — otomatisasi GitHub Actions. `notifikasi-artikel-baru.yml`: tiap ada file HTML **baru** masuk `/artikel/` dan ke-push ke `main`, judul + ringkasan + canonical-nya dibaca lalu dikirim jadi push OneSignal otomatis. Mengedit artikel lama tidak memicu apa pun. Tulis `[tanpa-notif]` di pesan commit untuk melewati. Butuh secret repo `ONESIGNAL_REST_API_KEY` (REST API Key OneSignal — **rahasia**, jangan pernah ditulis di kode).
- **`/.github/workflows/periksa-notifikasi.yml`** — alat DIAGNOSA notifikasi (jalankan manual dari tab Actions). GET saja ke OneSignal, tidak pernah POST, jadi tidak menghasilkan notifikasi ke siapa pun — kecuali kolom `osid` diisi, yang mengirim SATU notifikasi uji ke satu langganan itu saja. Dibuat Agu 2026 karena log pengirim mencetak "TERKIRIM" berbekal `id` dari OneSignal, padahal `id` cuma bukti kirimannya DIBUAT. Yang menjawab "sampai atau tidak" ada di sisi OneSignal: `players`, `messageable_players`, `successful` tiap kiriman, dan `invalid_identifier` tiap langganan. **Temuan pertamanya:** push artikel SEHAT (84-90 perangkat menerima tiap kiriman), tapi **80 dari 165 langganan alamat push-nya MATI** (`invalid_identifier`) — perangkat yang ada di golongan itu tidak menerima apa pun sampai ia BERLANGGANAN ULANG, dan tidak ada kode di sisi kita yang bisa memperbaikinya. Catatan jebakan: versi API yang menjawab `/players` tidak lagi mengisi `notification_types` (semuanya `None`) — jangan dibaca sebagai "nol pelanggan".

- **`/clipper/`** — sub-brand **IkhlasClip**. Landing (`index.html`), produk utama `ngeclip-cuan` (checkout Lynk.id), + panduan/artikel clipper (cara-jadi-clipper, platform-clipper-indonesia, platform-clipper-luar-negeri, clipaffiliates, clipping-net). Aset khusus: logo platform, screenshot tutorial (`ca-*`, `cn-*`), OG image `og-*.jpg`.
- **`/digital/`** — halaman bio **joinbib.id/digital** (`index.html`) + landing produk digital: `sutradara-digital` dan `10template`. Aset: video demo (`Dekstop*.mp4`, `Mobile*.mp4`), screenshot `belajar-website-*.png`, logo.
- **`/digital/10template/`** — pendukung produk 10template: halaman `purchase.html` + asetnya.
- **`/pinterest-downloader/`** — tool Pinterest Video Downloader (`index.html`) + asetnya. Frontend memanggil Cloudflare Worker sebagai jalur utama, fallback ke proxy publik.
- **`/workers/komentar/`** — backend komentar artikel (Cloudflare Worker + KV, `worker.js`). Pengganti bagian FAQ (keputusan pemilik, Agu 2026): pembaca menulis pertanyaan di bawah artikel; kata kasar/vulgar/hinaan, tautan, dan spam DISARING DI SINI (daftar `KATA_TERLARANG` + normalisasi), bukan di halaman. **BUKAN** bagian situs statis; deploy manual — lihat `README.md` foldernya. Alamatnya dikunci di skrip artikel: `komentar-artikel.ikhlassyamribusiness.workers.dev`.
- **`/workers/pinterest/`** — backend serverless (Cloudflare Worker, `worker.js`) untuk pinterest-downloader. **BUKAN** bagian situs statis GitHub Pages; deploy terpisah ke Cloudflare (gratis). Endpoint: `GET /resolve`, `GET /download`. Detail lengkap di `README.md` folder itu.

## Ciri khas WAJIB setiap artikel baru
1. **OG image custom** (1200x630 JPG) — didesain sendiri sesuai isi artikel, di-commit ke repo, dipasang di `og:image` + `twitter:image` dengan URL absolut. Preview harus muncul saat link dishare ke WA.
2. **Pop-up promosi BiB** — muncul ±20% scroll, bisa ditutup. Copy boleh kreatif/random asal ber-DNA BiB (lihat atas).
3. **Karakter scroll interaktif** — WAJIB kreasi orisinal per artikel (JANGAN copy karakter artikel lain). Bebas bentuk (UFO, robot, kendaraan, dll) dengan syarat:
   - Tidak mengganggu pembaca (kecil, `pointer-events:none`, area atas halaman).
   - Aktivitas karakter RELEVAN dengan isi artikel, berubah mengikuti progres scroll.
   - Warna bebas (tidak harus hijau neon) asal jelas terlihat.
   - Boleh ada latar belakang (mis. bintang) asal tidak menghalangi teks.
4. **Update `sitemap.xml`** setiap tambah halaman.
5. Kartu kontak: Instagram @ikhlassyamri, WhatsApp wa.me/62895411449962, Saluran WA channel/0029VbD3xRK6LwHdluqg330X.

## Catatan teknis
- Viewport meta pakai `maximum-scale=1.0, user-scalable=no` (halaman terkunci pas layar HP).
- URL tanpa `.html` (GitHub Pages extensionless).
- Deploy = merge ke `main`; build Pages ±1-5 menit.
