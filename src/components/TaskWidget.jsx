import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { todayWIB, fmtDate } from '../lib/utils'

export default function TaskWidget({ profile }) {
  const isOpsManager = profile?.role === 'ops_manager'
  const [tasks, setTasks] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', assigned_to: '', due_date: '' })
  const [saving, setSaving] = useState(false)
  const today = todayWIB()

  useEffect(() => {
    if (!profile?.id) return
    fetchTasks()
    if (isOpsManager) fetchManagers()
  }, [profile?.id])

  const fetchTasks = async () => {
    let q = supabase
      .from('dm_tasks')
      .select('id, title, is_done, done_at, due_date, created_at, assigned_to, assignee:profiles!assigned_to(id, full_name)')
      .order('is_done', { ascending: true })
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
      .in('role', ['district_manager', 'area_manager'])
      .eq('is_active', true)
      .order('full_name')
    setManagers(data || [])
  }

  const toggleDone = async (task) => {
    const patch = {
      is_done: !task.is_done,
      done_at: !task.is_done ? new Date().toISOString() : null,
    }
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
  const done = tasks.filter((t) => t.is_done)
  const shortName = (s) => s?.full_name?.split(' ').slice(0, 2).join(' ') || '-'

  return (
    <div className="flex flex-col overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 pb-3 pt-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tugas</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">
            {loading ? '...' : pending.length > 0 ? `${pending.length} perlu diselesaikan` : 'Semua tugas selesai ✓'}
          </div>
        </div>
        {isOpsManager && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary-50 text-xl font-light text-primary-700 transition-colors hover:bg-primary-100"
          >
            {showForm ? '×' : '+'}
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={addTask} className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <input
            required
            className="input text-sm"
            placeholder="Deskripsi tugas..."
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              required
              className="input text-sm"
              value={form.assigned_to}
              onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
            >
              <option value="">Assign ke...</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
            <input
              type="date"
              className="input text-sm"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-primary-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Tambah Tugas'}
          </button>
        </form>
      )}

      {/* Task list */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ maxHeight: 320 }}>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            {isOpsManager ? 'Belum ada tugas. Klik + untuk tambah.' : 'Tidak ada tugas untukmu saat ini.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-50">
            {[...pending, ...done].map((task) => {
              const isOverdue = !task.is_done && task.due_date && task.due_date < today
              return (
                <div key={task.id} className={`flex items-start gap-3 px-4 py-3 transition-opacity ${task.is_done ? 'opacity-40' : ''}`}>
                  <button
                    type="button"
                    onClick={() => toggleDone(task)}
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      task.is_done
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-slate-300 hover:border-primary-400'
                    }`}
                  >
                    {task.is_done && <span className="text-[9px] leading-none text-white">✓</span>}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium text-slate-800 ${task.is_done ? 'line-through' : ''}`}>
                      {task.title}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-400">
                      {isOpsManager && task.assignee && <span>{shortName(task.assignee)}</span>}
                      {task.due_date && (
                        <span className={isOverdue ? 'font-semibold text-rose-500' : ''}>
                          {isOverdue ? 'Lewat ' : ''}{fmtDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isOpsManager && (
                    <button
                      type="button"
                      onClick={() => deleteTask(task.id)}
                      className="shrink-0 text-lg leading-none text-slate-200 transition-colors hover:text-rose-400"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          {done.length > 0 && !loading ? `${done.length} selesai` : ''}
        </span>
        <Link
          to="/tasks"
          className="text-[11px] font-semibold text-primary-600 hover:text-primary-800 transition-colors"
        >
          Lihat semua →
        </Link>
      </div>
    </div>
  )
}
