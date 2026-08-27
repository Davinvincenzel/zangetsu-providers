# Seanime Extension Repository & Providers

Repositori ekstensi **Seanime** (`onlinestream-provider`) yang dikonversi dari repositori Zangetsu Providers. Menyediakan sumber streaming anime subtitle Indonesia, Inggris, dan Donghua.

---

## 📋 Daftar Provider yang Tersedia

| ID | Nama Provider | Bahasa | Tipe | Sumber Asli |
|---|---|---|---|---|
| `otakudesu` | **Otakudesu** | Indonesia (`id`) | `onlinestream-provider` | `https://otakudesu.blog` |
| `samehadaku` | **Samehadaku** | Indonesia (`id`) | `onlinestream-provider` | `https://v2.samehadaku.how` |
| `ylnime` | **YLnime** | Indonesia (`id`) | `onlinestream-provider` | `https://ylnime.com` |
| `hianime` | **HiAnime** | Inggris (`en`) | `onlinestream-provider` | `https://hianimes.se` |
| `animekai` | **AnimeKai** | Inggris (`en`) | `onlinestream-provider` | `https://anikai.cc` |
| `allanime` | **AllAnime** | Inggris (`en`) | `onlinestream-provider` | `https://allanime.to` |
| `anikoto` | **AniKoto** | Inggris (`en`) | `onlinestream-provider` | `https://anikoto.cz` |
| `animecube` | **AnimeCube** | Donghua / Chinese (`zh`) | `onlinestream-provider` | `https://animecube.live` |

> [!NOTE]
> Provider film/movie Barat/Bollywood (seperti `4K HDHub`, `UHD Movies`, `HDHub4u`, `VegaMovies`, `MultiMovies`) **tidak disertakan** di sini karena Seanime secara spesifik adalah pemutar anime yang terhubung ke basis data AniList / MyAnimeList.

---

## 🚀 Cara Memasang di Seanime

### Opsi 1: Menggunakan Marketplace (Rekomendasi)
Agar seluruh provider ini muncul otomatis di katalog Marketplace Seanime:
1. Buka aplikasi **Seanime**.
2. Masuk ke menu **Extensions → Marketplace**.
3. Klik tombol **Change repository** (atau edit URL marketplace).
4. Masukkan URL berikut:
   ```text
   https://raw.githubusercontent.com/Davinvincenzel/zangetsu-providers/main/seanime/marketplace.json
   ```
5. Klik **Save / Refresh**. Sekarang seluruh daftar ekstensi akan muncul di katalog dan Anda cukup klik **Install** pada provider yang diinginkan.

---

### Opsi 2: Memasang Ekstensi Secara Manual (Add Extension)
Jika Anda hanya ingin memasang salah satu provider tertentu tanpa mengubah repository marketplace:
1. Buka **Seanime** → Tab **Extensions**.
2. Klik tombol **Add extension** (atau *Install from URL*).
3. Salin dan tempel raw URL salah satu `manifest.json` berikut:

* **Otakudesu (Sub Indo):**
  ```text
  https://raw.githubusercontent.com/Davinvincenzel/zangetsu-providers/main/seanime/providers/otakudesu/manifest.json
  ```
* **Samehadaku (Sub Indo):**
  ```text
  https://raw.githubusercontent.com/Davinvincenzel/zangetsu-providers/main/seanime/providers/samehadaku/manifest.json
  ```
* **YLnime (Sub Indo):**
  ```text
  https://raw.githubusercontent.com/Davinvincenzel/zangetsu-providers/main/seanime/providers/ylnime/manifest.json
  ```
* **HiAnime (Sub & Dub English):**
  ```text
  https://raw.githubusercontent.com/Davinvincenzel/zangetsu-providers/main/seanime/providers/hianime/manifest.json
  ```
* **AnimeKai (Sub & Dub English):**
  ```text
  https://raw.githubusercontent.com/Davinvincenzel/zangetsu-providers/main/seanime/providers/animekai/manifest.json
  ```
* **AllAnime (Sub & Dub English):**
  ```text
  https://raw.githubusercontent.com/Davinvincenzel/zangetsu-providers/main/seanime/providers/allanime/manifest.json
  ```
* **AniKoto (Sub & Dub English):**
  ```text
  https://raw.githubusercontent.com/Davinvincenzel/zangetsu-providers/main/seanime/providers/anikoto/manifest.json
  ```
* **AnimeCube (Donghua):**
  ```text
  https://raw.githubusercontent.com/Davinvincenzel/zangetsu-providers/main/seanime/providers/animecube/manifest.json
  ```

---

## 📦 Ingin Menjadikan Repositori GitHub Terpisah?

Jika Anda ingin membuat repositori GitHub khusus bernama `seanime-providers`:
1. Buat repositori baru di GitHub dengan nama `seanime-providers`.
2. Salin isi folder `seanime/` ke repositori baru tersebut:
   - File `marketplace.json` di root
   - Folder `providers/` di root
3. Di dalam `marketplace.json` dan setiap `manifest.json`, ganti URL:
   `https://raw.githubusercontent.com/Davinvincenzel/zangetsu-providers/main/seanime/`
   menjadi:
   `https://raw.githubusercontent.com/Davinvincenzel/seanime-providers/main/`
4. Commit dan push ke GitHub.
