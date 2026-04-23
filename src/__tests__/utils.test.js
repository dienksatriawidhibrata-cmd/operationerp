import { vi, describe, it, expect, beforeAll } from 'vitest'

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

const {
  fmtRp,
  visitGrade,
  pctToScore,
  avg360ToScore,
  periodBounds,
  periodLabel,
  isStoreRole,
  isManagerRole,
  roleLabel,
} = await import('../lib/utils.js')

// ── fmtRp ────────────────────────────────────────────────────────────────────

describe('fmtRp', () => {
  it('formats whole thousands', () => {
    expect(fmtRp(1500000)).toBe('Rp 1.500.000')
  })

  it('formats zero', () => {
    expect(fmtRp(0)).toBe('Rp 0')
  })

  it('returns Rp 0 for null', () => {
    expect(fmtRp(null)).toBe('Rp 0')
  })

  it('returns Rp 0 for NaN', () => {
    expect(fmtRp(NaN)).toBe('Rp 0')
  })

  it('formats small amount', () => {
    expect(fmtRp(500)).toBe('Rp 500')
  })
})

// ── visitGrade ───────────────────────────────────────────────────────────────

describe('visitGrade', () => {
  it('returns Excellent at 90%+', () => {
    expect(visitGrade(99, 110).label).toBe('Excellent')
  })

  it('returns Good at 80-89%', () => {
    expect(visitGrade(88, 110).label).toBe('Good')
  })

  it('returns Fair at 60-79%', () => {
    expect(visitGrade(70, 110).label).toBe('Fair')
  })

  it('returns Poor below 60%', () => {
    expect(visitGrade(50, 110).label).toBe('Poor')
  })

  it('includes color and bg keys', () => {
    const grade = visitGrade(100, 110)
    expect(grade).toHaveProperty('color')
    expect(grade).toHaveProperty('bg')
  })
})

// ── pctToScore ───────────────────────────────────────────────────────────────

describe('pctToScore', () => {
  it('returns 5 at 90%+', () => expect(pctToScore(95)).toBe(5))
  it('returns 4 at 80%+', () => expect(pctToScore(85)).toBe(4))
  it('returns 3 at 70%+', () => expect(pctToScore(75)).toBe(3))
  it('returns 2 at 60%+', () => expect(pctToScore(65)).toBe(2))
  it('returns 1 below 60%', () => expect(pctToScore(50)).toBe(1))
})

// ── avg360ToScore ─────────────────────────────────────────────────────────────

describe('avg360ToScore', () => {
  it('returns 5 at 4.0+', () => expect(avg360ToScore(4.5)).toBe(5))
  it('returns 4 at 3.0+', () => expect(avg360ToScore(3.5)).toBe(4))
  it('returns 3 at 2.5+', () => expect(avg360ToScore(2.7)).toBe(3))
  it('returns 2 at 2.0+', () => expect(avg360ToScore(2.0)).toBe(2))
  it('returns 1 below 2.0', () => expect(avg360ToScore(1.5)).toBe(1))
})

// ── periodBounds ─────────────────────────────────────────────────────────────

describe('periodBounds', () => {
  it('returns correct bounds for April 2026', () => {
    const { startDate, endDate, daysInMonth } = periodBounds('2026-04')
    expect(startDate).toBe('2026-04-01')
    expect(endDate).toBe('2026-04-30')
    expect(daysInMonth).toBe(30)
  })

  it('returns correct bounds for February 2024 (leap year)', () => {
    const { endDate, daysInMonth } = periodBounds('2024-02')
    expect(endDate).toBe('2024-02-29')
    expect(daysInMonth).toBe(29)
  })

  it('returns empty values for falsy input', () => {
    const { startDate, endDate, daysInMonth } = periodBounds(null)
    expect(startDate).toBe('')
    expect(endDate).toBe('')
    expect(daysInMonth).toBe(0)
  })
})

// ── periodLabel ───────────────────────────────────────────────────────────────

describe('periodLabel', () => {
  it('returns formatted label', () => {
    expect(periodLabel('2026-04')).toMatch(/Apr.*2026|2026.*Apr/)
  })

  it('returns empty string for falsy input', () => {
    expect(periodLabel(null)).toBe('')
    expect(periodLabel('')).toBe('')
  })
})

// ── isStoreRole / isManagerRole ───────────────────────────────────────────────

describe('isStoreRole', () => {
  it('recognises staff', () => expect(isStoreRole('staff')).toBe(true))
  it('recognises head_store', () => expect(isStoreRole('head_store')).toBe(true))
  it('rejects ops_manager', () => expect(isStoreRole('ops_manager')).toBe(false))
})

describe('isManagerRole', () => {
  it('recognises district_manager', () => expect(isManagerRole('district_manager')).toBe(true))
  it('recognises ops_manager', () => expect(isManagerRole('ops_manager')).toBe(true))
  it('rejects staff', () => expect(isManagerRole('staff')).toBe(false))
})

// ── roleLabel ─────────────────────────────────────────────────────────────────

describe('roleLabel', () => {
  it('returns human label for known role', () => {
    expect(roleLabel('ops_manager')).not.toBe('ops_manager')
  })

  it('returns role itself for unknown role', () => {
    expect(roleLabel('unknown_role')).toBe('unknown_role')
  })
})
