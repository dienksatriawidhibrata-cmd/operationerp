/**
 * Master expense codes (from NEW CODE sheet — simplified version)
 * Format: { code, name, category }
 */
export const EXPENSE_CODES = [
  // Beban Biaya Admin
  { code: 'BBA-101', name: 'Admin',               category: 'Beban Biaya Admin' },
  { code: 'BBA-102', name: 'Pajak Bunga',         category: 'Beban Biaya Admin' },
  { code: 'BBA-103', name: 'Bunga Bank',           category: 'Beban Biaya Admin' },
  // Beban General Opening
  { code: 'BGO-101', name: 'Tumpeng',              category: 'Beban General Opening' },
  { code: 'BGO-102', name: 'Nasi Box',             category: 'Beban General Opening' },
  { code: 'BGO-103', name: 'Ustad',                category: 'Beban General Opening' },
  { code: 'BGO-104', name: 'Pengajian',            category: 'Beban General Opening' },
  { code: 'BGO-105', name: 'Santunan',             category: 'Beban General Opening' },
  // Beban Listrik dan Air
  { code: 'BLA-101', name: 'Listrik – Token',      category: 'Beban Listrik dan Air' },
  { code: 'BLA-102', name: 'PDAM',                 category: 'Beban Listrik dan Air' },
  // Beban Maintenance Bangunan
  { code: 'BMB-101', name: 'Jasa Maintenance',     category: 'Beban Maintenance Bangunan' },
  { code: 'BMB-102', name: 'Material Maintenance', category: 'Beban Maintenance Bangunan' },
  // Beban Maintenance Peralatan
  { code: 'BMP-101', name: 'Maintenance Peralatan',category: 'Beban Maintenance Peralatan' },
  // Beban Operasional Harian
  { code: 'BOH-101', name: 'Es Batu',                        category: 'Beban Operasional Harian' },
  { code: 'BOH-102', name: 'Gas 5Kg – Isi Ulang',            category: 'Beban Operasional Harian' },
  { code: 'BOH-103', name: 'Gas 12Kg – Isi Ulang',           category: 'Beban Operasional Harian' },
  { code: 'BOH-104', name: 'Galon – Isi Ulang',              category: 'Beban Operasional Harian' },
  { code: 'BOH-105', name: 'Iuran Sampah',                   category: 'Beban Operasional Harian' },
  { code: 'BOH-106', name: 'Iuran Kebersihan / Tukang',      category: 'Beban Operasional Harian' },
  { code: 'BOH-107', name: 'Pewangi Ruangan',                category: 'Beban Operasional Harian' },
  { code: 'BOH-108', name: 'Cairan atau Bubuk Pembersih',    category: 'Beban Operasional Harian' },
  { code: 'BOH-109', name: 'Konsumsi General Cleaning',      category: 'Beban Operasional Harian' },
  { code: 'BOH-110', name: 'P3K',                            category: 'Beban Operasional Harian' },
  { code: 'BOH-111', name: 'ATK',                            category: 'Beban Operasional Harian' },
  { code: 'BOH-112', name: 'Print Materi',                   category: 'Beban Operasional Harian' },
  { code: 'BOH-113', name: 'Biaya Parkir',                   category: 'Beban Operasional Harian' },
  { code: 'BOH-114', name: 'Laundry',                        category: 'Beban Operasional Harian' },
  { code: 'BOH-115', name: 'Refill Kertas Lem Lalat',        category: 'Beban Operasional Harian' },
  { code: 'BOH-116', name: 'Gaji OB',                        category: 'Beban Operasional Harian' },
  { code: 'BOH-117', name: 'Plastik Klip',                   category: 'Beban Operasional Harian' },
  { code: 'BOH-118', name: 'Subscribe Layanan Digital',      category: 'Beban Operasional Harian' },
  // Beban Pembelian Bahan Baku
  { code: 'PBB-101', name: 'Bagi Espresso',                  category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-102', name: 'Bagi Golden',                    category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-103', name: 'Bagi Rawon',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-104', name: 'Bagi Signature',                 category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-105', name: 'Bawang Bombay',                  category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-106', name: 'Bawang Merah',                   category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-107', name: 'Bawang Putih',                   category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-108', name: 'Beans Arabica Signature',        category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-109', name: 'Biji Selasih',                   category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-110', name: 'Biji Wijen',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-111', name: 'Black Tea',                      category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-112', name: 'Bon Cabe',                       category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-113', name: 'Buah Lemon',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-114', name: 'Buah Strawberry',                category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-115', name: 'Cabai Merah Keriting',           category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-116', name: 'Cabai Rawit Hijau',              category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-117', name: 'Cabai Rawit Merah',              category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-118', name: 'Caramel Sauce',                  category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-119', name: 'Cleo Eco Green 400ML',           category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-120', name: 'Mineral Water Small',            category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-121', name: 'Mineral Water Large',            category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-122', name: 'Creamer Gold',                   category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-123', name: 'Creamer Monalisa',               category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-124', name: 'Cuka',                           category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-125', name: 'Cup PET 12Oz',                   category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-126', name: 'Cup PET 16Oz',                   category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-127', name: 'Daun Bawang',                    category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-128', name: 'Daun Jeruk',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-129', name: 'Fiber Creme',                    category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-130', name: 'Freshmilk',                      category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-131', name: 'Garam',                          category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-132', name: 'Garlic Powder',                  category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-133', name: 'Gimbori',                        category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-134', name: 'Gula Halus',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-135', name: 'Hot Cup',                        category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-136', name: 'Indomie Ayam Bawang',            category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-137', name: 'Indomie Goreng Jumbo',           category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-138', name: 'Katsuo Bushi',                   category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-139', name: 'Kecap Manis',                    category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-140', name: 'Kentang',                        category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-141', name: 'Kerupuk Udang',                  category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-142', name: 'Knorr Chicken Powder',           category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-143', name: 'Kol',                            category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-144', name: 'Kornet',                         category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-145', name: 'Lada Putih',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-146', name: 'Lid Cup PET',                    category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-147', name: 'Magic Powder',                   category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-148', name: 'Marinate Fillet Nasi Goreng',    category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-149', name: 'Marinate Fillet Paha Ayam Teriyaki', category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-150', name: 'Marinate Fillet Paha Indomie',   category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-151', name: 'Marinate Fillet Paha Ricebowl',  category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-152', name: 'Mayonnaise Kewpie',              category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-153', name: 'Mayonnaise Salad',               category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-154', name: 'Mentega',                        category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-155', name: 'Minyak Goreng',                  category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-156', name: 'MSG',                            category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-157', name: 'Nasi',                           category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-158', name: 'Oatly Barista',                  category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-159', name: 'Paper Bowl + Tutup',             category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-160', name: 'Paper Food',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-161', name: 'Parsley',                        category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-162', name: 'Plastik 10',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-163', name: 'Plastik Cup Sealer',             category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-164', name: 'Pro Chiz',                       category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-165', name: 'Rainbow Jelly',                  category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-166', name: 'Rujak Cireng',                   category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-167', name: 'Salada',                         category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-168', name: 'Sauce Barbeque',                 category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-169', name: 'Sauce Teriyaki',                 category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-170', name: 'Saus Bolognaise',                category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-171', name: 'Saus Container 25ml',            category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-172', name: 'Saus Sambal Jerigen',            category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-173', name: 'Saus Tiram',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-174', name: 'Saus Tomat',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-175', name: 'Schweppes',                      category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-176', name: 'Sedotan',                        category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-177', name: 'Selada',                         category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-178', name: 'Sendok + Garpu Plastik',         category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-179', name: 'Serai',                          category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-180', name: 'Sesame Oil',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-181', name: 'Smoked Beef',                    category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-182', name: 'Susu Kental Manis',              category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-183', name: 'Tahu Cibuntu',                   category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-184', name: 'Tahu Walik',                     category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-185', name: 'Takjil',                         category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-186', name: 'Telur',                          category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-187', name: 'Tempe',                          category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-188', name: 'Tepung Maizena',                 category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-189', name: 'Tepung Tapioka',                 category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-190', name: 'Tepung Terigu',                  category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-191', name: 'Terasi',                         category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-192', name: 'Thermal',                        category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-193', name: 'Timun',                          category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-194', name: 'Tissue',                         category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-195', name: 'Tomat',                          category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-196', name: 'Trashbag',                       category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-197', name: 'Vegetable Frozen',               category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-198', name: 'Wortel',                         category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-199', name: 'Yakult',                         category: 'Beban Pembelian Bahan Baku' },
  { code: 'PBB-200', name: 'Saus Cury Batangan',             category: 'Beban Pembelian Bahan Baku' },
  // Beban Pengiriman Barang
  { code: 'BPB-101', name: 'Pengiriman Barang – Jasa',       category: 'Beban Pengiriman Barang' },
  { code: 'BPB-102', name: 'Pengiriman Barang – Tol',        category: 'Beban Pengiriman Barang' },
  // Beban Perizinan atau Denda
  { code: 'BPD-101', name: 'Uang Keamanan',                  category: 'Beban Perizinan atau Denda' },
  // Beban Perlengkapan Toko
  { code: 'BPT-101', name: 'Perlengkapan Bar',               category: 'Beban Perlengkapan Toko' },
  { code: 'BPT-102', name: 'Perlengkapan Kitchen',           category: 'Beban Perlengkapan Toko' },
  { code: 'BPT-103', name: 'Perlengkapan Area',              category: 'Beban Perlengkapan Toko' },
  // Beban Telpon dan Internet
  { code: 'BTI-101', name: 'Pulsa HP',                       category: 'Beban Telpon dan Internet' },
  { code: 'BTI-102', name: 'Wifi',                           category: 'Beban Telpon dan Internet' },
]

