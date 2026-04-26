import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AppIcon } from './ui/AppKit'

const SUGGESTED = [
  'Toko mana yang belum setoran minggu ini?',
  'Siapa yang paling sering skip ceklis bulan ini?',
  'Toko mana yang opex-nya paling besar?',
  'DM mana yang paling rajin visit?',
  'Toko mana yang sering understaffing?',
]

export default function AskTheData() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const inputRef = useRef(null)

  async function ask(q) {
    const text = (q || question).trim()
    if (!text || loading) return
    setQuestion('')
    setLoading(true)
    setError('')
    setAnswer('')
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-the-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ question: text }),
        },
      )
      if (!resp.ok) throw new Error(`Error ${resp.status}`)
      const json = await resp.json()
      const ans = json.answer || 'Tidak ada jawaban.'
      setAnswer(ans)
      setHistory((prev) => [{ q: text, a: ans }, ...prev].slice(0, 10))
    } catch (e) {
      setError('Gagal menghubungi AI. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask()
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 px-5 py-4 text-left shadow-sm transition-transform active:scale-[0.98]"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-200">
          <AppIcon name="spark" size={20} />
        </div>
        <div>
          <p className="text-xs font-black text-violet-900">Ask the Data</p>
          <p className="text-[10px] text-violet-500">Tanya apa saja soal operasional toko…</p>
        </div>
        <AppIcon name="chevronRight" size={16} className="ml-auto text-violet-400" />
      </button>
    )
  }

  return (
    <div className="rounded-[2rem] border border-violet-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-violet-50 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-600 text-white">
          <AppIcon name="spark" size={18} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-black text-violet-900">Ask the Data</p>
          <p className="text-[9px] text-violet-400">AI Analyst — Ops Manager</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        {!answer && !loading && !error && history.length === 0 && (
          <div className="mb-4">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Contoh pertanyaan</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-violet-50 px-4 py-3">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
            <p className="text-xs text-violet-600">Sedang menganalisis data…</p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3">
            <p className="text-xs text-rose-600">{error}</p>
          </div>
        )}

        {answer && (
          <div className="mb-4">
            <div className="mb-2 rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400">Pertanyaan</p>
              <p className="text-xs text-slate-700">{history[0]?.q}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 px-4 py-3">
              <p className="text-[10px] font-bold text-violet-500">Jawaban AI</p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-800">{answer}</p>
            </div>
          </div>
        )}

        {history.length > 1 && (
          <details className="mb-4">
            <summary className="cursor-pointer text-[10px] font-bold text-slate-400 hover:text-slate-600">
              Riwayat pertanyaan ({history.length - 1} sebelumnya)
            </summary>
            <div className="mt-2 space-y-2">
              {history.slice(1).map((h, i) => (
                <div key={i} className="rounded-xl border border-slate-100 px-3 py-2">
                  <p className="text-[9px] font-bold text-slate-400">{h.q}</p>
                  <p className="line-clamp-2 text-[10px] text-slate-600">{h.a}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Tanya soal operasional toko…"
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => ask()}
            disabled={!question.trim() || loading}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-200 transition disabled:opacity-40 active:scale-95"
          >
            <AppIcon name="chevronRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
