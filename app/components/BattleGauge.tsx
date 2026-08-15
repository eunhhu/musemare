import { battleGaugeMaximum, type BattleGaugeState } from '../logic/battleGauge'

type BattleGaugeProps = {
    gauge:BattleGaugeState
    className?:string
}

export function BattleGauge({ gauge, className = '' }:BattleGaugeProps) {
    const classes = [
        'battle-gauge',
        className,
        gauge.failed ? 'failed' : '',
        !gauge.failed && gauge.health <= 25 ? 'critical' : '',
        !gauge.failed && gauge.health > 25 && gauge.health <= 50 ? 'low' : '',
    ].filter(Boolean).join(' ')

    return <div
        className={classes}
        data-battle-health={gauge.health}
        data-battle-failed={gauge.failed}
    >
        <div className="battle-gauge-label">
            <span>HP</span>
            <strong>{gauge.health}</strong>
        </div>
        <div
            className="battle-gauge-track"
            role="progressbar"
            aria-label="Battle health"
            aria-valuemin={0}
            aria-valuemax={battleGaugeMaximum}
            aria-valuenow={gauge.health}
        >
            <div className="battle-gauge-fill" style={{ width:`${gauge.health}%` }} />
        </div>
    </div>
}
