import { extend } from '@pixi/react'
import * as PIXI from 'pixi.js'
import { PixiAssetSprite } from '../components/PixiAssetSprite'
import { ResponsivePixiApplication } from '../components/ResponsivePixiApplication'
import type { camera, player, Rsprite, text } from '../data/types'
import { getSpriteHitboxBounds, parseHex } from '../data/utils'

extend({
    Container:PIXI.Container,
    Graphics:PIXI.Graphics,
    Sprite:PIXI.Sprite,
    Text:PIXI.Text,
})

export type ExploreRendererProps = {
    stageSize:[number, number]
    sprites:Rsprite[]
    texts:text[]
    player:player
    camera:camera
    backgroundColor:string
    showHitbox?:boolean
    surfaceLabel?:string
}

function Hitbox({ sprite }:{ sprite:Pick<Rsprite, 'position' | 'anchor' | 'width' | 'height' | 'hitbox'> }) {
    return <pixiGraphics draw={graphics => {
        const bounds = getSpriteHitboxBounds(sprite)
        graphics.clear()
        graphics.rect(bounds.left, bounds.top, bounds.width, bounds.height)
            .stroke({ width:1, color:0x00ff00 })
    }} />
}

export function ExploreRenderer({
    stageSize,
    sprites,
    texts,
    player,
    camera,
    backgroundColor,
    showHitbox = false,
    surfaceLabel = 'explore',
}:ExploreRendererProps) {
    const globalSize = Math.max(stageSize[0], stageSize[1]) / 1000

    return <ResponsivePixiApplication
        width={stageSize[0]}
        height={stageSize[1]}
        backgroundColor={backgroundColor}
        label={surfaceLabel}
    >
        <pixiContainer
            pivot={{ x:camera.position[0], y:camera.position[1] }}
            x={stageSize[0] / 2}
            y={stageSize[1] / 2}
            scale={camera.scale * globalSize}
            rotation={camera.rotation * Math.PI / 180}
        >
            {sprites.map((sprite, index) => <pixiContainer key={index}>
                <PixiAssetSprite
                    src={sprite.src || '/assets/object/white.png'}
                    x={sprite.position[0]}
                    y={sprite.position[1]}
                    rotation={sprite.rotation * Math.PI / 180}
                    width={sprite.width}
                    height={sprite.height}
                    alpha={sprite.opacity}
                    anchor={{ x:sprite.anchor[0], y:sprite.anchor[1] }}
                />
                {showHitbox && sprite.showHitbox && <Hitbox sprite={sprite} />}
            </pixiContainer>)}
            {texts.map((label, index) => <pixiText
                key={index}
                text={label.content}
                style={new PIXI.TextStyle({
                    align:'center',
                    fontFamily:'Impact',
                    fontSize:20,
                    fontWeight:label.weight as PIXI.TextStyleFontWeight,
                    fill:parseHex(label.color),
                    fontStyle:'normal',
                })}
                x={label.position[0]}
                y={label.position[1]}
                rotation={label.rotation * Math.PI / 180}
                scale={{ x:label.scale[0], y:label.scale[1] }}
                alpha={label.opacity}
                pivot={{ x:label.anchor[0] * 5 + 230, y:label.anchor[1] * 0.5 + 50 }}
            />)}
            <PixiAssetSprite
                src={player.src || '/assets/object/white.png'}
                x={player.position[0]}
                y={player.position[1]}
                rotation={player.rotation * Math.PI / 180}
                width={player.width}
                height={player.height}
                alpha={player.opacity}
                anchor={{ x:player.anchor[0], y:player.anchor[1] }}
            />
            {showHitbox && player.showHitbox && <Hitbox sprite={player} />}
        </pixiContainer>
    </ResponsivePixiApplication>
}
