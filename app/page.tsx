'use client'

import dynamic from 'next/dynamic'

const Main = dynamic(() => import('./main'), { ssr: false })

export default function Home() {
  return <Main />
}
