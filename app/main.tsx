'use client'

import { createContext, useEffect, useState, type Dispatch, type SetStateAction } from "react"
import MainMenu from './scenes/MainMenu'
import Intro from './scenes/Intro'
import Settings from './scenes/Settings'
import Credits from './scenes/Credits'
import Battle from './scenes/Battle'
import Explore from './scenes/Explore'
import Selector from './scenes/Selector'
import type { camera, player } from "./data/types"
import type { LevelCode } from './data/levelManifest'
import { parsePersistedEnv, type PersistedEnv } from './logic/persistedEnv'

type GlobalConfig = {
    startScene:string
    defaultLang:string
    testBattleCode:LevelCode
    defaultEnv:PersistedEnv
    startExploreCode:string
    defaultPlayer:player
    defaultCamera:camera
    defaultGravity:number
    defaultGround:number
    black:string
    white:string
    mapList:string[]
    levelList:LevelCode[][]
}

type GlobalContextValue = {
    scene:string
    setScene:Dispatch<SetStateAction<string>>
    lang:string
    setLang:Dispatch<SetStateAction<string>>
    battleCode:string
    setBattleCode:Dispatch<SetStateAction<string>>
    exploreCode:string
    setExploreCode:Dispatch<SetStateAction<string>>
    afterBattleScene:string
    setAfterBattleScene:Dispatch<SetStateAction<string>>
    env:PersistedEnv
    setEnv:Dispatch<SetStateAction<PersistedEnv>>
}

// 글로벌 설정
export const globalConfig:GlobalConfig = {
    startScene:'MainMenu',
    defaultLang:'en-US',
    testBattleCode:'test',
    defaultEnv:{
        keys:{
            playerLeft:'KeyA',
            playerRight:'KeyD',
            playerJump:'Space',
            playerRun:'ShiftLeft',
            playerSneak:'ControlLeft',
            interaction:'KeyF',
            escape:'Escape',
        },
        language:'en-US',
        volume:1
    },
    startExploreCode:'FogForest',
    defaultPlayer:{
        position:[0,0],
        rotation:0,
        width:100, height:120,
        opacity:1,
        anchor:[0.5, 0.5],
        src:'/assets/object/glowing_circle_01.png',
        jumpSrc:'',
        sneakSrc:'',
        sneakWalkSrc:[''],
        walkSrc:[''],
        runSrc:[''],
        dposition:[0, 0],
        isSneak:false,
        isRun:false,
        isGround:false,
        hitbox:[1, 1],
        events:[],
        tags:["player"],
        showHitbox:true,
    },
    defaultCamera:{
        position:[0,0],
        rotation:0,
        scale:1,
        follow:'',
    },
    defaultGravity:0.3,
    defaultGround:300,
    black:'#000000',
    white:'#ffffff',
    mapList:['fogforest', 'gloomcave', 'jungle', 'wasteland'],
    levelList:[
        ['test'],
        ['moai'],
        ['dogbite'],
        ['test'],
    ],
}

const ignoreStateUpdate = (_value:unknown) => undefined

export const globalContext = createContext<GlobalContextValue>({
    scene:globalConfig.startScene,
    setScene:ignoreStateUpdate,
    lang:globalConfig.defaultLang,
    setLang:ignoreStateUpdate,
    battleCode:globalConfig.testBattleCode,
    setBattleCode:ignoreStateUpdate,
    exploreCode:globalConfig.startExploreCode,
    setExploreCode:ignoreStateUpdate,
    afterBattleScene:globalConfig.startScene,
    setAfterBattleScene:ignoreStateUpdate,
    env:globalConfig.defaultEnv,
    setEnv:ignoreStateUpdate,
})

export default function Index(){
    // 글로벌 state 변수 선언
    const [lang, setLang] = useState<string>(globalConfig.defaultLang)
    const [scene, setScene] = useState<string>(globalConfig.startScene)
    const [battleCode, setBattleCode] = useState<string>(globalConfig.testBattleCode)
    const [afterBattleScene, setAfterBattleScene] = useState<string>(globalConfig.startScene)
    const [exploreCode, setExploreCode] = useState<string>(globalConfig.startExploreCode)
    const [env, setEnv] = useState<PersistedEnv>(globalConfig.defaultEnv)
    const [load, setLoad] = useState<boolean>(false)

    useEffect(() => {
        setLang(navigator.language ?? globalConfig.defaultLang)

        let nextEnv = globalConfig.defaultEnv
        try {
            const persistedEnv = parsePersistedEnv(localStorage.getItem('env'), globalConfig.defaultEnv)
            nextEnv = persistedEnv.value
            if (persistedEnv.repaired) localStorage.setItem('env', JSON.stringify(persistedEnv.value))
        } catch {
            nextEnv = globalConfig.defaultEnv
        }
        setEnv(nextEnv)

        const search = new URLSearchParams(window.location.search)
        const requestedScene = search.get('scene')
        if (requestedScene === 'Battle') {
            setBattleCode(search.get('battle') ?? 'test')
            setAfterBattleScene('Selector')
            setScene('Battle')
        } else if (requestedScene === 'Explore') {
            setExploreCode(search.get('explore') ?? 'preview')
            setScene('Explore')
        }
        setLoad(true)
    }, [])

    return <globalContext.Provider value={{
        // 글로벌 state 변수 업로드
        scene, setScene,
        lang, setLang,
        battleCode, setBattleCode,
        exploreCode, setExploreCode,
        afterBattleScene, setAfterBattleScene,
        env, setEnv,
    }}>
        {
            // scene 불러오기
            load && (
            scene == 'Intro' ? <Intro /> :
            scene == 'MainMenu' ? <MainMenu /> :
            scene == 'Settings' ? <Settings /> :
            scene == 'Credits' ? <Credits /> :
            scene == 'Battle' ? <Battle /> :
            scene == 'Explore' ? <Explore key={exploreCode} /> :
            scene == 'Selector' ? <Selector /> :
            <></>)
        }
    </globalContext.Provider>
}
