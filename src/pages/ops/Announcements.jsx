import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { OpsBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel,
  LoadingButton,
  SectionPanel,
  SubpageShell,
} from '../../components/ui/AppKit'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function AnnouncementsPage() {
  const { profile } = useAuth()
  const { toastSuccess, toastError } = useToast()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const fetchItems = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, body, is_active, published_at')
      .order('published_at', { ascending: false })
    if (!error) setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  const handleCreate = async () => {
    if (!title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('announcements').insert({
      title: title.trim(),
      body: body.trim() || null,
      is_active: true,
      created_by: profile.id,
    })
    setSaving(false)
    if (error) {
      toastError('Gagal membuat pengumuman: ' + error.message)
    } else {
      toastSuccess('Pengumuman berhasil dibuat.')
      setTitle('')
      setBody('')
      setShowForm(false)
      fetchItems()
    }
  }

  const toggleActive = async (item) => {
    setTogglingId(item.id)
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
    setTogglingId(null)
    if (error) {
      toastError('Gagal mengubah status.')
    } else {
      toastSuccess(item.is_active ? 'Pengumuman dinonaktifkan.' : 'Pengumuman diaktifkan.')
      fetchItems()
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    setDeletingId(null)
    if (error) {
      toastError('Gagal menghapus: ' + error.message)
    } else {
      toastSuccess('Pengumuman dihapus.')
      fetchItems()
    }
  }

  const cancelForm = () => {
    setShowForm(false)
    setTitle('')
    setBody('')
  }

  return (
    <SubpageShell
      title="Kelola Pengumuman"
      eyebrow="Ops Management"
      footer={<OpsBottomNav />}
    >
      <SectionPanel
        eyebrow="Pengumuman"
        title="Buat & Kelola Pengumuman"
        description="Pengumuman aktif tampil di dashboard semua staff."
        actions={
          !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-xl border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-600 hover:bg-primary-50"
            >
              + Buat
            </button>
          )
        }
      >
        {showForm && (
          <div className="mb-5 space-y-3 rounded-[20px] border border-primary-100 bg-primary-50 p-4">
            <div>
              <label className="label">Judul</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul pengumuman..."
                autoFocus
              />
            </div>
            <div>
              <label className="label">Isi <span className="font-normal text-slate-400">(opsional)</span></label>
              <textarea
                className="input resize-none"
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Detail pengumuman..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelForm}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <LoadingButton
                loading={saving}
                loadingLabel="Menyimpan..."
                onClick={handleCreate}
                disabled={!title.trim()}
                className="btn-primary flex-1"
              >
                Simpan
              </LoadingButton>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <EmptyPanel
            title="Belum ada pengumuman"
            description="Buat pengumuman pertama untuk ditampilkan ke semua staff."
            actionLabel="Buat Sekarang"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-[20px] border p-4 transition-opacity ${
                  item.is_active
                    ? 'border-primary-100 bg-white'
                    : 'border-slate-100 bg-slate-50 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatDate(item.published_at)}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-slate-800">{item.title}</p>
                    {item.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.body}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => toggleActive(item)}
                      disabled={togglingId === item.id}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="rounded-xl bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                    >
                      {deletingId === item.id ? '...' : 'Hapus'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>
    </SubpageShell>
  )
}
