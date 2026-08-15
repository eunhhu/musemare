import {
    BloomFilter,
    ConvolutionFilter,
    DotFilter,
    GlitchFilter,
    GodrayFilter,
    GrayscaleFilter,
    MotionBlurFilter,
    PixelateFilter,
    RGBSplitFilter,
} from 'pixi-filters'
import * as PIXI from 'pixi.js'
import type { filter, filterType } from '../data/types'

const filterOrder:filterType[] = [
    'blur', 'dot', 'motionBlur', 'bloom', 'godray', 'convolution', 'glitch',
    'grayscale', 'noise', 'pixelate', 'rgbsplit',
]

type BattleFilterFactory = (type:filterType) => PIXI.Filter

const createBattleFilter:BattleFilterFactory = type => {
    if (type === 'blur') return new PIXI.BlurFilter()
    if (type === 'dot') return new DotFilter()
    if (type === 'motionBlur') return new MotionBlurFilter({ velocity:[10, 10] })
    if (type === 'bloom') return new BloomFilter()
    if (type === 'godray') return new GodrayFilter()
    if (type === 'convolution') return new ConvolutionFilter()
    if (type === 'glitch') return new GlitchFilter()
    if (type === 'grayscale') return new GrayscaleFilter()
    if (type === 'noise') return new PIXI.NoiseFilter()
    if (type === 'pixelate') return new PixelateFilter()
    return new RGBSplitFilter()
}

export class BattleFilterRegistry {
    private readonly instances = new Map<filterType, PIXI.Filter>()

    constructor(private readonly createFilter:BattleFilterFactory = createBattleFilter) {}

    get size() {
        return this.instances.size
    }

    private get<T extends PIXI.Filter>(type:filterType):T {
        const current = this.instances.get(type)
        if (current) return current as T
        const created = this.createFilter(type)
        this.instances.set(type, created)
        return created as T
    }

    resolve(values:filter, timeline:number):PIXI.Filter[] {
        const active:PIXI.Filter[] = []
        for (const type of filterOrder) {
            if (values[type] === 0) continue

            if (type === 'blur') {
                const instance = this.get<PIXI.BlurFilter>(type)
                instance.strength = values.blur
                active.push(instance)
            } else if (type === 'dot') {
                const instance = this.get<DotFilter>(type)
                instance.scale = values.dot
                active.push(instance)
            } else if (type === 'motionBlur') {
                const instance = this.get<MotionBlurFilter>(type)
                instance.kernelSize = Math.min(15, Math.max(5, Math.round(values.motionBlur * 5) | 1))
                active.push(instance)
            } else if (type === 'bloom') {
                const instance = this.get<BloomFilter>(type)
                instance.strength = values.bloom * 2
                active.push(instance)
            } else if (type === 'godray') {
                const instance = this.get<GodrayFilter>(type)
                instance.gain = values.godray
                active.push(instance)
            } else if (type === 'convolution') {
                const instance = this.get<ConvolutionFilter>(type)
                const strength = values.convolution
                instance.matrix = new Float32Array([
                    0, -strength, 0,
                    -strength, 1 + strength * 4, -strength,
                    0, -strength, 0,
                ])
                active.push(instance)
            } else if (type === 'glitch') {
                const instance = this.get<GlitchFilter>(type)
                const amount = values.glitch * 5
                instance.red.x = amount
                instance.red.y = amount
                instance.green.x = -amount
                instance.green.y = -amount
                instance.blue.x = amount / 2
                instance.blue.y = -amount / 2
                active.push(instance)
            } else if (type === 'grayscale') {
                active.push(this.get<GrayscaleFilter>(type))
            } else if (type === 'noise') {
                const instance = this.get<PIXI.NoiseFilter>(type)
                instance.noise = values.noise
                instance.seed = timeline % 1
                active.push(instance)
            } else if (type === 'pixelate') {
                const instance = this.get<PixelateFilter>(type)
                instance.size = values.pixelate * 10
                active.push(instance)
            } else if (type === 'rgbsplit') {
                const instance = this.get<RGBSplitFilter>(type)
                const amount = values.rgbsplit * 5
                instance.redX = amount
                instance.redY = amount
                instance.greenX = amount / 2
                instance.greenY = -amount / 2
                instance.blueX = -amount
                instance.blueY = -amount
                active.push(instance)
            }
        }
        return active
    }

    destroy() {
        for (const instance of this.instances.values()) instance.destroy()
        this.instances.clear()
    }
}
