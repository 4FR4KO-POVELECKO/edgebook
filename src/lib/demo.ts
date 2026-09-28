import { uid } from '../store'
import type { DayNote, Strategy, Trade } from '../types'
import { localDateTime, ymd } from './format'

/** Seeded PRNG so demo data is stable between clicks. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

export function makeDemo(): { strategies: Strategy[]; trades: Trade[]; dayNotes: Record<string, DayNote> } {
  const now = new Date().toISOString()
  const strategies: Strategy[] = [
    {
      id: uid(), name: 'Пробой уровня', color: '#6c8cff', timeframe: '15m', market: 'Акции', archived: false, createdAt: now,
      description: 'Вход на пробое дневного уровня с повышенным объёмом.',
      rules: ['Уровень отторгался 2+ раза', 'Объём на пробое выше среднего', 'Стоп за уровень', 'R:R не менее 1:2'],
    },
    {
      id: uid(), name: 'Отбой от VWAP', color: '#22c3a6', timeframe: '5m', market: 'Акции', archived: false, createdAt: now,
      description: 'Возврат к VWAP в сторону тренда дня.',
      rules: ['Тренд дня определён', 'Касание VWAP', 'Разворотная свеча', 'Стоп за экстремум'],
    },
    {
      id: uid(), name: 'Свинг по тренду', color: '#f5a524', timeframe: '1D', market: 'Крипто', archived: false, createdAt: now,
      description: 'Покупка откатов в восходящем тренде на дневках.',
      rules: ['Цена выше 50 EMA', 'Откат к зоне поддержки', 'Подтверждение на 4H'],
    },
  ]

  const r = rng(42)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const symbols: Record<string, [string, number][]> = {
    'Акции': [['AAPL', 190], ['NVDA', 120], ['TSLA', 240], ['AMD', 150], ['MSFT', 420], ['META', 500]],
    'Крипто': [['BTCUSDT', 62000], ['ETHUSDT', 3000], ['SOLUSDT', 150]],
  }
  const tagsPool = ['A+ сетап', 'новости', 'гэп', 'утро', 'после обеда', 'тренд']
  const mistakesPool = ['Ранний выход', 'Передвинул стоп', 'Вход без сетапа', 'Завышенный объём', 'FOMO-вход']
  const emotions = ['Спокойствие', 'Уверенность', 'Страх', 'Жадность', 'FOMO']
  // each strategy gets its own edge so analytics has something to show
  const edge = [0.56, 0.48, 0.42]

  const trades: Trade[] = []
  const dayNotes: Record<string, DayNote> = {}
  const today = new Date()
  for (let back = 100; back >= 1; back--) {
    const day = new Date(today)
    day.setDate(today.getDate() - back)
    const dow = day.getDay()
    if (dow === 0 || dow === 6) continue
    if (r() < 0.15) continue
    const n = 1 + Math.floor(r() * 3)
    for (let k = 0; k < n; k++) {
      const si = Math.floor(r() * strategies.length)
      const s = strategies[si]
      const [symbol, base] = pick(symbols[s.market])
      const direction = r() < 0.7 ? 'long' : 'short'
      const entry = +(base * (0.9 + r() * 0.2)).toFixed(2)
      const riskPx = entry * (0.004 + r() * 0.01)
      const riskMoney = 80 + r() * 60
      const qty = s.market === 'Крипто' ? +(riskMoney / riskPx).toFixed(3) : Math.max(1, Math.round(riskMoney / riskPx))
      const win = r() < edge[si]
      const rr = win ? 0.8 + r() * 2.4 : -(0.4 + r() * 0.7)
      const sign = direction === 'long' ? 1 : -1
      const exit = +(entry + sign * rr * riskPx).toFixed(2)
      const stop = +(entry - sign * riskPx).toFixed(2)
      const tp = +(entry + sign * riskPx * 2).toFixed(2)
      const h = 9 + Math.floor(r() * 6)
      const m = Math.floor(r() * 60)
      const ed = new Date(day); ed.setHours(h, m)
      const xd = new Date(ed)
      xd.setMinutes(xd.getMinutes() + (s.timeframe === '1D' ? 60 * 24 * (1 + Math.floor(r() * 5)) : 10 + Math.floor(r() * 180)))
      if (xd > today) xd.setTime(today.getTime() - 60000)
      const mistakes = !win && r() < 0.5 ? [pick(mistakesPool)] : r() < 0.08 ? [pick(mistakesPool)] : []
      const checklist = Object.fromEntries(s.rules.map((rule) => [rule, mistakes.length ? r() < 0.5 : r() < 0.9]))
      trades.push({
        id: uid(), symbol, market: s.market, direction, status: 'closed',
        entryDate: localDateTime(ed), exitDate: localDateTime(xd),
        entryPrice: entry, exitPrice: exit, quantity: qty, multiplier: 1,
        fees: +(1 + r() * 3).toFixed(2), stopLoss: stop, takeProfit: tp,
        strategyId: s.id, checklist,
        tags: r() < 0.6 ? [pick(tagsPool)] : [],
        mistakes,
        emotion: mistakes.length ? pick(emotions.slice(2)) : pick(emotions.slice(0, 2)),
        rating: mistakes.length ? 1 + Math.floor(r() * 3) : 3 + Math.floor(r() * 3),
        notes: '', screenshots: [], createdAt: now,
      })
    }
    if (r() < 0.35) {
      const d = ymd(day)
      dayNotes[d] = {
        date: d,
        plan: 'Смотрю пробои дневных уровней, не больше 3 сделок.',
        review: r() < 0.5 ? 'Держался плана, всё ок.' : 'Поторопился со входом, нужно ждать подтверждения.',
        mood: 2 + Math.floor(r() * 4),
      }
    }
  }
  // one open position
  trades.push({
    id: uid(), symbol: 'ETHUSDT', market: 'Крипто', direction: 'long', status: 'open',
    entryDate: localDateTime(new Date(today.getTime() - 86400000)), entryPrice: 2950, quantity: 0.5,
    multiplier: 1, fees: 1.2, stopLoss: 2860, takeProfit: 3200, strategyId: strategies[2].id,
    checklist: {}, tags: ['тренд'], mistakes: [], emotion: 'Уверенность', notes: '', screenshots: [], createdAt: now,
  })
  return { strategies, trades, dayNotes }
}
