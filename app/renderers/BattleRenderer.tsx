import { extend } from '@pixi/react'
import * as PIXI from 'pixi.js'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { PixiAssetSprite } from '../components/PixiAssetSprite'
import { ResponsivePixiApplication } from '../components/ResponsivePixiApplication'
import type { battleRenderData, drawer, ease, eventValue, filterType, obj } from '../data/types'
import { Easing, calcEventColor, calcEventValue, enableFilters, getPos, parseHex } from '../data/utils'
import { resolveObjectBpmAt, type JudgementRecord, type JudgementState, type NoteId } from '../logic/battleDomain'
import { BattleFilterRegistry } from '../logic/battleFilters'

extend({
    Container: PIXI.Container,
    Graphics: PIXI.Graphics,
    Sprite: PIXI.Sprite,
    Text: PIXI.Text,
})

function vectorEventValue(value:eventValue | undefined):[number, number] {
    return Array.isArray(value) ? value : [0, 0]
}

function createRenderFrame(renderData: battleRenderData): battleRenderData {
    return {
        ...renderData,
        position: [...renderData.position],
        filters: { ...renderData.filters },
        objs: renderData.objs.map(object => ({
            ...object,
            position: [...object.position],
            scale: [...object.scale],
            anchor: [...object.anchor],
        })),
    }
}

function chartDraw(
    graphics: PIXI.Graphics,
    object: obj,
    objectIndex: number,
    timeline: number,
    judgements: JudgementState,
) {
    const mainColor = object.mcolor as string
    const judgementColor = object.jcolor as string
    const noteColor = object.ncolor as string
    const drawer = object.drawer as drawer
    const shape = object.shape as string
    const line = object.line as number
    const noteLine = object.nline as number

    graphics.clear()
    graphics.rect(-250 + line / 2, 1 - line / 2, 500, line).fill(parseHex(mainColor))
    graphics.rect(-250 + line / 2, -25, line, 50).fill(parseHex(mainColor))
    graphics.rect(250 - line / 2, -25, line, 50).fill(parseHex(mainColor))
    graphics.rect(-200 + line / 2, -25, line, 50).fill(parseHex(judgementColor))

    object.notes?.forEach((note, noteIndex) => {
        const noteId = `${objectIndex}:${noteIndex}` as NoteId
        if (note.judge !== 'none' || judgements[noteId]) {
            return
        }

        let timing = (note.stamp - timeline) / (240 / (object.bpm as number))
        timing = timing <= 1 && timing >= 0 ? Easing(timing, object.ease as ease) : timing
        if (timing > 1 || timing < -0.1) {
            return
        }

        const x = -200 + 450 * timing + line
        if (shape === 'arc') {
            graphics.circle(x, 0, 25)
        } else {
            graphics.rect(x - 25, -25, 50, 50)
        }

        if (drawer === 'stroke') {
            graphics.stroke({ width: noteLine, color: parseHex(noteColor) })
        } else {
            graphics.fill(parseHex(noteColor))
        }
    })
}

function BattleSceneContainer({
    renderData,
    timeline,
    stageSize,
    children,
}: {
    renderData:battleRenderData
    timeline:number
    stageSize:[number, number]
    children:ReactNode
}) {
    const containerRef = useRef<PIXI.Container>(null)
    const registryRef = useRef<BattleFilterRegistry | null>(null)
    useLayoutEffect(() => {
        const registry = new BattleFilterRegistry()
        const container = containerRef.current
        registryRef.current = registry
        return () => {
            if (container) container.filters = null
            registry.destroy()
            registryRef.current = null
        }
    }, [])
    useLayoutEffect(() => {
        if (containerRef.current && registryRef.current) {
            containerRef.current.filters = registryRef.current.resolve(renderData.filters, timeline)
        }
    })

    return <pixiContainer
        ref={containerRef}
        pivot={{ x:renderData.position[0] / 100 * stageSize[0], y:renderData.position[1] / 100 * stageSize[1] }}
        x={stageSize[0] / 2}
        y={stageSize[1] / 2}
        scale={renderData.scale}
        rotation={renderData.rotate * Math.PI / 180}
    >
        {children}
    </pixiContainer>
}

