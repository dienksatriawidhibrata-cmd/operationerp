import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { AUDIT_ITEMS, AUDIT_SECTIONS, AUDIT_MAX_SCORE } from '../../lib/constants'
import { todayWIB, visitGrade } from '../../lib/utils'
import Header from '../../components/Header'
import ScoreDots from '../../components/ScoreDots'
import PhotoUpload from '../../components/PhotoUpload'
import PhotoViewer from '../../components/PhotoViewer'
import Alert from '../../components/Alert'
import { DMBottomNav } from '../../components/BottomNav'

export default function DailyVisit() {
  const { profile } = useAuth()
  const today = todayWIB()

  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [existing, setExisting] = useState(null)
  const [scores, setScores]   = useState({})
  const [photos, setPhotos]   = useState({}) // { item_key: string[] }
  const [catatan, setCatatan] = useState('')
  const [fotoKondisi, setFotoKondisi] = useState([])
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')
  const [photoErrors, setPhotoErrors] = useState({})

  useEffect(() => { fetchBranches() }, [profile?.id])

  // Use a ref to cancel in-flight fetchExisting when branch changes
  const fetchSeqRef = useRef(0)
  useEffect(() => {
    if (!selectedBranch) return
    fetchSeqRef.current += 1
    const seq = fetchSeqRef.current
    fetchExisting(false, seq)
  }, [selectedBranch])

  const fetchBranches = async () => {
    let q = supabase.from('branches').select('id,name,store_id,district,area').eq('is_active', true)
    if (profile?.role === 'district_manager') q = q.in('district', profile.managed_districts || [])
    else if (profile?.role === 'area_manager') q = q.in('area', profile.managed_areas || [])
    const { data } = await q.order('name')
    setBranches(data || [])
  }

  const fetchExisting = async (preserveDone = false, seq = null) => {
    const { data: visit, error: fetchErr } = await supabase
      .from('daily_visits')
      .select('*, visit_scores(*)')
      .eq('branch_id', selectedBranch)
      .eq('tanggal', today)
      .maybeSingle()

    // Discard result if a newer fetchExisting has been triggered (branch changed)
    if (seq !== null && seq !== fetchSeqRef.current) return

    if (fetchErr) {
      setError('Gagal memuat data audit: ' + fetchErr.message)
      return
    }

    if (visit) {
      setExisting(visit)
      const sc = {}, ph = {}
      ;(visit.visit_scores || []).forEach(s => {
        sc[s.item_key] = s.score
        ph[s.item_key] = s.photos || []
      })
      setScores(sc)
      setPhotos(ph)
      setCatatan(visit.catatan || '')
      setFotoKondisi(visit.foto_kondisi || [])
    } else {
      setExisting(null)
      setScores({})
      setPhotos({})
      setCatatan('')
      setFotoKondisi([])
    }
    if (!preserveDone) setDone(false)
    setError('')
    setPhotoErrors({})
  }

  const totalScore = AUDIT_ITEMS.reduce((s, item) => s + (scores[item.key] || 0), 0)
  const grade      = visitGrade(totalScore)

  const setScore = (key, val) => setScores(prev => ({ ...prev, [key]: val }))
  const setPhoto = (key, urls) => setPhotos(prev => ({ ...prev, [key]: urls }))

  const validate = () => {
    const errs = {}
    AUDIT_ITEMS.forEach(item => {
      if (!scores[item.key]) errs[item.key] = 'Wajib diberi nilai'
      if (!photos[item.key] || photos[item.key].length === 0) errs[item.key + '_photo'] = 'Wajib foto'
    })
    return errs
  }

  const handleSubmit = async () => {
    if (!selectedBranch) { setError('Pilih toko terlebih dahulu.'); return }
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setPhotoErrors(errs)
      setError('Semua item wajib diberi nilai dan foto.')
      return
    }
    setSaving(true); setError(''); setPhotoErrors({})

    const g = visitGrade(totalScore)

    // Upsert daily_visit header
    let visitId = existing?.id
    if (!visitId) {
      const { data: newVisit, error: e1 } = await supabase
        .from('daily_visits')
        .insert({
          branch_id: selectedBranch,
          tanggal: today,
          auditor_id: profile.id,
          total_score: totalScore,
          max_score: AUDIT_MAX_SCORE,
          grade: g.label,
          catatan,
          foto_kondisi: fotoKondisi,
        })
        .select('id')
        .single()
      if (e1) { setError('Gagal: ' + e1.message); setSaving(false); return }
      visitId = newVisit.id
    } else {
      const { error: eUpd } = await supabase.from('daily_visits').update({
        total_score: totalScore, grade: g.label, catatan, foto_kondisi: fotoKondisi
      }).eq('id', visitId)
      if (eUpd) { setError('Gagal update visit: ' + eUpd.message); setSaving(false); return }
      // Delete old scores
      const { error: eDel } = await supabase.from('visit_scores').delete().eq('visit_id', visitId)
      if (eDel) { setError('Gagal hapus scores lama: ' + eDel.message); setSaving(false); return }
    }

    // Insert scores
    const scoreRows = AUDIT_ITEMS.map(item => ({
      visit_id: visitId,
      item_key: item.key,
      score: scores[item.key] || 1,
      photos: photos[item.key] || [],
    }))
    const { error: e2 } = await supabase.from('visit_scores').insert(scoreRows)
    if (e2) {
      // Hapus orphan visit header kalau baru saja dibuat (bukan update)
      if (!existing?.id) {
        await supabase.from('daily_visits').delete().eq('id', visitId)
      }
      setError('Gagal simpan scores: ' + e2.message)
      setSaving(false)
      return
    }

    setDone(true)
    await fetchExisting(true)
    setSaving(false)
  }

  const isReadOnly = !!existing

  return (
    <div className="page-shell">
      <Header title="Daily Visit / Audit" sub={today} />

      <div className="flex-1 overflow-y-auto pb-28 px-4 pt-4 space-y-3">
        {done && <Alert variant="ok">Audit berhasil disimpan! Score: {totalScore}/{AUDIT_MAX_SCORE}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        {/* Branch selector */}
        <div className="card p-4">
          <label className="label">Pilih Toko</label>
          <select className="input" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} disabled={isReadOnly}>
            <option value="">-- Pilih toko --</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {isReadOnly && (
            <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mt-2">
              Audit toko ini hari ini sudah diisi. Kamu bisa melihat hasilnya di bawah.
            </p>
          )}
        </div>

        {/* Score summary hero */}
        {selectedBranch && (
          <div className="bg-primary-600 text-white rounded-2xl p-5 text-center">
            <div className="text-xs opacity-60 tracking-widest mb-1">TOTAL SCORE</div>
            <div className="text-5xl font-bold leading-none">{totalScore}</div>
            <div className="text-sm opacity-75 mt-1">dari {AUDIT_MAX_SCORE} poin</div>
            <div className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${grade.bg} ${grade.color}`}>
              {grade.label}
            </div>
            <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${totalScore / AUDIT_MAX_SCORE * 100}%` }} />
            </div>
          </div>
        )}

        {/* Scoring sections */}
        {selectedBranch && AUDIT_SECTIONS.map(sec => {
          const items = AUDIT_ITEMS.filter(i => i.section === sec.key)
          return (
            <div key={sec.key} className="card p-4">
              <h3 className="font-bold text-gray-900 mb-3">{sec.emoji} {sec.label}</h3>
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={item.key} className={`pb-4 ${idx < items.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      <ScoreDots value={scores[item.key] || 0} onChange={v => setScore(item.key, v)} disabled={isReadOnly} />
                    </div>
                    {/* Photo — wajib per item */}
                    {isReadOnly ? (
                      <PhotoViewer urls={photos[item.key]} emptyText="Tidak ada foto" />
                    ) : (
                      <>
                        <PhotoUpload
                          folder={`visit/${today}/${item.section}`}
                          value={photos[item.key] || []}
                          onChange={urls => setPhoto(item.key, urls)}
                          label={`Foto ${item.label} (wajib)`}
                          max={5}
                        />
                        {(photoErrors[item.key] || photoErrors[item.key + '_photo']) && (
                          <p className="text-xs text-red-500 mt-1">⚠ Nilai dan foto wajib</p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Notes & kondisi foto */}
        {selectedBranch && (
          <>
            <div className="card p-4">
              <label className="label">Temuan & Rekomendasi</label>
              {isReadOnly ? (
                <p className="text-sm text-gray-600">{existing?.catatan || <span className="italic text-gray-400">Tidak ada catatan</span>}</p>
              ) : (
                <textarea className="input resize-none" rows={3} value={catatan}
                  onChange={e => setCatatan(e.target.value)}
                  placeholder="Catatan kondisi toko, temuan, tindak lanjut..." />
              )}
            </div>

            <div className="card p-4">
              <label className="label">Foto Kondisi Umum Toko</label>
              {isReadOnly ? (
                <PhotoViewer urls={fotoKondisi} emptyText="Tidak ada foto" />
              ) : (
                <PhotoUpload
                  folder={`visit/${today}/kondisi`}
                  value={fotoKondisi}
                  onChange={setFotoKondisi}
                  label="Upload Foto Toko"
                  max={10}
                />
              )}
            </div>

            {!isReadOnly && (
              <button onClick={handleSubmit} disabled={saving} className="btn-primary">
                {saving ? 'Menyimpan...' : `Submit Audit (${totalScore}/${AUDIT_MAX_SCORE} poin)`}
              </button>
            )}
          </>
        )}
      </div>

      <DMBottomNav />
    </div>
  )
}