export const CHECKLIST_ITEMS = [
  // ── Status Toko & Platform ──────────────────────────────────
  { key: 'toko_buka',            label: 'Toko sudah buka',            shift: ['opening'],        type: 'toggle',     requiresPhoto: false, section: 'status' },
  { key: 'gofood_aktif',         label: 'GoFood aktif',               shift: ['opening'],        type: 'toggle',     requiresPhoto: false, section: 'status' },
  { key: 'grabfood_aktif',       label: 'GrabFood aktif',             shift: ['opening'],        type: 'toggle',     requiresPhoto: false, section: 'status' },
  { key: 'shopeefood_aktif',     label: 'ShopeeFood aktif',           shift: ['opening'],        type: 'toggle',     requiresPhoto: false, section: 'status' },
  { key: 'start_pos',            label: 'Start Shift POS',            shift: ['opening'],        type: 'toggle',     requiresPhoto: false, section: 'status' },
  { key: 'toko_close',           label: 'Toko sudah Close',           shift: ['closing'],        type: 'toggle',     requiresPhoto: false, section: 'status' },
  { key: 'gofood_close',         label: 'GoFood sudah Close',         shift: ['closing'],        type: 'toggle',     requiresPhoto: false, section: 'status' },
  { key: 'grabfood_close',       label: 'GrabFood sudah Close',       shift: ['closing'],        type: 'toggle',     requiresPhoto: false, section: 'status' },
  { key: 'shopeefood_close',     label: 'ShopeeFood sudah Close',     shift: ['closing'],        type: 'toggle',     requiresPhoto: false, section: 'status' },
  { key: 'end_pos',              label: 'End Shift POS',              shift: ['closing'],        type: 'toggle',     requiresPhoto: false, section: 'status' },
  // ── Kebersihan Area ─────────────────────────────────────────
  { key: 'bar_bersih',           label: 'Area Bar',                   shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'kebersihan' },
  { key: 'kitchen_bersih',       label: 'Area Kitchen',               shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'kebersihan' },
  { key: 'indoor_ns_bersih',     label: 'Indoor Non-Smoking',         shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'kebersihan' },
  { key: 'indoor_sm_bersih',     label: 'Indoor Smoking',             shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'kebersihan' },
  { key: 'outdoor_bersih',       label: 'Area Outdoor',               shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'kebersihan' },
  { key: 'toilet_pria_bersih',   label: 'Toilet Pria',                shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'kebersihan' },
  { key: 'toilet_wanita_bersih', label: 'Toilet Wanita',              shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'kebersihan' },
  { key: 'musholla_bersih',      label: 'Musholla',                   shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'kebersihan' },
  { key: 'dc_toilet',            label: 'Daily Checklist Toilet',     shift: ['opening', 'middle'], type: 'toggle',     requiresPhoto: true,  section: 'kebersihan' },
  { key: 'dc_musholla',          label: 'Daily Checklist Musholla',   shift: ['opening', 'middle'], type: 'toggle',     requiresPhoto: true,  section: 'kebersihan' },
  { key: 'dc_area',              label: 'Daily Checklist Area',       shift: ['opening', 'middle'], type: 'toggle',     requiresPhoto: true,  section: 'kebersihan' },
  // ── Operasional & Display ───────────────────────────────────
  { key: 'staff_grooming',       label: 'Staff Grooming',             shift: ['opening'],        type: 'toggle',     requiresPhoto: true,  section: 'operasional' },
  { key: 'kalibrasi',            label: 'Kalibrasi Beans',            shift: ['opening'],        type: 'toggle',     requiresPhoto: true,  section: 'operasional' },
  { key: 'menyiram_tanaman',     label: 'Menyiram Tanaman',           shift: ['opening', 'middle'], type: 'toggle',     requiresPhoto: true,  section: 'operasional' },
  { key: 'materi_promo',         label: 'Display Promo',              shift: ['opening', 'middle'], type: 'toggle',     requiresPhoto: true,  section: 'operasional' },
  { key: 'showcase_bar',         label: 'Showcase Bar',               shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'operasional' },
  { key: 'showcase_kitchen',     label: 'Showcase Kitchen',           shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'operasional' },
  { key: 'freezer_bar',          label: 'Freezer Bar',                shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'operasional' },
  { key: 'freezer_kitchen',      label: 'Freezer Kitchen',            shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'operasional' },
  { key: 'sink',                 label: 'Sink',                       shift: ['opening', 'middle', 'malam', 'closing'], type: 'toggle',     requiresPhoto: true,  section: 'operasional' },
  { key: 'cermin_logo',          label: 'Cermin Logo',                shift: ['opening', 'middle'], type: 'toggle',     requiresPhoto: true,  section: 'operasional' },
  { key: 'neon_box',             label: 'Neon Box Menyala',           shift: ['malam'],       type: 'toggle',     requiresPhoto: true,  section: 'operasional' },
  // ── Middle Shift ────────────────────────────────────────────
  { key: 'stok_bahan_cukup',     label: 'Stok Bahan Baku Cukup',     shift: ['middle'],      type: 'toggle',     requiresPhoto: false, section: 'middle' },
  { key: 'peralatan_bersih',     label: 'Peralatan Bersih & Siap',   shift: ['middle'],      type: 'toggle',     requiresPhoto: false, section: 'middle' },
  // ── Inventory Signal ────────────────────────────────────────
  { key: 'item_oos',             label: 'Item Out of Stock',          shift: ['opening', 'middle', 'malam', 'closing'], type: 'text_array', requiresPhoto: false, section: 'oos' },
]

