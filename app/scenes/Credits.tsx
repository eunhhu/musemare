'use client'

import { useContext } from "react"
import { useRuntimeRoute } from '../components/RuntimeStatus'
import { globalContext } from "../main"
import { toLang } from "../data/lang"
import { useSceneFade } from "../hooks/useSceneFade"

export default function Index(){
    const {lang, setScene} = useContext(globalContext)
    const { style, transitionTo } = useSceneFade(setScene)
    useRuntimeRoute('credits')

    return <div style={style} className="Credits fullscreen blackbg">
        <div className="credit-list">
            <div className="teampani">{toLang(lang, 'teampani')}</div>
            <div>
                <div className="direct">
                    <div>{toLang(lang, 'design')}</div>
                    <div>{toLang(lang, 'story')}</div>
                    <div>{toLang(lang, 'illustration')}</div>
                    <div>{toLang(lang, 'development')}</div>
                    <div>{toLang(lang, 'audiotrack')}</div>
                    <div>{toLang(lang, 'specialthanks')}</div>
                </div>
                <div>
                    <div>냉장고 문선우 푸른슬라임</div>
                    <div>냉장고 문선우 푸른슬라임</div>
                    <div>냉장고</div>
                    <div>문선우 푸른슬라임</div>
                    <div>BilliumMoto</div>
                    <div>학원쌤</div>
                </div>
            </div>
        </div>
        <div className="goback" onClick={() => transitionTo('MainMenu')}>{toLang(lang, 'goback')}</div>
    </div>
}
