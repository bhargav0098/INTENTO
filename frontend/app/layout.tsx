import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'INTENTO — AI Agent Platform',
  description: 'Autonomous AI Agent Platform. Type a goal. INTENTO thinks, plans, executes, and delivers real outcomes.',
  keywords: 'AI agents, autonomous, goal planning, execution, INTENTO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
