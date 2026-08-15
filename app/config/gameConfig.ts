import type { camera, player } from '../data/types'
import type { LevelCode } from '../data/levelManifest'
import type { PersistedEnv } from '../logic/persistedEnv'

export type GameConfig = {
    startScene:'MainMenu'
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

export const gameConfig:GameConfig = {
    startScene:'MainMenu',
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
        volume:1,
    },
    startExploreCode:'preview',
    defaultPlayer:{
        position:[0, 0],
        rotation:0,
        width:100,
        height:120,
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
        tags:['player'],
        showHitbox:true,
    },
    defaultCamera:{
        position:[0, 0],
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
