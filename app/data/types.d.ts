export type ease = 'linear'|'insine'|'outsine'|'sine'|'inquad'|'outquad'|'quad'|'incubic'|'outcubic'|'cubic'|'inquart'|'outquart'|'quart'|'inquint'|'outquint'|'quint'|'inexpo'|'outexpo'|'expo'|'incirc'|'outcirc'|'circ'|'inback'|'outback'|'back';
export type objEvType = 'position'|'rotate'|'scale'|'opacity'|'anchor'|'bpm'|'ease'|'visible'|'change'|'mcolor'|'jcolor'|'ncolor'|'drawer'|'shape'|'line'|'nline';
export type mainEvType = 'bgcolor'|'filter'|'wiggle'|'position'|'rotate'|'scale';
export type filterType = 'blur'|'dot'|'motionBlur'|'bloom'|'godray'|'convolution'|'glitch'|'grayscale'|'noise'|'pixelate'|'rgbsplit'
export type wiggleAxis = 'both'|'x'|'y'
export type judge = 'perfect'|'great'|'good'|'bad'|'miss'|'none'
export type drawer = 'fill'|'stroke'
export type eventValue = number|string|boolean|[number, number]

export type EmptyProps = {
    children?: ReactNode;
}

export interface keys{
    playerLeft:string;
    playerRight:string;
    playerJump:string;
    playerSneak:string;
    playerRun:string;
    interaction:string;
    escape:string;
}

export interface env{
    keys:keys
}

export interface Rsprite{
    position:[number, number];
    rotation:number;
    width:number;
    height:number;
    opacity:number;
    anchor:[number, number];
    hitbox:[number, number];
    src:string;
    showHitbox:boolean;
}

export interface Msprite{
    position:[number, number];
    rotation:number;
    width:number;
    height:number;
    opacity:number;
    anchor:[number, number];
    hitbox:[number, number];
    src:string[];
    srcIdx:number;
    isGravity:boolean;
    isCollision:boolean;
    isGround:boolean;
    showHitbox:boolean;
    dposition:[number, number];
    tags:string[];
    events:mevent[];
}
export type MspriteParams = 'position'|'rotation'|'width'|'height'|'opacity'|'anchor'|'hitbox'|'src'|'isGravity'|'isCollision'|'isGround'|'dposition'|'tags'|'events'

export type eventName = 'click'|'collision'|'keydown'|'keyup'|'isground';

export type scriptType = 'setAttribute';

export interface exevent{
    eventName:eventName;
    target:string|number;
    once?:boolean;
}
export interface script{
    type:scriptType;
    value:unknown;
}
export interface mevent{
    eventName:string;
    target:string|number;
    scripts:script[];
}
export type meventProps = 'eventName'|'script'

export interface player{
    position:[number, number];
    rotation:number;
    width:number;
    height:number;
    opacity:number;
    anchor:[number, number];
    hitbox:[number, number];
    src:string;
    jumpSrc:string;
    sneakSrc:string;
    sneakWalkSrc:string[];
    runSrc:string[];
    walkSrc:string[];
    isGround:boolean;
    isSneak:boolean;
    isRun:boolean;
    showHitbox:boolean;
    dposition:[number, number];
    events:mevent[];
    tags:string[];
}
export type playerParams = 'position'|'rotation'|'width'|'height'|'opacity'|'anchor'|'hitbox'|'src'|'sneakSrc'|'runSrc'|'isGround'|'isSneak'|'isRun'|'dposition'|'events'|'tags'

export interface text{
    position:[number, number];
    rotation:number;
    scale:[number, number];
    opacity:number;
    anchor:[number, number];
    content:string;
    color:string;
    weight:string;
}
export type textParams = 'position'|'rotation'|'scale'|'opacity'|'anchor'|'content'|'color'|'weight'

export interface camera{
    position:[number, number];
    rotation:number;
    scale:number;
    follow:string;
}
export type cameraParams = 'position'|'rotation'|'scale'|'follow'

export interface map{
    camera:camera;
    backgroundColor:string;
    sprites:Msprite[];
    texts:text[];
    player:player;
    gravity:number;
    ground:number;
}

export interface battleRenderData{
    events:event[];
    objs:obj[];
    backgroundColor:string;
    position:[number, number];
    rotate:number;
    scale:number;
    filters:filter;
}

export interface note{
    stamp:number;
    hit:number;
    judge:judge;
}

export interface filter{
    blur:number;
    dot:number;
    motionBlur:number;
    bloom:number;
    godray:number;
    convolution:number;
    glitch:number;
    grayscale:number;
    noise:number;
    pixelate:number;
    rgbsplit:number;
}


export interface event{
    stamp:number;
    type:mainEvType;
    value?:eventValue;
    duration?:number;
    filter?:filterType;
    smooth?:boolean;
    ease?:ease;
    speed?:number;
    axis?:wiggleAxis;
    seed?:number;
    octaves?:number;
    falloff?:number;
}
export type eventProps = 'stamp'|'type'|'value'|'duration'|'ease'|'speed'|'smooth'|'filter'|'axis'|'seed'|'octaves'|'falloff'

export interface objEvent{
    stamp:number;
    type:objEvType
    value?:eventValue;
    duration?:number;
    ease?:ease;
}
export type objEventProps = 'stamp'|'type'|'value'|'duration'|'ease'

export interface obj{
    type:'chart'|'sprite';
    bpm?:number; // speed bpm
    notes?:note[]; // notes
    src?:string; // sprite's img src
    position:[number, number];
    rotate:number;
    scale:[number, number];
    opacity:number;
    anchor:[number, number];
    events:objEvent[];
    ease?:ease; // note down easing
    visible:boolean;
    mcolor?:string; // chart color
    jcolor?:string; // chart judge block color
    ncolor?:string; // chart note color
    drawer?:drawer; // note's drawer
    shape?:string; // note's shape
    line?:number; // chart's line width
    nline?:number; // chart's stroke note width
}
export type objProps = 'type'|'bpm'|'notes'|'src'|'position'|'rotate'|'scale'|'opacity'|'anchor'|'events'|'ease'

export interface level{
    bpm:number;
    offset:number;
    song:string;
    songName?:string;
    backgroundColor:string;
    volume:number;
    events:event[];
    position:[number, number];
    rotate:number;
    scale:number;
    objs:obj[];
    filters:filter;
    endpoint:number;
}
export type levelProps = 'bpm'|'offset'|'song'|'songName'|'backgroundColor'|'volume'|'events'|'objs'|'endpoint'
