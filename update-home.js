const fs = require('fs');
let c = fs.readFileSync('src/pages/staff/Home.jsx', 'utf8');

c = c.replace(/const \[ceklisPagi, ceklisMiddle, ceklisMalam, laporan/g, 'const [ceklisOpening, ceklisMiddle, ceklisMalam, ceklisClosing, laporan');

c = c.replace(
  /\.eq\('shift', 'pagi'\)/g,
  `.eq('shift', 'opening')`
);

c = c.replace(
  /supabase\.from\('daily_checklists'\)\s*\.select\('id, is_late'\)\s*\.eq\('branch_id', branchId\)\.eq\('tanggal', today\)\.eq\('shift', 'malam'\)\s*\.maybeSingle\(\),/,
  `supabase.from('daily_checklists').select('id, is_late').eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'malam').maybeSingle(),
      supabase.from('daily_checklists').select('id, is_late').eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'closing').maybeSingle(),`
);

c = c.replace(
  /setStatus\(\{[\s\S]*?ceklisPagi: ceklisPagi\.data,[\s\S]*?ceklisMiddle: ceklisMiddle\.data,[\s\S]*?ceklisMalam: ceklisMalam\.data,[\s\S]*?laporan: laporan\.data,/m,
  `setStatus({
      ceklisOpening: ceklisOpening.data,
      ceklisMiddle: ceklisMiddle.data,
      ceklisMalam: ceklisMalam.data,
      ceklisClosing: ceklisClosing.data,
      laporan: laporan.data,`
);

c = c.replace(
  /const ceklisDone = \[status\?\.ceklisPagi, status\?\.ceklisMiddle, status\?\.ceklisMalam\]\.filter\(Boolean\)\.length/,
  `const ceklisDone = [status?.ceklisOpening, status?.ceklisMiddle, status?.ceklisMalam, status?.ceklisClosing].filter(Boolean).length`
);

c = c.replace(
  /const ceklisPct = Math\.round\(\(ceklisDone \/ 3\) \* 100\)/,
  `const ceklisPct = Math.round((ceklisDone / 4) * 100)`
);

c = c.replace(
  /<div className="grid grid-cols-3 gap-2 mb-4">\s*<StatusItem\s*icon="spark"\s*label="Pagi"\s*done=\{!!status\?\.ceklisPagi\}\s*loading=\{loading\}\s*statusLabel=\{status\?\.ceklisPagi \? \(status\.ceklisPagi\.is_late \? 'Terlambat' : 'Selesai'\) : 'Belum'\}\s*to="\/staff\/ceklis"\s*\/>\s*<StatusItem\s*icon="checklist"\s*label="Middle"\s*done=\{!!status\?\.ceklisMiddle\}\s*loading=\{loading\}\s*statusLabel=\{status\?\.ceklisMiddle \? \(status\.ceklisMiddle\.is_late \? 'Terlambat' : 'Selesai'\) : 'Belum'\}\s*to="\/staff\/ceklis"\s*\/>\s*<StatusItem\s*icon="checklist"\s*label="Malam"\s*done=\{!!status\?\.ceklisMalam\}\s*loading=\{loading\}\s*statusLabel=\{status\?\.ceklisMalam \? 'Selesai' : 'Belum'\}\s*to="\/staff\/ceklis"\s*\/>\s*<\/div>/,
  `<div className="grid grid-cols-4 gap-2 mb-4">
              <StatusItem icon="spark" label="Opening" done={!!status?.ceklisOpening} loading={loading} statusLabel={status?.ceklisOpening ? (status.ceklisOpening.is_late ? 'Terlambat' : 'Selesai') : 'Belum'} to="/staff/ceklis" />
              <StatusItem icon="checklist" label="Middle" done={!!status?.ceklisMiddle} loading={loading} statusLabel={status?.ceklisMiddle ? (status.ceklisMiddle.is_late ? 'Terlambat' : 'Selesai') : 'Belum'} to="/staff/ceklis" />
              <StatusItem icon="checklist" label="Malam" done={!!status?.ceklisMalam} loading={loading} statusLabel={status?.ceklisMalam ? 'Selesai' : 'Belum'} to="/staff/ceklis" />
              <StatusItem icon="moon" label="Closing" done={!!status?.ceklisClosing} loading={loading} statusLabel={status?.ceklisClosing ? (status.ceklisClosing.is_late ? 'Terlambat' : 'Selesai') : 'Belum'} to="/staff/ceklis" />
            </div>`
);

c = c.replace(
  /\{loading \? '\.\.\.' : \`\$\{ceklisDone\} dari 3 ceklis\`\}/g,
  `{loading ? '...' : \`\${ceklisDone} dari 4 ceklis\`}`
);

c = c.replace(
  /\`Ceklis: \$\{status\?\.ceklisPagi \? 'Pagi ✓' : 'Pagi -'\} \$\{status\?\.ceklisMiddle \? '· Middle ✓' : '· Middle -'\} \$\{status\?\.ceklisMalam \? '· Malam ✓' : '· Malam -'\} · Laporan: \$\{status\?\.laporan \? '✓' : 'Pending'\}\`\}/,
  `\`Ceklis: \${status?.ceklisOpening ? 'Opn ✓' : 'Opn -'} \${status?.ceklisMiddle ? '· Mid ✓' : '· Mid -'} \${status?.ceklisMalam ? '· Mal ✓' : '· Mal -'} \${status?.ceklisClosing ? '· Cls ✓' : '· Cls -'} · Laporan: \${status?.laporan ? '✓' : 'Pending'}\`}`
);

fs.writeFileSync('src/pages/staff/Home.jsx', c);
console.log("Updated Home.jsx");
