import type {
    Msprite,
    camera,
    ease,
    event,
    eventValue,
    filter,
    filterType,
    level,
    map,
    mevent,
    note,
    obj,
    objEvent,
    player,
    text,
} from '../data/types'

type JsonRecord = Record<string, unknown>

const eases = new Set<ease>([
    'linear', 'insine', 'outsine', 'sine', 'inquad', 'outquad', 'quad',
    'incubic', 'outcubic', 'cubic', 'inquart', 'outquart', 'quart',
    'inquint', 'outquint', 'quint', 'inexpo', 'outexpo', 'expo',
    'incirc', 'outcirc', 'circ', 'inback', 'outback', 'back',
])
const mainEventTypes = new Set<event['type']>(['bgcolor', 'filter', 'wiggle', 'position', 'rotate', 'scale'])
const objectEventTypes = new Set<objEvent['type']>([
    'position', 'rotate', 'scale', 'opacity', 'anchor', 'bpm', 'ease', 'visible',
    'change', 'mcolor', 'jcolor', 'ncolor', 'drawer', 'shape', 'line', 'nline',
])
const filterTypes = new Set<filterType>([
    'blur', 'dot', 'motionBlur', 'bloom', 'godray', 'convolution', 'glitch',
    'grayscale', 'noise', 'pixelate', 'rgbsplit',
])
const judges = new Set<note['judge']>(['perfect', 'good', 'miss', 'none'])

export class ContentValidationError extends Error {
    constructor(path:string, expectation:string) {
        super(`${path} must be ${expectation}.`)
        this.name = 'ContentValidationError'
    }
}

function record(value:unknown, path:string):JsonRecord {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ContentValidationError(path, 'an object')
    }
    return value as JsonRecord
}

function array(value:unknown, path:string):unknown[] {
    if (!Array.isArray(value)) throw new ContentValidationError(path, 'an array')
    return value
}

function finite(value:unknown, path:string):number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ContentValidationError(path, 'a finite number')
    }
    return value
}

function positive(value:unknown, path:string):number {
    const result = finite(value, path)
    if (result <= 0) throw new ContentValidationError(path, 'greater than zero')
    return result
}

function nonNegative(value:unknown, path:string):number {
    const result = finite(value, path)
    if (result < 0) throw new ContentValidationError(path, 'zero or greater')
    return result
}

function string(value:unknown, path:string):string {
    if (typeof value !== 'string') throw new ContentValidationError(path, 'a string')
    return value
}

