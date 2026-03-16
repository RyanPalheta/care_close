import type { Metadata, Viewport } from 'next'
import { Lexend } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

const lexend = Lexend({
    subsets: ['latin'],
    variable: '--font-lexend',
    weight: ['300', '400', '500', '600', '700'],
})

export const viewport: Viewport = {
    themeColor: '#42b6f0',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
}

export const metadata: Metadata = {
    title: 'Care Close',
    description: 'Plataforma de cuidados e gerenciamento de medicamentos para pacientes e cuidadores',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'Care Close',
    },
    formatDetection: {
        telephone: false,
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="pt-BR" className={lexend.variable} suppressHydrationWarning>
            <head>
                <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
                <meta name="mobile-web-app-capable" content="yes" />
            </head>
            <body className="font-lexend antialiased bg-sky-50 min-h-screen">
                <div className="max-w-md mx-auto min-h-screen bg-white shadow-sm relative">
                    <AuthProvider>
                        {children}
                    </AuthProvider>
                </div>
            </body>
        </html>
    )
}