function latestJudgementForObject(objectIndex: number, judgements: JudgementState) {
    const prefix = `${objectIndex}:`
    return Object.entries(judgements).reduce<JudgementRecord | undefined>((latest, [noteId, record]) => {
        if (!noteId.startsWith(prefix) || (latest && latest.hit >= record.hit)) {
            return latest
        }
        return record
    }, undefined)
}

function renderJudgement(
    object: obj,
    objectIndex: number,
    timeline: number,
    stageSize: [number, number],
    judgements: JudgementState,
) {
    if (object.type !== 'chart' || !object.visible) {
        return null
    }

    const judgement = latestJudgementForObject(objectIndex, judgements)
    if (!judgement || timeline - judgement.hit >= 0.5) {
        return null
    }

    const fill = judgement.judge === 'perfect'
        ? 0x33ff00
        : judgement.judge === 'great'
            ? 0x44ddff
            : judgement.judge === 'good'
                ? 0xdddd00
                : judgement.judge === 'bad'
                    ? 0xff8800
                    : 0xdd0000
    const position = getPos(object.position, stageSize)

    return <pixiText
        key={objectIndex}
        text={judgement.judge.toUpperCase()}
        style={new PIXI.TextStyle({
            align: 'center',
            fontFamily: 'Arial',
            fontSize: 20,
            fontWeight: '700',
            letterSpacing: 1,
            fill,
            fontStyle: 'normal',
        })}
        x={position[0]}
        y={position[1]}
        rotation={object.rotate * Math.PI / 180}
        scale={{ x: object.scale[0], y: object.scale[1] }}
        alpha={object.opacity}
        pivot={{ x: object.anchor[0] * 5 + 230, y: object.anchor[1] * 0.5 + 50 }}
    />
}

function applyEvents(base: battleRenderData, timeline: number) {
    base.events.forEach(event => {
        if (timeline < event.stamp) {
            return
        }

        if (event.type === 'bgcolor') {
            base.backgroundColor = calcEventColor(timeline, event.stamp, 60 / (event.duration as number), base.backgroundColor, String(event.value ?? base.backgroundColor), event.ease)
        } else if (event.type === 'wiggle') {
            if (timeline >= event.stamp + 60 / (event.duration as number)) return
            const elapsed = timeline - event.stamp
            const speed = 1 / Number(event.speed)
            const step = (elapsed % speed) * (1 / speed)
            const phase = Math.round(elapsed / (speed / 10)) % 4
            const direction = phase >= 2 ? -1 : 1
            const offset = phase % 2 === 0 ? step : 1 - step
            const smoothing = event.smooth ? 1 - elapsed / (60 / (event.duration as number)) : 1
            base.position[1] += offset * direction * smoothing * (Number(event.value) / 10)
        } else if (event.type === 'rotate') {
            base.rotate = calcEventValue(timeline, event.stamp, 60 / (event.duration as number), base.rotate, Number(event.value), event.ease)
        } else if (event.type === 'scale') {
            base.scale = calcEventValue(timeline, event.stamp, 60 / (event.duration as number), base.scale, Number(event.value), event.ease)
        } else if (event.type === 'position') {
            const value = vectorEventValue(event.value)
            base.position[0] = calcEventValue(timeline, event.stamp, 60 / (event.duration as number), base.position[0], Number(value[0]), event.ease)
            base.position[1] = calcEventValue(timeline, event.stamp, 60 / (event.duration as number), base.position[1], Number(value[1]), event.ease)
        } else if (event.type === 'filter') {
            const filter = event.filter as filterType
            if (enableFilters.includes(filter)) {
                base.filters[filter] = event.value !== 0 ? 1 : 0
            } else {
                base.filters[filter] = calcEventValue(timeline, event.stamp, 60 / (event.duration as number), base.filters[filter], Number(event.value) / 100, event.ease)
            }
        }
    })

    base.objs.forEach(object => {
        const effectiveBpm = object.type === 'chart' ? resolveObjectBpmAt(object, timeline) : undefined
        object.events.forEach(event => {
            if (timeline < event.stamp) {
                return
            }

            if (event.type === 'bpm') {
                return
            }
            if (event.type === 'opacity' || event.type === 'rotate' || event.type === 'line' || event.type === 'nline') {
                object[event.type] = calcEventValue(timeline, event.stamp, 60 / (event.duration as number), object[event.type] as number, Number(event.value), event.ease)
            } else if (event.type === 'position' || event.type === 'anchor' || event.type === 'scale') {
                const current = object[event.type]
                const value = vectorEventValue(event.value)
                current[0] = calcEventValue(timeline, event.stamp, 60 / (event.duration as number), current[0], Number(value[0]), event.ease)
                current[1] = calcEventValue(timeline, event.stamp, 60 / (event.duration as number), current[1], Number(value[1]), event.ease)
            } else if (event.type === 'mcolor' || event.type === 'jcolor' || event.type === 'ncolor') {
                object[event.type] = calcEventColor(timeline, event.stamp, 60 / (event.duration as number), object[event.type] as string, String(event.value ?? object[event.type]), event.ease)
            } else if (event.type === 'visible') object.visible = Boolean(event.value)
            else if (event.type === 'ease' && typeof event.value === 'string') object.ease = event.value as ease
            else if (event.type === 'drawer' && typeof event.value === 'string') object.drawer = event.value as drawer
            else if (event.type === 'shape' && typeof event.value === 'string') object.shape = event.value
            else if (event.type === 'change' && typeof event.value === 'string') object.src = event.value
        })
        if (effectiveBpm !== undefined) object.bpm = effectiveBpm
    })
}

