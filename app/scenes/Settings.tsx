import { useState, type KeyboardEvent } from "react"
import { useRuntimeRoute } from '../components/RuntimeStatus'
import { useGameSession } from '../components/GameSession'
import { normalizeLanguage, toLang, type SupportedLanguage } from "../data/lang"
import { useSceneFade } from "../hooks/useSceneFade"
import type { keys } from '../data/types'

const keyLabels:Record<keyof keys, { en:string, ko:string }> = {
    playerLeft:{ en:'Move left', ko:'왼쪽 이동' },
    playerRight:{ en:'Move right', ko:'오른쪽 이동' },
    playerJump:{ en:'Jump', ko:'점프' },
    playerSneak:{ en:'Sneak', ko:'숙이기' },
    playerRun:{ en:'Run', ko:'달리기' },
    interaction:{ en:'Interact', ko:'상호작용' },
    escape:{ en:'Back / pause', ko:'뒤로 / 일시정지' },
}

export default function Index(){
    const { lang, navigate, env, updateEnv } = useGameSession()
    const [settingMenu, setSettingMenu] = useState<string>('general')
    const { style, transitionTo } = useSceneFade(navigate)
    useRuntimeRoute('settings')

    const persistEnv = (nextEnv:typeof env) => {
        updateEnv(nextEnv)
        try {
            localStorage.setItem('env', JSON.stringify(nextEnv))
        } catch {
            // Settings remain active for this session when storage is unavailable.
        }
    }

    const updateLanguage = (language:SupportedLanguage) => {
        persistEnv({ ...env, language })
    }

    const bindKey = (key:keyof keys, event:KeyboardEvent<HTMLInputElement>) => {
        event.preventDefault()
        if (event.repeat) return
        persistEnv({ ...env, keys:{ ...env.keys, [key]:event.code } })
    }

    const optionContent = settingMenu === 'general'
        ? <label className="setting-row">
            <span>{toLang(lang, 'language')}</span>
            <select
                aria-label={toLang(lang, 'language')}
                value={normalizeLanguage(lang)}
                onChange={event => updateLanguage(event.target.value as SupportedLanguage)}
            >
                <option value="en-US">English</option>
                <option value="ko-KR">한국어</option>
            </select>
        </label>
        : settingMenu === 'audio'
            ? <label className="setting-row">
                <span>{toLang(lang, 'master volume')}</span>
                <input
                    aria-label={toLang(lang, 'master volume')}
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={env.volume}
                    onChange={event => persistEnv({ ...env, volume:Number(event.target.value) })}
                />
                <output>{Math.round(env.volume * 100)}%</output>
            </label>
            : settingMenu === 'controls'
                ? <div className="control-settings">{(Object.keys(keyLabels) as (keyof keys)[]).map(key => (
                    <label className="setting-row" key={key}>
                        <span>{keyLabels[key][normalizeLanguage(lang) === 'ko-KR' ? 'ko' : 'en']}</span>
                        <input
                            aria-label={keyLabels[key].en}
                            value={env.keys[key]}
                            readOnly
                            onKeyDown={event => bindKey(key, event)}
                            onFocus={event => event.currentTarget.select()}
                        />
                    </label>
                ))}</div>
                : <div className="video-settings">
                    <div className="setting-row"><span>{toLang(lang, 'renderer')}</span><output>WebGL</output></div>
                    <p>{toLang(lang, 'video notice')}</p>
                </div>

    return <div style={style} className="Settings fullscreen blackbg">
        <div className="container">
            <div className="menu">
                {['general', 'video', 'audio', 'controls'].map((v, i) => (
                    <button type="button" onClick={() => setSettingMenu(v)} className={v == settingMenu ? 'active' : ''}
                    key={i}>{toLang(lang, v)}</button>
                ))}
            </div>
            <div className="options">
                {optionContent}
            </div>
        </div>
        <button type="button" className="goback" onClick={() => transitionTo('MainMenu')}>{toLang(lang, 'goback')}</button>
    </div>
}
