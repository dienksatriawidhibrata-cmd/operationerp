import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtDate, todayWIB } from '../../lib/utils'
import { DMBottomNav, OpsBottomNav } from '../../components/BottomNav'
import { isOpsLikeRole } from '../../lib/access'
import {
  EmptyPanel, SectionPanel, SoftButton, SubpageShell, ToneBadge,
} from '../../components/ui/AppKit'

export default function TasksPage() {
  const { profile } = useAuth()
  const isOpsManager = isOpsLikeRole(profile?.role)
  const today = todayWIB()

  const [tasks, setTasks]       = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ title: '', assigned_to: '', due_date: '' })

  useEffect(() => {
    if (!profile?.id) return
    fetchTasks()
    if (isOpsManager) fetchManagers()
  }, [profile?.id])

  const fetchTasks = async () => {
    let q = supabase
      .from('dm_tasks')
      .select('id, title, is_done, done_at, due_date, created_at, assigned_to, assignee:profiles!assigned_to(id, full_name, role)')
      .order('is_done', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (!isOpsManager) q = q.eq('assigned_to', profile.id)
    const { data } = await q
    setTasks(data || [])
    setLoading(false)
  }

  const fetchManagers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['district_manager', 'area_manager', 'head_store', 'asst_head_store', 'trainer'])
      .eq('is_active', true)
      .order('role')
      .order('full_name')
    setManagers(data || [])
  }

  const toggleDone = async (task) => {
    const patch = { is_done: !task.is_done, done_at: !task.is_done ? new Date().toISOString() : null }
    const { error } = await supabase.from('dm_tasks').update(patch).eq('id', task.id)
    if (!error) setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, ...patch } : t))
  }

  const deleteTask = async (id) => {
    await supabase.from('dm_tasks').delete().eq('id', id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.assigned_to) return
    setSaving(true)
    const { error } = await supabase.from('dm_tasks').insert({
      created_by: profile.id,
      assigned_to: form.assigned_to,
      title: form.title.trim(),
      due_date: form.due_date || null,
    })
    setSaving(false)
    if (!error) {
      setForm({ title: '', assigned_to: '', due_date: '' })
      setShowForm(false)
      fetchTasks()
    }
  }

  const pending = tasks.filter((t) => !t.is_done)
  const done    = tasks.filter((t) => t.is_done)

  const shortName = (s) => s?.full_name?.split(' ').slice(0, 2).join(' ') || '-'
  const roleBadge = (role) => {
    const map = { district_manager: 'DM', area_manager: 'AM', head_store: 'HS', asst_head_store: 'AHS', trainer: 'Trainer' }
    return map[role] ?? role
  }

  const BottomNav = isOpsManager ? OpsBottomNav : DMBottomNav

  return (
    <SubpageShell
      title="Tugas"
      subtitle={`${pending.length} perlu diselesaikan`}
      eyebrow="Task Manager"
      footer={<BottomNav />}
      action={
        isOpsManager && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600 text-xl font-light text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            {showForm ? '×' : '+'}
          </button>
        )
      }
    >
      {/* Add form */}
      {showForm && (
        <SectionPanel eyebrow="Ops Manager" title="Buat Tugas Baru" className="mb-4">
          <form onSubmit={addTask} className="space-y-3">
            <div>
              <label className="label">Deskripsi Tugas</label>
              <input
                required
                className="input"
                placeholder="Tulis deskripsi tugas yang jelas..."
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Assign ke</label>
                <select
                  required
                  className="input"
                  value={form.assigned_to}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                >
                  <option value="">Pilih assignee...</option>
                  {['district_manager', 'area_manager'].some((r) => managers.find((m) => m.role === r)) && (
                    <optgroup label="Manager">
                      {managers.filter((m) => ['district_manager', 'area_manager'].includes(m.role)).map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name} ({roleBadge(m.role)})</option>
                      ))}
                    </optgroup>
                  )}
                  {['head_store', 'asst_head_store'].some((r) => managers.find((m) => m.role === r)) && (
                    <optgroup label="Store">
                      {managers.filter((m) => ['head_store', 'asst_head_store'].includes(m.role)).map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name} ({roleBadge(m.role)})</option>
                      ))}
                    </optgroup>
                  )}
                  {managers.some((m) => m.role === 'trainer') && (
                    <optgroup label="Trainer">
                      {managers.filter((m) => m.role === 'trainer').map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name} (Trainer)</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="label">Deadline (opsional)</label>
                <input
                  type="date"
                  className="input"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center justify-center gap-2"
            >
              {saving ? 'Menyimpan...' : 'Buat Tugas'}
            </button>
          </form>
        </SectionPanel>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyPanel
          title="Tidak ada tugas"
          description={isOpsManager ? 'Klik + di kanan atas untuk membuat tugas baru.' : 'Belum ada tugas yang di-assign ke kamu.'}
          actionLabel={isOpsManager ? 'Buat Tugas' : undefined}
          onAction={isOpsManager ? () => setShowForm(true) : undefined}
        />
      ) : (
        <div className="space-y-4">
          {/* Pending */}
          {pending.length > 0 && (
            <SectionPanel
              eyebrow="Perlu Diselesaikan"
              title={`${pending.length} Tugas Aktif`}
            >
              <div className="divide-y divide-slate-50">
                {pending.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    isOpsManager={isOpsManager}
                    shortName={shortName}
                    roleBadge={roleBadge}
                    onToggle={toggleDone}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            </SectionPanel>
          )}

          {/* Done */}
          {done.length > 0 && (
            <SectionPanel
              eyebrow="Selesai"
              title={`${done.length} Tugas Selesai`}
            >
              <div className="divide-y divide-slate-50 opacity-60">
                {done.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    isOpsManager={isOpsManager}
                    shortName={shortName}
                    roleBadge={roleBadge}
                    onToggle={toggleDone}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            </SectionPanel>
          )}
        </div>
      )}
    </SubpageShell>
  )
}

function TaskRow({ task, today, isOpsManager, shortName, roleBadge, onToggle, onDelete }) {
  const isOverdue = !task.is_done && task.due_date && task.due_date < today

  return (
    <div className="flex items-start gap-3 py-3.5">
      <button
        type="button"
        onClick={() => onToggle(task)}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
          task.is_done
            ? 'border-emerald-500 bg-emerald-500'
            : 'border-slate-300 hover:border-primary-400'
        }`}
      >
        {task.is_done && <span className="text-[10px] leading-none text-white">✓</span>}
      </button>

      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium text-slate-800 ${task.is_done ? 'line-through' : ''}`}>
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {isOpsManager && task.assignee && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {roleBadge(task.assignee.role)} · {shortName(task.assignee)}
            </span>
          )}
          {task.due_date && (
            <ToneBadge tone={isOverdue ? 'danger' : task.is_done ? 'ok' : 'slate'}>
              {isOverdue ? 'Lewat ' : task.is_done ? 'Selesai ' : ''}{fmtDate(task.due_date)}
            </ToneBadge>
          )}
          {!task.due_date && !isOpsManager && (
            <span className="text-[11px] text-slate-400">Tanpa deadline</span>
          )}
        </div>
      </div>

      {isOpsManager && (
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="shrink-0 rounded-xl border border-transparent p-1.5 text-slate-300 transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-500"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </button>
      )}
    </div>
  )
}
