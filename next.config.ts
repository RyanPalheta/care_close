import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
    // PWA headers for installability
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                ],
            },
        ]
    },
}

// Sentry wrapping is safe without a DSN — it just skips source-map upload.
export default withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    // Only uploads source maps when SENTRY_AUTH_TOKEN is present (CI/Vercel).
    silent: !process.env.CI,
    widenClientFileUpload: true,
    disableLogger: true,
})
