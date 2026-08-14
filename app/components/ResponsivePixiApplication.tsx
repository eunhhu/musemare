'use client'

import { Application, type ApplicationRef } from '@pixi/react'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { Application as PixiApplication } from 'pixi.js'
import { useRuntimeTask } from './RuntimeStatus'

type ResponsivePixiApplicationProps = {
    width:number
    height:number
    backgroundColor:string
    children:ReactNode
    className?:string
    label:string
}

function synchronizeRenderer(app:PixiApplication, width:number, height:number, backgroundColor:string) {
    app.renderer.resize(width, height)
    app.renderer.background.color = backgroundColor
    const canvas = app.canvas
    canvas.dataset.pixiReady = 'true'
    canvas.dataset.pixiBackground = app.renderer.background.color.toHex()
    canvas.dataset.pixiWidth = String(canvas.width)
    canvas.dataset.pixiHeight = String(canvas.height)
}

export function ResponsivePixiApplication({
    width,
    height,
    backgroundColor,
    children,
    className,
    label,
}:ResponsivePixiApplicationProps) {
    const applicationRef = useRef<ApplicationRef>(null)
    const ready = width > 0 && height > 0
    const task = useRuntimeTask('surface', label)
    const handleInit = useCallback((app:PixiApplication) => {
        synchronizeRenderer(app, width, height, backgroundColor)
        task.complete()
    }, [backgroundColor, height, task, width])

    useEffect(() => {
        const app = applicationRef.current?.getApplication()
        if (!app || !ready) return
        synchronizeRenderer(app, width, height, backgroundColor)
    }, [backgroundColor, height, ready, width])

    if (!ready) return null

    return <Application
        ref={applicationRef}
        className={className}
        width={width}
        height={height}
        resolution={window.devicePixelRatio}
        autoDensity={true}
        backgroundColor={backgroundColor}
        preference="webgl"
        onInit={handleInit}
    >
        {children}
    </Application>
}
