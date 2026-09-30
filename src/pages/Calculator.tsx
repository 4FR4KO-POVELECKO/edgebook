import { RiskCalculator, draftFromCalc } from '../components/RiskCalculator'
import { useTradeModal } from '../components/TradeTable'
import { useT } from '../i18n'

export default function CalculatorPage() {
  const t = useT()
  const show = useTradeModal((s) => s.show)
  return (
    <div className="stack">
      <div className="page-head"><h1>{t.calc.title}</h1></div>
      <div className="card">
        <RiskCalculator useLabel={t.calc.create} onUse={(r) => show(undefined, { ...draftFromCalc(r), status: 'open' })} />
      </div>
    </div>
  )
}
