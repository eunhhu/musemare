'use client'

import dynamic from 'next/dynamic'

const MapEditorClient = dynamic(() => import('./MapEditorClient'), { ssr: false })

export default function Page() {
  return <MapEditorClient />
}
