import { extend } from "@pixi/react"
import type { camera, player, Rsprite, text } from "../data/types"
import { parseHex } from "../data/utils"
import * as PIXI from 'pixi.js'
import { PixiAssetSprite } from '../components/PixiAssetSprite'
import { ResponsivePixiApplication } from '../components/ResponsivePixiApplication'
import { stepExploreSimulation } from './exploreDomain'

extend({
    Container: PIXI.Container,
    Graphics: PIXI.Graphics,
    Sprite: PIXI.Sprite,
    Text: PIXI.Text,
})

export const exRender = (stageSize:[number, number], lang:string, sprites:Rsprite[], texts:text[], player:player, camera:camera, backgroundColor:string, showHitbox?:boolean, surfaceLabel = 'explore') => {
    const globalSize = Math.max(stageSize[0], stageSize[1])/1000
    return <ResponsivePixiApplication width={stageSize[0]} height={stageSize[1]} backgroundColor={backgroundColor} label={surfaceLabel}>
        <pixiContainer pivot={{ x: camera.position[0], y: camera.position[1] }} x={stageSize[0]/2} y={stageSize[1]/2} scale={camera.scale*globalSize} rotation={camera.rotation*Math.PI/180}>
            {sprites.map((_v, _i) => <pixiContainer key={_i}>
                    <PixiAssetSprite src={_v.src || "/assets/object/white.png"} x={_v.position[0]} y={_v.position[1]} rotation={_v.rotation*Math.PI/180} width={_v.width} height={_v.height} alpha={_v.opacity} anchor={{ x: (_v.anchor[0]+50)/100, y: (_v.anchor[1]+50)/100 }}/>
                    {showHitbox && _v.showHitbox && (
                        <pixiGraphics draw={g => {
                            g.clear()
                            g.rect(_v.position[0] - _v.width * _v.anchor[0], _v.position[1] - _v.height * _v.anchor[1], _v.width, _v.height)
                                .stroke({ width: 1, color: 0x00ff00 })
                        }}/>
                    )}
                </pixiContainer>)}
            {texts.map((_v, _i) => (
                <pixiText key={_i} text={_v.content} style={new PIXI.TextStyle({align:'center', fontFamily:'Impact', fontSize:20, fontWeight:_v.weight as PIXI.TextStyleFontWeight, fill:parseHex(_v.color), fontStyle:'normal'})}
                x={_v.position[0]} y={_v.position[1]} rotation={_v.rotation*Math.PI/180} scale={{ x: _v.scale[0], y: _v.scale[1] }} alpha={_v.opacity} pivot={{ x: _v.anchor[0]*5+230, y: _v.anchor[1]*0.5+50 }}/>
            ))}
            <PixiAssetSprite src={(player.src) || "/assets/object/white.png"} x={player.position[0]} y={player.position[1]} rotation={player.rotation*Math.PI/180} width={player.width} height={player.height} alpha={player.opacity} anchor={{ x: (player.anchor[0]+50)/100, y: (player.anchor[1]+50)/100 }}/>
            {showHitbox && player.showHitbox && (
                <pixiGraphics draw={g => {
                    g.clear()
                    g.rect(player.position[0] - player.width * player.anchor[0], player.position[1] - player.height * player.anchor[1], player.width, player.height)
                        .stroke({ width: 1, color: 0x00ff00 })
                }}/>
            )}
        </pixiContainer>
    </ResponsivePixiApplication>
}

export const execute = (_lang:string, ...args:Parameters<typeof stepExploreSimulation>) => stepExploreSimulation(...args)
