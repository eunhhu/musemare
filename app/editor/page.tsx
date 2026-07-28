'use client'

import dynamic from 'next/dynamic'

const EditorClient = dynamic(() => import('./EditorClient'), { ssr: false })

export default function Page() {
  return <EditorClient />
}
