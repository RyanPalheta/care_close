'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface UserProfile {
    id: string
    name: string
    role: 'patient' | 'family' | 'caregiver' | 'institution'
    avatar_url?: string
}

interface AuthContextType {
    user: User | null
    profile: UserProfile | null
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    signOut: async () => { },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user)
                fetchProfile(session.user.id)
            } else {
                setUser(null)
                setLoading(false)
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                // If we just logged in, user state changes but profile needs to be fetched
                // Set loading to true so we don't abort early in auth/page.tsx
                setLoading(true)
                setUser(session.user)
                fetchProfile(session.user.id)
            }
            else {
                setUser(null)
                setProfile(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    async function fetchProfile(userId: string, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Ensure we have an active session before querying (RLS depends on auth.uid())
                const { data: sessionData } = await supabase.auth.getSession()
                if (!sessionData.session) {
                    console.warn(`fetchProfile attempt ${attempt}: no active session, retrying...`)
                    if (attempt < retries) {
                        await new Promise(r => setTimeout(r, 1000 * attempt))
                        continue
                    }
                    setProfile(null)
                    setLoading(false)
                    return
                }

                const { data, error } = await supabase
                    .from('users')
                    .select('id, name, role, avatar_url')
                    .eq('id', userId)
                    .single()

                if (error) {
                    console.error(`fetchProfile attempt ${attempt}/${retries} error:`, error.message || "Unknown error")
                    console.error('Error details:', JSON.stringify(error))
                    if (attempt < retries) {
                        await new Promise(r => setTimeout(r, 1000 * attempt))
                        continue
                    }
                }

                if (data) {
                    setProfile(data)
                    setLoading(false)
                    return
                }

                // data is null — row not found or RLS blocked
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, 1000 * attempt))
                    continue
                }

                setProfile(null)
                setLoading(false)
                return
            } catch (err) {
                console.error(`fetchProfile attempt ${attempt}/${retries} exception:`, err)
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, 1000 * attempt))
                    continue
                }
                setProfile(null)
                setLoading(false)
            }
        }
        setLoading(false)
    }

    async function signOut() {
        await supabase.auth.signOut()
    }

    return (
        <AuthContext.Provider value={{ user, profile, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
