import { describe, expect, it } from 'vitest'
import type { camera, env, player } from '../../app/data/types'
import { stepExploreSimulation } from '../../app/logic/exploreDomain'
import { consumeFixedSteps } from '../../app/logic/fixedStep'

const controls:env = { keys:{
    playerLeft:'KeyA',
    playerRight:'KeyD',
    playerJump:'Space',
    playerSneak:'ControlLeft',
    playerRun:'ShiftLeft',
    interaction:'KeyF',
    escape:'Escape',
} }

function createPlayer():player {
    return {
        position:[0, 0], rotation:0, width:10, height:10, opacity:1,
        anchor:[0.5, 0.5], hitbox:[1, 1], src:'/assets/object/glowing_circle_01.png',
        jumpSrc:'', sneakSrc:'', sneakWalkSrc:[], runSrc:[], walkSrc:[],
        isGround:true, isSneak:false, isRun:false, showHitbox:false,
        dposition:[0, 0], events:[], tags:['player'],
    }
}

function simulate(cadence:number[]) {
    let accumulator = 0
    let playerState = createPlayer()
    let cameraState:camera = { position:[0, 0], rotation:0, scale:1, follow:'player' }

    for (const elapsed of cadence) {
        const fixed = consumeFixedSteps(accumulator, elapsed)
        accumulator = fixed.remainderMs
        for (let step = 0; step < fixed.steps; step += 1) {
            const result = stepExploreSimulation([], 0.3, ['KeyD'], [], controls, playerState, cameraState, 300)
            playerState = result[1]
            cameraState = result[2]
        }
    }

    return playerState.position[0]
}

describe('fixed-step simulation timing', () => {
    it('produces the same movement across different frame cadences', () => {
        expect(simulate(Array.from({ length:10 }, () => 10))).toBe(30)
        expect(simulate([16, 17, 17, 16, 17, 17])).toBe(30)
    })

    it('bounds catch-up work after a long suspended frame', () => {
        expect(consumeFixedSteps(0, 5_000)).toEqual({ steps:10, remainderMs:0 })
    })
})
