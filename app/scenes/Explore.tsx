import { useState } from 'react'
import { useGameSession } from '../components/GameSession'
import { useRuntimeRoute } from '../components/RuntimeStatus'
import { gameConfig } from '../config/gameConfig'
import type { Msprite, camera, exevent, player, text } from '../data/types'
import { maps } from '../data/map'
import { MsArrToRsArr } from '../data/utils'
import { useFixedStepAnimation } from '../hooks/useFixedStepAnimation'
import { useHeldKeys } from '../hooks/useHeldKeys'
import { useSceneFade } from '../hooks/useSceneFade'
import { useWindowSize } from '../hooks/useWindowSize'
import { stepExploreSimulation } from '../logic/exploreDomain'
import { ExploreRenderer } from '../renderers/ExploreRenderer'

export default function Index(){
    const { width, height } = useWindowSize()
    const { navigate, env, exploreCode } = useGameSession()
    const { style } = useSceneFade(navigate)
    const selectedMap = maps[exploreCode]
    const [start] = useState(Boolean(selectedMap))
    const [activeEvents, setActiveEvents] = useState<exevent[]>([])
    const [sprites, setSprites] = useState<Msprite[]>(() => selectedMap?.sprites ?? [])
    const [texts] = useState<text[]>(() => selectedMap?.texts ?? [])
    const [gravity] = useState<number>(() => selectedMap?.gravity ?? gameConfig.defaultGravity)
    const [ground] = useState<number>(() => selectedMap?.ground ?? gameConfig.defaultGround)
    const [player, setPlayer] = useState<player>(() => selectedMap?.player ?? gameConfig.defaultPlayer)
    const [camera, setCamera] = useState<camera>(() => selectedMap?.camera ?? gameConfig.defaultCamera)
    const [backgroundColor] = useState<string>(() => selectedMap?.backgroundColor ?? gameConfig.black)
    const inputsRef = useHeldKeys(start)
    useRuntimeRoute('explore')

    useFixedStepAnimation(steps => {
        let nextSprites = sprites
        let nextPlayer = player
        let nextCamera = camera
        let nextEvents = activeEvents
        for (let step = 0; step < steps; step += 1) {
            const next = stepExploreSimulation(nextSprites, gravity, inputsRef.current, nextEvents, env, nextPlayer, nextCamera, ground)
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
        <ExploreRenderer
            stageSize={[width, height]}
            sprites={MsArrToRsArr(sprites)}
            texts={texts}
            player={player}
            camera={camera}
            backgroundColor={backgroundColor}
            showHitbox={true}
            surfaceLabel="explore"
        />
    </div>
}
