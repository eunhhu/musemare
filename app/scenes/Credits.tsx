import { useRuntimeRoute } from '../components/RuntimeStatus'
import { useGameSession } from '../components/GameSession'
import { toLang } from "../data/lang"
import { useSceneFade } from "../hooks/useSceneFade"

export default function Index(){
    const { lang, navigate } = useGameSession()
    const { style, transitionTo } = useSceneFade(navigate)
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
        <button type="button" className="goback" onClick={() => transitionTo('MainMenu')}>{toLang(lang, 'goback')}</button>
    </div>
}
