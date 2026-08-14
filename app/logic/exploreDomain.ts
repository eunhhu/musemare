import type { Msprite, camera, env, exevent, player } from '../data/types'
import { initCollidedPosition, playerToMsprite } from '../data/utils'

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

    if(!nextPlayer.isGround){
        nextPlayer.dposition[1] += gravity
    }
    if(!nextPlayer.isGround && nextPlayer.position[1] + nextPlayer.anchor[1] * nextPlayer.height >= ground){
        nextPlayer.dposition[1] = 0
        nextPlayer.position[1] = ground - nextPlayer.anchor[1] * nextPlayer.height
        nextPlayer.isGround = true
    }
    if(inputs.includes(controls.keys.playerJump) && nextPlayer.isGround){
        nextPlayer.dposition[1] = -10
        nextPlayer.isGround = false
    }

    const move = nextPlayer.isRun ? 5 : 3
    nextPlayer.isSneak = inputs.includes(controls.keys.playerSneak)
    nextPlayer.isRun = inputs.includes(controls.keys.playerRun)
    nextPlayer.dposition[0] = inputs.includes(controls.keys.playerLeft) ? -move :
        inputs.includes(controls.keys.playerRight) ? move : 0

    const movedPlayer = initCollidedPosition(playerToMsprite(nextPlayer), nextSprites)
    nextPlayer.position = [...movedPlayer.position]
    nextPlayer.dposition = [...movedPlayer.dposition]
    nextPlayer.isGround = movedPlayer.isGround

    nextSprites.forEach((sprite, spriteIndex) => {
        if(sprite.isGravity){
            if(!sprite.isGround) sprite.dposition[1] += gravity
            if(!sprite.isGround && sprite.position[1] + sprite.anchor[1] * sprite.height >= ground){
                sprite.dposition[1] = 0
                sprite.position[1] = ground - sprite.anchor[1] * sprite.height
                sprite.isGround = true
            }
        }
        const collisionPeers = nextSprites.filter((_, index) => index !== spriteIndex)
        collisionPeers.push(playerToMsprite(nextPlayer))
        nextSprites[spriteIndex] = initCollidedPosition(sprite, collisionPeers)
    })

    const actors = [...nextSprites, playerToMsprite(nextPlayer)]
    actors.forEach(actor => {
        if(actor.tags.includes(nextCamera.follow)){
            nextCamera.position = [...actor.position]
        }
    })
    return [nextSprites, nextPlayer, nextCamera, nextEvents]
}
