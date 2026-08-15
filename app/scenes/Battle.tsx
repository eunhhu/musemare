import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameSession } from '../components/GameSession'
import { useRuntimeRoute } from '../components/RuntimeStatus'
import { gameConfig } from '../config/gameConfig'
import { levels } from '../data/level'
import { levelManifest, type LevelCode } from '../data/levelManifest'
import type { level } from '../data/types'
import { lvlToRendata } from '../data/utils'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { useRuntimeMedia } from '../hooks/useRuntimeMedia'
import { useSceneFade } from '../hooks/useSceneFade'
import { useWindowSize } from '../hooks/useWindowSize'
import {
    enqueuePendingHit,
    evaluateJudgements,
    isAudioActivelyPlaying,
    prepareNotes,
    timelineStampFromAudio,
    type JudgementState,
} from '../logic/battleDomain'
import {
    applyBattleGaugeEvents,
    collectNewGaugeEvents,
    createBattleGaugeState,
    type BattleGaugeState,
} from '../logic/battleGauge'
import { BattleRenderer } from '../renderers/BattleRenderer'
import { isEditableTarget } from '../logic/input'
import type { GameScene } from '../logic/gameSession'
import {
    markLevelCleared,
    parseProgress,
    progressStorageKey,
    type BattleProgressTarget,
} from '../logic/progression'

const playKeys = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'BracketLeft', 'BracketRight', 'Backslash', 'Equal', 'Minus', 'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Space', 'ControlLeft', 'AltLeft', 'ControlRight', 'ContextMenu', 'AltRight', 'Enter', 'Backspace', 'Backquote', 'Tab', 'ShiftLeft', 'ShiftRight', 'CapsLock', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadDecimal', 'NumLock', 'NumpadEnter', 'NumpadSubtract', 'NumpadAdd', 'NumpadMultiply', 'NumpadDivide', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

function UnavailableBattle({ code, onBack }:{ code:LevelCode, onBack:() => void }) {
    const manifest = levelManifest[code]
    useRuntimeRoute('battle-unavailable')

    return <div className="BattleUnavailable fullscreen blackbg">
        <h1>{manifest.track.artist} — {manifest.track.title}</h1>
        <p>This level is unavailable because the matching recording is not present as a legally usable repository asset.</p>
        <button type="button" onClick={onBack}>Back to Selector</button>
    </div>
}

function BattleGauge({ gauge }:{ gauge:BattleGaugeState }) {
    return <div
        className={`battle-gauge${gauge.failed ? ' failed' : ''}`}
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
            aria-valuemax={100}
            aria-valuenow={gauge.health}
        >
            <div className="battle-gauge-fill" style={{ width:`${gauge.health}%` }} />
        </div>
    </div>
}

type PlayableBattleProps = {
    levelData:level
    masterVolume:number
    progressTarget:BattleProgressTarget | null
    afterBattleScene:GameScene
    setScene:(scene:GameScene) => void
}