function color(value:unknown, path:string):string {
    const result = string(value, path)
    if (!/^#[0-9a-f]{6}$/i.test(result)) throw new ContentValidationError(path, 'a #RRGGBB color')
    return result
}

function boolean(value:unknown, path:string):boolean {
    if (typeof value !== 'boolean') throw new ContentValidationError(path, 'a boolean')
    return value
}

function tuple(value:unknown, path:string):[number, number] {
    const values = array(value, path)
    if (values.length !== 2) throw new ContentValidationError(path, 'a two-number tuple')
    return [finite(values[0], `${path}[0]`), finite(values[1], `${path}[1]`)]
}

function stringArray(value:unknown, path:string):string[] {
    return array(value, path).map((entry, index) => string(entry, `${path}[${index}]`))
}

function eventValueOf(value:unknown, path:string):eventValue {
    if (typeof value === 'number') return finite(value, path)
    if (typeof value === 'string' || typeof value === 'boolean') return value
    return tuple(value, path)
}

function numericEventValue(value:unknown, path:string) {
    if (typeof value === 'number') return finite(value, path)
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return value
    throw new ContentValidationError(path, 'a finite number or numeric string')
}

function optionalEase(value:unknown, path:string) {
    if (value === undefined) return
    if (typeof value !== 'string' || !eases.has(value as ease)) {
        throw new ContentValidationError(path, 'a supported easing name')
    }
}

function validateFilters(value:unknown, path:string):filter {
    const result = record(value, path)
    for (const name of filterTypes) finite(result[name], `${path}.${name}`)
    return result as unknown as filter
}

function validateMainEvent(value:unknown, path:string):event {
    const result = record(value, path)
    finite(result.stamp, `${path}.stamp`)
    if (typeof result.type !== 'string' || !mainEventTypes.has(result.type as event['type'])) {
        throw new ContentValidationError(`${path}.type`, 'a supported main event type')
    }
    if (result.value === undefined) throw new ContentValidationError(`${path}.value`, 'present')
    eventValueOf(result.value, `${path}.value`)
    positive(result.duration, `${path}.duration`)
    if (result.type === 'position') tuple(result.value, `${path}.value`)
    else if (result.type === 'bgcolor') color(result.value, `${path}.value`)
    else numericEventValue(result.value, `${path}.value`)
    if (result.type === 'wiggle') positive(result.speed, `${path}.speed`)
    else if (result.speed !== undefined) positive(result.speed, `${path}.speed`)
    if (result.smooth !== undefined) boolean(result.smooth, `${path}.smooth`)
    optionalEase(result.ease, `${path}.ease`)
    if (result.filter !== undefined && (typeof result.filter !== 'string' || !filterTypes.has(result.filter as filterType))) {
        throw new ContentValidationError(`${path}.filter`, 'a supported filter type')
    }
    if (result.type === 'filter' && result.filter === undefined) {
        throw new ContentValidationError(`${path}.filter`, 'present for filter events')
    }
    return result as unknown as event
}

function validateObjectEvent(value:unknown, path:string):objEvent {
    const result = record(value, path)
    finite(result.stamp, `${path}.stamp`)
    if (typeof result.type !== 'string' || !objectEventTypes.has(result.type as objEvent['type'])) {
        throw new ContentValidationError(`${path}.type`, 'a supported object event type')
    }
    if (result.value === undefined) throw new ContentValidationError(`${path}.value`, 'present')
    eventValueOf(result.value, `${path}.value`)
    positive(result.duration, `${path}.duration`)
    if (['position', 'scale', 'anchor'].includes(result.type as string)) tuple(result.value, `${path}.value`)
    else if (['rotate', 'opacity', 'bpm', 'line', 'nline'].includes(result.type as string)) numericEventValue(result.value, `${path}.value`)
    else if (['mcolor', 'jcolor', 'ncolor'].includes(result.type as string)) color(result.value, `${path}.value`)
    else if (result.type === 'visible') boolean(result.value, `${path}.value`)
    else if (result.type === 'ease') optionalEase(result.value, `${path}.value`)
    else if (result.type === 'drawer' && result.value !== 'fill' && result.value !== 'stroke') {
        throw new ContentValidationError(`${path}.value`, '"fill" or "stroke"')
    } else string(result.value, `${path}.value`)
    optionalEase(result.ease, `${path}.ease`)
    return result as unknown as objEvent
}

function validateNote(value:unknown, path:string):note {
    const result = record(value, path)
    finite(result.stamp, `${path}.stamp`)
    finite(result.hit, `${path}.hit`)
    if (typeof result.judge !== 'string' || !judges.has(result.judge as note['judge'])) {
        throw new ContentValidationError(`${path}.judge`, 'a supported judgement')
    }
    return result as unknown as note
}

function validateObject(value:unknown, path:string):obj {
    const result = record(value, path)
    if (result.type !== 'chart' && result.type !== 'sprite') {
        throw new ContentValidationError(`${path}.type`, '"chart" or "sprite"')
    }
    tuple(result.position, `${path}.position`)
    finite(result.rotate, `${path}.rotate`)
    tuple(result.scale, `${path}.scale`)
    finite(result.opacity, `${path}.opacity`)
    tuple(result.anchor, `${path}.anchor`)
    boolean(result.visible, `${path}.visible`)
    array(result.events, `${path}.events`).forEach((entry, index) => validateObjectEvent(entry, `${path}.events[${index}]`))

    if (result.type === 'sprite') {
        string(result.src, `${path}.src`)
    } else {
        positive(result.bpm, `${path}.bpm`)
        array(result.notes, `${path}.notes`).forEach((entry, index) => validateNote(entry, `${path}.notes[${index}]`))
        optionalEase(result.ease, `${path}.ease`)
        color(result.mcolor, `${path}.mcolor`)
        color(result.jcolor, `${path}.jcolor`)
        color(result.ncolor, `${path}.ncolor`)
        if (result.drawer !== 'fill' && result.drawer !== 'stroke') {
            throw new ContentValidationError(`${path}.drawer`, '"fill" or "stroke"')
        }
        string(result.shape, `${path}.shape`)
        nonNegative(result.line, `${path}.line`)
        nonNegative(result.nline, `${path}.nline`)
    }
    return result as unknown as obj
}

function validateScriptEvents(value:unknown, path:string):mevent[] {
    return array(value, path).map((entry, index) => {
        const eventPath = `${path}[${index}]`
        const result = record(entry, eventPath)
        string(result.eventName, `${eventPath}.eventName`)
        if (typeof result.target !== 'string') finite(result.target, `${eventPath}.target`)
        array(result.scripts, `${eventPath}.scripts`).forEach((scriptEntry, scriptIndex) => {
            const scriptPath = `${eventPath}.scripts[${scriptIndex}]`
            const script = record(scriptEntry, scriptPath)
            if (script.type !== 'setAttribute') {
                throw new ContentValidationError(`${scriptPath}.type`, '"setAttribute"')
            }
        })
        return result as unknown as mevent
    })
}

function validatePlayer(value:unknown, path:string):player {
    const result = record(value, path)
    tuple(result.position, `${path}.position`)
    finite(result.rotation, `${path}.rotation`)
    nonNegative(result.width, `${path}.width`)
    nonNegative(result.height, `${path}.height`)
    finite(result.opacity, `${path}.opacity`)
    tuple(result.anchor, `${path}.anchor`)
    const hitbox = tuple(result.hitbox, `${path}.hitbox`)
    if (hitbox.some(entry => entry < 0)) throw new ContentValidationError(`${path}.hitbox`, 'non-negative')
    string(result.src, `${path}.src`)
    string(result.jumpSrc, `${path}.jumpSrc`)
    string(result.sneakSrc, `${path}.sneakSrc`)
    stringArray(result.sneakWalkSrc, `${path}.sneakWalkSrc`)
    stringArray(result.runSrc, `${path}.runSrc`)
    stringArray(result.walkSrc, `${path}.walkSrc`)
    boolean(result.isGround, `${path}.isGround`)
    boolean(result.isSneak, `${path}.isSneak`)
    boolean(result.isRun, `${path}.isRun`)
    boolean(result.showHitbox, `${path}.showHitbox`)
    tuple(result.dposition, `${path}.dposition`)
    validateScriptEvents(result.events, `${path}.events`)
    stringArray(result.tags, `${path}.tags`)
    return result as unknown as player
}

function validateSprite(value:unknown, path:string):Msprite {
    const result = record(value, path)
    tuple(result.position, `${path}.position`)
    finite(result.rotation, `${path}.rotation`)
    nonNegative(result.width, `${path}.width`)
    nonNegative(result.height, `${path}.height`)
    finite(result.opacity, `${path}.opacity`)
    tuple(result.anchor, `${path}.anchor`)
    const hitbox = tuple(result.hitbox, `${path}.hitbox`)
    if (hitbox.some(entry => entry < 0)) throw new ContentValidationError(`${path}.hitbox`, 'non-negative')
    const sources = stringArray(result.src, `${path}.src`)
    const sourceIndex = finite(result.srcIdx, `${path}.srcIdx`)
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || (sources.length > 0 && sourceIndex >= sources.length)) {
        throw new ContentValidationError(`${path}.srcIdx`, 'a valid source index')
    }
    boolean(result.isGravity, `${path}.isGravity`)
    boolean(result.isCollision, `${path}.isCollision`)
    boolean(result.isGround, `${path}.isGround`)
    boolean(result.showHitbox, `${path}.showHitbox`)
    tuple(result.dposition, `${path}.dposition`)
    stringArray(result.tags, `${path}.tags`)
    validateScriptEvents(result.events, `${path}.events`)
    return result as unknown as Msprite
}

