import { useRuntimeRoute } from '../components/RuntimeStatus'
import { useGameSession } from '../components/GameSession'
import { toLang } from "../data/lang"
import { useSceneFade } from "../hooks/useSceneFade"
import { useRuntimeImage } from '../hooks/useRuntimeImage'

export default function Index(){
    const { lang, navigate } = useGameSession()
    const { style, transitionTo } = useSceneFade(navigate)
    const {
        imageRef:titleImageRef,
        complete:completeTitleImage,
        fail:failTitleImage,
    } = useRuntimeImage('/assets/ui/title.svg', 'Title image failed to decode.')
    const {
        imageRef:backgroundImageRef,
        complete:completeBackgroundImage,
        fail:failBackgroundImage,
    } = useRuntimeImage('/assets/background/menubg.png', 'Menu background failed to decode.')
    useRuntimeRoute('main-menu')

    const buttonInput = (str:string) => {
        if (str == 'credits') transitionTo('Credits')
        else if (str == 'settings') transitionTo('Settings')
        else if (str == 'new game') transitionTo('Intro')
        else if (str == 'continue') transitionTo('Selector')
    }

    return <div style={style}
    className="MainMenu fullscreen blackbg">
        <img
            ref={backgroundImageRef}
            className="MainMenu-background"
            src="/assets/background/menubg.png"
            alt=""
            fetchPriority="high"
            decoding="async"
            onLoad={completeBackgroundImage}
            onError={failBackgroundImage}
        />
        <div>
            <img
                ref={titleImageRef}
                src="/assets/ui/title.svg"
                alt="MuseMare"
                width={983}
                height={225}
                loading="eager"
                decoding="async"
                onLoad={completeTitleImage}
                onError={failTitleImage}
            />
            <div className="menu">
                {['new game', 'continue', 'settings', 'credits'].map((v, i) => (
                    <button type="button" key={i} onClick={() => buttonInput(v)}>{toLang(lang, v)}</button>
                ))}
            </div>
        </div>
    </div>
}