export const PREPARATION_ITEMS = [
  { key: 'bar_kopi_susu', label: 'Kopi Susu', section: 'Bar' },
  { key: 'bar_matcha', label: 'Matcha', section: 'Bar' },
  { key: 'bar_chocolate', label: 'Chocolate', section: 'Bar' },
  { key: 'bar_bpt', label: 'BPT', section: 'Bar' },
  { key: 'bar_rosella_tea', label: 'Rosella Tea', section: 'Bar' },
  { key: 'bar_jpt', label: 'JPT', section: 'Bar' },
  { key: 'kit_indomie', label: 'Indomie', section: 'Kitchen' },
  { key: 'kit_nasi_goreng', label: 'Nasi Goreng', section: 'Kitchen' },
  { key: 'kit_sausage_fries', label: 'Sausage & Fries', section: 'Kitchen' },
  { key: 'kit_fries_bolognaise', label: 'Fries Bolognaise', section: 'Kitchen' },
  { key: 'kit_tahu_lada_garam', label: 'Tahu Lada Garam', section: 'Kitchen' },
  { key: 'kit_tahu_walik', label: 'Tahu Walik', section: 'Kitchen' },
  { key: 'kit_cireng', label: 'Cireng', section: 'Kitchen' },
  { key: 'kit_combro', label: 'Combro', section: 'Kitchen' },
  { key: 'kit_mix_platter', label: 'Mix Platter', section: 'Kitchen' },
  { key: 'kit_garlic_oil', label: 'Garlic Oil', section: 'Kitchen' },
  { key: 'kit_bawang_goreng', label: 'Bawang Putih Goreng', section: 'Kitchen' },
  { key: 'kit_acar', label: 'Acar', section: 'Kitchen' },
  { key: 'kit_salad', label: 'Salad', section: 'Kitchen' },
  { key: 'kit_sambal_matah', label: 'Sambal Matah', section: 'Kitchen' },
  { key: 'kit_sambal_goang', label: 'Sambal Goang', section: 'Kitchen' },
  { key: 'kit_saus_nashville', label: 'Saus Nashville', section: 'Kitchen' },
]

