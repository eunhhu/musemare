export type SupportedLanguage = 'en-US' | 'ko-KR'

const langs:Record<string, { ko:string, en:string }> = {
    '':{
        'ko':'',
        'en':'',
    },
    'new game':{
        'ko':'새 게임',
        'en':'New Game',
    },
    'continue':{
        'ko':'이어하기',
        'en':'Continue',
    },
    'settings':{
        'ko':'설정',
        'en':'Settings',
    },
    'credits':{
        'ko':'크레딧',
        'en':'Credits',
    },
    'goback':{
        'ko':'뒤로가기',
        'en':'Back',
    },
    'general':{
        'ko':'일반',
        'en':'General',
    },
    'video':{
        'ko':'비디오',
        'en':'Video',
    },
    'controls':{
        'ko':'조작키',
        'en':'Controls',
    },
    'audio':{
        'ko':'오디오',
        'en':'Audio',
    },
    'language':{
        'ko':'언어',
        'en':'Language',
    },
    'master volume':{
        'ko':'전체 음량',
        'en':'Master Volume',
    },
    'renderer':{
        'ko':'렌더러',
        'en':'Renderer',
    },
    'video notice':{
        'ko':'현재 변경 가능한 비디오 옵션이 없습니다.',
        'en':'There are no configurable video options yet.',
    },
    'press skip':{
        'ko':'[F]키를 눌러 스킵',
        'en':'Press [F] key to skip',
    },
    'teampani':{
        'ko':'팀파니 (TeamPani)',
        'en':'TeamPani',
    },
    'design':{
        'ko':'기획',
        'en':'Design',
    },
    'illustration':{
        'ko':'그림',
        'en':'Illustration',
    },
    'development':{
        'ko':'개발',
        'en':'Development',
    },
    'specialthanks':{
        'ko':'고마운 분들',
        'en':'Special Thanks',
    },
    'story':{
        'ko':'스토리',
        'en':'Story',
    },
    'audiotrack':{
        'ko':'오디오 트랙',
        'en':'Audio Track',
    },
    'fogforest':{
        'ko':'안개숲',
        'en':'Fog Forest',
    },
    'gloomcave':{
        'ko':'어둠동굴',
        'en':'Gloom Cave',
    },
    'jungle':{
        'ko':'정글',
        'en':'Jungle',
    },
    'wasteland':{
        'ko':'황무지',
        'en':'Wasteland',
    },
    'test':{
        'ko':'테스트',
        'en':'Test',
    },
    'moai':{
        'ko':'모아이',
        'en':'Moai',
    },
    'dogbite':{
        'ko':'개물림',
        'en':'Dog Bite',
    },
    'ending':{
        'ko':'엔딩',
        'en':'Ending',
    },
}

export function normalizeLanguage(language:string | null | undefined):SupportedLanguage {
    return language?.toLowerCase().startsWith('ko') ? 'ko-KR' : 'en-US'
}

export function toLang(language:string, data:string) {
    const translations = langs[data]
    if (!translations) return data
    return translations[normalizeLanguage(language).startsWith('ko') ? 'ko' : 'en'] ?? translations.en ?? data
}
