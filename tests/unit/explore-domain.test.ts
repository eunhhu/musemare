import { describe, expect, it } from 'vitest'
import type { camera, env, player } from '../../app/data/types'
import { stepExploreSimulation } from '../../app/logic/exploreDomain'

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
        position:[0, 0],
        rotation:0,
        width:10,
        height:10,
        opacity:1,
        anchor:[0.5, 0.5],
        hitbox:[1, 1],
        src:'/assets/object/glowing_circle_01.png',
        jumpSrc:'',
        sneakSrc:'',
        sneakWalkSrc:[],
        runSrc:[],
        walkSrc:[],
        isGround:true,
        isSneak:false,
        isRun:false,
        showHitbox:false,
        dposition:[0, 0],
        events:[],
        tags:['player'],
    }
}

describe('explore simulation', () => {
    it('advances movement without mutating the supplied world state', () => {
        const originalPlayer = createPlayer()
        const originalCamera:camera = { position:[0, 0], rotation:0, scale:1, follow:'player' }

        const [, nextPlayer, nextCamera] = stepExploreSimulation(
            [],
            0.3,
            ['KeyD'],
            [],
            controls,
            originalPlayer,
            originalCamera,
            300,
        )

        expect(nextPlayer.position[0]).toBe(3)
        expect(nextCamera.position).toEqual(nextPlayer.position)
        expect(originalPlayer.position).toEqual([0, 0])
        expect(originalPlayer.dposition).toEqual([0, 0])
        expect(originalCamera.position).toEqual([0, 0])
        expect(nextPlayer.position).not.toBe(originalPlayer.position)
        expect(nextCamera.position).not.toBe(originalCamera.position)
    })
})
