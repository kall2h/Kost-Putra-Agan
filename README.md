# Portal Admin Kost Putra Agan

Aplikasi web manajemen properti kos untuk mengelola kamar, penghuni, tagihan bulanan, kwitansi PDF QR, pengingat WhatsApp, laporan keuangan Excel/CSV terformat rapi, serta pendaftaran calon penghuni online.

## Teknologi Utama

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **Database & Autentikasi:** Firebase Firestore & Google Authentication
- **Ekspor Laporan & Dokumen:** ExcelJS (`.xlsx` dengan auto-width, warna label, merge & center, border otomatis), CSV terstruktur, jsPDF + QRCode (kwitansi digital)

---

## 1. Menjalankan di VS Code (Pengembangan Lokal)

### Prasyarat
- **Node.js** versi `20+` (disarankan LTS)
- **Git** & **Visual Studio Code**
- Saat membuka folder proyek di VS Code, instal ekstensi yang direkomendasikan dari notifikasi pojok kanan bawah (`ESLint`, `Tailwind CSS IntelliSense`, `Prettier`, `Path Intellisense`).

### Langkah Menjalankan
1. Salin repositori ke komputer lokal:
   ```bash
   git clone <url-repositori-github-anda>
   cd <nama-folder-proyek>
   ```
2. Pasang seluruh dependensi:
   ```bash
   npm install
   ```
3. Siapkan file environment lokal:
   ```bash
   cp .env.example .env
   ```
   *(Di Windows PowerShell gunakan `Copy-Item .env.example .env`)*.
   - Jika tetap menggunakan backend Firebase bawaan proyek, isi default sudah siap pakai.
   - Jika ingin mengarah ke Firebase Project baru (misalnya akun milik pemilik kos), isi variabel `VITE_FIREBASE_*` dan `VITE_PRIMARY_OWNER_EMAIL` di `.env`.
4. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
5. Buka browser ke `http://localhost:3000`.

### Perintah Penting Lainnya
- `npm run typecheck` atau `npm run lint` — memeriksa keamanan tipe TypeScript (`tsc --noEmit`).
- `npm run lint:rules` — memvalidasi syntax & keamanan aturan `firestore.rules`.
- `npm run build` — menghasilkan bundle produksi siap deploy di folder `dist/`.
- `npm run preview` — mencoba hasil build produksi secara lokal.

---

## 2. Alur Kerja Tim di GitHub

1. **Jangan pernah commit file `.env`** — file `.gitignore` sudah dikonfigurasi untuk melindungi `.env`, `node_modules/`, dan `dist/`, sambil tetap menyimpan `.env.example`, `.vscode/settings.json`, dan `.vscode/extensions.json` agar pengaturan tim seragam.
2. Buat branch fitur baru setiap kali anggota tim mengerjakan perubahan:
   ```bash
   git checkout -b fitur/nama-fitur
   ```
3. Sebelum push atau membuat Pull Request, pastikan selalu lolos cek:
   ```bash
   npm run typecheck && npm run build
   ```
4. Lakukan Pull Request ke branch `main` agar bisa ditinjau tim sebelum tayang otomatis di layanan hosting.

---

## 3. Panduan Serah Terima ("Lepas Website ke Pemilik Kos")

Aplikasi ini dirancang dengan arsitektur **serverless** (Frontend statis + Firebase Managed Cloud), sehingga **tidak memerlukan perawatan server 24 jam** oleh tim developer setelah diserahterimakan.

### Opsi A: Serah Terima Cepat (Memakai Database Cloud Saat Ini + Hosting Permanen)
Cocok jika pemilik kos ingin langsung memakai aplikasi secara mandiri dan tim developer melepas aksesnya:

1. **Tambahkan Pemilik sebagai `Pemilik (Owner)` di Aplikasi:**
   - Buka menu **Pengaturan -> Tim Pengelola & Akses Admin**.
   - Masukkan **Email Google milik pemilik kos** dan **Nama Lengkap**, pilih peran **Pemilik (Owner)**, lalu klik **Undang**.
   - Minta pemilik kos membuka URL aplikasi dan **Login dengan Google** menggunakan email tersebut.
   - Pastikan akun pemilik sudah tampil di daftar **Admin Terdaftar** dengan badge **Pemilik**. (Bila sebelumnya sempat terundang sebagai Staff, klik tombol **Set Pemilik** di baris akunnya).
2. **Deploy Frontend Permanen ke Akun Hosting Pemilik (Gratis):**
   - Hubungkan repositori GitHub ini ke **Vercel**, **Netlify**, atau **Firebase Hosting** menggunakan akun milik pemilik kos.
   - Pengaturan build:
     - Build Command: `npm run build`
     - Output Directory: `dist`
   - Tambahkan variabel environment dari `.env.example` di dashboard hosting (minimal `VITE_PRIMARY_OWNER_EMAIL` diisi email pemilik kos).
3. **Daftarkan Domain Hosting di Firebase Authentication:**
   - Buka **Firebase Console -> Authentication -> Settings -> Authorized domains**.
   - Klik **Add domain** dan masukkan domain hosting baru (misalnya `kostputraagan.vercel.app` atau domain `.com` pribadi) agar tombol **Login dengan Google** berfungsi di domain tersebut.
4. **Lepas Akses Developer:**
   - Hapus akun Google anggota tim developer dari daftar **Admin Terdaftar** di menu **Pengaturan**.
   - *(Opsional untuk pemisahan penuh)* Perbarui email owner bootstrap di `firestore.rules` (ganti email developer lama ke email pemilik kos) lalu jalankan `firebase deploy --only firestore:rules`.

### Opsi B: Pindah Penuh 100% ke Akun Firebase Milik Pemilik Kos
Cocok jika pemilik kos menginginkan tagihan, kepemilikan proyek cloud, dan kontrol akun Google sepenuhnya di bawah akun pribadinya sendiri:

1. Buat proyek baru di [Firebase Console](https://console.firebase.google.com) menggunakan akun Google milik pemilik kos.
2. Aktifkan **Authentication -> Sign-in method -> Google**.
3. Buat database **Cloud Firestore** (pilih lokasi terdekat, misalnya `asia-southeast2` Jakarta atau `asia-southeast1` Singapore).
4. Perbarui email `OWNER_EMAIL` di dalam `firestore.rules` menjadi email Google pemilik kos, lalu deploy aturan keamanan:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules
   ```
5. Daftarkan aplikasi Web di **Project Settings -> Your apps** pada Firebase Console, lalu salin konfigurasi (`apiKey`, `authDomain`, `projectId`, dll.) ke `.env` atau Environment Variables di Vercel/Netlify milik pemilik:
   - `VITE_PRIMARY_OWNER_EMAIL`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_DATABASE_ID` *(kosongkan jika menggunakan database `(default)`)*
6. Tambahkan domain Vercel/Netlify/custom domain ke **Authentication -> Settings -> Authorized domains**.
7. Saat pemilik login pertama kali, database tipe kamar, pengaturan awal, dan profil **Pemilik Utama** akan langsung aktif otomatis dan siap dipakai seterusnya tanpa keterlibatan developer.
