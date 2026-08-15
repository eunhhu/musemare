import type { Msprite, camera, env, exevent, player } from '../data/types'
import { getSpriteHitboxBounds, initCollidedPosition, playerToMsprite } from '../data/utils'

function clampActorToGround<T extends Msprite>(actor:T, ground:number):T {
    const bounds = getSpriteHitboxBounds(actor)
    if (actor.dposition[1] >= 0 && bounds.bottom >= ground) {
        actor.position[1] -= bounds.bottom - ground
        actor.dposition[1] = 0
        actor.isGround = true
    } else if (Math.abs(bounds.bottom - ground) <= 0.5 && actor.dposition[1] >= 0) {
        actor.isGround = true
    }
    return actor
}

export function stepExploreSimulation(
    sprites:Msprite[],
    gravity:number,
    inputs:string[],
    activeEvents:exevent[],
    controls:env,
    playerState:player,
    cameraState:camera,
    ground:number,
):[Msprite[], player, camera, exevent[]] {
    const nextSprites:Msprite[] = sprites.map(sprite => ({
        ...sprite,
        position:[...sprite.position],
        dposition:[...sprite.dposition],
    }))
    const nextPlayer:player = {
        ...playerState,
        position:[...playerState.position],
        dposition:[...playerState.dposition],
    }
    const nextCamera:camera = { ...cameraState, position:[...cameraState.position] }
    const nextEvents:exevent[] = activeEvents.map(event => ({ ...event }))

    nextPlayer.isSneak = inputs.includes(controls.keys.playerSneak)
    nextPlayer.isRun = inputs.includes(controls.keys.playerRun)

    if(!nextPlayer.isGround){
        nextPlayer.dposition[1] += gravity
    }
    if(inputs.includes(controls.keys.playerJump) && nextPlayer.isGround){
        nextPlayer.dposition[1] = -10
        nextPlayer.isGround = false
    }

    const move = nextPlayer.isRun ? 5 : 3
    nextPlayer.dposition[0] = inputs.includes(controls.keys.playerLeft) ? -move :
        inputs.includes(controls.keys.playerRight) ? move : 0

    const movedPlayer = clampActorToGround(initCollidedPosition(playerToMsprite(nextPlayer), nextSprites), ground)
    nextPlayer.position = [...movedPlayer.position]
    nextPlayer.dposition = [...movedPlayer.dposition]
    nextPlayer.isGround = movedPlayer.isGround

    nextSprites.forEach((sprite, spriteIndex) => {
        if(sprite.isGravity){
            if(!sprite.isGround) sprite.dposition[1] += gravity
        }
        const collisionPeers = nextSprites.filter((_, index) => index !== spriteIndex)
        collisionPeers.push(playerToMsprite(nextPlayer))
        const movedSprite = initCollidedPosition(sprite, collisionPeers)
        nextSprites[spriteIndex] = sprite.isGravity ? clampActorToGround(movedSprite, ground) : movedSprite
    })

    const actors = [...nextSprites, playerToMsprite(nextPlayer)]
    actors.forEach(actor => {
        if(actor.tags.includes(nextCamera.follow)){
            nextCamera.position = [...actor.position]
        }
    })
    return [nextSprites, nextPlayer, nextCamera, nextEvents]
}
