import { useEffect, useRef, useState } from "react"
import { useGameSession } from '../components/GameSession'
import { useRuntimeRoute } from '../components/RuntimeStatus'
import { gameConfig } from '../config/gameConfig'
import { isLevelAvailable, levelManifest } from '../data/levelManifest'
import { toLang } from "../data/lang"
import { useAnimationFrame } from "../hooks/useAnimationFrame"
import { useSceneFade } from "../hooks/useSceneFade"
import {
    createDefaultProgress,
    getEndingAccess,
    isProgressionStageAccessible,
    parseProgress,
    progressStorageKey,
} from '../logic/progression'

export default function Index(){
    const { lang, navigate, prepareBattle } = useGameSession()
    const [selected, setSelected] = useState<string>('')
    const [levelList, setLevelList] = useState<number[][]>(() => createDefaultProgress(gameConfig.levelList))
    const [rainbowColor, setRainbowColor] = useState<string>('#000000')
    const lastRainbowUpdate = useRef(0)
    const { style, transitionTo } = useSceneFade(navigate)
    const endingAccess = getEndingAccess(gameConfig.levelList, levelList, isLevelAvailable)
    useRuntimeRoute('selector')

    useEffect(() => {
        try {
            const parsed = parseProgress(localStorage.getItem(progressStorageKey), gameConfig.levelList)
            setLevelList(parsed.value)
            if (parsed.repaired) localStorage.setItem(progressStorageKey, JSON.stringify(parsed.value))
        } catch (error) {
            console.error('Unable to read level progress.', error)
            setLevelList(createDefaultProgress(gameConfig.levelList))
        }
    }, [])

    useAnimationFrame((timestamp) => {
        if (timestamp - lastRainbowUpdate.current < 50) return
        lastRainbowUpdate.current = timestamp
        const t = (Date.now() / 3000) % 1
        const r = Math.round(Math.sin(t * 2 * Math.PI) * 127 + 128)
        const g = Math.round(Math.sin(t * 2 * Math.PI + 2 * Math.PI / 3) * 127 + 128)
        const b = Math.round(Math.sin(t * 2 * Math.PI + 4 * Math.PI / 3) * 127 + 128)
        setRainbowColor(`rgb(${r},${g},${b})`)
    }, endingAccess === 'completed')

    return <div style={style} className="Selector fullscreen blackbg">
        {!selected ? <>{gameConfig.mapList.map((v, i) => (
            <button type="button" className={!isProgressionStageAccessible(gameConfig.levelList, levelList, i, isLevelAvailable) ? 'disabled' : ''} key={i} onClick={() => {
                if(!isProgressionStageAccessible(gameConfig.levelList, levelList, i, isLevelAvailable)) return
                setSelected(v)
            }}>{toLang(lang, v)}</button>
        ))} {endingAccess !== 'locked' && <button type="button" style={endingAccess === 'completed' ? {borderColor:rainbowColor, color:rainbowColor} : undefined} onClick={() => {
            prepareBattle('ending')
            transitionTo('Battle')
        }}>{endingAccess === 'prerequisites-unavailable' ? 'Play Ending — prerequisites unavailable' : toLang(lang, 'ending')}</button>}
        {endingAccess === 'prerequisites-unavailable' && <div className="availability-note">The prerequisite recordings are unavailable, so the existing ending is offered as a standalone playable level. No unavailable prerequisite is marked complete.</div>}</>:
        <>{gameConfig.levelList[gameConfig.mapList.indexOf(selected)].map((v, i) => {
            const stageIndex = gameConfig.mapList.indexOf(selected)
            const manifest = levelManifest[v]
            const unavailable = manifest.availability === 'unavailable'
            const label = unavailable
                ? `${manifest.track.artist} — ${manifest.track.title} — Unavailable`
                : toLang(lang, v)
            return <button
                type="button"
                key={i}
                aria-disabled={unavailable}
                className={unavailable ? 'disabled' : ''}
                onClick={() => {
                    if (unavailable) return
                    prepareBattle(v, [stageIndex, i])
                    transitionTo('Battle')
                }}
            >{label}</button>
        })}
        <div className="availability-note">Unavailable levels keep their original chart and track identity, but cannot start without the matching recording.</div>
        <button type="button" onClick={() => setSelected('')}>{toLang(lang, 'goback')}</button></>}
        <button type="button" className="goback" onClick={() => transitionTo('MainMenu')}>{toLang(lang, 'goback')}</button>
    </div>
}
