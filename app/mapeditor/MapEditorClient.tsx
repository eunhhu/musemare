'use client'

import { use, useContext, useEffect, useState } from "react"
import { Msprite, camera, env, event, eventName, exevent, map, mevent, player, playerParams, text } from "../data/types"
import { globalConfig, globalContext } from "../main"
import { useInterval, useWindowSize } from "usehooks-ts"
import { exRender, execute } from "../logic/exploreEngine"
import { MsArrToRsArr, copy } from "../data/utils"
import { defaultConfig } from "next/dist/server/config-shared"

export default function Page(){
    const { width, height } = useWindowSize()
    const {lang, setLang} = useContext(globalContext)
    const [env, setEnv] = useState<env>({keys:{
        playerLeft:'KeyA',
        playerRight:'KeyD',
        playerJump:'Space',
        playerRun:'ShiftLeft',
        playerSneak:'ControlLeft',
        interaction:'KeyF',
        escape:'Escape',
    }})
    const [focusing, setFocusing] = useState<number>(-1)
    const [evText, setEvText] = useState<string>('')
    const [sizing, setSizing] = useState<boolean>(false)
    const [mouseStartPoint, setMouseStartPoint] = useState<[number, number]>([0, 0])
    const [mouseOffsetPoint, setMouseOffsetPoint] = useState<[number, number]>([0, 0])
    const [isMouseDown, setIsMouseDown] = useState<boolean>(false)
    const [isEventMapOpen, setIsEventMapOpen] = useState<boolean>(false)
    const [focusingEvent, setFocusingEvent] = useState<number>(-1)

    const [start, setStart] = useState<boolean>(false)
    const [inputs, setInputs] = useState<string[]>([])
    const [activeEvents, setActiveEvents] = useState<exevent[]>([])
    const [sprites, setSprites] = useState<Msprite[]>([])
    const [texts, setTexts] = useState<text[]>([])
    const [gravity, setGravity] = useState<number>(globalConfig['defaultGravity'])
    const [ground, setGround] = useState<number>(globalConfig['defaultGround'])
    const [canControl, setCanControl] = useState<boolean>(true)
    const [player, setPlayer] = useState<player>(globalConfig['defaultPlayer'])
    const [camera, setCamera] = useState<camera>(globalConfig['defaultCamera'])
    const [backgroundColor, setBackgroundColor] = useState<string>(globalConfig['black'])

    useEffect(() => {
        setStart(true)
    }, [])

    useEffect(() => {
        const keydown = (e:KeyboardEvent) => {addInput(e.code)}
        const keyup = (e:KeyboardEvent) => {remInput(e.code)}
        document.addEventListener('keydown', keydown)
        document.addEventListener('keyup', keyup)
        return () => {
            document.removeEventListener('keydown', keydown)
            document.removeEventListener('keyup', keyup)
        }
    }, [inputs])

    const addInput = (key:string) => {
        let _ar:string[] = copy(inputs)
        if(!_ar.includes(key)) _ar.push(key)
        sendEvent('keydown')
        setInputs(_ar)
    }
    const remInput = (key:string) => {
        let _ar:string[] = copy(inputs)
        let _i:number = _ar.indexOf(key)
        _i != -1 ? _ar.splice(_i, 1) : null
        sendEvent('keyup')
        setInputs(_ar)
    }

    useInterval(() => {
        const _ar = execute(lang, sprites, gravity, inputs, activeEvents, env, player, camera, ground)
        setSprites(_ar[0])
        setPlayer(_ar[1])
        setCamera(_ar[2])
        setActiveEvents(_ar[3])
    }, start ? 10 : null)

    const sendEvent = (eventName:eventName) => {
        player.events.forEach((_v, _i) => {
            if(_v.eventName == eventName){
            }
        })
        sprites.forEach((_v, _i) => {
            _v.events.forEach((_v2, _i2) => {
                if(_v2.eventName == eventName){
                }
            })
        })
    }
    const openLevel = () => {
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        fileInput.click()
    
        fileInput.addEventListener('change', (e) => {
            const selectedFile = (fileInput.files as FileList)[0];

            if (selectedFile) {
                const reader = new FileReader();

                reader.onload = (event) => {
                    const map = JSON.parse(event.target?.result as string) as map;

                    // statement 적용
                    setCamera(map.camera)
                    setGravity(map.gravity)
                    setPlayer(map.player)
                    setSprites(map.sprites)
                    setTexts(map.texts)
                    setBackgroundColor(map.backgroundColor)
                    setGround(map.ground)
                };

                reader.readAsText(selectedFile);
            }
        });
    }

    const exportLevel = () => {
        const _a = document.createElement('a') as HTMLAnchorElement
        let _map:map = {backgroundColor, camera, gravity, ground, player, sprites, texts}
        _a.download = 'map.json'
        let _blob = new Blob([JSON.stringify(_map)], {type:'application/json'})
        _a.href = URL.createObjectURL(_blob)
        _a.click()
    }

    const createSprite = () => {
        let _ar:Msprite[] = copy(sprites)
        _ar.push({
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
        })
        setSprites(_ar)
    }

    const setPlayerAttr = <K extends keyof player>(key: K, value: player[K]): void => {
        let _player: player = copy(player)
        _player[key] = value
        setPlayer(_player)
    }

    const setMspriteAttr = <K extends keyof Msprite>(key: K, value: Msprite[K], index:number): void => {
        let _ar:Msprite[] = copy(sprites)
        _ar[index][key] = value
        setSprites(_ar)
    }

    const setCameraAttr = <K extends keyof camera>(key: K, value: camera[K]): void => {
        let _camera: camera = copy(camera)
        _camera[key] = value
        setCamera(_camera)
    }

    // resize msprite    
    useEffect(() => {
        const canvas:HTMLCanvasElement = document.querySelector('canvas')!
        const mousedown = (e:MouseEvent) => {
            setMouseStartPoint([e.offsetX, e.offsetY])
        }
        const mouseup = (e:MouseEvent) => {
            if(mouseStartPoint[0] != e.offsetX && mouseStartPoint[1] != e.offsetY){
                let _ar:Msprite[] = copy(sprites)
                let _newWidth = e.offsetX - mouseStartPoint[0]
                let _newHeight = e.offsetY - mouseStartPoint[1]
                _ar[focusing].position[0] = mouseStartPoint[0] + _ar[focusing].anchor[0] * _newWidth + camera.position[0] - width/2*0.6
                _ar[focusing].position[1] = mouseStartPoint[1] + _ar[focusing].anchor[1] * _newHeight + camera.position[1] - height/2
                _ar[focusing].width = _newWidth
                _ar[focusing].height = _newHeight
                setSprites(_ar)
                setSizing(false)
            }
        }
        if(sizing){
            canvas.addEventListener('mousedown', mousedown)
            canvas.addEventListener('mouseup', mouseup)
        }
        return () => {
            canvas.removeEventListener('mousedown', mousedown)
            canvas.removeEventListener('mouseup', mouseup)
        }
    }, [sizing, focusing, sprites, mouseStartPoint, camera, width, height])

    // move msprite
    useEffect(() => {
        const canvas:HTMLCanvasElement = document.querySelector('canvas')!
        const mousedown = (e:MouseEvent) => {
            setIsMouseDown(true)
            setMouseOffsetPoint([e.offsetX - sprites[focusing].position[0], e.offsetY - sprites[focusing].position[1]])
        }
        const mousemove = (e:MouseEvent) => {
            if(mouseStartPoint[0] != e.offsetX && mouseStartPoint[1] != e.offsetY && isMouseDown){
                let _ar:Msprite[] = copy(sprites)
                _ar[focusing].position[0] = e.offsetX - mouseOffsetPoint[0]
                _ar[focusing].position[1] = e.offsetY - mouseOffsetPoint[1]
                setSprites(_ar)
            }
        }
        const mouseup = (e:MouseEvent) => {
            if(isMouseDown){
                let _ar:Msprite[] = copy(sprites)
                _ar[focusing].position[0] = e.offsetX - mouseOffsetPoint[0]
                _ar[focusing].position[1] = e.offsetY - mouseOffsetPoint[1]
                setSprites(_ar)
                setIsMouseDown(false)
            }
        }
        if(focusing != -1){
            canvas.addEventListener('mousedown', mousedown)
            canvas.addEventListener('mousemove', mousemove)
            canvas.addEventListener('mouseup', mouseup)
        }
        return () => {
            canvas.removeEventListener('mousedown', mousedown)
            canvas.removeEventListener('mousemove', mousemove)
            canvas.removeEventListener('mouseup', mouseup)
        }
    }, [focusing, sprites, mouseStartPoint, mouseOffsetPoint])

    const openEventMap = () => {
        setFocusingEvent(focusing)
        setIsEventMapOpen(true)
    }

    const createEventMap = (_v:mevent, _i:number) => {
        return <details key={_i}>
            <summary>
                <div>{_v.eventName}</div>
                <input type="text" name="" id="" value={_v.target} onChange={e => e.target.value}/>
            </summary>
        </details>
    }

    return <div className="MapEditor">
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
                <input type="number" value={camera.position[0]} onChange={(e) => {setCamera({position:[Number(e.target.value), camera.position[1]], rotation:camera.rotation, scale:camera.scale, follow:camera.follow})}} />
                <input type="number" value={camera.position[1]} onChange={(e) => {setCamera({position:[camera.position[0], Number(e.target.value)], rotation:camera.rotation, scale:camera.scale, follow:camera.follow})}} />
            </div>
            <div>
                <label>Rotation</label>
                <input type="number" value={camera.rotation} onChange={(e) => {setCamera({position:camera.position, rotation:Number(e.target.value), scale:camera.scale, follow:camera.follow})}} />
            </div>
            <div>
                <label>Scale</label>
                <input type="number" value={camera.scale} onChange={(e) => {setCamera({position:camera.position, rotation:camera.rotation, scale:Number(e.target.value), follow:camera.follow})}} />
            </div>
            <div>
                <label>Follow</label>
                <input type="text" value={camera.follow} onChange={(e) => {setCamera({position:camera.position, rotation:camera.rotation, scale:camera.scale, follow:e.target.value})}} />
            </div>
            <hr />
            <button onClick={e => {createSprite()}}>Create Sprite</button>
            <div className={focusing == -1 ? "select" : ""} onClick={e => {setFocusing(-1);setEvText("")}}>player</div>
            {sprites.map((_v, _i) => (
                <div onClick={e => {setFocusing(_i);setEvText("")}} key={_i} className={focusing == _i ? "select" : ""}>
                    {_v.tags.join(' ')}
                </div>
            ))}
        </div>
        {exRender([width*0.6, height], lang, MsArrToRsArr(sprites), texts, player, camera, backgroundColor, true)}
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
                                let _ar:mevent[] = JSON.parse(evText)
                                setPlayerAttr('events', _ar)
                            } catch(e){
                                setEvText(JSON.stringify(player.events))
                            }
                        }
                    }} onFocus={e => {
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
                    <input type="number" value={sprites[focusing].position[0]} onChange={(e) => {setMspriteAttr('position', [Number(e.target.value), sprites[focusing].position[1]], focusing)}} />
                    <input type="number" value={sprites[focusing].position[1]} onChange={(e) => {setMspriteAttr('position', [sprites[focusing].position[0], Number(e.target.value)], focusing)}} />
                </div>
                <div>
                    <label>Rotation</label>
                    <input type="number" value={sprites[focusing].rotation} onChange={(e) => {setMspriteAttr('rotation', Number(e.target.value), focusing)}} />
                </div>
                <div>
                    <label>Width</label>
                    <input type="number" value={sprites[focusing].width} onChange={(e) => {setMspriteAttr('width', Number(e.target.value), focusing)}} />
                </div>
                <div>
                    <label>Height</label>
                    <input type="number" value={sprites[focusing].height} onChange={(e) => {setMspriteAttr('height', Number(e.target.value), focusing)}} />
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
                                let _ar:mevent[] = JSON.parse(evText)
                                setMspriteAttr('events', _ar, focusing)
                            } catch(e){
                                setEvText(JSON.stringify(sprites[focusing].events))
                            }
                        }
                    }} onFocus={e => {
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
                <button onClick={e => {setSizing(true)}}>{sizing ? "Sizing..." : "Set Size"}</button>
            </>}
        </div>
        {isEventMapOpen && <div className="back" onMouseDown={e => setIsEventMapOpen(false)}></div>}
        {isEventMapOpen && <div className="eventmap">{
            focusing == -1 ? player.events.map((_v, _i) => createEventMap(_v, _i)) :
            sprites[focusingEvent].events.map((_v, _i) => createEventMap(_v, _i))
        }</div>}
        <input type="file" name="" id="fileInput" style={{display:'none'}} />
    </div>
}