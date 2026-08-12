import type { map } from "./types";


export const maps:{[key:string]:map} = {
    preview:{
        camera:{ position:[0, 0], rotation:0, scale:1, follow:'player' },
        backgroundColor:'#000000',
        sprites:[],
        texts:[],
        player:{
            position:[0, 0],
            rotation:0,
            width:100,
            height:120,
            opacity:1,
            anchor:[0.5, 0.5],
            hitbox:[1, 1],
            src:'/assets/object/glowing_circle_01.png',
            jumpSrc:'',
            sneakSrc:'',
            sneakWalkSrc:[],
            runSrc:[],
            walkSrc:[],
            isGround:false,
            isSneak:false,
            isRun:false,
            showHitbox:true,
            dposition:[0, 0],
            events:[],
            tags:['player'],
        },
        gravity:0.3,
        ground:300,
    },
}