/**
 * Audit items untuk Daily Visit — 22 items, max 110 poin
 */
export const AUDIT_ITEMS = [
  // Kebersihan (8 items × 5 = 40)
  { key: 'indoor_ns',   label: 'Indoor Non-Smoking', section: 'kebersihan', sort: 1 },
  { key: 'indoor_sm',   label: 'Indoor Smoking',     section: 'kebersihan', sort: 2 },
  { key: 'outdoor',     label: 'Outdoor',            section: 'kebersihan', sort: 3 },
  { key: 'musholla',    label: 'Musholla',           section: 'kebersihan', sort: 4 },
  { key: 'toilet_pria', label: 'Toilet Pria',        section: 'kebersihan', sort: 5 },
  { key: 'toilet_wanita',label: 'Toilet Wanita',     section: 'kebersihan', sort: 6 },
  { key: 'bar',         label: 'Bar',                section: 'kebersihan', sort: 7 },
  { key: 'kitchen',     label: 'Kitchen',            section: 'kebersihan', sort: 8 },
  // Preparation (10 items × 5 = 50)
  { key: 'prep_kopi_susu',    label: 'Prep Kopi Susu',      section: 'preparation', sort: 9 },
  { key: 'prep_matcha',       label: 'Prep Matcha',          section: 'preparation', sort: 10 },
  { key: 'prep_chocolate',    label: 'Prep Chocolate',       section: 'preparation', sort: 11 },
  { key: 'prep_minuman_lain', label: 'Prep Minuman Lain',    section: 'preparation', sort: 12 },
  { key: 'prep_nasi',         label: 'Prep Nasi',            section: 'preparation', sort: 13 },
  { key: 'prep_indomie',      label: 'Prep Indomie',         section: 'preparation', sort: 14 },
  { key: 'prep_nasgor',       label: 'Prep Nasgor',          section: 'preparation', sort: 15 },
  { key: 'prep_sambal',       label: 'Prep Sambal',          section: 'preparation', sort: 16 },
  { key: 'prep_snack',        label: 'Prep Snack',           section: 'preparation', sort: 17 },
  { key: 'prep_lainnya',      label: 'Prep Lainnya',         section: 'preparation', sort: 18 },
  // Quality & Service (3 items × 5 = 15)
  { key: 'qc_minuman', label: 'QC Minuman', section: 'quality', sort: 19 },
  { key: 'qc_makanan', label: 'QC Makanan', section: 'quality', sort: 20 },
  { key: 'grooming',   label: 'Grooming',   section: 'quality', sort: 21 },
  // Compliance (1 item × 5 = 5)
  { key: 'daily_checklist', label: 'Daily Checklist Compliance', section: 'compliance', sort: 22 },
]

