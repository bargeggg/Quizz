# Kuis Transition Words & Connectors

Kuis interaktif 13 soal pilihan ganda untuk presentasi (dibagikan lewat Zoom).
Presenter: Elsa, Sofia, Irfan, Ahmad. Materi: lihat `quiz.txt`.

## Fitur
- Satu soal per layar, kata penghubung disorot stabilo kuning, pembahasan muncul setelah menjawab.
- Navigasi soal dikelompokkan per presenter, status benar/salah/kunci dibuka terlihat langsung.
- Jawaban tersimpan di browser (tidak hilang saat refresh); tombol "Mulai ulang" untuk sesi baru.
- Halaman hasil: skor, rekap per presenter, tabel per soal, salin ringkasan ke chat, cetak.
- Keyboard: `A`-`D` pilih jawaban, `←` `→` pindah soal.
- Mode terang/gelap otomatis, responsif di HP, tanpa library eksternal (hanya font Google, ada fallback).

## Struktur
```
index.html        Halaman kuis (aplikasi utama)
questions.json    Bank soal: tambah/ubah soal di sini
assets/audio.js   Efek suara (Web Audio, tanpa file MP3)
admin.html, assets/realtime.js, assets/style.css, firebase-config.js
                  LEGACY: dashboard realtime versi lama (essay/Q&A/NIP). Tidak dipakai index.html.
```

### Format soal (`questions.json` -> `pg`)
`id`, `presenter` ("Nama (#n)"), `category`, `q` (teks soal, boleh kosong), `instruction`,
`options` (tanpa awalan "A."), `correct` ("A"-"D"), `explanation`, `hl` (daftar frasa yang disorot).
Gunakan `_____` di `q` untuk soal isian; blank otomatis terisi jawaban benar setelah dijawab.

## Menjalankan
Buka lewat server (file `questions.json` dimuat dengan fetch):
`python -m http.server` lalu buka http://localhost:8000

## Deploy ke GitHub Pages
Settings > Pages > Deploy from a branch > `main` / root. Alamat: `https://bargeggg.github.io/Quizz/`
