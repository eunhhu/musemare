import { FC } from "react";
import { battleRenderData, ease, EmptyProps, level, Msprite, player, Rsprite } from "./types";

export function isInRange(me:number, range:number, tar:number){
    return tar - range < me && me < tar + range
}

function easeInSine(x: number): number {return 1 - Math.cos((x * Math.PI) / 2);}
function easeOutSine(x: number): number {return Math.sin((x * Math.PI) / 2);}
function easeInOutSine(x: number): number {return -(Math.cos(Math.PI * x) - 1) / 2;}
function easeInQuad(x: number): number {return x * x;}
function easeOutQuad(x: number): number {return 1 - (1 - x) * (1 - x);}
function easeInOutQuad(x: number): number {return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;}
function easeInCubic(x: number): number {return x * x * x;}
function easeOutCubic(x: number): number {return 1 - Math.pow(1 - x, 3);}
function easeInOutCubic(x: number): number {return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;}
function easeInQuart(x: number): number {return x * x * x * x;}
function easeOutQuart(x: number): number {return 1 - Math.pow(1 - x, 4);}
function easeInOutQuart(x: number): number {return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;}
function easeInQuint(x: number): number {return x * x * x * x * x;}
function easeOutQuint(x: number): number {return 1 - Math.pow(1 - x, 5);}
function easeInOutQuint(x: number): number {return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;}
function easeInExpo(x: number): number {return x === 0 ? 0 : Math.pow(2, 10 * x - 10);}
function easeOutExpo(x: number): number {return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);}
function easeInOutExpo(x: number): number {return x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;}
function easeInCirc(x: number): number {return 1 - Math.sqrt(1 - Math.pow(x, 2));}
function easeOutCirc(x: number): number {return Math.sqrt(1 - Math.pow(x - 1, 2));}
function easeInOutCirc(x: number): number {return x < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2;}
function easeInBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * x * x * x - c1 * x * x;
}
function easeOutBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function easeInOutBack(x: number): number {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return x < 0.5 ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2 : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
}

export function hexToRgb(hex:string):number[] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
    ] : [0, 0, 0];
}

