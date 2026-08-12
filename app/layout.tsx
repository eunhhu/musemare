import './styles/globals.scss'
import type { Metadata } from 'next'
import { RuntimeStatusProvider } from './components/RuntimeStatus'

export const metadata: Metadata = {
  title: 'MuseMare',
  description: 'Are you ready to have an adventure with a guitar?',
  icons: {
    icon: '/assets/ui/icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body><RuntimeStatusProvider>{children}</RuntimeStatusProvider></body>
    </html>
  )
}
