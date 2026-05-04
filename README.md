# MinIO Storage App

Aplikasi web sederhana untuk menyimpan file ke MinIO dan mengaksesnya lewat browser.

## Fitur

- Upload banyak file sekaligus
- Daftar file dalam bucket MinIO
- Download file lewat aplikasi
- Hapus file dari bucket
- Opsional basic auth untuk dipakai online

## Menjalankan lokal

1. Copy `.env.example` ke `.env`
2. Jalankan `npm install`
3. Jalankan `npm start`

## Menjalankan dengan Docker

```bash
docker compose up --build
```

## Deploy online

Repo ini sudah disiapkan untuk Netlify. Untuk menjalankannya di `hrd-drive.netlify.app`:

1. Hubungkan repo GitHub ini ke Netlify
2. Set build settings:
   - Build command: kosongkan atau biarkan default
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
3. Isi environment variable berikut di Netlify:

- `APP_NAME` = `HRD Drive` atau nama yang kamu mau
- `MINIO_ENDPOINT_URL` = URL publik MinIO, misalnya `https://minio.domainkamu.com`
- `MINIO_BUCKET` = nama bucket, misalnya `storage`
- `MINIO_ACCESS_KEY` = access key MinIO
- `MINIO_SECRET_KEY` = secret key MinIO
- `MAX_UPLOAD_SIZE_BYTES` = opsional, misalnya `52428800`

Jika aplikasi akan dibuka publik, aktifkan juga:

- `APP_USERNAME` = username login dashboard
- `APP_PASSWORD` = password login dashboard

4. Deploy site-nya, lalu atur nama site menjadi `hrd-drive` jika masih tersedia.

Catatan:

- Halaman root `/` sekarang menjadi halaman login.
- Halaman kerja upload dan daftar file ada di `/upload.html`.
- `MINIO_ENDPOINT_URL` harus mengarah ke MinIO yang bisa dijangkau dari browser, karena download memakai presigned URL dari MinIO.
- Kalau kamu ingin MinIO tetap privat sepenuhnya, kita perlu ubah download flow supaya lewat proxy function, bukan redirect langsung.
- Untuk lokal, pakai [.env.example](/Users/macbookpro/Documents/minio/.env.example). Untuk Netlify, pakai [.env.netlify.example](/Users/macbookpro/Documents/minio/.env.netlify.example) sebagai acuan.

## Catatan penting

- Aplikasi ini hanya UI dan API untuk MinIO. MinIO sendiri tetap harus berjalan di server atau cloud yang bisa diakses dari aplikasi ini.
- Kalau bucket ingin benar-benar publik, bisa juga pakai policy publik di MinIO, tetapi cara yang lebih aman adalah tetap lewat aplikasi ini dengan basic auth.
