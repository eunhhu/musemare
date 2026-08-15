import { useCallback, useEffect, useRef } from 'react'
import { useRuntimeTask } from '../components/RuntimeStatus'
import { createRuntimeAssetFailure, mediaSourceMatches } from '../logic/runtimeAssets'

export function useRuntimeMedia<Media extends HTMLMediaElement = HTMLMediaElement>(source:string, failureMessage:string, enabled = Boolean(source)) {
    const mediaRef = useRef<Media | null>(null)
    const task = useRuntimeTask('asset', source, enabled)

    const complete = useCallback((media = mediaRef.current) => {
        if (!enabled || !media || media.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return
        if (mediaSourceMatches(media.currentSrc, source, window.location.href)) task.complete()
    }, [enabled, source, task])

    const fail = useCallback((media = mediaRef.current) => {
        if (!enabled || !media || !mediaSourceMatches(media.currentSrc, source, window.location.href)) return
        task.fail(createRuntimeAssetFailure(source, new Error(failureMessage)))
    }, [enabled, failureMessage, source, task])

    const elementRef = useCallback((media:Media | null) => {
        mediaRef.current = media
        if (media) complete(media)
    }, [complete])

    useEffect(() => {
        const media = mediaRef.current
        if (!enabled || !media) return
        const handleReady = () => complete(media)
        media.addEventListener('loadeddata', handleReady)
        media.addEventListener('canplay', handleReady)
        media.addEventListener('canplaythrough', handleReady)
        handleReady()
        return () => {
            media.removeEventListener('loadeddata', handleReady)
            media.removeEventListener('canplay', handleReady)
            media.removeEventListener('canplaythrough', handleReady)
        }
    }, [complete, enabled])

    return { mediaRef, elementRef, complete, fail }
}
