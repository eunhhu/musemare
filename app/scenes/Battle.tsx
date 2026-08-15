import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameSession } from '../components/GameSession'
import { BattleGauge } from '../components/BattleGauge'
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
    isAudioActivelyPlaying,
    prepareNotes,
    timelineStampFromAudio,
    type JudgementState,
} from '../logic/battleDomain'
import {
    advanceBattleFrame,
    createBattleGaugeState,
} from '../logic/battleGauge'
import { isGameplayKeyboardInput } from '../logic/battleInput'
import { BattleRenderer } from '../renderers/BattleRenderer'
import { isEditableTarget } from '../logic/input'
import type { GameScene } from '../logic/gameSession'
import {
    markLevelCleared,
    parseProgress,
    progressStorageKey,
    type BattleProgressTarget,
} from '../logic/progression'

function UnavailableBattle({ code, onBack }:{ code:LevelCode, onBack:() => void }) {
    const manifest = levelManifest[code]
    useRuntimeRoute('battle-unavailable')

    return <div className="BattleUnavailable fullscreen blackbg">
        <h1>{manifest.track.artist} — {manifest.track.title}</h1>
        <p>This level is unavailable because the matching recording is not present as a legally usable repository asset.</p>
        <button type="button" onClick={onBack}>Back to Selector</button>
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
        const result = advanceBattleFrame(
            preparedNotes,
            pendingHitsRef.current,
            currentTimeline,
            judgementsRef.current,
            gaugeRef.current,
        )
        pendingHitsRef.current = result.pendingHits
        if (result.judgements !== judgementsRef.current) {
            judgementsRef.current = result.judgements
            setJudgements(result.judgements)
        }
        if (result.gauge !== gaugeRef.current) {
            gaugeRef.current = result.gauge
            setGauge(result.gauge)
        }
        setTimeline(currentTimeline)

        if (result.gauge.failed) {
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
            if (!audio || isEditableTarget(event.target) || !isGameplayKeyboardInput(event) || !isAudioActivelyPlaying(audio)) return
            event.preventDefault()
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
