import { type PixiElements } from '@pixi/react'
import { Assets, Texture, type Texture as PixiTexture } from 'pixi.js'
import { useEffect, useState } from 'react'
import { createRuntimeAssetFailure } from '../logic/runtimeAssets'
import { useRuntimeTask } from './RuntimeStatus'

type PixiAssetSpriteProps = Omit<PixiElements['pixiSprite'], 'texture'> & {
    src: string
}

export function PixiAssetSprite({ src, ...props }: PixiAssetSpriteProps) {
    const task = useRuntimeTask('asset', src)
    const [loaded, setLoaded] = useState<{ src:string, texture:PixiTexture }>({
        src:'',
        texture:Texture.EMPTY,
    })

    useEffect(() => {
        let active = true

        Assets.load<PixiTexture>(src)
            .then(loadedTexture => {
                if (!active) return
                if (!loadedTexture || loadedTexture === Texture.EMPTY) {
                    task.fail(createRuntimeAssetFailure(src, new Error('Pixi returned an empty texture.')))
                    return
                }
                setLoaded({ src, texture:loadedTexture })
                task.complete()
            })
            .catch(error => {
                if (!active) return
                task.fail(createRuntimeAssetFailure(src, error))
            })

        return () => {
            active = false
        }
    }, [src, task])

    return <pixiSprite {...props} texture={loaded.src === src ? loaded.texture : Texture.EMPTY} />
}
