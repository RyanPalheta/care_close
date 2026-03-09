'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

/**
 * Hook to protect routes client-side.
 * If not authenticated, redirects to '/'.
 * Returns { user, profile, loading } from auth context.
 */
export function useProtectedRoute() {
    const { user, profile, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/')
        }
    }, [loading, user, router])

    return { user, profile, loading }
}
