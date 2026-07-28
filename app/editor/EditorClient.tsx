'use client'

import { useEffect, useState } from "react"
import { copy, enableFilters, isInRange, strengthFilters } from "../data/utils"
import { obj, event, level, objEvent, eventProps, objEventProps, filter, filterType } from "../data/types"
import { battleEngine } from "../logic/battleEngine"

// ui 조절 드래그 범위
const dragRange = 6

// 플레이 가능한 키 등록
const playKeys = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'BracketLeft', 'BracketRight', 'Backslash', 'Equal', 'Minus', 'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9']

export default function Page(){
    const [lang, setLang] = useState<string>('en-US')
    // ui settings
    const [underbarLine, setUnderbarLine] = useState<number>(30)
    const [mainsetLine, setMainsetLine] = useState<number>(20)
    const [eventsetLine, setEventsetLine] = useState<number>(20)
    const [objLine, setObjLine] = useState<number>(20)
    const [condset, setCondset] = useState<number[]>([0, 0])
    const [rowScroll, setRowScroll] = useState<number>(0)
    const [colScroll, setColScroll] = useState<number>(0)
    const [stageSize, setStageSize] = useState<[number, number]>([0, 0])

    // default settings
    const [bpm, setBpm] = useState<number>(100)
    const [offset, setOffset] = useState<number>(0)
    const [song, setSong] = useState<string>('')
    const [BackgroundColor, setBackgroundColor] = useState<string>('#000000')
    const [volume, setVolume] = useState<number>(100)
    const [endpoint, setEndpoint] = useState<number>(90)
    const [events, setEvents] = useState<event[]>([])
    const [objs, setObjs] = useState<obj[]>([])
    const [position, setPosition] = useState<[number, number]>([0, 0])
    const [rotate, setRotate] = useState<number>(0)
    const [scale, setScale] = useState<number>(1)
    const [filters, setFilters] = useState<filter>({blur:0, dot:0, motionBlur:0, bloom:0, godray:0, convolution:0, glitch:0, grayscale:0, noise:0, pixelate:0, rgbsplit:0})
    
    // env settings
    const [grid, setGrid] = useState<number>(4)
    const [gridOffset, setGridOffset] = useState<number>(0)
    const [chartOffset, setChartOffset] = useState<number>(0)
    const [playing, setPlaying] = useState<boolean>(false)
    const [zoom, setZoom] = useState<number>(100)
    const [timeline, setTimeline] = useState<number>(0)
    const [gridLine, setGridLine] = useState<number[]>([])
    const [sel, setSel] = useState<'chart'|'sprite'>('chart')
    const [focusEvent, setFocusEvent] = useState<[number, number]>([-1, 0]) // 0 = main | other = obj's idx, index
    const [focusNote, setFocusNote] = useState<[number, number]>([-1, 0]) // obj's idx, index
    const [focusObj, setFocusObj] = useState<number>(0)
    const [focusing, setFocusing] = useState<number>(0) // 0 = obj, 1 = event, 2 = note
    const [evClipboard, setEvClipboard] = useState<event|objEvent>()
    const [hits, setHits] = useState<number[]>([])

    let v_playing:boolean = false, v_zoom:number = 100, v_timeline = 0 // 미등록 자연 변경 변수

    let ubl = 30
    let msl = 20
    let esl = 20
    let obl = 20
    let Dragging = ''
    let cont_dragging = false
    let scrow_dragging = false
    
    useEffect(() => {
        setLang(navigator.language)
        setCondset([innerWidth, innerHeight])

        // const canvas = document.querySelector('canvas') as HTMLCanvasElement
        
        function resizeCanvas(){
            setCondset([innerWidth, innerHeight])
            setStageSize([innerWidth / 100 * (100 - msl - esl), innerHeight / 100 * (100 - ubl)])
        }
        window.onresize = resizeCanvas
        resizeCanvas()

        function keydown(e:KeyboardEvent){
            if(e.altKey){
                e.preventDefault()
            }
        }
        function mouseup(e:MouseEvent){
            Dragging = ''
        }
        function mousedown(e:MouseEvent){
            if(isInRange(e.clientY, dragRange, innerHeight / 100 * (100-ubl))){
                Dragging = 'underbar'
            } else if(isInRange(e.clientX, dragRange, innerWidth / 100 * (msl)) && e.clientY < (innerHeight / 100 * (100-ubl))){
                Dragging = 'mainset'
            } else if(isInRange(e.clientX, dragRange, innerWidth / 100 * (100-esl)) && e.clientY < (innerHeight / 100 * (100-ubl))){
                Dragging = 'eventset'
            } else if(isInRange(e.clientX, dragRange, innerWidth / 100 * (obl)) && e.clientY > (innerHeight / 100 * (100-ubl))){
                Dragging = 'objs'
            }
        }
        function mousemove(e:MouseEvent){
            if(Dragging){
                switch(Dragging){
                    case 'underbar':
                        ubl = 100 - (100 * e.clientY / innerHeight)
                        setUnderbarLine(ubl)
                        break;
                    case 'mainset':
                        msl = (100 * e.clientX / innerWidth)
                        setMainsetLine(msl)
                        break;
                        case 'eventset':
                        esl = 100 - (100 * e.clientX / innerWidth)
                        setEventsetLine(esl)
                        break;
                    case 'objs':
                        obl = (100 * e.clientX / innerWidth)
                        setObjLine(obl)
                        break;
                }
                resizeCanvas()
            } else {
                if(isInRange(e.clientY, dragRange, innerHeight / 100 * (100-ubl))){
                    document.body.style.cursor = 'n-resize'
                } else if(isInRange(e.clientX, dragRange, innerWidth / 100 * (msl)) && e.clientY < (innerHeight / 100 * (100-ubl))){
                    document.body.style.cursor = 'e-resize'
                } else if(isInRange(e.clientX, dragRange, innerWidth / 100 * (100-esl)) && e.clientY < (innerHeight / 100 * (100-ubl))){
                    document.body.style.cursor = 'e-resize'
                } else if(isInRange(e.clientX, dragRange, innerWidth / 100 * (obl)) && e.clientY > (innerHeight / 100 * (100-ubl))){
                    document.body.style.cursor = 'e-resize'
                } else {
                    document.body.style.cursor = 'unset'
                }
            }
        }
        
        function wheel(e:WheelEvent){
            if(e.altKey){
                v_zoom -= (v_zoom/8)*(e.deltaY / 100)
                v_zoom < 1 && (v_zoom = 1)
                setZoom(v_zoom)
            }
        }
        const contextmenu = (e:Event) => {
            e.preventDefault()
        }
        
        document.addEventListener('wheel', wheel)
        document.addEventListener('contextmenu', contextmenu)
        document.addEventListener('mousemove', mousemove)
        document.addEventListener('mousedown', mousedown)
        document.addEventListener('mouseup', mouseup)
        document.addEventListener('keydown', keydown)
        return () => {
            document.removeEventListener('wheel', wheel)
            document.removeEventListener('contextmenu', contextmenu)
            document.removeEventListener('mousemove', mousemove)
            document.removeEventListener('mousedown', mousedown)
            document.removeEventListener('mouseup', mouseup)
            document.removeEventListener('keydown', keydown)
        }
    }, [])
    
    // new 눌렀을때 리셋
    const reset = () => {
        setGrid(4)
        setBpm(100)
        setSong("")
        setOffset(0)
        setBackgroundColor("#000000")
        setVolume(100)
        setEndpoint(90)
        setPlaying(false)
        setZoom(100)
        setRowScroll(0)
        setColScroll(0)
        v_setTimeline(0)
        setEvents([])
        setObjs([])
        setEvClipboard(undefined)
        setFocusEvent([-1, 0])
        setFocusing(0)
        setFocusNote([-1, 0])
        setFocusObj(0)
        v_playing = false
        v_zoom = 0
    }

    const openLevel = () => {
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        fileInput.click()
    
        fileInput.addEventListener('change', (e) => {
            const selectedFile = (fileInput.files as FileList)[0];

            if (selectedFile) {
                const reader = new FileReader();

                reader.onload = (event) => {
                    const level = JSON.parse(event.target?.result as string) as level;

                    // statement 적용
                    setBpm(level.bpm)
                    setOffset(level.offset)
                    setSong(level.song)
                    setBackgroundColor(level.backgroundColor)
                    setVolume(level.volume)
                    setEndpoint(level.endpoint)
                    setObjs(level.objs)
                    setEvents(level.events)
                    setPosition(level.position)
                    setRotate(level.rotate)
                    setScale(level.scale)
                };

                reader.readAsText(selectedFile);
            }
        });
    }

    const exportLevel = () => {
        const _a = document.createElement('a') as HTMLAnchorElement
        let _obj:level = {bpm, events, endpoint, objs, offset, song, volume, backgroundColor:BackgroundColor, position, rotate, scale, filters}
        _a.download = 'level.json'
        let _blob = new Blob([JSON.stringify(_obj)], {type:'application/json'})
        _a.href = URL.createObjectURL(_blob)
        _a.click()
    }

    async function playLevel (){
        const audio = document.querySelector('audio') as HTMLAudioElement
        v_playing = playing
        if(v_playing){
            audio.pause()
            v_playing = false
            setPlaying(v_playing)
        } else {
            await audio.play()
            v_playing = true
            setPlaying(v_playing)
        }
    }

    const v_setTimeline = (e:number) => {
        const audio = document.querySelector('audio') as HTMLAudioElement
        v_timeline = e
        audio.currentTime = v_timeline+offset
        setTimeline(v_timeline)
    }

    // 오디오, 컨트롤바 세팅
    useEffect(() => {
        const controls = document.querySelector('.controls') as HTMLDivElement
        const scrowbar = document.querySelector('.scrollbar-row > div') as HTMLDivElement

        const checkEnd = setInterval(() => {
            const audio = document.querySelector('audio') as HTMLAudioElement
            v_timeline = audio.currentTime - offset
            setTimeline(v_timeline)
            if(v_timeline > endpoint){
                audio.pause()
                audio.currentTime = offset
                v_playing = false
                setPlaying(v_playing)
            }
        }, 1)
        // 마우스 무브 이벤트
        function mousemove(e:MouseEvent){
            if(cont_dragging){
                let res:number = (endpoint * (e.clientX-rowScroll - innerWidth/100*objLine) / (innerWidth/100*(100-objLine)))/(zoom/100)
                if(e.shiftKey){
                    let rz = 5-Math.round(zoom/100)
                    let f = (2**(rz < 1 ? 1 : rz))
                    let gap = (gridLine[1] - gridLine[0]) * f
                    res = Math.round((res-(gridOffset%gap)) / gap) * gap + (gridOffset%gap)
                    res < gridOffset ? res = gridOffset : false
                }
                v_setTimeline(res < 0 ? 0 : res > endpoint ? endpoint : res)
            } else if(scrow_dragging) {
                // scroll logic 드래그 기능이라 무필요
            }
        }
        // 마우스 업 이벤트
        function mouseup(e:MouseEvent){
            cont_dragging = false
            scrow_dragging = false
        }
        // 타임라인 컨트롤바 마우스 다운 감지
        function controls_mousedown(e:MouseEvent){
            if(!Dragging){
                cont_dragging = true
                Dragging = ''
                mousemove(e)
            }
        }
        // 타임라인 스크롤바 마우스 다운 감지
        function scrowbar_mousedown(e:MouseEvent){
            if(!Dragging){
                scrow_dragging = true
                Dragging = ''
                mousemove(e)
            }
        }
        // 타임라인 밑 배생 관련 키 다운
        const keydown = (e:KeyboardEvent) => {
            let isNumlock = e.getModifierState('NumLock') // 넘패드 Home, 넘패드 End 를 감지하기 위한 넘버락 확인불른
            if(e.code == 'Space'){
                playLevel()
            } else if(e.code == 'Home' || (e.code == 'Numpad7' && !isNumlock)){
                v_setTimeline(0)
            } else if(e.code == 'End' || (e.code == 'Numpad1' && !isNumlock)){
                v_setTimeline(endpoint)
            } else if(e.code == 'Backquote'){
                setRowScroll(0)
            }
        }
        scrowbar.addEventListener('mousedown', scrowbar_mousedown)
        controls.addEventListener('mousedown', controls_mousedown)
        document.addEventListener('mouseup', mouseup)
        document.addEventListener('mousemove', mousemove)
        document.addEventListener('keydown', keydown)
        return () => {
            clearInterval(checkEnd)
            document.removeEventListener('keydown', keydown)
            controls.removeEventListener('mousedown', controls_mousedown)
            document.removeEventListener('mouseup', mouseup)
            document.removeEventListener('mousemove', mousemove)
        }
    }, [endpoint, playing, offset, objLine, zoom, gridLine, rowScroll, gridOffset])

    // state volume변경시 실제 오디오 볼륨을 변경하는 코드
    useEffect(() => {
        const audio = document.querySelector('audio') as HTMLAudioElement
        audio.volume = volume/100
    }, [volume])

    // bpm, grid, endpoint값에 따라 그리드 리스트를 만드는 코드
    useEffect(() => {
        let c = (60/bpm/grid)
        let arr = []
        for(let i = 0; i < Math.floor((endpoint-gridOffset)/c); i++){
            arr.push(i*c)
        }
        arr.push(endpoint-gridOffset)
        setGridLine(arr)
    }, [bpm, grid, endpoint, gridOffset])

    // 휠버튼으로 타임라인 이동하는 코드
    useEffect(() => {
        const ev = document.querySelector('.timeline') as HTMLDivElement // 타임라인 이벤트 엘레멘트
        // 휠 이벤트
        function wheelev(e:WheelEvent){
            if(!e.altKey){
                let res = rowScroll-e.deltaY
                setRowScroll(res > 0 ? 0 : res)
            }
        }
        ev.addEventListener('wheel', wheelev)
        return () => {
            ev.removeEventListener('wheel', wheelev)
        }
    }, [rowScroll])

    // 휠버튼으로 오브젝트 스크롤 이동하는 코드
    useEffect(() => {
        const ob = document.querySelector('.objs') as HTMLDivElement // 타임라인 이벤트 엘레멘트
        // 휠 이벤트
        function wheelev(e:WheelEvent){
            if(!e.altKey){
                let res = colScroll+(e.deltaY/100)
                setColScroll(res <= 0 ? 0 : res)
            }
        }
        ob.addEventListener('wheel', wheelev)
        return () => {
            ob.removeEventListener('wheel', wheelev)
        }
    }, [colScroll])

    // 오브젝트 추가 함수
    const addObj = () => {
        let _arr:obj[] = copy(objs)
        let _obj:obj = {anchor:[0, 0],events:[],opacity:1,position:[50, 50],rotate:0,scale:[1, 1],type:sel,visible:true}
        if(sel == "chart"){
            _obj['bpm'] = bpm
            _obj['ease'] = 'linear'
            _obj['notes'] = []
            _obj['mcolor'] = '#ffffff'
            _obj['jcolor'] = '#0099ff'
            _obj['ncolor'] = '#ffffff'
            _obj['drawer'] = 'stroke'
            _obj['shape'] = 'arc'
            _obj['line'] = 3
            _obj['nline'] = 3
        } else if(sel == "sprite"){
            _obj['src'] = ''
        }
        _arr.push(_obj)
        setObjs(_arr)
    }

    // 오브젝트 제거 함수
    const remObj = (_i:number) => {
        let _arr:obj[] = copy(objs)
        _arr.splice(_i, 1)
        setObjs(_arr)
    }
    
    // 메인 이벤트 추가 함수
    const addEv = (_opt?:event) => {
        let _arr:event[] = copy(events)
        let _d = _opt
        _d ? _d.stamp = timeline : _d
        _arr.push(_d || {stamp:timeline, type:'bgcolor', value:'#000000', duration:bpm, ease:'linear', smooth:true, speed:10, filter:'blur'})
        _arr = _arr.sort((_a, _b) => _a.stamp - _b.stamp)
        setEvents(_arr)
    }
    
    // 메인 이벤트 제거 함수
    const remEv = (_idx:number) => {
        let _arr:event[] = copy(events)
        _arr.splice(_idx, 1)
        _arr = _arr.sort((_a, _b) => _a.stamp - _b.stamp)
        setEvents(_arr)
    }
    
    // 오브젝트 이벤트 추가 함수
    const addObjEv = (_i:number, _opt?:objEvent) => {
        let _arr:obj[] = copy(objs)
        let _d = _opt
        _d ? _d.stamp = timeline : _d
        _arr[_i].events.push(_d || {stamp:timeline, type:'position', value:[50, 50], ease:'linear', duration:bpm})
        _arr[_i].events = _arr[_i].events.sort((_a, _b) => _a.stamp - _b.stamp)
        setObjs(_arr)
    }

    // 오브젝트 이벤트 제거 함수
    const remObjEv = (_oi:number, _i:number) => {
        let _arr:obj[] = copy(objs)
        _arr[_oi].events.splice(_i, 1)
        _arr[_oi].events = _arr[_oi].events.sort((_a, _b) => _a.stamp - _b.stamp)
        setObjs(_arr)
    }
    
    // 차트 노트 추가 함수
    const addChartNote = (_i:number) => {
        let _arr:obj[] = copy(objs)
        _arr[_i].notes?.push({stamp:timeline, hit:0, judge:'none'})
        _arr[_i].notes = _arr[_i].notes?.sort((_a, _b) => _a.stamp - _b.stamp)
        setObjs(_arr)
    }

    // 차트 노트 제거 함수
    const remChartNote = (_oi:number, _i:number) => {
        let _arr:obj[] = copy(objs)
        _arr[_oi].notes?.splice(_i, 1)
        _arr[_oi].notes = _arr[_oi].notes?.sort((_a, _b) => _a.stamp - _b.stamp)
        setObjs(_arr)
    }

    // 오브젝트 속성 설정 함수
    const setObjProperty = (_i:number, _type:string, _v:any) => {
        let _arr:obj[] = copy(objs)
        if(_type == 'position'){
            _arr[_i].position[_v[0]] = _v[1]
        } else if(_type == 'rotate'){
            _arr[_i].rotate = _v
        } else if(_type == 'scale'){
            _arr[_i].scale[_v[0]] = _v[1]
        } else if(_type == 'opacity'){
            _arr[_i].opacity = _v
        } else if(_type == 'anchor'){
            _arr[_i].anchor[_v[0]] = _v[1]
        } else {
            _arr[_i][_type as 'bpm'|'src'|'ease'] = _v
        }
        setObjs(_arr)
    }

    // 메인 이벤트 설정 함수
    const setEv = (_i:number, _t:eventProps, _v:any):void => {
        let _arr:event[] = copy(events)
        if(_t == 'type'){
            if(_v == 'bgcolor'){_arr[_i].value = '#000000'}
            else if(_v == 'filter'){_arr[_i].filter = 'blur';_arr[_i].value = 100}
            else if(_v == 'position'){_arr[_i].value = [0, 0]}else{
                _arr[_i].value = 100
            }
        }
        _arr[_i][_t] = _t == 'value' || _t == 'speed' ? Number.isNaN(+_v) ? _v : +_v : _v
        setEvents(_arr)
    }

    // 오브젝트 이벤트 설정 함수
    const setObjEv = (_oi:number, _i:number, _t:objEventProps, _v:any):void => {
        let _arr:obj[] = copy(objs)
        if(_t == 'type'){
            _arr[_oi].events[_i].value =
            ['rotate'].includes(_v) ? 0 :
            ['opacity', 'line', 'nline'].includes(_v) ? 1 :
            _v == 'bpm' ? 100 :
            _v == 'change' ? '' :
            ['mcolor', 'jcolor', 'ncolor'].includes(_v) ? '#ffffff' :
            ['position', 'scale', 'anchor'].includes(_v) ? [0, 0] :
            _v == 'ease' ? 'linear' :
            _v == 'drawer' ? 'stroke' :
            _v == 'shape' ? 'arc' :
            _v == 'visible' || ''
        }
        _arr[_oi].events[_i][_t] = _v
        setObjs(_arr)
    }

    // 오브젝트 인덱스 설정 함수
    const setObjIdx = (_i:number, _ri:number) => {
        let _arr:obj[] = copy(objs)
        let _exboard:obj = copy(_arr[_i])
        _arr.splice(_i, 1)
        let _resArr:obj[] = [..._arr.slice(0, _ri), _exboard, ..._arr.slice(_ri)]
        setObjs(_resArr)
    }

    // 차트 오프셋 전체 변경 함수
    const changeChartOffset = () => {
        let _arr:obj[] = copy(objs)
        _arr.forEach(v => {
            if(v.type == 'chart'){
                v.notes?.forEach(v2 => {
                    v2.stamp += chartOffset
                })
            }
        })
        setObjs(_arr)
    }

    // 오브젝트 및 이벤트 선택 & 삭제 & 해제 & 수정
    useEffect(() => {
        // 글로벌 키다운 이벤트
        function keydown(e:KeyboardEvent){
            // 인풋태그 포커징시 단축키 입력 방지
            const inps = document.querySelectorAll('input')
            let iarr:boolean[] = []
            inps.forEach(v => {
                iarr.push(v == document.activeElement)
            })
            if(iarr.includes(true)) return

            // 옵젝 & 이벤트 삭제
            if(e.code == 'Delete'){
                if(focusing == 0){
                    if(focusObj != 0){
                        remObj(focusObj-1)
                        if(focusEvent[0]+1 >= focusObj) setFocusEvent([-1, 0])
                        if(focusNote[0] >= focusObj) setFocusNote([-1, 0])
                        setFocusObj(0)
                    }
                } else if(focusing == 1){
                    if(focusEvent[0] == 0){
                        remEv(focusEvent[1])
                        setFocusEvent([-1, 0])
                    } else if(focusEvent[0] > 0){
                        remObjEv(focusEvent[0]-1, focusEvent[1])
                        setFocusEvent([-1, 0])
                    }
                } else if(focusing == 2 && focusNote[0] != -1){
                    remChartNote(...focusNote)
                    setFocusNote([-1, 0])
                }
            // 이벤트 포커징 옮기는 코드
            } else if(e.code == 'ArrowLeft' || e.code == 'ArrowRight'){
                if(focusing == 1 && focusEvent[0] > -1){
                    let _evLen:number = focusEvent[0] == 0 ? events.length : objs[focusEvent[0]-1].events.length
                    let _idx:number = focusEvent[1]
                    _idx += e.code == 'ArrowLeft' ? -1 : 1
                    _idx = _idx < 0 ? 0 : _idx+1 > _evLen ? _evLen-1 : _idx
                    setFocusEvent([focusEvent[0], _idx])
                } else if(focusing == 2 && focusNote[0] > -1){
                    let _ntLen:number = objs[focusNote[0]].notes?.length || 0
                    let _idx:number = focusNote[1]
                    _idx += e.code == 'ArrowLeft' ? -1 : 1
                    _idx = _idx < 0 ? 0 : _idx+1 > _ntLen ? _ntLen-1 : _idx
                    setFocusNote([focusNote[0], _idx])
                }
            // 이벤트 복사, 자르기, 붙여넣기 코드
            } else if((e.code == 'KeyC' || e.code == 'KeyX') && e.ctrlKey){ // 복사 & 자르기
                if(focusEvent[0] != -1){
                    let cb:event | objEvent = copy(focusEvent[0] == 0 ? events[focusEvent[1]] : objs[focusEvent[0]-1].events[focusEvent[1]])
                    if(e.code == 'KeyX') {
                        focusEvent[0] == 0 ? remEv(focusEvent[1]) : remObjEv(focusEvent[0]-1, focusEvent[1])
                        setFocusEvent([-1, 0])
                    }
                    setEvClipboard(cb)
                }
            } else if(e.code == 'KeyV' && e.ctrlKey){ // 붙여넣기
                if(evClipboard){
                    let isCbMainEv:boolean = (evClipboard as event).speed == undefined ? false : true
                    focusObj == 0 ? isCbMainEv && addEv(evClipboard as event) : !isCbMainEv && addObjEv(focusObj-1, evClipboard as objEvent)
                }
            } else if(e.code == 'KeyW'){ // 선택된 차트에 노트 추가
                if(focusObj > 0 && objs[focusObj-1].type == 'chart'){
                    addChartNote(focusObj-1)
                }
            } else if(e.code == 'KeyE'){ // 선택된 오브젝트에 이벤트 추가
                if(focusObj == 0){
                    addEv()
                } else if(focusObj > 0){
                    addObjEv(focusObj-1)
                }
            } else if(['ArrowUp', 'ArrowDown'].includes(e.code) && e.shiftKey && focusing == 0 && focusObj != 0){ // 레이어 위치 바꾸기
                let _idx:number = focusObj-1
                let _dir:number = e.code == 'ArrowUp' ? -1 : 1
                if(_idx + _dir < 0 || _idx + _dir >= objs.length) return
                setObjIdx(_idx, _idx + _dir)
                setFocusObj(_idx+ 1 + _dir)
            }
        }

        document.addEventListener('keydown', keydown)
        return () => {
            document.removeEventListener('keydown', keydown)
        }
    }, [events, objs, focusEvent, focusObj, focusNote, focusing, evClipboard, timeline])

    // 플레이
    useEffect(() => {
        if(playing){
            const keydown = (e:KeyboardEvent) => {
                if(playKeys.includes(e.code)){
                    let _ar:number[] = copy(hits)
                    _ar.push(timeline)
                    setHits(_ar)
                }
            }
            document.addEventListener('keydown', keydown)
            return () => {
                document.removeEventListener('keydown', keydown)
            }
        }
    }, [timeline, playing, hits])
    useEffect(() => {if(!playing) setHits([])}, [playing])

    // easing
    const EaseOpts = () => {
        return <>
            <option value="linear">Linear</option>
            <option value="insine">In-Sine</option>
            <option value="outsine">Out-Sine</option>
            <option value="sine">Sine</option>
            <option value="inquad">In-Quad</option>
            <option value="outquad">Out-Quad</option>
            <option value="quad">Quad</option>
            <option value="incubic">In-Cubic</option>
            <option value="outcubic">Out-Cubic</option>
            <option value="cubic">Cubic</option>
            <option value="inquart">In-Quart</option>
            <option value="outquart">Out-Quart</option>
            <option value="quart">Quart</option>
            <option value="inquint">In-Quint</option>
            <option value="outquint">Out-Quint</option>
            <option value="quint">Quint</option>
            <option value="inexpo">In-Expo</option>
            <option value="outexpo">Out-Expo</option>
            <option value="expo">Expo</option>
            <option value="incirc">In-Circ</option>
            <option value="outcirc">Out-Circ</option>
            <option value="circ">Circ</option>
            <option value="inback">In-Back</option>
            <option value="outback">Out-Back</option>
            <option value="back">Back</option>
        </>
    }

    // html 코드
    return <div className="Editor">
        <div style={{height:`${100-underbarLine}%`}} className="workspace">
            <div style={{width:`${mainsetLine}%`}} className="mainset">
                <div>
                    <button onClick={e => reset()}>New</button>
                    <button onClick={e => openLevel()}>Open</button>
                    <button onClick={e => exportLevel()}>Export</button>
                </div>
                <div>
                    <button onClick={e => v_setTimeline(0)}>Home</button>
                    <button className="playlevel" onClick={e => playLevel()}>{playing ? 'Stop' : 'Play'}</button>
                    <button onClick={e => v_setTimeline(endpoint)}>End</button>
                </div>
                <hr />
                {
                    focusObj == 0 ? <>
                        <div><button onClick={e => changeChartOffset()}>Set Chart Offset</button><input type="text" name="" id="" value={chartOffset} onChange={e => setChartOffset(+e.target.value)} /></div>
                        <div>Grid<input type="text" name="" id="" value={grid} onChange={e => setGrid(+e.target.value)} /></div>
                        <div>Grid Offset<input type="text" name="" id="" value={gridOffset} onChange={e => setGridOffset(+e.target.value)} /></div>
                        <div>BPM<input type="text" name="" id="" value={bpm} onChange={e => setBpm(+e.target.value)} /></div>
                        <div>Offsets<input type="text" name="" id="" value={offset} onChange={e => setOffset(+e.target.value)} /></div>
                        <div>Song<input type="text" name="" id="" value={song} onChange={e => setSong(e.target.value)} /></div>
                        <div>BackgroundColor<input type="color" name="" id="" value={BackgroundColor} onChange={e => setBackgroundColor(e.target.value)}/></div>
                        <div>Volume<input type="text" name="" id="" value={volume} onChange={e => setVolume(+e.target.value)}/></div>
                        <div>Endpoint<input type="text" name="" id="" value={`${Math.floor(endpoint/60)}:${endpoint%60}`}
                        onChange={e => {
                            let time:number[] = e.target.value.split(':').map(v => +v)
                            setEndpoint((time[0]*60 + time[1]))
                        }}/></div>
                        <div>Position<input type="number" name="" id="" value={position[0]} onChange={e => setPosition([+e.target.value, position[1]])}/>
                        <input type="number" name="" id="" value={position[1]} onChange={e => setPosition([position[0], +e.target.value])}/></div>
                        <div>Rotate<input type="number" name="" id="" value={rotate} onChange={e => setRotate(+e.target.value)}/></div>
                        <div>Scale<input type="number" name="" id="" value={scale} onChange={e => setScale(+e.target.value)}/></div>
                    </>:<>
                        <div>Position<input type="number" name="" id="" value={objs[focusObj-1].position[0]} onChange={e => setObjProperty(focusObj-1, 'position', [0, +e.target.value])}/>
                        <input type="number" name="" id="" value={objs[focusObj-1].position[1]} onChange={e => setObjProperty(focusObj-1, 'position', [1, +e.target.value])}/></div>
                        <div>Rotate<input type="number" name="" id="" value={objs[focusObj-1].rotate} onChange={e => setObjProperty(focusObj-1, 'rotate', +e.target.value)}/></div>
                        <div>Scale<input type="number" name="" id="" value={objs[focusObj-1].scale[0]} onChange={e => setObjProperty(focusObj-1, 'scale', [0, +e.target.value])}/>
                        <input type="number" name="" id="" value={objs[focusObj-1].scale[1]} onChange={e => setObjProperty(focusObj-1, 'scale', [1, +e.target.value])}/></div>
                        <div>Opacity<input type="number" name="" id="" value={objs[focusObj-1].opacity} onChange={e => setObjProperty(focusObj-1, 'opacity', +e.target.value)}/></div>
                        <div>Anchor<input type="number" name="" id="" value={objs[focusObj-1].anchor[0]} onChange={e => setObjProperty(focusObj-1, 'anchor', [0, +e.target.value])}/>
                        <input type="number" name="" id="" value={objs[focusObj-1].anchor[1]} onChange={e => setObjProperty(focusObj-1, 'anchor', [1, +e.target.value])}/></div>
                        <div>Visible<input type="checkbox" name="" id="" checked={objs[focusObj-1].visible} onChange={e => setObjProperty(focusObj-1, 'visible', e.target.checked)}/></div>
                        {objs[focusObj-1].type == 'chart' && <div>BPM<input type="number" name="" id="" value={objs[focusObj-1].bpm}
                        onChange={e => setObjProperty(focusObj-1, 'bpm', +e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Main Color<input type="color" name="" id="" value={objs[focusObj-1].mcolor}
                        onChange={e => setObjProperty(focusObj-1, 'mcolor', e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Judgement Color<input type="color" name="" id="" value={objs[focusObj-1].jcolor}
                        onChange={e => setObjProperty(focusObj-1, 'jcolor', e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Note Color<input type="color" name="" id="" value={objs[focusObj-1].ncolor}
                        onChange={e => setObjProperty(focusObj-1, 'ncolor', e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Note Drawer<select name="" id="" value={objs[focusObj-1].drawer}
                        onChange={e => setObjProperty(focusObj-1, 'drawer', e.target.value)}>
                            <option value="fill">Fill</option>
                            <option value="stroke">Stroke</option>
                        </select></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Note Shape<select name="" id="" value={objs[focusObj-1].shape}
                        onChange={e => setObjProperty(focusObj-1, 'shape', e.target.value)}>
                            <option value="arc">Arc</option>
                            <option value="rect">Rect</option>
                        </select></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Main Line Width<input type="number" name="" id="" value={objs[focusObj-1].line}
                        onChange={e => setObjProperty(focusObj-1, 'line', +e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Note Line Width<input type="number" name="" id="" value={objs[focusObj-1].nline}
                        onChange={e => setObjProperty(focusObj-1, 'nline', +e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Ease <select name="" id="" value={objs[focusObj-1].ease}
                        onChange={e => setObjProperty(focusObj-1, 'ease', e.target.value)}>{EaseOpts()}</select></div>}
                        {objs[focusObj-1].type == 'sprite' && <div>source URL<input type="text" name="" id="" value={objs[focusObj-1].src}
                        onChange={e => setObjProperty(focusObj-1, 'src', e.target.value)}/></div>}
                    </>
                }
            </div>
            <div style={{width:`${100-mainsetLine-eventsetLine}%`}} className="scene">
                {battleEngine(timeline, hits, stageSize, {events, objs, backgroundColor:BackgroundColor, position, rotate, scale, filters}, playing)}
            </div>
            <div style={{width:`${eventsetLine}%`}} className="eventset">
                {focusEvent[0] == 0 ? <>
                    <div>TimeStamp<input type="text" name="" id="" value={events[focusEvent[1]].stamp} onChange={e => setEv(focusEvent[1], 'stamp', +e.target.value)}/></div>
                    <div>Type<select name="" id="" value={events[focusEvent[1]].type} onChange={e => setEv(focusEvent[1], 'type', e.target.value)}>
                        <option value="bgcolor">BackgroundColor</option>
                        <option value="filter">Filter</option>
                        <option value="wiggle">Wiggle</option>
                        <option value="position">Position</option>
                        <option value="rotate">Rotate</option>
                        <option value="scale">Scale</option>
                    </select></div>
                    {['wiggle', 'rotate', 'scale'].includes(events[focusEvent[1]].type) && <div>Value<input type="text" name="" id=""
                    value={events[focusEvent[1]].value} onChange={e => setEv(focusEvent[1], 'value', e.target.value)}/></div>}
                    {['filter'].includes(events[focusEvent[1]].type) && <div>Filter Type<select name="" id="" value={events[focusEvent[1]].filter} onChange={e => setEv(focusEvent[1], 'filter', e.target.value)}>
                    <option value="blur">Blur</option>
                    <option value="dot">Dot</option>
                    <option value="motionBlur">Motion Blur</option>
                    <option value="bloom">Bloom</option>
                    <option value="godray">Godray</option>
                    <option value="convolution">Convolution</option>
                    <option value="glitch">Glitch</option>
                    <option value="grayscale">Grayscale</option>
                    <option value="noise">Noise</option>
                    <option value="pixelate">Pixelate</option>
                    <option value="rgbsplit">RGB Split</option>
                    </select></div>}
                    {['filter'].includes(events[focusEvent[1]].type) && strengthFilters.includes(events[focusEvent[1]].filter as filterType) &&
                    <div>Strength<input type="number" name="" id="" value={events[focusEvent[1]].value} onChange={e => setEv(focusEvent[1], 'value', +e.target.value)}/></div>}
                    {['filter'].includes(events[focusEvent[1]].type) &&
                    enableFilters.includes(events[focusEvent[1]].filter as filterType) &&
                    <div>Enable<input type="checkbox" name="" id="" checked={events[focusEvent[1]].value != 0} onChange={e => setEv(focusEvent[1], 'value', e.target.checked ? 100 : 0)}/></div>}
                    {['position'].includes(events[focusEvent[1]].type) && <div>Value<input type="number" name="" id=""
                    value={events[focusEvent[1]].value[0]} onChange={e => setEv(focusEvent[1], 'value', [+e.target.value, events[focusEvent[1]].value[1]])}/><input type="number" name="" id=""
                    value={events[focusEvent[1]].value[1]} onChange={e => setEv(focusEvent[1], 'value', [events[focusEvent[1]].value[0], +e.target.value])}/></div>}
                    {['bgcolor'].includes(events[focusEvent[1]].type) && <div>Color<input type="color" name="" id=""
                    value={events[focusEvent[1]].value} onChange={e => setEv(focusEvent[1], 'value', e.target.value)}/></div>}
                    {['filter', 'bgcolor', 'wiggle', 'position', 'rotate', 'scale'].includes(events[focusEvent[1]].type) &&
                    (events[focusEvent[1]].type == 'filter' ? strengthFilters.includes(events[focusEvent[1]].filter as filterType) : true) && <div>Duration<input type="number" name="" id=""
                    value={events[focusEvent[1]].duration} onChange={e => setEv(focusEvent[1], 'duration', +e.target.value)}/></div>}
                    {['wiggle'].includes(events[focusEvent[1]].type) && <div>Wiggle Speed<input type="number" name="" id=""
                    value={events[focusEvent[1]].speed} onChange={e => setEv(focusEvent[1], 'speed', e.target.value)}/></div>}
                    {['wiggle'].includes(events[focusEvent[1]].type) && <div>Wiggle Smooth End<input type="checkbox" name="" id=""
                    checked={events[focusEvent[1]].smooth} onChange={e => setEv(focusEvent[1], 'smooth', e.target.checked)}/></div>}
                    {['filter', 'bgcolor', 'position', 'rotate', 'scale'].includes(events[focusEvent[1]].type) &&
                    (events[focusEvent[1]].type == 'filter' ? strengthFilters.includes(events[focusEvent[1]].filter as filterType) : true) && <div>Ease<select name="" id=""
                    value={events[focusEvent[1]].ease} onChange={e => setEv(focusEvent[1], 'ease', e.target.value)}>{EaseOpts()}</select></div>}
                </>:
                focusEvent[0] > 0 ? <>
                    <div>TimeStamp<input type="text" name="" id="" value={objs[focusEvent[0]-1].events[focusEvent[1]].stamp} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'stamp', +e.target.value)}/></div>
                    <div>Type<select name="" id="" value={objs[focusEvent[0]-1].events[focusEvent[1]].type} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'type', e.target.value)}>
                        <option value="position">Transform</option>
                        <option value="rotate">Rotate</option>
                        <option value="scale">Scale</option>
                        <option value="opacity">Opacity</option>
                        <option value="anchor">Anchor</option>
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="bpm">BPM</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="ease">Ease</option>}
                        <option value="visible">Visible</option>
                        {objs[focusEvent[0]-1].type == 'sprite' && <option value="change">Change Image</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="mcolor">Main Color</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="jcolor">Judge Color</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="ncolor">Note Color</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="drawer">Note Drawer</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="shape">Note Shape</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="line">Main Line</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="nline">Note Line</option>}
                    </select></div>
                    {['position', 'rotate', 'scale', 'opacity', 'anchor', 'bpm', 'mcolor', 'jcolor', 'ncolor', 'line', 'nline'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) && <div>Duration<input type="number" name="" id=""
                    value={objs[focusEvent[0]-1].events[focusEvent[1]].duration} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'duration', +e.target.value)}/></div>}
                    {['position', 'rotate', 'scale', 'opacity', 'anchor', 'bpm', 'mcolor', 'jcolor', 'ncolor', 'line', 'nline'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) && <div>Ease<select name="" id=""
                    value={objs[focusEvent[0]-1].events[focusEvent[1]].ease} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'ease', e.target.value)}>{EaseOpts()}</select></div>}
                    {['mcolor', 'jcolor', 'ncolor'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Color Value<input type="color" name="" id=""
                    value={objs[focusEvent[0]-1].events[focusEvent[1]].value} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', e.target.value)}/></div> :
                    ['rotate', 'opacity', 'bpm', 'change', 'line', 'nline'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Value<input type="text" name="" id=""
                    value={objs[focusEvent[0]-1].events[focusEvent[1]].value} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', e.target.value)}/></div>:
                    ['position', 'scale', 'anchor'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Value<input type="number" name="" id=""
                    value={objs[focusEvent[0]-1].events[focusEvent[1]].value[0]} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', [+e.target.value, objs[focusEvent[0]-1].events[focusEvent[1]].value[1]])}/>
                    <input type="number" name="" id="" value={objs[focusEvent[0]-1].events[focusEvent[1]].value[1]} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', [objs[focusEvent[0]-1].events[focusEvent[1]].value[0], +e.target.value])}/></div>:
                    ['ease'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>EaseType<select name="" id="" value={objs[focusEvent[0]-1].events[focusEvent[1]].ease} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'ease', e.target.value)}>{EaseOpts()}</select></div>:
                    ['visible'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Visible<input type="checkbox" name="" id=""
                    checked={objs[focusEvent[0]-1].events[focusEvent[1]].value} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', e.target.checked)}/></div>:
                    ['drawer'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Note Drawer<select name="" id="" value={objs[focusEvent[0]-1].events[focusEvent[1]].value} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', e.target.value)}>
                    <option value="stroke">Stroke</option><option value="fill">Fill</option></select></div>:
                    ['shape'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Note Shape<select name="" id="" value={objs[focusEvent[0]-1].events[focusEvent[1]].value} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', e.target.value)}>
                    <option value="arc">Arc</option><option value="rect">Rect</option></select></div>:<></>
                    }
                </>:<></>}
            </div>
        </div>
        <div style={{height:`${underbarLine}%`}} className="underbar">
            <div style={{width:`${objLine}%`}} className="objs">
                <div className="description">Objects {timeline.toFixed(3)}
                    <div className="right">
                    <select name="" id="" value={sel} onChange={e => setSel(e.target.value as 'chart'|'sprite')}>
                        <option value="chart">Chart</option>
                        <option value="sprite">Sprite</option>
                    </select>
                    <button onClick={e => addObj()}>+</button></div>
                </div>
                {Math.round(colScroll) <= 0 && <div className={focusObj == 0 ? 'selected' : ''}
                onClick={e => {setFocusObj(0);setFocusing(0)}}>Main<button onClick={e => addEv()}>Add Event</button></div>}
                {objs.map((v, i) => (
                    Math.round(colScroll) <= i+1 && <div key={i} className={focusObj == i+1 ? 'selected' : ''} onClick={e => {setFocusObj(i+1);setFocusing(0)}}>{`Obj${i+1}`}
                    {v.type == 'chart' && <button onClick={e => addChartNote(i)}>Add Note</button>}
                    <button onClick={e => addObjEv(i)}>Add Event</button></div>
                ))}
            </div>
            <div style={{width:`${100-objLine}%`}} className="timeline">
                <div className="controls">
                    <div style={{marginLeft:`${(condset[0] /100 * (100-objLine) * timeline / endpoint)*(zoom/100) + rowScroll - 11}px`}} className="timelineGrab"></div>
                </div>
                <div className="overlay">
                    {gridLine.map((v, i) => (
                        (condset[0] /100 * (100-objLine) * v / endpoint)*(zoom/100) + (condset[0] /100 * (100-objLine) * gridOffset / endpoint)*(zoom/100) + rowScroll >= 0 && (
                        i == 0 ? <div key={i} style={{marginLeft:`${(condset[0] /100 * (100-objLine) * gridOffset / endpoint)*(zoom/100) + rowScroll}px`}} className="grid start"></div> :
                        i+1 == gridLine.length ? <div key={i} style={{marginLeft:`${(condset[0] /100 * (100-objLine))*(zoom/100) + rowScroll}px`}} className="grid end"></div> :
                        i % (2**(5-Math.round(zoom/100) < 1 ? 1 : 5-Math.round(zoom/100))) == 0 &&
                        <div style={{marginLeft:`${(condset[0] /100 * (100-objLine) * v / endpoint)*(zoom/100) + (condset[0] /100 * (100-objLine) * gridOffset / endpoint)*(zoom/100) + rowScroll}px`}}
                        className={i % (grid*(2**(5-Math.round(zoom/100) < 1 ? 1 : 5-Math.round(zoom/100)))) == 0 ? 'grid' : 'grid m'} key={i}></div>)
                    ))}
                    <div className="bar" style={{marginLeft:`${(condset[0] /100 * (100-objLine) * timeline / endpoint)*(zoom/100) + rowScroll}px`}}></div>
                </div>
                <div className="events">
                    {Math.round(colScroll) <= 0 && <div>
                        {events.map((v, i) => (
                            (condset[0] /100 * (100-objLine) * v.stamp / endpoint)*(zoom/100) + rowScroll >= 0 &&
                            <div key={i} style={{marginLeft:`${(condset[0] /100 * (100-objLine) * v.stamp / endpoint)*(zoom/100) + rowScroll - 8}px`}}
                            className={`box ${focusEvent[0] == 0 && focusEvent[1] == i ? 'selected' : ''}`}
                            onClick={e => {setFocusEvent([0, i]);setFocusing(1)}}></div>
                            ))}
                    </div>}
                    {objs.map((v, i) => (
                        Math.round(colScroll) <= i+1 && <div key={i} style={{marginTop:`${(i+1-Math.round(colScroll))*25.5}px`}}>
                            {v.events.map((v2, i2) => (
                                (condset[0] /100 * (100-objLine) * v2.stamp / endpoint)*(zoom/100) + rowScroll >= 0 &&
                                <div key={i2} style={{marginLeft:`${(condset[0] /100 * (100-objLine) * v2.stamp / endpoint)*(zoom/100) + rowScroll - 8}px`}}
                                className={`box ${focusEvent[0] == i+1 && focusEvent[1] == i2 ? 'selected' : ''}`}
                                onClick={e => {setFocusEvent([i+1, i2]);setFocusing(1)}}></div>
                            ))}
                            {v.type == 'chart' ? v.notes?.map((v2, i2) => (
                                (condset[0] /100 * (100-objLine) * v2.stamp / endpoint)*(zoom/100) + rowScroll >= 0 &&
                                <div key={i2} style={{marginLeft:`${(condset[0] /100 * (100-objLine) * v2.stamp / endpoint)*(zoom/100) + rowScroll - 8}px`}}
                                className={`note ${focusNote[0] == i && focusNote[1] == i2 ? 'selected' : ''}`}
                                onClick={e => {setFocusNote([i, i2]);setFocusing(2)}}></div>
                            )) : <></>}
                        </div>
                    ))}
                </div>
                <div className="scrollbar-row" style={{width:`${100-objLine}%`}}><div
                style={{width:`${(condset[0] /100 * (100-objLine)) /(zoom/100)}px`,
                marginLeft:`${((condset[0] /100 * (100-objLine))-(condset[0] /100 * (100-objLine)/(zoom/100)))*(-rowScroll)/((condset[0] /100 * (100-objLine)) * (zoom/100) - (condset[0] /100 * (100-objLine)))}px`}}></div></div>
            </div>
        </div>
        <input type="file" name="" id="fileInput" style={{display:'none'}} />
        <audio src={song} style={{display:'none'}}></audio>
    </div>
}
