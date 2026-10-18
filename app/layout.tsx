import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Badgers Session Hub',
  description:
    'Scheduling and communication between Winning Minds and Wisconsin Badgers women’s tennis.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Public+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
