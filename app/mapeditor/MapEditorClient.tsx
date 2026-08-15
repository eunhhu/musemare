import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
    type ChangeEvent,
} from "react"
import { useRuntimeRoute } from '../components/RuntimeStatus'
import { gameConfig } from '../config/gameConfig'
import type { Msprite, camera, env, exevent, map, mevent, player, text } from "../data/types"
import { stepExploreSimulation } from '../logic/exploreDomain'
import { ExploreRenderer } from '../renderers/ExploreRenderer'
import { MsArrToRsArr } from "../data/utils"
import { useFixedStepAnimation } from '../hooks/useFixedStepAnimation'
import { useHeldKeys } from '../hooks/useHeldKeys'
import { useSynchronizedState } from '../hooks/useSynchronizedState'
import { useWindowSize } from "../hooks/useWindowSize"
import { clientPointToWorld, normalizeDragRectangle, updateEventTarget } from '../logic/mapEditorDomain'
import { parseMapJson } from '../logic/contentValidation'

const editorEnv:env = {keys:{
    playerLeft:'KeyA',
    playerRight:'KeyD',
    playerJump:'Space',
    playerRun:'ShiftLeft',
    playerSneak:'ControlLeft',
    interaction:'KeyF',
    escape:'Escape',
}}

export default function Page(){
    const { width, height } = useWindowSize()
    const [focusing, setFocusing] = useState<number>(-1)
    const [evText, setEvText] = useState<string>('')
    const [sizing, setSizing] = useState<boolean>(false)
    const [isEventMapOpen, setIsEventMapOpen] = useState<boolean>(false)
    const [focusingEvent, setFocusingEvent] = useState<number>(-1)
    const [importError, setImportError] = useState<string | null>(null)

    const [_activeEvents, setActiveEvents, activeEventsRef] = useSynchronizedState<exevent[]>([])
    const [sprites, setSprites, spritesRef] = useSynchronizedState<Msprite[]>([])
    const [texts, setTexts] = useState<text[]>([])
    const [gravity, setGravity] = useState<number>(gameConfig.defaultGravity)
    const [ground, setGround] = useState<number>(gameConfig.defaultGround)
    const [player, setPlayer, playerRef] = useSynchronizedState<player>(gameConfig.defaultPlayer)
    const [camera, setCamera, cameraRef] = useSynchronizedState<camera>(gameConfig.defaultCamera)
    const [backgroundColor, setBackgroundColor] = useState<string>(gameConfig.black)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const inputsRef = useHeldKeys()
    const interactionRef = useRef({
        mode:null as 'move' | 'resize' | null,
        pointerId:-1,
        canvas:null as HTMLCanvasElement | null,
        spriteIndex:-1,
        start:[0, 0] as [number, number],
        offset:[0, 0] as [number, number],
    })
    useRuntimeRoute('map-editor')

    useFixedStepAnimation(steps => {
        let nextSprites = spritesRef.current
        let nextPlayer = playerRef.current
        let nextCamera = cameraRef.current
        let nextEvents = activeEventsRef.current
        for (let step = 0; step < steps; step += 1) {
            const next = stepExploreSimulation(nextSprites, gravity, inputsRef.current, nextEvents, editorEnv, nextPlayer, nextCamera, ground)
            nextSprites = next[0]
            nextPlayer = next[1]
            nextCamera = next[2]
            nextEvents = next[3]
        }
        setSprites(nextSprites)
        setPlayer(nextPlayer)
        setCamera(nextCamera)
        setActiveEvents(nextEvents)
    })

    const openLevel = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
            fileInputRef.current.click()
        }
    }

    const handleMapFile = async (change:ChangeEvent<HTMLInputElement>) => {
        const selectedFile = change.target.files?.[0]
        if (!selectedFile) return
        resetCanvasInteraction(true)

        try {
            const loadedMap = parseMapJson(await selectedFile.text())
            setCamera(loadedMap.camera)
            setGravity(loadedMap.gravity)
            setPlayer(loadedMap.player)
            setSprites(loadedMap.sprites)
            setTexts(loadedMap.texts)
            setBackgroundColor(loadedMap.backgroundColor)
            setGround(loadedMap.ground)
            setActiveEvents([])
            setFocusing(-1)
            setFocusingEvent(-1)
            setIsEventMapOpen(false)
            setEvText('')
            setSizing(false)
            setImportError(null)
        } catch (error) {
            console.warn('Unable to open map JSON.', error)
            setImportError(error instanceof Error ? error.message : 'Unable to open map JSON.')
        }
    }

    const exportLevel = () => {
        const _a = document.createElement('a') as HTMLAnchorElement
        const _map:map = {backgroundColor, camera, gravity, ground, player, sprites, texts}
        _a.download = 'map.json'
        const _blob = new Blob([JSON.stringify(_map)], {type:'application/json'})
        _a.href = URL.createObjectURL(_blob)
        _a.click()
        URL.revokeObjectURL(_a.href)
    }

    const createSprite = () => {
        const newSprite:Msprite = {
            position:[0, 0],
            dposition:[0, 0],
            rotation:0,
            width:100, height:100,
            opacity:1,
            anchor:[0.5, 0.5],
            isGravity:false,
            isGround:false,
            isCollision:true,
            showHitbox:true,
            src:[''],
            srcIdx:0,
            hitbox:[1, 1],
            events:[],
            tags:['sprite'],
        }
        setSprites(current => [...current, newSprite])
    }

    const setPlayerAttr = <K extends keyof player>(key: K, value: player[K]): void => {
        setPlayer(current => ({ ...current, [key]:value }))
    }

    const setMspriteAttr = <K extends keyof Msprite>(key: K, value: Msprite[K], index:number): void => {
        setSprites(current => current.map((sprite, spriteIndex) => spriteIndex === index
            ? { ...sprite, [key]:value }
            : sprite
        ))
    }

    const resetCanvasInteraction = useCallback((cancelSizing:boolean) => {
        const interaction = interactionRef.current
        const canvas = interaction.canvas
        const pointerId = interaction.pointerId
        interaction.mode = null
        interaction.pointerId = -1
        interaction.canvas = null
        interaction.spriteIndex = -1
        if (cancelSizing) setSizing(false)
        if (canvas?.hasPointerCapture(pointerId)) {
            canvas.releasePointerCapture(pointerId)
        }
    }, [])

    const worldPointForEvent = useEffectEvent((event:PointerEvent, canvas:HTMLCanvasElement) => (
        clientPointToWorld(
            [event.clientX, event.clientY],
            canvas.getBoundingClientRect(),
            [width * 0.6, height],
            camera,
        )
    ))

    const canvasPointerDown = useEffectEvent((event:PointerEvent) => {
        if (event.button !== 0 || !(event.target instanceof HTMLCanvasElement) || focusing < 0) return
        const focusedSprite = sprites[focusing]
        const worldPoint = worldPointForEvent(event, event.target)
        if (!focusedSprite || !worldPoint) return

        event.preventDefault()
        const interaction = interactionRef.current
        interaction.mode = sizing ? 'resize' : 'move'
        interaction.pointerId = event.pointerId
        interaction.canvas = event.target
        interaction.spriteIndex = focusing
        interaction.start = worldPoint
        interaction.offset = [
            worldPoint[0] - focusedSprite.position[0],
            worldPoint[1] - focusedSprite.position[1],
        ]
        event.target.setPointerCapture(event.pointerId)
    })

    const canvasPointerMove = useEffectEvent((event:PointerEvent) => {
        const interaction = interactionRef.current
        if (interaction.mode !== 'move' || event.pointerId !== interaction.pointerId || !interaction.canvas) return
        const worldPoint = worldPointForEvent(event, interaction.canvas)
        if (!worldPoint) return
        setMspriteAttr('position', [
            worldPoint[0] - interaction.offset[0],
            worldPoint[1] - interaction.offset[1],
        ], interaction.spriteIndex)
    })

    const canvasPointerUp = useEffectEvent((event:PointerEvent) => {
        const interaction = interactionRef.current
        if (!interaction.mode || event.pointerId !== interaction.pointerId || !interaction.canvas) return
        const worldPoint = worldPointForEvent(event, interaction.canvas)

        if (interaction.mode === 'resize' && worldPoint) {
            const rectangle = normalizeDragRectangle(interaction.start, worldPoint)
            if (rectangle) {
                setSprites(current => current.map((sprite, index) => index === interaction.spriteIndex ? {
                    ...sprite,
                    position:[
                        rectangle.x + sprite.anchor[0] * rectangle.width,
                        rectangle.y + sprite.anchor[1] * rectangle.height,
                    ],
                    width:rectangle.width,
                    height:rectangle.height,
                } : sprite))
            }
        } else if (interaction.mode === 'move' && worldPoint) {
            setMspriteAttr('position', [
                worldPoint[0] - interaction.offset[0],
                worldPoint[1] - interaction.offset[1],
            ], interaction.spriteIndex)
        }
        resetCanvasInteraction(interaction.mode === 'resize')
    })

    const cancelPointerInteraction = useEffectEvent((event:PointerEvent) => {
        if (event.pointerId !== interactionRef.current.pointerId) return
        resetCanvasInteraction(true)
    })

    const cancelForWindowState = useEffectEvent(() => {
        resetCanvasInteraction(true)
    })

    useEffect(() => {
        const visibilityChange = () => {
            if (document.visibilityState !== 'visible') cancelForWindowState()
        }
        document.addEventListener('pointerdown', canvasPointerDown)
        document.addEventListener('pointermove', canvasPointerMove)
        document.addEventListener('pointerup', canvasPointerUp)
        document.addEventListener('pointercancel', cancelPointerInteraction)
        document.addEventListener('lostpointercapture', cancelPointerInteraction)
        document.addEventListener('visibilitychange', visibilityChange)
        window.addEventListener('blur', cancelForWindowState)
        return () => {
            document.removeEventListener('pointerdown', canvasPointerDown)
            document.removeEventListener('pointermove', canvasPointerMove)
            document.removeEventListener('pointerup', canvasPointerUp)
            document.removeEventListener('pointercancel', cancelPointerInteraction)
            document.removeEventListener('lostpointercapture', cancelPointerInteraction)
            document.removeEventListener('visibilitychange', visibilityChange)
            window.removeEventListener('blur', cancelForWindowState)
            cancelForWindowState()
        }
    }, [])

    const openEventMap = () => {
        setFocusingEvent(focusing)
        setIsEventMapOpen(true)
    }

    const createEventMap = (_v:mevent, _i:number) => {
        const updateTarget = (rawTarget:string) => {
            if (focusingEvent === -1) {
                setPlayer(current => ({
                    ...current,
                    events:updateEventTarget(current.events, _i, rawTarget),
                }))
            } else {
                setSprites(current => current.map((sprite, spriteIndex) => spriteIndex === focusingEvent
                    ? { ...sprite, events:updateEventTarget(sprite.events, _i, rawTarget) }
                    : sprite
                ))
            }
        }
        return <details key={_i}>
            <summary>
                <div>{_v.eventName}</div>
                <input aria-label={`Event ${_i + 1} target`} type="text" value={_v.target} onChange={e => updateTarget(e.target.value)}/>
            </summary>
        </details>
    }

    return <div className="MapEditor">
        {importError && <div className="import-error" role="alert">Map import rejected: {importError}</div>}
        <div>
            <div>
                <button onClick={() => {openLevel()}}>Open Map</button>
                <button onClick={() => {exportLevel()}}>Save Map</button>
            </div>
            <div>
                <label>Gravity</label>
                <input type="number" value={gravity} onChange={(e) => {setGravity(Number(e.target.value))}} />
            </div>
            <div>
                <label>BackgroundColor</label>
                <input type="color" value={backgroundColor} onChange={(e) => {setBackgroundColor(e.target.value)}} />
            </div>
            <div>
                <label>Ground</label>
                <input type="number" value={ground} onChange={(e) => {setGround(Number(e.target.value))}} />
            </div>
            <hr />
            <div>
                <label>Position</label>
                <input aria-label="Camera position X" type="number" value={camera.position[0]} onChange={(e) => {setCamera({position:[Number(e.target.value), camera.position[1]], rotation:camera.rotation, scale:camera.scale, follow:camera.follow})}} />
                <input aria-label="Camera position Y" type="number" value={camera.position[1]} onChange={(e) => {setCamera({position:[camera.position[0], Number(e.target.value)], rotation:camera.rotation, scale:camera.scale, follow:camera.follow})}} />
            </div>
            <div>
                <label>Rotation</label>
                <input aria-label="Camera rotation" type="number" value={camera.rotation} onChange={(e) => {setCamera({position:camera.position, rotation:Number(e.target.value), scale:camera.scale, follow:camera.follow})}} />
            </div>
            <div>
                <label>Scale</label>
                <input aria-label="Camera scale" type="number" value={camera.scale} onChange={(e) => {setCamera({position:camera.position, rotation:camera.rotation, scale:Number(e.target.value), follow:camera.follow})}} />
            </div>
            <div>
                <label>Follow</label>
                <input type="text" value={camera.follow} onChange={(e) => {setCamera({position:camera.position, rotation:camera.rotation, scale:camera.scale, follow:e.target.value})}} />
            </div>
            <hr />
            <button onClick={() => {createSprite()}}>Create Sprite</button>
            <div className={focusing == -1 ? "select" : ""} onClick={() => {setFocusing(-1);setEvText("")}}>player</div>
            {sprites.map((_v, _i) => (
                <div onClick={() => {setFocusing(_i);setEvText("")}} key={_i} className={focusing == _i ? "select" : ""}>
                    {_v.tags.join(' ')}
                </div>
            ))}
        </div>
        <ExploreRenderer
            stageSize={[width * 0.6, height]}
            sprites={MsArrToRsArr(sprites)}
            texts={texts}
            player={player}
            camera={camera}
            backgroundColor={backgroundColor}
            showHitbox={true}
            surfaceLabel="map-editor"
        />
        <div>
            {focusing == -1 ? <>
                <div>
                    <label>Position</label>
                    <input type="number" value={player.position[0]} onChange={(e) => {setPlayerAttr('position', [Number(e.target.value), player.position[1]])}} />
                    <input type="number" value={player.position[1]} onChange={(e) => {setPlayerAttr('position', [player.position[0], Number(e.target.value)])}} />
                </div>
                <div>
                    <label>Rotation</label>
                    <input type="number" value={player.rotation} onChange={(e) => {setPlayerAttr('rotation', Number(e.target.value))}} />
                </div>
                <div>
                    <label>Width</label>
                    <input type="number" value={player.width} onChange={(e) => {setPlayerAttr('width', Number(e.target.value))}} />
                </div>
                <div>
                    <label>Height</label>
                    <input type="number" value={player.height} onChange={(e) => {setPlayerAttr('height', Number(e.target.value))}} />
                </div>
                <div>
                    <label>Opacity</label>
                    <input type="number" value={player.opacity} onChange={(e) => {setPlayerAttr('opacity', Number(e.target.value))}} />
                </div>
                <div>
                    <label>Anchor</label>
                    <input type="number" value={player.anchor[0]} onChange={(e) => {setPlayerAttr('anchor', [Number(e.target.value), player.anchor[1]])}} />
                    <input type="number" value={player.anchor[1]} onChange={(e) => {setPlayerAttr('anchor', [player.anchor[0], Number(e.target.value)])}} />
                </div>
                <div>
                    <label>Src</label>
                    <input type="text" value={player.src} onChange={(e) => {setPlayerAttr('src', e.target.value)}} />
                </div>
                <div>
                    <label>JumpSrc</label>
                    <input type="text" value={player.jumpSrc} onChange={(e) => {setPlayerAttr('jumpSrc', e.target.value)}} />
                </div>
                <div>
                    <label>SneakSrc</label>
                    <input type="text" value={player.sneakSrc} onChange={(e) => {setPlayerAttr('sneakSrc', e.target.value)}} />
                </div>
                <div>
                    <label>SneakWalkSrc</label>
                    <input type="text" value={player.sneakWalkSrc.join(' ')} onChange={(e) => {setPlayerAttr('sneakWalkSrc', e.target.value.split(' '))}} />
                </div>
                <div>
                    <label>WalkSrc</label>
                    <input type="text" value={player.walkSrc.join(' ')} onChange={(e) => {setPlayerAttr('walkSrc', e.target.value.split(' '))}} />
                </div>
                <div>
                    <label>RunSrc</label>
                    <input type="text" value={player.runSrc.join(' ')} onChange={(e) => {setPlayerAttr('runSrc', e.target.value.split(' '))}} />
                </div>
                <div>
                    <label>Hitbox</label>
                    <input type="number" value={player.hitbox[0]} onChange={(e) => {setPlayerAttr('hitbox', [Number(e.target.value), player.hitbox[1]])}} />
                    <input type="number" value={player.hitbox[1]} onChange={(e) => {setPlayerAttr('hitbox', [player.hitbox[0], Number(e.target.value)])}} />
                </div>
                <div>
                    <label>Events</label>
                    <textarea value={evText} onChange={e => setEvText(e.target.value)} onKeyDown={e => {
                        if(e.code == 'Enter'){
                            try{
                                const _ar:mevent[] = JSON.parse(evText)
                                setPlayerAttr('events', _ar)
                            } catch(_error){
                                setEvText(JSON.stringify(player.events))
                            }
                        }
                    }} onFocus={() => {
                        setEvText(JSON.stringify(player.events))
                    }}></textarea>
                    <button onClick={openEventMap}>Event Map</button>
                </div>
                <div>
                    <label>Tags</label>
                    <input type="text" value={player.tags.join(' ')} onChange={(e) => {setPlayerAttr('tags', e.target.value.split(' '))}} />
                </div>
                <div>
                    <label>showHitbox</label>
                    <input type="checkbox" checked={player.showHitbox} onChange={(e) => {setPlayerAttr('showHitbox', e.target.checked)}} />
                </div>
            </> : <>
                <div>
                    <label>Position</label>
                    <input aria-label="Sprite position X" type="number" value={sprites[focusing].position[0]} onChange={(e) => {setMspriteAttr('position', [Number(e.target.value), sprites[focusing].position[1]], focusing)}} />
                    <input aria-label="Sprite position Y" type="number" value={sprites[focusing].position[1]} onChange={(e) => {setMspriteAttr('position', [sprites[focusing].position[0], Number(e.target.value)], focusing)}} />
                </div>
                <div>
                    <label>Rotation</label>
                    <input type="number" value={sprites[focusing].rotation} onChange={(e) => {setMspriteAttr('rotation', Number(e.target.value), focusing)}} />
                </div>
                <div>
                    <label>Width</label>
                    <input aria-label="Sprite width" type="number" value={sprites[focusing].width} onChange={(e) => {setMspriteAttr('width', Number(e.target.value), focusing)}} />
                </div>
                <div>
                    <label>Height</label>
                    <input aria-label="Sprite height" type="number" value={sprites[focusing].height} onChange={(e) => {setMspriteAttr('height', Number(e.target.value), focusing)}} />
                </div>
                <div>
                    <label>Opacity</label>
                    <input type="number" value={sprites[focusing].opacity} onChange={(e) => {setMspriteAttr('opacity', Number(e.target.value), focusing)}} />
                </div>
                <div>
                    <label>Anchor</label>
                    <input type="number" value={sprites[focusing].anchor[0]} onChange={(e) => {setMspriteAttr('anchor', [Number(e.target.value), sprites[focusing].anchor[1]], focusing)}} />
                    <input type="number" value={sprites[focusing].anchor[1]} onChange={(e) => {setMspriteAttr('anchor', [sprites[focusing].anchor[0], Number(e.target.value)], focusing)}} />
                </div>
                <div>
                    <label>Src</label>
                    <input type="text" value={sprites[focusing].src.join(' ')} onChange={(e) => {setMspriteAttr('src', e.target.value.split(' '), focusing)}} />
                </div>
                <div>
                    <label>srcIdx</label>
                    <input type="number" value={sprites[focusing].srcIdx} onChange={(e) => {setMspriteAttr('srcIdx', Number(e.target.value), focusing)}} />
                </div>
                <div>
                    <label>Hitbox</label>
                    <input type="number" value={sprites[focusing].hitbox[0]} onChange={(e) => {setMspriteAttr('hitbox', [Number(e.target.value), sprites[focusing].hitbox[1]], focusing)}} />
                    <input type="number" value={sprites[focusing].hitbox[1]} onChange={(e) => {setMspriteAttr('hitbox', [sprites[focusing].hitbox[0], Number(e.target.value)], focusing)}} />
                </div>
                <div>
                    <label>Events</label>
                    <textarea value={evText} onChange={e => setEvText(e.target.value)} onKeyDown={e => {
                        if(e.code == 'Enter'){
                            try{
                                const _ar:mevent[] = JSON.parse(evText)
                                setMspriteAttr('events', _ar, focusing)
                            } catch(_error){
                                setEvText(JSON.stringify(sprites[focusing].events))
                            }
                        }
                    }} onFocus={() => {
                        setEvText(JSON.stringify(sprites[focusing].events))
                    }}></textarea>
                    <button onClick={openEventMap}>Event Map</button>
                </div>
                <div>
                    <label>Tags</label>
                    <input type="text" value={sprites[focusing].tags.join(' ')} onChange={(e) => {setMspriteAttr('tags', e.target.value.split(' '), focusing)}} />
                </div>
                <div>
                    <label>isGravity</label>
                    <input type="checkbox" checked={sprites[focusing].isGravity} onChange={(e) => {setMspriteAttr('isGravity', e.target.checked, focusing)}} />
                </div>
                <div>
                    <label>isCollision</label>
                    <input type="checkbox" checked={sprites[focusing].isCollision} onChange={(e) => {setMspriteAttr('isCollision', e.target.checked, focusing)}} />
                </div>
                <div>
                    <label>showHitbox</label>
                    <input type="checkbox" checked={sprites[focusing].showHitbox} onChange={(e) => {setMspriteAttr('showHitbox', e.target.checked, focusing)}} />
                </div>
                <button onClick={() => {setSizing(true)}}>{sizing ? "Sizing..." : "Set Size"}</button>
            </>}
        </div>
        {isEventMapOpen && <button type="button" aria-label="Close event map" className="back" onMouseDown={() => setIsEventMapOpen(false)}></button>}
        {isEventMapOpen && <div className="eventmap">{
            focusingEvent == -1 ? player.events.map((_v, _i) => createEventMap(_v, _i)) :
            (sprites[focusingEvent]?.events ?? []).map((_v, _i) => createEventMap(_v, _i))
        }</div>}
        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleMapFile} style={{display:'none'}} />
    </div>
}
