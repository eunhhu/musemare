'use client'

import Image from 'next/image'
import { useCallback, useContext, useEffect } from "react"
import { useRuntimeRoute, useRuntimeTask } from '../components/RuntimeStatus'
import { globalContext } from "../main"
import { toLang } from "../data/lang"
import { createRuntimeAssetFailure } from '../logic/runtimeAssets'

export default function Index(){
    const {setAfterBattleScene, setScene, lang} = useContext(globalContext)
    const backgroundTask = useRuntimeTask('asset', '/assets/background/menubg.png')
    useRuntimeRoute('intro')

    const continueToSelector = useCallback(() => {
        setAfterBattleScene('Selector')
        setScene('Selector')
    }, [setAfterBattleScene, setScene])

    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if(event.code == 'KeyF'){
                continueToSelector()
            }
        }
        window.addEventListener('keydown', keydown)
        return () => window.removeEventListener('keydown', keydown)
    }, [continueToSelector])

    return <div className="Intro Intro-fallback">
        <Image
            src="/assets/background/menubg.png"
            alt=""
            fill={true}
            priority={true}
            sizes="100vw"
            onLoad={backgroundTask.complete}
            onError={() => backgroundTask.fail(createRuntimeAssetFailure('/assets/background/menubg.png', new Error('Intro background failed to decode.')))}
        />
        <div className="Intro-fallback-content">
            <p>The intro video is not included in this repository.</p>
            <button type="button" onClick={continueToSelector}>Continue</button>
            <div className="skip">{toLang(lang, 'press skip')}</div>
        </div>
    </div>
}
