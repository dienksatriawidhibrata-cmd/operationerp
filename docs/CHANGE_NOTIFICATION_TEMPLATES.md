# Draft Pemberitahuan Perubahan

Dokumen ini berisi template pemberitahuan untuk user yang terdampak perubahan aplikasi.

Tujuan:
- memastikan setiap perubahan penting punya komunikasi yang jelas
- memudahkan admin/support melakukan broadcast
- menyediakan versi singkat untuk in-app announcement dan versi panjang untuk WA/email/grup

## Aturan Pakai

Sebelum mengirim pemberitahuan:
- tentukan perubahan apa yang dirilis
- tentukan role yang terdampak
- tentukan kapan perubahan mulai berlaku
- tentukan apakah user perlu melakukan aksi tertentu

## Kanal yang Disarankan

| Kanal | Cocok untuk |
|---|---|
| Tabel `announcements` | Pengumuman ke role store yang membuka dashboard staff |
| Grup WhatsApp / Telegram | Manager, support, trainer, dan perubahan mendesak |
| Briefing shift / briefing area | Perubahan operasional yang wajib segera dipahami |
| SOP / dokumen internal | Perubahan prosedur yang perlu referensi tetap |

## Template Umum Rilis Perubahan

### Versi singkat

Judul:
`Update aplikasi operasional`

Isi:
`Aplikasi telah diperbarui. Mohon cek menu dan alur kerja yang berhubungan dengan tugas Anda. Jika menemukan kendala login, akses, atau input data, segera hubungi support/ops.`

### Versi panjang

`Halo tim,`

`Kami baru saja melakukan update pada aplikasi operasional Bagi Kopi Ops. Beberapa menu, alur input, dan proses approval dapat berubah sesuai role masing-masing. Mohon pastikan Anda mengecek fitur yang berkaitan dengan tugas harian Anda.`

`Jika ada kendala akses, data tidak muncul, atau menu belum sesuai role, segera laporkan ke tim support/ops agar bisa ditindaklanjuti.`

## Template Khusus: Perubahan KPI Manager-Level

### Target role
- `head_store`
- `district_manager`
- `area_manager`
- `ops_manager`
- `support_spv`

### Pesan singkat

Judul:
`Update KPI Personal Manager`

Isi:
`Modul KPI personal untuk level manager sudah diperbarui. Head Store sekarang dinilai oleh District Manager dan Support Supervisor, lalu diverifikasi Area Manager. District Manager dinilai oleh Area Manager dan Support Supervisor, atau oleh Ops Manager dan Support Supervisor bila area belum memiliki Area Manager.`

### Pesan panjang

`Halo tim retail dan support,`

`Mulai periode berjalan, modul KPI personal untuk role manager sudah diperbarui.`

`Perubahan utama:`
- `Head Store` dinilai oleh `District Manager` dan `Support Supervisor`, lalu diverifikasi oleh `Area Manager`.
- `District Manager` dinilai oleh `Area Manager` dan `Support Supervisor`.
- Untuk distrik yang belum memiliki `Area Manager`, penilaian `District Manager` dilakukan oleh `Ops Manager` dan `Support Supervisor`, lalu diverifikasi oleh `Ops Manager`.

`Mohon masing-masing role memastikan menu Input KPI Personal dan halaman KPI Personal sudah dipahami dan digunakan sesuai scope masing-masing.`

## Template Khusus: Perubahan SOP Input Manual

### Target role
- store-level
- head store
- manager
- trainer

### Pesan singkat

Judul:
`Update SOP input data manual`

Isi:
`Panduan baru untuk input OPEX, setoran, KPI, OJE, dan form manual lainnya sudah disiapkan. Gunakan SOP terbaru agar data yang masuk konsisten dan mudah diverifikasi.`

### Pesan panjang

`Halo tim,`

`Untuk menjaga kualitas data operasional, SOP pengisian form manual sudah dirapikan dan disesuaikan dengan alur aplikasi terbaru.`

`Mohon gunakan SOP terbaru untuk pengisian:`
- OPEX
- Laporan harian
- Setoran
- KPI personal
- KPI 360
- OJE
- form manual lain yang terkait operasional

`Bila ada field yang membingungkan atau dirasa belum sesuai praktik di lapangan, catat kendalanya dan sampaikan ke support/ops agar SOP bisa diperbarui.`

## Template Per Role

### Untuk `head_store`

`Halo Head Store, menu Input KPI Team dan alur KPI personal sudah diperbarui. Tetap gunakan menu ini untuk menilai barista, kitchen, waitress, dan asst. head store. Selain itu, KPI untuk posisi Head Store sekarang juga akan dinilai oleh District Manager dan Support Supervisor.`

### Untuk `district_manager`

`Halo District Manager, menu Input KPI sudah aktif untuk penilaian Head Store di area tanggung jawab Anda. Mohon lakukan input KPI sesuai periode yang ditetapkan dan lanjutkan approval setoran serta monitoring toko seperti biasa.`

### Untuk `area_manager`

`Halo Area Manager, Anda sekarang memiliki peran tambahan untuk input KPI District Manager dan verifikasi KPI Head Store. Mohon cek menu KPI Personal agar proses penilaian berjalan lengkap dan tidak tertunda.`

### Untuk `ops_manager`

`Halo Ops Manager, modul KPI manager-level sudah aktif. Anda berperan sebagai evaluator District Manager pada area yang belum memiliki Area Manager, serta sebagai verifier KPI District Manager.`

### Untuk `support_spv`

`Halo Support Supervisor, Anda sekarang menjadi evaluator tambahan untuk KPI Head Store dan District Manager. Mohon gunakan menu Input KPI Personal sesuai periode penilaian.`

### Untuk `trainer`

`Halo Trainer, panduan pengisian OJE, penilaian staff baru, dan staff lama sudah diperbarui. Mohon gunakan SOP terbaru agar hasil penilaian konsisten dan mudah direkap.`

## Template In-App Announcement SQL

Catatan:
- `announcements` saat ini paling relevan untuk dashboard staff/store.
- Untuk manager/support/trainer, tetap disarankan kirim via grup resmi karena mereka tidak mengandalkan kartu pengumuman staff home.

Contoh SQL:

```sql
insert into announcements (title, body, target_roles, is_active)
values (
  'Update KPI Personal Manager',
  'Modul KPI personal untuk Head Store dan District Manager sudah diperbarui. Mohon cek menu KPI sesuai role masing-masing dan gunakan alur penilaian terbaru.',
  array['head_store','district_manager','area_manager','ops_manager','support_spv'],
  true
);
```

## Checklist Setelah Rilis

- umumkan perubahan di kanal yang sesuai
- pastikan role terdampak tahu aksi yang harus dilakukan
- cek apakah menu baru muncul sesuai role
- cek apakah data bisa disimpan tanpa error
- kumpulkan feedback 1-3 hari setelah rilis
