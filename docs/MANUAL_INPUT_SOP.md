# SOP Pengisian Data Manual

Dokumen ini menjadi SOP ringkas untuk semua form yang butuh input manual di aplikasi.

Tujuan SOP:
- menjaga konsistensi data
- memudahkan verifikasi oleh atasan
- mengurangi input yang tertolak atau perlu revisi

## Aturan Umum Semua Form

Sebelum submit:
- pastikan login menggunakan akun sendiri
- pastikan role dan cabang sudah benar
- cek tanggal dan shift sebelum input
- isi angka tanpa perkiraan berlebihan
- lampirkan foto bila diwajibkan
- gunakan catatan singkat, spesifik, dan bisa diverifikasi

Sesudah submit:
- cek status berhasil tersimpan
- bila ada mode koreksi, hanya ubah data yang memang keliru
- jangan menghapus bukti sebelum approval selesai

## 1. SOP Ceklis Harian

Role utama:
- `staff`
- `barista`
- `kitchen`
- `waitress`
- `asst_head_store`
- `head_store`

Menu:
- `/staff/ceklis`

Langkah:
1. Pilih shift: `pagi`, `middle`, atau `malam`.
2. Isi semua toggle sesuai kondisi toko aktual.
3. Upload foto pada item yang mewajibkan foto.
4. Isi item out of stock bila ada.
5. Tambahkan catatan bila ada kondisi khusus.
6. Submit ceklis.

Catatan penting:
- deadline indikatif di halaman:
  - pagi: `08.00 WIB`
  - middle: `14.00 WIB`
  - malam: `03.00 WIB`
- gunakan mode koreksi hanya bila memang ada kesalahan input
- foto harus jelas dan sesuai area yang dimaksud

## 2. SOP Preparation Harian

Role utama:
- role store

Menu:
- `/staff/preparation`

Langkah:
1. Pilih shift.
2. Isi jumlah preparation per item.
3. Upload foto preparation.
4. Tambahkan catatan shift bila perlu.
5. Submit atau simpan koreksi.

Catatan penting:
- angka harus mencerminkan stok prep aktual
- gunakan foto yang menunjukkan hasil preparation, bukan foto lama

## 3. SOP Laporan Harian

Role utama:
- `head_store`

Menu:
- `/staff/laporan`

Data yang diisi:
- net sales
- jumlah staff
- jumlah kunjungan
- catatan harian

Langkah:
1. Buka form laporan harian untuk tanggal yang ditentukan sistem.
2. Isi `Net Sales` sesuai data POS.
3. Isi jumlah staff yang bertugas.
4. Isi jumlah kunjungan aktual.
5. Tambahkan catatan bila ada kejadian penting.
6. Submit laporan.

Catatan penting:
- halaman menampilkan deadline laporan `14.00 WIB`
- gunakan edit hanya untuk koreksi data yang benar-benar keliru

## 4. SOP Setoran Cash

Role utama:
- `head_store`

Menu:
- `/staff/laporan` bagian `Form Setoran Cash`

Data yang diisi:
- nominal cash POS
- nominal cash disetorkan
- alasan selisih bila ada
- foto bukti setoran

Langkah:
1. Isi nominal `cash_pos`.
2. Isi nominal `cash_disetorkan`.
3. Bila ada selisih, isi alasan dengan singkat dan jelas.
4. Upload foto slip atau struk setoran.
5. Submit setoran ke approval DM.

Aturan penting:
- foto bukti wajib
- alasan selisih wajib bila selisih tidak nol
- bila status `rejected`, revisi sesuai alasan penolakan lalu submit ulang

## 5. SOP Approval Setoran

Role utama:
- `district_manager`
- `area_manager` untuk district tanpa DM di area
- `ops_manager` / support sesuai akses monitoring

Menu:
- `/dm/approval`

Langkah:
1. Buka tab `Pending`.
2. Pilih satu kartu setoran.
3. Cek nominal POS, nominal setor, selisih, dan bukti foto.
4. Approve bila lengkap dan valid.
5. Reject bila ada masalah, dengan alasan yang jelas.

Aturan penting:
- alasan reject wajib
- gunakan alasan yang bisa langsung ditindaklanjuti Head Store

## 6. SOP OPEX / Beban Operasional

Role utama:
- store-level
- terutama `head_store`

Menu:
- `/staff/opex`

Data yang diisi:
- kode item
- tanggal
- qty
- harga satuan
- detail
- foto nota / struk

Langkah:
1. Cari dan pilih kode item yang paling tepat.
2. Isi tanggal transaksi.
3. Isi qty dan harga satuan.
4. Isi detail tambahan bila diperlukan.
5. Upload foto nota / struk.
6. Submit pengeluaran.