function BattleAttempt({
    levelData,
    masterVolume,
    progressTarget,
    afterBattleScene,
    setScene,
    onRetry,
}:PlayableBattleProps & { onRetry:() => void }) {
    const { width, height } = useWindowSize()
    const [timeline, setTimeline] = useState(0)
    const [audioPlaying, setAudioPlaying] = useState(false)
    const {
        mediaRef:audioRef,
        elementRef:audioElementRef,
        complete:completeAudio,
        fail:failAudio,
    } = useRuntimeMedia<HTMLAudioElement>(levelData.song, 'Battle audio failed to decode.')
    const pendingHitsRef = useRef<number[]>([])
    const judgementsRef = useRef<JudgementState>({})
    const [judgements, setJudgements] = useState<JudgementState>({})
    const gaugeRef = useRef(createBattleGaugeState())
    const [gauge, setGauge] = useState(createBattleGaugeState)
    const endingRef = useRef(false)
    const renderData = useMemo(() => lvlToRendata(levelData), [levelData])
    const preparedNotes = useMemo(() => prepareNotes(renderData.objs), [renderData])
    const { style, transitionTo } = useSceneFade(setScene)
    useRuntimeRoute('battle')

    useAnimationFrame(() => {
        const audio = audioRef.current
        if (!audio || gaugeRef.current.failed) return

        const currentTimeline = timelineStampFromAudio(audio, levelData.offset)
        const result = evaluateJudgements(
            preparedNotes,
            pendingHitsRef.current,
            currentTimeline,
            judgementsRef.current,
        )
        pendingHitsRef.current = result.pendingHits
        let nextGauge = gaugeRef.current
        if (result.judgements !== judgementsRef.current) {
            nextGauge = applyBattleGaugeEvents(
                gaugeRef.current,
                collectNewGaugeEvents(preparedNotes, judgementsRef.current, result.judgements),
            )
            judgementsRef.current = result.judgements
            setJudgements(result.judgements)
            if (nextGauge !== gaugeRef.current) {
                gaugeRef.current = nextGauge
                setGauge(nextGauge)
            }
        }
        setTimeline(currentTimeline)

        if (nextGauge.failed) {
            audio.pause()
            setAudioPlaying(false)
            return
        }

        if (!endingRef.current && currentTimeline >= levelData.endpoint) {
            endingRef.current = true
            if (progressTarget) {
                try {
                    const current = parseProgress(localStorage.getItem(progressStorageKey), gameConfig.levelList).value
                    localStorage.setItem(progressStorageKey, JSON.stringify(markLevelCleared(current, gameConfig.levelList, progressTarget)))
                } catch (error) {
                    console.error('Unable to save level progress.', error)
                }
            }
            transitionTo(afterBattleScene)
        }
    })

    useEffect(() => {
        const keydown = (event:KeyboardEvent) => {
            const audio = audioRef.current
            if (!audio || event.repeat || isEditableTarget(event.target) || !playKeys.includes(event.code) || !isAudioActivelyPlaying(audio)) return
            const stamp = timelineStampFromAudio(audio, levelData.offset)
            pendingHitsRef.current = enqueuePendingHit(pendingHitsRef.current, stamp, stamp)
        }
        document.addEventListener('keydown', keydown)
        return () => document.removeEventListener('keydown', keydown)
    }, [audioRef, levelData.offset])

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = Math.min(1, Math.max(0, levelData.volume / 100 * masterVolume))
    }, [audioRef, levelData.volume, masterVolume])

    return <div style={style} className="Battle">
        <audio
            ref={audioElementRef}
            src={levelData.song}
            autoPlay={true}
            preload="auto"
            onLoadedMetadata={event => {
                event.currentTarget.volume = Math.min(1, Math.max(0, levelData.volume / 100 * masterVolume))
                event.currentTarget.currentTime = Math.max(levelData.offset, 0)
            }}
            onCanPlayThrough={event => completeAudio(event.currentTarget)}
            onPlaying={() => setAudioPlaying(true)}
            onPause={() => setAudioPlaying(false)}
            onWaiting={() => setAudioPlaying(false)}
            onEnded={() => setAudioPlaying(false)}
            onError={event => failAudio(event.currentTarget)}
        />
        <BattleRenderer
            timeline={timeline}
            stageSize={[width, height]}
            renderData={renderData}
            judgements={judgements}
            playing={audioPlaying}
            surfaceLabel="battle"
        />
        <BattleGauge gauge={gauge} />
        {gauge.failed && <div className="battle-game-over" role="dialog" aria-modal="true" aria-labelledby="battle-game-over-title">
            <h1 id="battle-game-over-title">Game Over</h1>
            <p>Health reached zero.</p>
            <div>
                <button type="button" onClick={onRetry}>Retry</button>
                <button type="button" onClick={() => transitionTo(afterBattleScene)}>Leave</button>
            </div>
        </div>}
    </div>
}

function PlayableBattle(props:PlayableBattleProps) {
    const [attempt, setAttempt] = useState(0)
    return <BattleAttempt key={attempt} {...props} onRetry={() => setAttempt(current => current + 1)} />
}

export default function Index(){
    const { navigate, battleCode, afterBattleScene, battleProgressTarget, env } = useGameSession()
    const code = Object.hasOwn(levels, battleCode) ? battleCode as LevelCode : 'test'
    const manifest = levelManifest[code]

    if (manifest.availability === 'unavailable') {
        return <UnavailableBattle code={code} onBack={() => navigate('Selector')} />
    }

    return <PlayableBattle
        levelData={levels[code]}
        masterVolume={env.volume}
        progressTarget={battleProgressTarget}
        afterBattleScene={afterBattleScene}
        setScene={navigate}
    />
}
