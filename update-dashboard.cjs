const fs = require('fs');

function updateDashboard() {
  let c = fs.readFileSync('src/pages/dm/Dashboard.jsx', 'utf8');

  // Change 'pagi' to 'opening' and add 'closing' references
  c = c.replace(/ceklisPagi: checklistsByBranch\[branch\.id\]\?\.pagi \|\| null,/g,
    `ceklisOpening: checklistsByBranch[branch.id]?.opening || null,`);

  c = c.replace(/ceklisMiddle: checklistsByBranch\[branch\.id\]\?\.middle \|\| null,\s*ceklisMalam: checklistsByBranch\[branch\.id\]\?\.malam \|\| null,/g,
    `ceklisMiddle: checklistsByBranch[branch.id]?.middle || null,
        ceklisMalam: checklistsByBranch[branch.id]?.malam || null,
        ceklisClosing: checklistsByBranch[branch.id]?.closing || null,`);

  c = c.replace(/ceklisOK: enrichedStores\.filter\(\(store\) => store\.ceklisPagi\)\.length,/g,
    `ceklisOK: enrichedStores.filter((store) => store.ceklisOpening).length,`);

  c = c.replace(/if \(!store\.ceklisPagi\) return \{ tone: 'danger', label: 'Ceklis pagi belum masuk' \}/g,
    `if (!store.ceklisOpening) return { tone: 'danger', label: 'Ceklis opening belum masuk' }`);

  c = c.replace(/const belumPagi = stores\.filter\(\(s\) => !s\.ceklisPagi\)\.map\(sName\)\s*const belumMiddle = stores\.filter\(\(s\) => !s\.ceklisMiddle\)\.map\(sName\)\s*const belumMalam = stores\.filter\(\(s\) => !s\.ceklisMalam\)\.map\(sName\)/g,
    `const belumOpening = stores.filter((s) => !s.ceklisOpening).map(sName)
  const belumMiddle = stores.filter((s) => !s.ceklisMiddle).map(sName)
  const belumMalam = stores.filter((s) => !s.ceklisMalam).map(sName)
  const belumClosing = stores.filter((s) => !s.ceklisClosing).map(sName)`);

  c = c.replace(/const terlambatPagi = stores\.filter\(\(s\) => s\.ceklisPagi\?\.is_late\)\.map\(sName\)\s*const terlambatMiddle = stores\.filter\(\(s\) => s\.ceklisMiddle\?\.is_late\)\.map\(sName\)/g,
    `const terlambatOpening = stores.filter((s) => s.ceklisOpening?.is_late).map(sName)
  const terlambatMiddle = stores.filter((s) => s.ceklisMiddle?.is_late).map(sName)`);

  c = c.replace(/if \(!store\.ceklisPagi\) \{/g, `if (!store.ceklisOpening) {`);

  c = c.replace(/\{ label: 'Pagi', ok: !!store\.ceklisPagi, late: store\.ceklisPagi\?\.is_late \},/g,
    `{ label: 'Opening', ok: !!store.ceklisOpening, late: store.ceklisOpening?.is_late },`);

  c = c.replace(/\{ label: 'Middle', ok: !!store\.ceklisMiddle, late: store\.ceklisMiddle\?\.is_late \},\s*\{ label: 'Malam', ok: !!store\.ceklisMalam, late: false \},/g,
    `{ label: 'Middle', ok: !!store.ceklisMiddle, late: store.ceklisMiddle?.is_late },
              { label: 'Malam', ok: !!store.ceklisMalam, late: false },
              { label: 'Closing', ok: !!store.ceklisClosing, late: store.ceklisClosing?.is_late },`);

  c = c.replace(/\{store\.ceklisPagi && <ChecklistPreview checklist=\{store\.ceklisPagi\} \/>\}/g,
    `{store.ceklisOpening && <ChecklistPreview checklist={store.ceklisOpening} />}`);

  c = c.replace(/\{store\.ceklisMiddle && <ChecklistPreview checklist=\{store\.ceklisMiddle\} \/>\}\s*\{store\.ceklisMalam && <ChecklistPreview checklist=\{store\.ceklisMalam\} \/>\}/g,
    `{store.ceklisMiddle && <ChecklistPreview checklist={store.ceklisMiddle} />}
          {store.ceklisMalam && <ChecklistPreview checklist={store.ceklisMalam} />}
          {store.ceklisClosing && <ChecklistPreview checklist={store.ceklisClosing} />}`);

  c = c.replace(/<ToneBadge tone=\{store\.ceklisPagi \? 'ok' : 'danger'\}>\{store\.ceklisPagi \? 'Ceklis Pagi ✓' : 'Ceklis Pagi –'\}<\/ToneBadge>/g,
    `<ToneBadge tone={store.ceklisOpening ? 'ok' : 'danger'}>{store.ceklisOpening ? 'Ceklis Opening ✓' : 'Ceklis Opening –'}</ToneBadge>`);

  c = c.replace(/\{ label: 'Ceklis Pagi', value: loading \? '-' : \`\$\{summary\.ceklisOK\}\/\$\{summary\.total\}\`, sub: loading \? '' : summary\.ceklisOK === summary\.total \? 'Semua aman' : \`\$\{summary\.total - summary\.ceklisOK\} belum\`, ok: !loading && summary\.ceklisOK === summary\.total \}/g,
    `{ label: 'Ceklis Opening', value: loading ? '-' : \`\${summary.ceklisOK}/\${summary.total}\`, sub: loading ? '' : summary.ceklisOK === summary.total ? 'Semua aman' : \`\${summary.total - summary.ceklisOK} belum\`, ok: !loading && summary.ceklisOK === summary.total }`);

  fs.writeFileSync('src/pages/dm/Dashboard.jsx', c);
  console.log("Updated Dashboard.jsx");
}

updateDashboard();
