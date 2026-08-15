import { useCallback } from 'react'
import { useRuntimeTask } from '../components/RuntimeStatus'
import { createRuntimeAssetFailure } from '../logic/runtimeAssets'

export function useRuntimeImage(source:string, failureMessage:string) {
    const task = useRuntimeTask('asset', source)
    const fail = useCallback(() => {
        task.fail(createRuntimeAssetFailure(source, new Error(failureMessage)))
    }, [failureMessage, source, task])

    const imageRef = useCallback((image:HTMLImageElement | null) => {
        if (!image?.complete) return
        if (image.naturalWidth > 0) task.complete()
        else fail()
    }, [fail, task])

    return { imageRef, complete:task.complete, fail }
}
