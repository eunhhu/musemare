import { describe, expect, it } from 'vitest'
import type { Msprite, camera, env, player } from '../../app/data/types'
import { stepExploreSimulation } from '../../app/logic/exploreDomain'
import { initCollidedPosition } from '../../app/data/utils'

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

    it('applies run speed on the same simulation step', () => {
        const [, nextPlayer] = stepExploreSimulation(
            [], 0.3, ['KeyD', 'ShiftLeft'], [], controls, createPlayer(),
            { position:[0, 0], rotation:0, scale:1, follow:'' }, 300,
        )
        expect(nextPlayer.position[0]).toBe(5)
        expect(nextPlayer.isRun).toBe(true)
    })

    it('keeps hitbox bottom on the global ground for arbitrary anchors', () => {
        const grounded = createPlayer()
        grounded.anchor = [0.5, 0.25]
        grounded.hitbox = [1, 0.5]
        grounded.position = [0, 96.25]

        const [, nextPlayer] = stepExploreSimulation(
            [], 0.3, [], [], controls, grounded,
            { position:[0, 0], rotation:0, scale:1, follow:'' }, 100,
        )
        expect(nextPlayer.position[1]).toBe(96.25)
        expect(nextPlayer.isGround).toBe(true)
    })

    it('resolves horizontal collisions using anchors instead of assuming centered sprites', () => {
        const actor = playerSprite({ position:[0, 0], anchor:[0, 0], dposition:[15, 0] })
        const obstacle = playerSprite({ position:[20, 0], anchor:[0, 0], isCollision:true })
        const moved = initCollidedPosition(actor, [obstacle])
        expect(moved.position[0]).toBe(10)
        expect(moved.dposition[0]).toBe(0)
    })

    it('uses configured hitbox ratios instead of visual dimensions', () => {
        const actor = playerSprite({
            position:[0, 0], anchor:[0, 0], width:20, hitbox:[0.5, 1], dposition:[5, 0],
        })
        const obstacle = playerSprite({ position:[15, 0], anchor:[0, 0], isCollision:true })
        const moved = initCollidedPosition(actor, [obstacle])
        expect(moved.position[0]).toBe(5)
    })

    it('does not tunnel through colliders during a large movement step', () => {
        const actor = playerSprite({ position:[0, 0], anchor:[0, 0], dposition:[100, 0] })
        const obstacle = playerSprite({ position:[20, 0], anchor:[0, 0], isCollision:true })
        expect(initCollidedPosition(actor, [obstacle]).position[0]).toBe(10)
    })
})

function playerSprite(overrides:Partial<Msprite>):Msprite {
    return {
        position:[0, 0], rotation:0, width:10, height:10, opacity:1,
        anchor:[0.5, 0.5], hitbox:[1, 1], src:[''], srcIdx:0,
        isGravity:false, isCollision:true, isGround:false, showHitbox:false,
        dposition:[0, 0], tags:[], events:[], ...overrides,
    }
}
