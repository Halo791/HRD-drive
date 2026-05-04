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

Set environment variable berikut ke MinIO yang bisa dijangkau publik:

- `MINIO_ENDPOINT_URL`
- `MINIO_BUCKET`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`

Jika aplikasi akan dibuka publik, aktifkan juga:

- `APP_USERNAME`
- `APP_PASSWORD`

Lalu deploy aplikasi ini ke VPS, Render, Railway, Fly.io, atau platform lain yang bisa menjalankan Node.js.

## Catatan penting

- Aplikasi ini hanya UI dan API untuk MinIO. MinIO sendiri tetap harus berjalan di server atau cloud yang bisa diakses dari aplikasi ini.
- Kalau bucket ingin benar-benar publik, bisa juga pakai policy publik di MinIO, tetapi cara yang lebih aman adalah tetap lewat aplikasi ini dengan basic auth.
