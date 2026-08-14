'use client'

import { useContext, useEffect, useRef, useState } from "react"
import { useRuntimeRoute } from '../components/RuntimeStatus'
import { isLevelAvailable, levelManifest } from '../data/levelManifest'
import { globalContext, globalConfig } from "../main"
import { toLang } from "../data/lang"
import { useAnimationFrame } from "../hooks/useAnimationFrame"
import { useSceneFade } from "../hooks/useSceneFade"
import { getEndingAccess, isProgressionStageAccessible } from '../logic/progression'

const defaultLevelList = [[-1,-1,-1],[-1,-1,-1],[-1,-1,-1],[-1,-1,-1]]

export default function Index(){
    const {lang, setScene, setBattleCode, setAfterBattleScene} = useContext(globalContext)
    const [selected, setSelected] = useState<string>('')
    const [levelList, setLevelList] = useState<number[][]>(defaultLevelList)
    const [rainbowColor, setRainbowColor] = useState<string>('#000000')
    const lastRainbowUpdate = useRef(0)
    const { style, transitionTo } = useSceneFade(setScene)
    const endingAccess = getEndingAccess(globalConfig.levelList, levelList, isLevelAvailable)
    useRuntimeRoute('selector')

    useEffect(() => {
        const clearList = localStorage.getItem('clearLevelList')
        if(clearList == null) {
            localStorage.setItem('clearLevelList', JSON.stringify(defaultLevelList))
            return
        }

        try {
            const parsed = JSON.parse(clearList)
            if (Array.isArray(parsed)) setLevelList(parsed)
        } catch (error) {
            console.error('Unable to read level progress.', error)
            localStorage.setItem('clearLevelList', JSON.stringify(defaultLevelList))
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
        {!selected ? <>{globalConfig.mapList.map((v, i) => (
            <div className={!isProgressionStageAccessible(globalConfig.levelList, levelList, i, isLevelAvailable) ? 'disabled' : ''} key={i} onClick={() => {
                if(!isProgressionStageAccessible(globalConfig.levelList, levelList, i, isLevelAvailable)) return
                setSelected(v)
            }}>{toLang(lang, v)}</div>
        ))} {endingAccess !== 'locked' && <button type="button" style={endingAccess === 'completed' ? {borderColor:rainbowColor, color:rainbowColor} : undefined} onClick={() => {
            setBattleCode('ending')
            transitionTo('Battle')
            setAfterBattleScene('Selector')
        }}>{endingAccess === 'prerequisites-unavailable' ? 'Play Ending — prerequisites unavailable' : toLang(lang, 'ending')}</button>}
        {endingAccess === 'prerequisites-unavailable' && <div className="availability-note">The prerequisite recordings are unavailable, so the existing ending is offered as a standalone playable level. No unavailable prerequisite is marked complete.</div>}</>:
        <>{globalConfig.levelList[globalConfig.mapList.indexOf(selected)].map((v, i) => {
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
                    setBattleCode(v)
                    transitionTo('Battle')
                    setAfterBattleScene('Selector')
                }}
            >{label}</button>
        })}
        <div className="availability-note">Unavailable levels keep their original chart and track identity, but cannot start without the matching recording.</div>
        <div onClick={() => setSelected('')}>{toLang(lang, 'goback')}</div></>}
        <div className="goback" onClick={() => transitionTo('MainMenu')}>{toLang(lang, 'goback')}</div>
    </div>
}
