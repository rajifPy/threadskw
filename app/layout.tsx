import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sharing Opini Arek Kost',
  description: 'Platform diskusi ide, politik, dan bisnis untuk anak kost',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-primary-50 dark:bg-gray-900 transition-colors duration-300`}>
        <AuthProvider>
          {children}
          <Toaster 
            position="top-center"
            toastOptions={{
              className: 'dark:bg-gray-800 dark:text-white',
              style: {
                background: 'var(--toast-bg, #fff)',
                color: 'var(--toast-color, #000)',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