Aturan penting:
- jangan submit tanpa memilih kode item
- foto nota wajib
- gunakan detail untuk menjelaskan pembelian yang tidak cukup jelas dari nama item

## 7. SOP KPI Personal Store-Level

Target yang dinilai:
- `barista`
- `kitchen`
- `waitress`
- `asst_head_store`

Evaluator:
- `head_store`

Menu evaluator:
- `/kpi/personal/input`

Langkah evaluator:
1. Pilih periode.
2. Pilih nama staff.
3. Isi seluruh item manual.
4. Periksa item otomatis seperti checklist, preparation, dan 360.
5. Tambahkan catatan bila perlu.
6. Simpan KPI.

Aturan penting:
- KPI store-level diverifikasi oleh `district_manager`
- KPI yang sudah diverifikasi tidak boleh diubah lagi

## 8. SOP KPI Personal Manager-Level

### A. KPI `head_store`

Evaluator:
- `district_manager`
- `support_spv`

Verifier:
- `area_manager`

Menu:
- `/kpi/personal/input`
- `/kpi/personal`

Langkah evaluator:
1. Buka `Input KPI Personal`.
2. Pilih periode.
3. Pilih `Head Store` dalam scope kerja.
4. Isi seluruh item KPI.
5. Simpan.

Langkah verifier:
1. Buka `KPI Personal`.
2. Pilih `Head Store`.
3. Pastikan semua evaluator wajib sudah mengisi.
4. Review skor gabungan dan catatan evaluator.
5. Klik verifikasi.

### B. KPI `district_manager`

Evaluator normal:
- `area_manager`
- `support_spv`

Evaluator fallback untuk area tanpa AM:
- `ops_manager`
- `support_spv`

Verifier:
- `ops_manager`

Langkah evaluator dan verifier:
- sama seperti alur `head_store`, tetapi targetnya `district_manager`

Aturan penting:
- verifikasi hanya dilakukan setelah semua role evaluator wajib selesai mengisi

## 9. SOP KPI 360

Role yang terlibat:
- role store tertentu
- `head_store`
- `district_manager`
- `area_manager`

Menu:
- `/kpi/360`

Langkah:
1. Pilih periode.
2. Pilih rekan kerja yang akan dinilai.
3. Isi seluruh item.
4. Tambahkan catatan bila diperlukan.
5. Kirim penilaian.

Aturan penting:
- penilaian bersifat anonim terhadap yang dinilai
- tidak boleh menilai diri sendiri

## 10. SOP OJE Individual

Role utama:
- `trainer`
- `ops_manager`
- `support_spv`
- `support_admin`
- `head_store`
- `district_manager`
- `area_manager` sesuai akses halaman

Menu:
- `/trainer/oje`

Langkah:
1. Buka tab `OJE Individual`.
2. Isi data kandidat.
3. Isi seluruh skor kriteria.
4. Isi catatan observasi.
5. Simpan.

Aturan penting:
- semua skor wajib terisi sebelum simpan
- observer dan catatan harus membantu pembacaan hasil evaluasi

## 11. SOP OJE Batch

Role utama:
- `trainer` dan role terkait yang punya akses OJE

Menu:
- `/trainer/oje`

Langkah:
1. Buka tab `Batch Scorecard`.
2. Isi data sesi.
3. Tambahkan peserta.
4. Isi skor tiap peserta.
5. Simpan batch.

Aturan penting:
- pastikan jumlah peserta benar sebelum submit
- gunakan batch untuk sesi penilaian massal, bukan evaluasi individu mendalam

## 12. SOP Daily Visit / Audit

Role utama:
- `district_manager`
- `area_manager`
- `ops_manager` sesuai akses

Menu:
- `/dm/visit`

Langkah:
1. Pilih toko.
2. Isi skor audit per section.
3. Upload foto temuan.
4. Isi temuan dan rekomendasi.
5. Submit audit.

Aturan penting:
- audit tidak boleh disimpan tanpa bukti foto yang relevan
- catatan rekomendasi harus bisa ditindaklanjuti Head Store

## 13. SOP Tugas

Role utama:
- `ops_manager` untuk membuat tugas
- role lain sesuai assignment untuk mengeksekusi

Menu:
- `/tasks`

Langkah pembuat tugas:
1. Isi judul dan detail tugas.
2. Pilih penerima.
3. Simpan tugas.

Langkah penerima:
1. Buka daftar tugas.
2. Kerjakan.
3. Tandai selesai bila pekerjaan sudah tuntas.

## Checklist Review SOP

Perbarui dokumen ini jika ada perubahan pada:
- field form
- validasi form
- deadline
- role pengisi
- role approver / verifier
- bukti foto atau lampiran wajib
