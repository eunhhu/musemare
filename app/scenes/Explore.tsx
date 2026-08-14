'use client'

import { useContext, useState } from 'react'
import { useRuntimeRoute } from '../components/RuntimeStatus'
import type { Msprite, camera, exevent, player, text } from '../data/types'
import { maps } from '../data/map'
import { MsArrToRsArr } from '../data/utils'
import { useFixedStepAnimation } from '../hooks/useFixedStepAnimation'
import { useHeldKeys } from '../hooks/useHeldKeys'
import { useSceneFade } from '../hooks/useSceneFade'
import { useWindowSize } from '../hooks/useWindowSize'
import { execute, exRender } from '../logic/exploreEngine'
import { globalConfig, globalContext } from '../main'

export default function Index(){
    const { width, height } = useWindowSize()
    const {lang, setScene, env, exploreCode} = useContext(globalContext)
    const { style } = useSceneFade(setScene)
    const selectedMap = maps[exploreCode]
    const [start] = useState(Boolean(selectedMap))
    const [activeEvents, setActiveEvents] = useState<exevent[]>([])
    const [sprites, setSprites] = useState<Msprite[]>(() => selectedMap?.sprites ?? [])
    const [texts] = useState<text[]>(() => selectedMap?.texts ?? [])
    const [gravity] = useState<number>(() => selectedMap?.gravity ?? globalConfig.defaultGravity)
    const [ground] = useState<number>(() => selectedMap?.ground ?? globalConfig.defaultGround)
    const [player, setPlayer] = useState<player>(() => selectedMap?.player ?? globalConfig.defaultPlayer)
    const [camera, setCamera] = useState<camera>(() => selectedMap?.camera ?? globalConfig.defaultCamera)
    const [backgroundColor] = useState<string>(() => selectedMap?.backgroundColor ?? globalConfig.black)
    const inputsRef = useHeldKeys(start)
    useRuntimeRoute('explore')

    useFixedStepAnimation(steps => {
        let nextSprites = sprites
        let nextPlayer = player
        let nextCamera = camera
        let nextEvents = activeEvents
        for (let step = 0; step < steps; step += 1) {
            const next = execute(lang, nextSprites, gravity, inputsRef.current, nextEvents, env, nextPlayer, nextCamera, ground)
            nextSprites = next[0]
            nextPlayer = next[1]
            nextCamera = next[2]
            nextEvents = next[3]
        }
        setSprites(nextSprites)
        setPlayer(nextPlayer)
        setCamera(nextCamera)
        setActiveEvents(nextEvents)
    }, start)

    if (!start) {
        return <div style={style} className="Explore fullscreen blackbg">
            <div>Explore maps are not available in this build.</div>
        </div>
    }

    return <div style={style} className="Explore">
        {exRender([width, height], lang, MsArrToRsArr(sprites), texts, player, camera, backgroundColor, true, 'explore')}
    </div>
}
