# Pinterest Downloader — Cloudflare Worker

Backend serverless (gratis) yang bikin Pinterest Video Downloader di
`joinbib.id/pinterest-downloader` jadi andal. Worker mengambil halaman
Pinterest di sisi server (bebas batasan CORS) lalu mengekstrak URL
video-nya, plus menyediakan endpoint download yang memaksa "save as".

Deploy sekali, gratis untuk pemakaian wajar (Cloudflare free plan:
100.000 request/hari).

---

## Cara Deploy — Pilih SALAH SATU

### Cara A — Lewat Dashboard Cloudflare (paling gampang, tanpa install apa pun)

1. Buat akun gratis di **https://dash.cloudflare.com** (kalau belum punya).
2. Menu kiri: **Workers & Pages** → **Create** → **Create Worker**.
3. Beri nama, misal `pinterest-downloader`, klik **Deploy**.
4. Klik **Edit code**. Hapus semua kode contoh, lalu **copy-paste seluruh
   isi file `worker.js`** dari folder ini. Klik **Deploy** lagi.
5. Salin URL Worker-nya, bentuknya seperti:
   `https://pinterest-downloader.NAMAKAMU.workers.dev`
6. Lanjut ke bagian **"Sambungkan ke situs"** di bawah.

### Cara B — Lewat CLI (wrangler)

```bash
# 1. Install wrangler (butuh Node.js)
npm install -g wrangler

# 2. Login ke Cloudflare
wrangler login

# 3. Dari dalam folder ini, deploy
cd workers/pinterest
wrangler deploy
```

Setelah selesai, wrangler menampilkan URL Worker
(`https://pinterest-downloader.NAMAKAMU.workers.dev`).

---

## Sambungkan ke situs

1. Buka file **`/pinterest-downloader/index.html`**.
2. Cari baris:

   ```js
   var WORKER = "https://pinterest-downloader.GANTI-INI.workers.dev";
   ```

3. Ganti dengan URL Worker kamu (tanpa garis miring di akhir).
4. Commit & push ke `main`.

Selesai. Frontend otomatis memakai Worker sebagai jalur utama. Kalau
Worker belum diisi / sedang bermasalah, situs otomatis jatuh ke proxy
publik (best-effort) supaya tidak mati total.

---

## Uji cepat

Buka di browser (ganti URL Worker + link pin):

```
https://pinterest-downloader.NAMAKAMU.workers.dev/resolve?url=https://pin.it/xxxxx
```

Kalau berhasil, muncul JSON `{"ok":true,"video":"https://...mp4", ...}`.

## Endpoint

- `GET /resolve?url=<link pin>` → `{ ok, video, title, thumbnail }`
- `GET /download?url=<mp4>&name=<nama>` → streaming video (paksa unduh;
  dibatasi hanya untuk CDN Pinterest agar bukan open proxy)
