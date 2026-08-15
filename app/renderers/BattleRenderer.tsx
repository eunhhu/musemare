import { extend } from '@pixi/react'
import * as PIXI from 'pixi.js'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { PixiAssetSprite } from '../components/PixiAssetSprite'
import { ResponsivePixiApplication } from '../components/ResponsivePixiApplication'
import type { battleRenderData, drawer, ease, eventValue, filterType, obj } from '../data/types'
import { Easing, calcEventColor, calcEventValue, enableFilters, getPos, parseHex } from '../data/utils'
import { resolveObjectBpmAt, type JudgementState, type NoteId } from '../logic/battleDomain'
import {
    getJudgementFeedbackFrame,
    getRecentJudgementsForObject,
    judgementFeedbackVisuals,
    type JudgementFeedbackFrame,
    type JudgementFeedbackVisual,
} from '../logic/battleFeedback'
import { BattleFilterRegistry } from '../logic/battleFilters'
import { evaluateWiggle } from '../logic/wiggle'

extend({
    Container: PIXI.Container,
    Graphics: PIXI.Graphics,
    Sprite: PIXI.Sprite,
    Text: PIXI.Text,
})

const chartJudgementX = -200

const judgementTextStyles = Object.fromEntries(Object.entries(judgementFeedbackVisuals).map(([judge, visual]) => [
    judge,
    new PIXI.TextStyle({
        align:'center',
        fontFamily:['Inter', 'Arial Black', 'Arial', 'sans-serif'],
        fontSize:30,
        fontWeight:'900',
        letterSpacing:1.8,
        fill:visual.color,
        padding:8,
        stroke:{ color:0x080b10, width:5, join:'round' },
        dropShadow:{ color:0x000000, alpha:0.72, blur:4, distance:3, angle:Math.PI / 2 },
    }),
])) as Record<keyof typeof judgementFeedbackVisuals, PIXI.TextStyle>

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
    graphics.rect(chartJudgementX + line / 2, -25, line, 50).fill(parseHex(judgementColor))

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

        const x = chartJudgementX + 450 * timing + line
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

function feedbackSeed(noteId:NoteId) {
    return noteId.split(':').reduce((seed, part) => seed * 31 + Number(part), 17)
}

function drawJudgementImpact(
    graphics:PIXI.Graphics,
    noteId:NoteId,
    frame:JudgementFeedbackFrame,
    visual:JudgementFeedbackVisual,
) {
    graphics.clear()
    const alpha = frame.impactAlpha * visual.strength
    const strokeWidth = Math.max(1.25, 4.5 * (1 - frame.progress))

    graphics
        .circle(chartJudgementX, 0, frame.ringRadius)
        .stroke({ color:visual.color, width:strokeWidth, alpha })
        .circle(chartJudgementX, 0, frame.ringRadius * 0.62)
        .stroke({ color:0xffffff, width:Math.max(1, strokeWidth * 0.45), alpha:alpha * 0.7 })
        .circle(chartJudgementX, 0, Math.max(2, 8 * (1 - frame.progress)))
        .fill({ color:visual.color, alpha:Math.min(1, alpha * 1.35) })
        .rect(chartJudgementX - 2.5, -30, 5, 60)
        .fill({ color:visual.color, alpha:alpha * 0.42 })

    const seedAngle = feedbackSeed(noteId) * 0.37
    for (let particle = 0; particle < visual.particleCount; particle += 1) {
        const angle = seedAngle + particle / visual.particleCount * Math.PI * 2
        const distance = frame.particleDistance * (0.78 + particle % 3 * 0.12)
        const radius = Math.max(0.8, (3.4 - particle % 2 * 0.7) * (1 - frame.progress * 0.72))
        graphics
            .circle(
                chartJudgementX + Math.cos(angle) * distance,
                Math.sin(angle) * distance,
                radius,
            )
            .fill({ color:particle % 3 === 0 ? 0xffffff : visual.color, alpha:alpha * 0.95 })
    }

    if (visual.label === 'MISS') {
        const crossRadius = 9 + frame.progress * 7
        graphics
            .moveTo(chartJudgementX - crossRadius, -crossRadius)
            .lineTo(chartJudgementX + crossRadius, crossRadius)
            .moveTo(chartJudgementX + crossRadius, -crossRadius)
            .lineTo(chartJudgementX - crossRadius, crossRadius)
            .stroke({ color:visual.color, width:Math.max(2, strokeWidth), alpha })
    }
}

function renderJudgementFeedback(objectIndex:number, timeline:number, judgements:JudgementState) {
    return getRecentJudgementsForObject(objectIndex, judgements, timeline).map(({ noteId, record }) => {
        const frame = getJudgementFeedbackFrame(record, timeline)
        if (!frame) return null
        const visual = judgementFeedbackVisuals[record.judge]
        return <pixiContainer key={`judgement-${noteId}`}>
            <pixiGraphics draw={graphics => drawJudgementImpact(graphics, noteId, frame, visual)} />
            <pixiText
                text={visual.label}
                style={judgementTextStyles[record.judge]}
                x={chartJudgementX}
                y={frame.textY}
                anchor={0.5}
                scale={{ x:frame.textScale, y:frame.textScale }}
                alpha={frame.textAlpha}
            />
        </pixiContainer>
    })
}

function applyEvents(base: battleRenderData, timeline: number) {
    const activeWiggles = base.events.filter(event => event.type === 'wiggle' && timeline >= event.stamp)
    base.events.forEach(event => {
        if (timeline < event.stamp) {
            return
        }

        if (event.type === 'bgcolor') {
            base.backgroundColor = calcEventColor(timeline, event.stamp, 60 / (event.duration as number), base.backgroundColor, String(event.value ?? base.backgroundColor), event.ease)
        } else if (event.type === 'wiggle') {
            return
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
    activeWiggles.forEach(event => {
        const offset = evaluateWiggle(event, timeline)
        base.position[0] += offset.x
        base.position[1] += offset.y
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
    surfaceLabel?:string
}

export function BattleRenderer({
    timeline,
    stageSize,
    renderData,
    judgements = {},
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
                    return <pixiContainer
                        key={objectIndex}
                        x={objectPosition[0]}
                        y={objectPosition[1]}
                        rotation={object.rotate * Math.PI / 180}
                        scale={{ x: object.scale[0] * globalSize, y: object.scale[1] * globalSize }}
                        alpha={object.opacity}
                        pivot={{ x: object.anchor[0] * 5, y: object.anchor[1] * 0.5 }}
                    >
                        <pixiGraphics draw={graphics => chartDraw(graphics, object, objectIndex, timeline, judgements)} />
                        {renderJudgementFeedback(objectIndex, timeline, judgements)}
                    </pixiContainer>
                }
                return null
            })}
        </BattleSceneContainer>
    </ResponsivePixiApplication>
}
