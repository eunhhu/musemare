import { useCallback, useEffect } from "react"
import { useRuntimeRoute } from '../components/RuntimeStatus'
import { useGameSession } from '../components/GameSession'
import { toLang } from "../data/lang"
import { useRuntimeImage } from '../hooks/useRuntimeImage'

export default function Index(){
    const { navigate, lang } = useGameSession()
    const {
        imageRef:backgroundImageRef,
        complete:completeBackgroundImage,
        fail:failBackgroundImage,
    } = useRuntimeImage('/assets/background/menubg.png', 'Intro background failed to decode.')
    useRuntimeRoute('intro')

    const continueToSelector = useCallback(() => {
        navigate('Selector')
    }, [navigate])

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
        <img
            ref={backgroundImageRef}
            src="/assets/background/menubg.png"
            alt=""
            fetchPriority="high"
            decoding="async"
            onLoad={completeBackgroundImage}
            onError={failBackgroundImage}
        />
        <div className="Intro-fallback-content">
            <p>The intro video is not included in this repository.</p>
            <button type="button" onClick={continueToSelector}>Continue</button>
            <div className="skip">{toLang(lang, 'press skip')}</div>
        </div>
    </div>
}
