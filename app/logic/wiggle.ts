import type { event, wiggleAxis } from '../data/types'

const DEFAULT_FREQUENCY = 5
const DEFAULT_OCTAVES = 3
const DEFAULT_FALLOFF = 0.5
const MAX_OCTAVES = 8

function clamp(value:number, minimum:number, maximum:number) {
    return Math.min(maximum, Math.max(minimum, value))
}

function smoothstep(value:number) {
    const bounded = clamp(value, 0, 1)
    return bounded * bounded * (3 - 2 * bounded)
}

function hash(index:number, seed:number) {
    let value = Math.imul(index ^ seed, 0x45d9f3b)
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
    value ^= value >>> 16
    return (value >>> 0) / 0xffffffff * 2 - 1
}

function valueNoise(time:number, seed:number) {
    const start = Math.floor(time)
    const progress = time - start
    const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10)
    const from = hash(start, seed)
    return from + (hash(start + 1, seed) - from) * eased
}

function fractalNoise(time:number, seed:number, octaves:number, falloff:number) {
    let amplitude = 1
    let frequency = 1
    let total = 0
    let weight = 0
    for (let octave = 0; octave < octaves; octave += 1) {
        total += valueNoise(time * frequency, seed + octave * 1013) * amplitude
        weight += amplitude
        amplitude *= falloff
        frequency *= 2
    }
    return weight > 0 ? total / weight : 0
}

export function wiggleDurationSeconds(value:Pick<event, 'duration'>) {
    const rate = Number(value.duration)
    return Number.isFinite(rate) && rate > 0 ? 60 / rate : 0
}

export function wiggleDurationRate(seconds:number) {
    return 60 / Math.max(0.01, Number.isFinite(seconds) ? seconds : 0.01)
}

export type WiggleOffset = {
    x:number
    y:number
    envelope:number
}

/**
 * Deterministic, band-limited motion similar to an AE wiggle expression.
 * Amplitude keeps the legacy level scale: 10 event units equal 1% of frame.
 */
export function evaluateWiggle(value:event, timeline:number):WiggleOffset {
    const duration = wiggleDurationSeconds(value)
    const elapsed = timeline - value.stamp
    if (duration <= 0 || elapsed < 0 || elapsed >= duration) return { x:0, y:0, envelope:0 }

    const frequency = Math.max(0.01, Number(value.speed) || DEFAULT_FREQUENCY)
    const amplitude = (Number(value.value) || 0) / 10
    const octaves = clamp(Math.round(Number(value.octaves) || DEFAULT_OCTAVES), 1, MAX_OCTAVES)
    const falloff = clamp(Number(value.falloff) || DEFAULT_FALLOFF, 0.05, 1)
    const seed = Math.round(Number.isFinite(Number(value.seed)) ? Number(value.seed) : value.stamp * 1000)
    const axis:wiggleAxis = value.axis ?? 'y'
    const sampleTime = elapsed * frequency

    const sample = (channelSeed:number) => {
        const current = fractalNoise(sampleTime, channelSeed, octaves, falloff)
        const origin = fractalNoise(0, channelSeed, octaves, falloff)
        return (current - origin) * amplitude
    }

    const fadeInDuration = Math.min(0.045, duration * 0.18)
    const fadeIn = fadeInDuration > 0 ? smoothstep(elapsed / fadeInDuration) : 1
    const fadeOutDuration = Math.min(0.14, duration * 0.35)
    const fadeOut = value.smooth && fadeOutDuration > 0
        ? smoothstep((duration - elapsed) / fadeOutDuration)
        : 1
    const envelope = fadeIn * fadeOut

    return {
        x:axis === 'y' ? 0 : sample(seed + 17) * envelope,
        y:axis === 'x' ? 0 : sample(seed + 7919) * envelope,
        envelope,
    }
}
