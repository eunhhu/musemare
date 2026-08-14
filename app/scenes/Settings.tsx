'use client'

import { useContext, useState } from "react"
import { useRuntimeRoute } from '../components/RuntimeStatus'
import { globalContext } from "../main"
import { toLang } from "../data/lang"
import { useSceneFade } from "../hooks/useSceneFade"

export default function Index(){
    const {lang, setScene} = useContext(globalContext)
    const [settingMenu, setSettingMenu] = useState<string>('general')
    const { style, transitionTo } = useSceneFade(setScene)
    useRuntimeRoute('settings')

    return <div style={style} className="Settings fullscreen blackbg">
        <div className="container">
            <div className="menu">
                {['general', 'video', 'audio', 'controls'].map((v, i) => (
                    <div onClick={() => setSettingMenu(v)} className={v == settingMenu ? 'active' : ''}
                    key={i}>{toLang(lang, v)}</div>
                ))}
            </div>
            <div className="options">
                <div>sometinh:true</div>
            </div>
        </div>
        <div className="goback" onClick={() => transitionTo('MainMenu')}>{toLang(lang, 'goback')}</div>
    </div>
}
