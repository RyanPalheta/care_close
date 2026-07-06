'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
    useEffect(() => {
        Sentry.captureException(error)
    }, [error])

    return (
        <html lang="pt-BR">
            <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 24, margin: 0, background: '#f0f9ff' }}>
                <div style={{ textAlign: 'center', maxWidth: 360 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>💙</div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
                        Algo deu errado
                    </h1>
                    <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5, marginBottom: 20 }}>
                        Tivemos um problema inesperado. Nossa equipe já foi avisada.
                        Tente recarregar a página.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '12px 28px', borderRadius: 14, border: 'none', cursor: 'pointer',
                            background: 'linear-gradient(135deg, #42b6f0 0%, #7bc843 100%)',
                            color: 'white', fontWeight: 800, fontSize: 15,
                        }}
                    >
                        Recarregar
                    </button>
                </div>
            </body>
        </html>
    )
}
