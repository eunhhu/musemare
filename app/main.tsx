import { Suspense, lazy, type ComponentType } from 'react'
import { GameSessionProvider, useGameSession } from './components/GameSession'
import type { GameScene } from './logic/gameSession'

const sceneComponents:Record<GameScene, ComponentType> = {
    MainMenu:lazy(() => import('./scenes/MainMenu')),
    Intro:lazy(() => import('./scenes/Intro')),
    Settings:lazy(() => import('./scenes/Settings')),
    Credits:lazy(() => import('./scenes/Credits')),
    Battle:lazy(() => import('./scenes/Battle')),
    Explore:lazy(() => import('./scenes/Explore')),
    Selector:lazy(() => import('./scenes/Selector')),
}

function SceneRouter() {
    const session = useGameSession()
    const Scene = sceneComponents[session.scene]
    const sceneKey = session.scene === 'Battle'
        ? `${session.scene}:${session.battleCode}`
        : session.scene === 'Explore'
            ? `${session.scene}:${session.exploreCode}`
            : session.scene

    return <Scene key={sceneKey} />
}

export default function Game() {
    return <GameSessionProvider>
        <Suspense fallback={null}>
            <SceneRouter />
        </Suspense>
    </GameSessionProvider>
}
