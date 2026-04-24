import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { AUDIT_ITEMS, AUDIT_MAX_SCORE, AUDIT_SECTIONS } from '../../lib/constants'
import { todayWIB, visitGrade } from '../../lib/utils'
import ScoreDots from '../../components/ScoreDots'
import PhotoUpload from '../../components/PhotoUpload'
import PhotoViewer from '../../components/PhotoViewer'
import Alert from '../../components/Alert'
import { DMBottomNav, OpsBottomNav } from '../../components/BottomNav'
import { isOpsLikeRole } from '../../lib/access'
import {
  HeroCard,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
  LoadingButton,
} from '../../components/ui/AppKit'

export default function DailyVisit() {
  const { profile } = useAuth()
  const today = todayWIB()

  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [existing, setExisting] = useState(null)
  const [scores, setScores] = useState({})
  const [photos, setPhotos] = useState({})
  const [catatan, setCatatan] = useState('')
  const [fotoKondisi, setFotoKondisi] = useState([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [photoErrors, setPhotoErrors] = useState({})

  const fetchSeqRef = useRef(0)

  useEffect(() => {
    fetchBranches()
  }, [profile?.id])

  useEffect(() => {
    if (!selectedBranch) return
    fetchSeqRef.current += 1
    const seq = fetchSeqRef.current
    fetchExisting(false, seq)
  }, [selectedBranch])

  const fetchBranches = async () => {
    let query = supabase.from('branches').select('id,name,store_id,district,area').eq('is_active', true)
    if (profile?.role === 'district_manager') query = query.in('district', profile.managed_districts || [])
    else if (profile?.role === 'area_manager') query = query.in('area', profile.managed_areas || [])
    const { data } = await query.order('name')
    setBranches(data || [])
  }

  const fetchExisting = async (preserveDone = false, seq = null) => {
    const { data: visit, error: fetchErr } = await supabase
      .from('daily_visits')
      .select('*, visit_scores(*)')
      .eq('branch_id', selectedBranch)
      .eq('tanggal', today)
      .maybeSingle()

    if (seq !== null && seq !== fetchSeqRef.current) return

    if (fetchErr) {
      setError('Gagal memuat data audit: ' + fetchErr.message)
      return
    }

    if (visit) {
      setExisting(visit)
      const nextScores = {}
      const nextPhotos = {}
      ;(visit.visit_scores || []).forEach((score) => {
        nextScores[score.item_key] = score.score
        nextPhotos[score.item_key] = score.photos || []
      })
      setScores(nextScores)
      setPhotos(nextPhotos)
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

  const totalScore = AUDIT_ITEMS.reduce((sum, item) => sum + (scores[item.key] || 0), 0)
  const grade = visitGrade(totalScore)

  const setScore = (key, value) => setScores((current) => ({ ...current, [key]: value }))
  const setPhoto = (key, urls) => setPhotos((current) => ({ ...current, [key]: urls }))

  const validate = () => {
    const errors = {}
    AUDIT_ITEMS.forEach((item) => {
      if (!scores[item.key]) errors[item.key] = 'Wajib diberi nilai'
      if (!photos[item.key] || photos[item.key].length === 0) errors[`${item.key}_photo`] = 'Wajib foto'
    })
    return errors
  }

  const handleSubmit = async () => {
    if (!selectedBranch) {
      setError('Pilih toko terlebih dahulu.')
      return
    }

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setPhotoErrors(validationErrors)
      setError('Semua item wajib diberi nilai dan foto.')
      return
    }

    setSaving(true)
    setError('')
    setPhotoErrors({})

    const gradeResult = visitGrade(totalScore)

    let visitId = existing?.id
    if (!visitId) {
      const { data: newVisit, error: insertErr } = await supabase
        .from('daily_visits')
        .insert({
          branch_id: selectedBranch,
          tanggal: today,
          auditor_id: profile.id,
          total_score: totalScore,
          max_score: AUDIT_MAX_SCORE,
          grade: gradeResult.label,
          catatan,
          foto_kondisi: fotoKondisi,
        })
        .select('id')
        .single()

      if (insertErr) {
        setError('Gagal: ' + insertErr.message)
        setSaving(false)
        return
      }
      visitId = newVisit.id
    } else {
      const { error: updateErr } = await supabase
        .from('daily_visits')
        .update({
          total_score: totalScore,
          grade: gradeResult.label,
          catatan,
          foto_kondisi: fotoKondisi,
        })
        .eq('id', visitId)

      if (updateErr) {
        setError('Gagal update visit: ' + updateErr.message)
        setSaving(false)
        return
      }

      const { error: deleteErr } = await supabase.from('visit_scores').delete().eq('visit_id', visitId)
      if (deleteErr) {
        setError('Gagal hapus scores lama: ' + deleteErr.message)
        setSaving(false)
        return
      }
    }

    const scoreRows = AUDIT_ITEMS.map((item) => ({
      visit_id: visitId,
      item_key: item.key,
      score: scores[item.key] || 1,
      photos: photos[item.key] || [],
    }))
    const { error: scoreErr } = await supabase.from('visit_scores').insert(scoreRows)
    if (scoreErr) {
      if (!existing?.id) {
        await supabase.from('daily_visits').delete().eq('id', visitId)
      }
      setError('Gagal simpan scores: ' + scoreErr.message)
      setSaving(false)
      return
    }

    setDone(true)
    await fetchExisting(true)
    setSaving(false)
  }

  const isReadOnly = !!existing
  const selectedBranchName = branches.find((branch) => branch.id === selectedBranch)?.name

  return (
    <SubpageShell
      title="Daily Visit / Audit"
      subtitle={today}
      eyebrow="Store Audit"
      footer={isOpsLikeRole(profile?.role) ? <OpsBottomNav /> : <DMBottomNav />}
    >
      <SectionPanel
        eyebrow="Outlet Picker"
        title="Pilih Toko"
        description="Pilih outlet yang ingin diaudit hari ini. Satu toko hanya punya satu audit per hari."
      >
          <div className="grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
          <div>
            <label className="label">Toko Audit</label>
            <select
              className="input"
              value={selectedBranch}
              onChange={(event) => setSelectedBranch(event.target.value)}
              disabled={isReadOnly}
            >
              <option value="">-- Pilih toko --</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            {isReadOnly && (
              <div className="mt-3 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Audit toko ini hari ini sudah diisi. Kamu masih bisa melihat seluruh hasilnya di bawah.
              </div>
            )}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-1">
            <InlineStat label="Total Score" value={totalScore} tone="primary" />
            <InlineStat label="Grade" value={grade.label} tone={totalScore >= 85 ? 'emerald' : totalScore >= 70 ? 'amber' : 'rose'} />
          </div>
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {done && <Alert variant="ok">Audit berhasil disimpan. Score: {totalScore}/{AUDIT_MAX_SCORE}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        {selectedBranch && (
          <HeroCard
            eyebrow={selectedBranchName || 'Audit Outlet'}
            title={`Score sementara ${totalScore}/${AUDIT_MAX_SCORE} poin`}
            description="Nilai akan terus terhitung otomatis saat kamu mengisi item per section. Lengkapi skor dan foto agar audit bisa disimpan."
            meta={
              <>
                <ToneBadge tone={totalScore >= 85 ? 'ok' : totalScore >= 70 ? 'warn' : 'danger'}>
                  Grade {grade.label}
                </ToneBadge>
                <ToneBadge tone="info">{AUDIT_ITEMS.length} item audit</ToneBadge>
              </>
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <InlineStat label="Scored" value={`${Object.keys(scores).length}/${AUDIT_ITEMS.length}`} tone="primary" />
              <InlineStat label="Foto Item" value={Object.values(photos).reduce((sum, urls) => sum + (urls?.length || 0), 0)} tone="slate" />
              <InlineStat label="Foto Umum" value={fotoKondisi.length} tone="slate" />
            </div>
          </HeroCard>
        )}

        {selectedBranch && AUDIT_SECTIONS.map((section) => {
          const sectionItems = AUDIT_ITEMS.filter((item) => item.section === section.key)
          return (
            <SectionPanel
              key={section.key}
              eyebrow="Audit Section"
              title={`${section.emoji || ''} ${section.label}`.trim()}
              description="Beri nilai dan unggah foto untuk setiap item di section ini."
            >
              <div className="space-y-4">
                {sectionItems.map((item) => (
                  <div key={item.key} className="rounded-[20px] bg-slate-50/85 px-3.5 py-3.5 sm:rounded-[22px] sm:px-4 sm:py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      <ScoreDots value={scores[item.key] || 0} onChange={(value) => setScore(item.key, value)} disabled={isReadOnly} />
                    </div>
                    <div className="mt-3">
                      {isReadOnly ? (
                        <PhotoViewer urls={photos[item.key]} emptyText="Tidak ada foto" />
                      ) : (
                        <>
                          <PhotoUpload
                            folder={`visit/${today}/${item.section}`}
                            value={photos[item.key] || []}
                            onChange={(urls) => setPhoto(item.key, urls)}
                            label={`Foto ${item.label} (wajib)`}
                            max={5}
                          />
                          {(photoErrors[item.key] || photoErrors[`${item.key}_photo`]) && (
                            <p className="mt-2 text-xs text-rose-500">Nilai dan foto wajib diisi.</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionPanel>
          )
        })}

        {selectedBranch && (
          <>
            <SectionPanel
              eyebrow="Findings"
              title="Temuan & Rekomendasi"
              description="Isi catatan audit untuk hal yang perlu ditindaklanjuti."
            >
              {isReadOnly ? (
                <p className="text-sm leading-6 text-slate-600">
                  {existing?.catatan || <span className="italic text-slate-400">Tidak ada catatan</span>}
                </p>
              ) : (
                <textarea
                  className="input resize-none"
                  rows={4}
                  value={catatan}
                  onChange={(event) => setCatatan(event.target.value)}
                  placeholder="Catat temuan, kondisi toko, dan rekomendasi tindak lanjut..."
                />
              )}
            </SectionPanel>

            <SectionPanel
              eyebrow="General View"
              title="Foto Kondisi Umum Toko"
              description="Dokumentasikan kondisi keseluruhan toko untuk pelengkap audit."
            >
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
            </SectionPanel>

            {!isReadOnly && (
              <LoadingButton onClick={handleSubmit} loading={saving} className="btn-primary">
                {`Submit Audit (${totalScore}/${AUDIT_MAX_SCORE} poin)`}
              </LoadingButton>
            )}
          </>
        )}
      </div>
    </SubpageShell>
  )
}