export type BattleRendererProps = {
    timeline:number
    stageSize:[number, number]
    renderData:battleRenderData
    judgements?:JudgementState
    playing?:boolean
    surfaceLabel?:string
}

export function BattleRenderer({
    timeline,
    stageSize,
    renderData,
    judgements = {},
    playing = false,
    surfaceLabel = 'battle',
}:BattleRendererProps) {
    const base = createRenderFrame(renderData)
    applyEvents(base, timeline)

    const globalSize = Math.max(stageSize[0], stageSize[1]) / 1000
    return <ResponsivePixiApplication
        width={stageSize[0]}
        height={stageSize[1]}
        backgroundColor={base.backgroundColor}
        label={surfaceLabel}
    >
        <pixiGraphics draw={graphics => {
            graphics.clear().rect(0, 0, stageSize[0], stageSize[1]).fill(parseHex(base.backgroundColor))
        }}/>
        <BattleSceneContainer
            renderData={base}
            timeline={timeline}
            stageSize={stageSize}
        >
            {base.objs.map((object, objectIndex) => {
                const objectPosition = getPos(object.position, stageSize)
                const anchor = { x: (object.anchor[0] + 50) / 100, y: (object.anchor[1] + 50) / 100 }
                if (object.type === 'sprite' && object.visible) {
                    return <PixiAssetSprite
                        key={objectIndex}
                        src={object.src || '/assets/object/white.png'}
                        x={objectPosition[0]}
                        y={objectPosition[1]}
                        rotation={object.rotate * Math.PI / 180}
                        scale={{ x: object.scale[0] * globalSize, y: object.scale[1] * globalSize }}
                        alpha={object.opacity}
                        anchor={anchor}
                    />
                }
                if (object.type === 'chart' && object.visible) {
                    return <pixiGraphics
                        key={objectIndex}
                        draw={graphics => chartDraw(graphics, object, objectIndex, timeline, judgements)}
                        x={objectPosition[0]}
                        y={objectPosition[1]}
                        rotation={object.rotate * Math.PI / 180}
                        scale={{ x: object.scale[0] * globalSize, y: object.scale[1] * globalSize }}
                        alpha={object.opacity}
                        pivot={{ x: object.anchor[0] * 5, y: object.anchor[1] * 0.5 }}
                    />
                }
                return null
            })}
            {playing && base.objs.map((object, objectIndex) => (
                renderJudgement(object, objectIndex, timeline, stageSize, judgements)
            ))}
        </BattleSceneContainer>
    </ResponsivePixiApplication>
}
