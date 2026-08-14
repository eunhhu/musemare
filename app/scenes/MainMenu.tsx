'use client'

import Image from 'next/image'
import { useContext } from "react"
import { useRuntimeRoute, useRuntimeTask } from '../components/RuntimeStatus'
import { globalContext } from "../main"
import { toLang } from "../data/lang"
import { useSceneFade } from "../hooks/useSceneFade"
import { createRuntimeAssetFailure } from '../logic/runtimeAssets'

export default function Index(){
    const {lang, setScene} = useContext(globalContext)
    const { style, transitionTo } = useSceneFade(setScene)
    const titleTask = useRuntimeTask('asset', '/assets/ui/title.svg')
    const backgroundTask = useRuntimeTask('asset', '/assets/background/menubg.png')
    useRuntimeRoute('main-menu')

    const buttonInput = (str:string) => {
        if (str == 'credits') transitionTo('Credits')
        else if (str == 'settings') transitionTo('Settings')
        else if (str == 'new game') transitionTo('Intro')
        else if (str == 'continue') transitionTo('Selector')
    }

    return <div style={style}
    className="MainMenu fullscreen blackbg">
        <Image
            className="MainMenu-background"
            src="/assets/background/menubg.png"
            alt=""
            fill={true}
            priority={true}
            sizes="100vw"
            onLoad={backgroundTask.complete}
            onError={() => backgroundTask.fail(createRuntimeAssetFailure('/assets/background/menubg.png', new Error('Menu background failed to decode.')))}
        />
        <div>
            <Image
                src="/assets/ui/title.svg"
                alt="MuseMare"
                width={983}
                height={225}
                priority={true}
                onLoad={titleTask.complete}
                onError={() => titleTask.fail(createRuntimeAssetFailure('/assets/ui/title.svg', new Error('Title image failed to decode.')))}
            />
            <div className="menu">
                {['new game', 'continue', 'settings', 'credits'].map((v, i) => (
                    <div key={i} onClick={() => buttonInput(v)}>{toLang(lang, v)}</div>
                ))}
            </div>
        </div>
    </div>
}
