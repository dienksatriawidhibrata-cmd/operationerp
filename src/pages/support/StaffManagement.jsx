import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel, SectionPanel, SubpageShell, ToneBadge,
} from '../../components/ui/AppKit'
import { roleLabel } from '../../lib/utils'

const ALL_ROLES = [
  'staff', 'barista', 'kitchen', 'waitress', 'asst_head_store', 'head_store',
  'district_manager', 'area_manager', 'ops_manager',
  'support_spv', 'support_admin', 'super_administrator', 'finance_supervisor', 'trainer',
  'hr_staff', 'hr_spv', 'hr_legal', 'hr_administrator',
  'sc_supervisor', 'purchasing_admin', 'warehouse_admin',
  'picking_spv', 'qc_spv', 'distribution_spv', 'warehouse_spv',
]

export default function StaffManagement() {
  const { profile } = useAuth()

  const [staff, setStaff] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [staffRes, branchRes] = await Promise.all([
      supabase.from('profiles').select('*, branch:branches(name)').order('full_name'),
      supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
    ])
    setStaff(staffRes.data || [])
    setBranches(branchRes.data || [])
    setLoading(false)
  }

  const toggleActive = async (person) => {
    setSaving(person.id)
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !person.is_active })
      .eq('id', person.id)
    if (!error) {
      setStaff((prev) => prev.map((s) => s.id === person.id ? { ...s, is_active: !s.is_active } : s))
      setMsg({ type: 'ok', text: `${person.full_name} berhasil ${!person.is_active ? 'diaktifkan' : 'dinonaktifkan'}.` })
    } else {
      setMsg({ type: 'err', text: 'Gagal update: ' + error.message })
    }
    setSaving(null)
    setTimeout(() => setMsg(null), 3000)
  }

  const startEdit = (person) => {
    setEditId(person.id)
    setEditForm({ role: person.role, branch_id: person.branch_id || '' })
  }

  const saveEdit = async () => {
    if (!editId) return
    setSaving(editId)
    const { error } = await supabase
      .from('profiles')
      .update({ role: editForm.role, branch_id: editForm.branch_id || null })
      .eq('id', editId)
    if (!error) {
      setStaff((prev) => prev.map((s) => s.id === editId
        ? { ...s, role: editForm.role, branch_id: editForm.branch_id || null, branch: branches.find((b) => b.id === editForm.branch_id) || null }
        : s
      ))
      setMsg({ type: 'ok', text: 'Profil berhasil diperbarui.' })
      setEditId(null)
    } else {
      setMsg({ type: 'err', text: 'Gagal update: ' + error.message })
    }
    setSaving(null)
    setTimeout(() => setMsg(null), 3000)
  }

  const filtered = staff.filter((s) => {
    if (filterStatus === 'active' && !s.is_active) return false
    if (filterStatus === 'inactive' && s.is_active) return false
    if (filterRole && s.role !== filterRole) return false
    if (search && !s.full_name?.toLowerCase().includes(search.toLowerCase()) &&
        !s.email?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const activeCount = staff.filter((s) => s.is_active).length
  const inactiveCount = staff.filter((s) => !s.is_active).length

  return (
    <SubpageShell
      title="Manajemen Staf"
      subtitle="Kelola akun dan akses pengguna"
      eyebrow="HR Management"
      footer={<SmartBottomNav />}
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-[18px] bg-emerald-50 p-3 text-center">
          <div className="text-xl font-black text-emerald-700">{activeCount}</div>
          <div className="text-[9px] font-bold uppercase text-emerald-600">Aktif</div>
        </div>
        <div className="rounded-[18px] bg-rose-50 p-3 text-center">
          <div className="text-xl font-black text-rose-600">{inactiveCount}</div>
          <div className="text-[9px] font-bold uppercase text-rose-500">Nonaktif</div>
        </div>
        <div className="rounded-[18px] bg-slate-100 p-3 text-center">
          <div className="text-xl font-black text-slate-700">{staff.length}</div>
          <div className="text-[9px] font-bold uppercase text-slate-500">Total</div>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Info box */}
      <div className="mb-4 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
        Untuk membuat akun staf baru, gunakan <strong>Supabase Auth Dashboard</strong> atau fitur undangan email. Halaman ini untuk mengelola akun yang sudah ada.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="input flex-1 min-w-[140px] py-2 text-sm"
          placeholder="Cari nama atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input py-2 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <select className="input py-2 text-sm" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">Semua Role</option>
          {ALL_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyPanel title="Tidak ada data" description="Tidak ada staf yang cocok dengan filter." />
      ) : (
        <SectionPanel eyebrow={`${filtered.length} staf`} title="Daftar Pengguna">
          <div className="space-y-2">
            {filtered.map((person) => (
              <div key={person.id} className="rounded-[18px] bg-slate-50 px-4 py-3">
                {editId === person.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 flex-1">{person.full_name}</span>
                      <button onClick={() => setEditId(null)} className="text-xs text-slate-400 hover:text-slate-600">Batal</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label">Role</label>
                        <select className="input py-1.5 text-sm" value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                          {ALL_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Toko</label>
                        <select className="input py-1.5 text-sm" value={editForm.branch_id} onChange={(e) => setEditForm((f) => ({ ...f, branch_id: e.target.value }))}>
                          <option value="">— Tanpa Toko —</option>
                          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={saveEdit}
                      disabled={saving === person.id}
                      className="btn-primary text-sm py-2"
                    >
                      {saving === person.id ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{person.full_name}</span>
                        {!person.is_active && <ToneBadge tone="danger">Nonaktif</ToneBadge>}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {person.email || '-'} · {roleLabel(person.role)}
                        {person.branch?.name && ` · ${person.branch.name}`}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => startEdit(person)}
                        className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(person)}
                        disabled={saving === person.id}
                        className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          person.is_active
                            ? 'border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100'
                            : 'border border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {saving === person.id ? '...' : person.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionPanel>
      )}
    </SubpageShell>
  )
}