export function componentToHex(c:number):string {
    const hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

export function rgbToHex(r:number, g:number, b:number):string {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

export function Easing(n:number, ease:ease):number{
    switch(ease){
        case 'linear': return n
        case 'insine': return easeInSine(n)
        case 'outsine': return easeOutSine(n)
        case 'sine': return easeInOutSine(n)
        case 'inquad': return easeInQuad(n)
        case 'outquad': return easeOutQuad(n)
        case 'quad': return easeInOutQuad(n)
        case 'incubic': return easeInCubic(n)
        case 'outcubic': return easeOutCubic(n)
        case 'cubic': return easeInOutCubic(n)
        case 'inquart': return easeInQuart(n)
        case 'outquart': return easeOutQuart(n)
        case 'quart': return easeInOutQuart(n)
        case 'inquint': return easeInQuint(n)
        case 'outquint': return easeOutQuint(n)
        case 'quint': return easeInOutQuint(n)
        case 'inexpo': return easeInExpo(n)
        case 'outexpo': return easeOutExpo(n)
        case 'expo': return easeInOutExpo(n)
        case 'incirc': return easeInCirc(n)
        case 'outcirc': return easeOutCirc(n)
        case 'circ': return easeInOutCirc(n)
        case 'inback': return easeInBack(n)
        case 'outback': return easeOutBack(n)
        case 'back': return easeInOutBack(n)
    }
}

export function calcEventValue(timeline:number, stamp:number, duration:number, start:number, end:number, ease?:ease){
    if(timeline >= stamp + +(duration)){return end}
    else {
        const _per:number = Easing((timeline - stamp) / +(duration), ease || 'linear')
        return start + _per*(end - start)
    }
}

export function calcEventColor(timeline:number, stamp:number, duration:number, start:string, end:string, ease?:ease){
    if(timeline >= stamp + +(duration)){return end}
    else {
        const _per:number = Easing((timeline - stamp) / +(duration), ease || 'linear')
        const _bs = hexToRgb(start)
        const _nw = hexToRgb(end);
        const _rs = _bs.map((_v, _i) => {
            return _v + Math.round(_per * (_nw[_i] - _v))
        })
        return rgbToHex(_rs[0], _rs[1], _rs[2])
    }
}

export function getPos(_pos:[number, number], _stage:[number, number]):[number, number]{
    return _pos.map((v:number, i:number) => (v-50)/100*_stage[i]) as [number, number]
}

export function parseHex(hex:string){
    return parseInt(hex.replace('#', ''), 16)
}

export const strengthFilters = ['blur', 'dot', 'motionBlur', 'bloom', 'godray', 'convolution', 'glitch', 'noise', 'pixelate', 'rgbsplit']
export const enableFilters = ['grayscale']


export function lvlToRendata(lv:level):battleRenderData{
    return {backgroundColor:lv.backgroundColor, events:lv.events, filters:lv.filters, objs:lv.objs, position:lv.position, rotate:lv.rotate, scale:lv.scale}
}

export function MsToRs(ms:Msprite):Rsprite{
    return {anchor:ms.anchor, hitbox:ms.hitbox, opacity:ms.opacity, position:ms.position, rotation:ms.rotation,
    width:ms.width, height:ms.height, src:ms.src[ms.srcIdx], showHitbox:ms.showHitbox}
}

export function MsArrToRsArr(ms:Msprite[]):Rsprite[]{
    return ms.map(v => MsToRs(v)) as Rsprite[]
}

type CollisionShape = Pick<Msprite, 'position' | 'anchor' | 'width' | 'height' | 'hitbox'>

export type SpriteBounds = {
    left:number
    right:number
    top:number
    bottom:number
    width:number
    height:number
}

function hitboxDimension(size:number, ratio:number | undefined) {
    return size * (Number.isFinite(ratio) && (ratio as number) >= 0 ? ratio as number : 1)
}

export function getSpriteHitboxBounds(sprite:CollisionShape, position = sprite.position):SpriteBounds {
    const width = hitboxDimension(sprite.width, sprite.hitbox?.[0])
    const height = hitboxDimension(sprite.height, sprite.hitbox?.[1])
    const left = position[0] - sprite.anchor[0] * width
    const top = position[1] - sprite.anchor[1] * height
    return { left, right:left + width, top, bottom:top + height, width, height }
}

function boundsOverlap(first:SpriteBounds, second:SpriteBounds) {
    return first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top
}

function rangesOverlap(firstStart:number, firstEnd:number, secondStart:number, secondEnd:number) {
    return firstStart < secondEnd && firstEnd > secondStart
}

export function checkCollisionWithPos(pos:[number, number], sp1:Msprite, sp2:Msprite):boolean{
    return boundsOverlap(getSpriteHitboxBounds(sp1, pos), getSpriteHitboxBounds(sp2))
}

export function checkCollision(sp1:Msprite, sp2:Msprite):boolean{
    return checkCollisionWithPos([
        sp1.position[0] + sp1.dposition[0],
        sp1.position[1] + sp1.dposition[1],
    ], sp1, sp2)
}

export function initCollidedPosition(_me: Msprite, _sprites: Msprite[]): Msprite {
    const actor: Msprite = {
        ..._me,
        position:[..._me.position],
        dposition:[..._me.dposition],
    }
    const colliders = _sprites.filter(sprite => sprite.isCollision)
    const actorSize = getSpriteHitboxBounds(actor)
    const start:[number, number] = [...actor.position]

    const horizontalVelocity = actor.dposition[0]
    const horizontalStart = getSpriteHitboxBounds(actor, start)
    actor.position[0] += horizontalVelocity
    let collidedHorizontally = false
    for (const collider of colliders) {
        const target = getSpriteHitboxBounds(actor)
        const obstacle = getSpriteHitboxBounds(collider)
        if (!rangesOverlap(target.top, target.bottom, obstacle.top, obstacle.bottom)) continue
        const crossedRight = horizontalVelocity > 0
            && horizontalStart.right <= obstacle.left
            && target.right >= obstacle.left
        const crossedLeft = horizontalVelocity < 0
            && horizontalStart.left >= obstacle.right
            && target.left <= obstacle.right
        const embeddedFromLeft = horizontalVelocity > 0 && boundsOverlap(target, obstacle) && horizontalStart.left < obstacle.left
        const embeddedFromRight = horizontalVelocity < 0 && boundsOverlap(target, obstacle) && horizontalStart.right > obstacle.right
        if (crossedRight || embeddedFromLeft) {
            actor.position[0] = Math.min(actor.position[0], obstacle.left - (1 - actor.anchor[0]) * actorSize.width)
            collidedHorizontally = true
        } else if (crossedLeft || embeddedFromRight) {
            actor.position[0] = Math.max(actor.position[0], obstacle.right + actor.anchor[0] * actorSize.width)
            collidedHorizontally = true
        }
    }
    if (collidedHorizontally) actor.dposition[0] = 0

    const verticalVelocity = actor.dposition[1]
    const verticalStartPosition:[number, number] = [actor.position[0], start[1]]
    const verticalStart = getSpriteHitboxBounds(actor, verticalStartPosition)
    actor.position[1] += verticalVelocity
    actor.isGround = false
    for (const collider of colliders) {
        const target = getSpriteHitboxBounds(actor)
        const obstacle = getSpriteHitboxBounds(collider)
        if (!rangesOverlap(target.left, target.right, obstacle.left, obstacle.right)) continue
        const crossedDown = verticalVelocity > 0
            && verticalStart.bottom <= obstacle.top
            && target.bottom >= obstacle.top
        const crossedUp = verticalVelocity < 0
            && verticalStart.top >= obstacle.bottom
            && target.top <= obstacle.bottom
        const embeddedFromAbove = verticalVelocity > 0 && boundsOverlap(target, obstacle) && verticalStart.top < obstacle.top
        const embeddedFromBelow = verticalVelocity < 0 && boundsOverlap(target, obstacle) && verticalStart.bottom > obstacle.bottom
        if (crossedDown || embeddedFromAbove) {
            actor.position[1] = Math.min(actor.position[1], obstacle.top - (1 - actor.anchor[1]) * actorSize.height)
            actor.isGround = true
            actor.dposition[1] = 0
        } else if (crossedUp || embeddedFromBelow) {
            actor.position[1] = Math.max(actor.position[1], obstacle.bottom + actor.anchor[1] * actorSize.height)
            actor.dposition[1] = 0
        }
    }

    if (!actor.isGround) {
        actor.isGround = colliders.some(collider => (
            checkCollisionWithPos([actor.position[0], actor.position[1] + 0.5], actor, collider)
        ))
    }
    return actor
}

export function playerToMsprite(_player:player){
    return {
        position:_player.position,
        rotation:_player.rotation,
        width:_player.width,
        height:_player.height,
        opacity:_player.opacity,
        anchor:_player.anchor,
        hitbox:_player.hitbox,
        src:[_player.src],
        srcIdx:0,
        isGravity:true,
        isCollision:true,
        isGround:_player.isGround,
        dposition:_player.dposition,
        tags:_player.tags,
        events:_player.events,
        showHitbox:_player.showHitbox,
    } as Msprite
}

export const Empty:FC<EmptyProps> = ({ children }) => {
    return <>{children}</>
}
