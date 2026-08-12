'use client'

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRuntimeRoute, useRuntimeTask } from '../components/RuntimeStatus'
import { levels } from '../data/level'
import { levelManifest, type LevelCode } from '../data/levelManifest'
import type { level } from '../data/types'
import { lvlToRendata } from '../data/utils'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
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
import { battleEngine } from '../logic/battleEngine'
import { isEditableTarget } from '../logic/input'
import { createRuntimeAssetFailure, mediaSourceMatches } from '../logic/runtimeAssets'
import { globalContext } from '../main'

const playKeys = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'BracketLeft', 'BracketRight', 'Backslash', 'Equal', 'Minus', 'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Space', 'ControlLeft', 'AltLeft', 'ControlRight', 'ContextMenu', 'AltRight', 'Enter', 'Backspace', 'Backquote', 'Tab', 'ShiftLeft', 'RightLeft', 'CapsLock', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadDecimal', 'NumLock', 'NumpadEnter', 'NumpadSubtract', 'NumpadAdd', 'NumpadMultiply', 'NumpadDivide', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

function UnavailableBattle({ code, onBack }:{ code:LevelCode, onBack:() => void }) {
    const manifest = levelManifest[code]
    useRuntimeRoute('battle-unavailable')

    return <div className="BattleUnavailable fullscreen blackbg">
        <h1>{manifest.track.artist} — {manifest.track.title}</h1>
        <p>This level is unavailable because the matching recording is not present as a legally usable repository asset.</p>
        <button type="button" onClick={onBack}>Back to Selector</button>
    </div>
}

function PlayableBattle({
    levelData,
    afterBattleScene,
    setScene,
}:{
    levelData:level
    afterBattleScene:string
    setScene:(scene:string) => void
}) {
    const { width, height } = useWindowSize()
    const [timeline, setTimeline] = useState(0)
    const [audioPlaying, setAudioPlaying] = useState(false)
    const audioRef = useRef<HTMLAudioElement>(null)
    const pendingHitsRef = useRef<number[]>([])
    const judgementsRef = useRef<JudgementState>({})
    const [judgements, setJudgements] = useState<JudgementState>({})
    const endingRef = useRef(false)
    const renderData = useMemo(() => lvlToRendata(levelData), [levelData])
    const preparedNotes = useMemo(() => prepareNotes(renderData.objs), [renderData])
    const { style, transitionTo } = useSceneFade(setScene)
    const audioTask = useRuntimeTask('asset', levelData.song)
    useRuntimeRoute('battle')

    useAnimationFrame(() => {
        const audio = audioRef.current
        if (!audio) return

        const currentTimeline = timelineStampFromAudio(audio, levelData.offset)
        const result = evaluateJudgements(
            preparedNotes,
            pendingHitsRef.current,
            currentTimeline,
            judgementsRef.current,
        )
        pendingHitsRef.current = result.pendingHits
        if (result.judgements !== judgementsRef.current) {
            judgementsRef.current = result.judgements
            setJudgements(result.judgements)
        }
        setTimeline(currentTimeline)

        if (!endingRef.current && currentTimeline >= levelData.endpoint) {
            endingRef.current = true
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
    }, [levelData.offset])

    return <div style={style} className="Battle">
        <audio
            ref={audioRef}
            src={levelData.song}
            autoPlay={true}
            preload="auto"
            onLoadedMetadata={event => {
                event.currentTarget.volume = levelData.volume / 100
                event.currentTarget.currentTime = Math.max(levelData.offset, 0)
            }}
            onCanPlayThrough={event => {
                if (mediaSourceMatches(event.currentTarget.currentSrc, levelData.song, window.location.href)) audioTask.complete()
            }}
            onPlaying={() => setAudioPlaying(true)}
            onPause={() => setAudioPlaying(false)}
            onWaiting={() => setAudioPlaying(false)}
            onEnded={() => setAudioPlaying(false)}
            onError={event => {
                if (!mediaSourceMatches(event.currentTarget.currentSrc, levelData.song, window.location.href)) return
                audioTask.fail(createRuntimeAssetFailure(levelData.song, new Error('Battle audio failed to decode.')))
            }}
        />
        {battleEngine(timeline, [width, height], renderData, judgements, audioPlaying, 'battle')}
    </div>
}

export default function Index(){
    const { setScene, battleCode, afterBattleScene } = useContext(globalContext)
    const code = Object.hasOwn(levels, battleCode) ? battleCode as LevelCode : 'test'
    const manifest = levelManifest[code]

    if (manifest.availability === 'unavailable') {
        return <UnavailableBattle code={code} onBack={() => setScene('Selector')} />
    }

    return <PlayableBattle levelData={levels[code]} afterBattleScene={afterBattleScene} setScene={setScene} />
}