export const AUDIT_MAX_SCORE = 110

// Per-branch shift config (from Shift.xlsx)
const S = (shift, hour) => ({ shift, hour: hour || null })
export const BRANCH_SHIFTS = {
  'Bagi Kopi - Bintaro':         [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Buah Batu':       [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Cawang':          [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Cilandak Barat':  [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('CLOSING','15:00 - 23:00')],
  'Bagi Kopi - Ciledug':         [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Cimahi Tengah':   [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Ciputat Jombang': [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Ciputat Juanda':  [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Citraland':       [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','14:00 - 22:00'), S('CLOSING','17:00 - 01:00')],
  'Bagi Kopi - Ciumbuleuit':     [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Jatinangor':      [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','12:00 - 20:00'), S('CLOSING','16:00 - 00:00')],
  'Bagi Kopi - Kalimalang':      [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Karawaci':        [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Kayu Putih':      [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','12:00 - 20:00'), S('MIDDLE 1 WEEKEND','11:00 - 19:00'), S('MIDDLE 2 WEEKEND','15:00 - 23:00'), S('CLOSING','16:00 - 24:00'), S('CLOSING WEEKEND','19:00 - 03:00')],
  'Bagi Kopi - Kemang Utara':    [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Kiara Artha':     [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','09:30 - 18:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Kota Wisata':     [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','09:30 - 18:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING 1','16:00 - 00:00'), S('CLOSING 2','19:00 - 03:00')],
  'Bagi Kopi - Kranggan':        [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Lebak Bulus':     [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Lenteng Agung':   [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Margonda Raya':   [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','12:00 - 20:00'), S('CLOSING','16:00 - 00:00')],
  'Bagi Kopi - Margorejo':       [S('DAY OFF'), S('OPENING','08:30 - 16:30'), S('MIDDLE 1','12:00 - 20:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','18:00 - 02:00')],
  'Bagi Kopi - Melong':          [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','09:30 - 18:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Metro':           [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','09:30 - 18:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Pamulang':        [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Pekayon':         [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Pengumben':       [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Peta':            [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Setu Cipayung':   [S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
  'Bagi Kopi - Subang':          [S('DAY OFF'), S('OPENING','08:30 - 17:00'), S('MIDDLE 1','13:00 - 21:00'), S('CLOSING','14:00 - 22:00')],
  'Bagi Kopi - Sulanjana':       [S('DAY OFF'), S('OPENING','08:00 - 16:00'), S('CLOSING','13:00 - 21:00')],
  'Bagi Kopi - Ujung Berung':    [S('DAY OFF'), S('OPENING','06:30 - 15:00'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00')],
}

export const DEFAULT_SHIFTS = [
  S('DAY OFF'), S('OPENING','06:30 - 14:30'), S('MIDDLE 1','11:00 - 19:00'), S('MIDDLE 2','15:00 - 23:00'), S('CLOSING','19:00 - 03:00'),
]

export function getBranchShifts(branchName) {
  if (!branchName) return DEFAULT_SHIFTS
  // Exact match
  if (BRANCH_SHIFTS[branchName]) return BRANCH_SHIFTS[branchName]
  // DB uses 'Bagi Kopi Melong', constants use 'Bagi Kopi - Melong'
  // Try inserting ' - ' after 'Bagi Kopi '
  const normalized = branchName.replace(/^Bagi Kopi\s+(?!-)/, 'Bagi Kopi - ')
  if (BRANCH_SHIFTS[normalized]) return BRANCH_SHIFTS[normalized]
  // Try removing ' - ' (reverse direction)
  const withoutDash = branchName.replace(/^Bagi Kopi\s+-\s+/, 'Bagi Kopi ')
  if (BRANCH_SHIFTS[withoutDash]) return BRANCH_SHIFTS[withoutDash]
  return DEFAULT_SHIFTS
}

export const AUDIT_SECTIONS = [
  { key: 'kebersihan',  label: 'Kebersihan Area', emoji: '🧹' },
  { key: 'preparation', label: 'Preparation',     emoji: '🍳' },
  { key: 'quality',     label: 'Quality & Service', emoji: '⭐' },
  { key: 'compliance',  label: 'Compliance Ceklis', emoji: '✅' },
]