function validateText(value:unknown, path:string):text {
    const result = record(value, path)
    tuple(result.position, `${path}.position`)
    finite(result.rotation, `${path}.rotation`)
    tuple(result.scale, `${path}.scale`)
    finite(result.opacity, `${path}.opacity`)
    tuple(result.anchor, `${path}.anchor`)
    string(result.content, `${path}.content`)
    color(result.color, `${path}.color`)
    string(result.weight, `${path}.weight`)
    return result as unknown as text
}

function validateCamera(value:unknown, path:string):camera {
    const result = record(value, path)
    tuple(result.position, `${path}.position`)
    finite(result.rotation, `${path}.rotation`)
    positive(result.scale, `${path}.scale`)
    string(result.follow, `${path}.follow`)
    return result as unknown as camera
}

export function validateLevel(value:unknown):level {
    const result = record(value, 'level')
    positive(result.bpm, 'level.bpm')
    finite(result.offset, 'level.offset')
    string(result.song, 'level.song')
    color(result.backgroundColor, 'level.backgroundColor')
    const volume = finite(result.volume, 'level.volume')
    if (volume < 0 || volume > 100) throw new ContentValidationError('level.volume', 'between 0 and 100')
    array(result.events, 'level.events').forEach((entry, index) => validateMainEvent(entry, `level.events[${index}]`))
    tuple(result.position, 'level.position')
    finite(result.rotate, 'level.rotate')
    finite(result.scale, 'level.scale')
    array(result.objs, 'level.objs').forEach((entry, index) => validateObject(entry, `level.objs[${index}]`))
    validateFilters(result.filters, 'level.filters')
    nonNegative(result.endpoint, 'level.endpoint')
    return result as unknown as level
}

export function validateMap(value:unknown):map {
    const result = record(value, 'map')
    validateCamera(result.camera, 'map.camera')
    color(result.backgroundColor, 'map.backgroundColor')
    array(result.sprites, 'map.sprites').forEach((entry, index) => validateSprite(entry, `map.sprites[${index}]`))
    array(result.texts, 'map.texts').forEach((entry, index) => validateText(entry, `map.texts[${index}]`))
    validatePlayer(result.player, 'map.player')
    finite(result.gravity, 'map.gravity')
    finite(result.ground, 'map.ground')
    return result as unknown as map
}

function parseJson(serialized:string, label:string):unknown {
    try {
        return JSON.parse(serialized) as unknown
    } catch {
        throw new ContentValidationError(label, 'valid JSON')
    }
}

export function parseLevelJson(serialized:string):level {
    return validateLevel(parseJson(serialized, 'level file'))
}

export function parseMapJson(serialized:string):map {
    return validateMap(parseJson(serialized, 'map file'))
}
