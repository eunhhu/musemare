export type LevelCode = 'test' | 'moai' | 'dogbite' | 'ending'

type TrackIdentity = {
    artist:string
    title:string
}

type UnavailableLevelManifest = {
    availability:'unavailable'
    track:TrackIdentity
    assetPath:null
    provenance:{
        originalUrl:string
        note:string
    }
}

type AvailableLevelManifest = {
    availability:'available'
    track:TrackIdentity
    assetPath:string
    provenance:{
        repositoryPath:string
        note:string
    }
}

export type LevelManifestEntry = UnavailableLevelManifest | AvailableLevelManifest

export const levelManifest = {
    test:{
        availability:'unavailable',
        track:{ artist:'Halv', title:'Romanesque' },
        assetPath:null,
        provenance:{
            originalUrl:'https://cdn.discordapp.com/attachments/1154783041399574578/1154784269504360460/Halv_-_Romanesque.ogg?ex=65163468&is=6514e2e8&hm=879b834f79d46e559d533f1bee4647e864c2b399f33b9511f9740148356178d5&',
            note:'Original chart recording reference; no matching legally usable repository asset is present.',
        },
    },
    moai:{
        availability:'unavailable',
        track:{ artist:'Exyl', title:'MOAI' },
        assetPath:null,
        provenance:{
            originalUrl:'https://cdn.discordapp.com/attachments/1154783041399574578/1154783833628086383/Exyl_-_MOAI.ogg?ex=651d7440&is=651c22c0&hm=b8a100d0af3f8793e7eb1b55f0dde9cd876e4327cc0ff54a47c46dbdcf478d61&',
            note:'Original chart recording reference; no matching legally usable repository asset is present.',
        },
    },
    dogbite:{
        availability:'unavailable',
        track:{ artist:'t+pazolite', title:'Dogbite' },
        assetPath:null,
        provenance:{
            originalUrl:'https://cdn.discordapp.com/attachments/1154783041399574578/1159310869650485358/tpazolitedogbite.ogg?ex=65308f62&is=651e1a62&hm=617858039222cd2b58ec1b5bbfd8aa1911e73a916c9d4e50d1bb1e07d07bb9e9&',
            note:'Original chart recording reference; no matching legally usable repository asset is present.',
        },
    },
    ending:{
        availability:'available',
        track:{ artist:'', title:'icyxis_true_ending' },
        assetPath:'/assets/song/icyxis_true_ending.mp3',
        provenance:{
            repositoryPath:'public/assets/song/icyxis_true_ending.mp3',
            note:'Existing repository asset retained for the playable ending level.',
        },
    },
} as const satisfies Record<LevelCode, LevelManifestEntry>

export function isLevelAvailable(code:LevelCode) {
    return levelManifest[code].availability === 'available'
}
