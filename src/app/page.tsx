'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function HomePage() {
    const { user, profile, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!loading && user && profile) {
            if (profile.role === 'caregiver') {
                router.replace('/caregiver/home')
            } else if (profile.role === 'family') {
                router.replace('/guest/home')
            } else {
                router.replace('/patient/home')
            }
        }
    }, [user, profile, loading, router])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#e8f5fd] to-white">
                <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
            </div>
        )
    }

    if (user) return null // redirecting

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f6fd] via-[#f4fbff] to-[#f3fae8] relative overflow-hidden">
            {/* Background decorative circles — logo palette */}
            <div className="absolute top-[-80px] left-[-80px] w-[280px] h-[280px] rounded-full bg-[#42b6f0]/12" />
            <div className="absolute top-[140px] right-[-70px] w-[220px] h-[220px] rounded-full bg-[#7bc843]/10" />
            <div className="absolute bottom-[80px] left-[-50px] w-[180px] h-[180px] rounded-full bg-[#42b6f0]/8" />
            <div className="absolute bottom-[200px] right-[20px] w-[100px] h-[100px] rounded-full bg-[#7bc843]/12" />

            {/* Main content */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 relative z-10">
                {/* Logo with gradient glow */}
                <div
                    className="w-32 h-32 rounded-[2rem] bg-white flex items-center justify-center mb-6 overflow-hidden"
                    style={{ boxShadow: '0 16px 48px -8px rgba(66,182,240,0.30), 0 8px 24px -4px rgba(123,200,67,0.20)' }}
                >
                    <img src="/logo.jpg" alt="Care Close" className="w-full h-full object-contain p-2" />
                </div>

                <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Care Close</h1>
                <p className="text-gray-400 text-center text-sm leading-relaxed mb-10 max-w-xs">
                    Cuidar ficou mais simples.<br />Medicamentos, rotina e saúde em um só lugar.
                </p>

                {/* Stats bar */}
                <div className="flex gap-8 mb-14">
                    {[
                        { val: '98%', label: 'Aderência', color: '#42b6f0' },
                        { val: '24h', label: 'Suporte', color: '#5cc85a' },
                        { val: '100%', label: 'Seguro', color: '#7bc843' },
                    ].map(s => (
                        <div key={s.label} className="text-center">
                            <p className="text-xl font-black" style={{ color: s.color }}>{s.val}</p>
                            <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom CTA */}
            <div className="px-6 pb-12 flex flex-col gap-3 relative z-10">
                <Link
                    href="/auth?mode=login"
                    className="w-full py-4 rounded-2xl text-white text-center font-bold text-base active:scale-95 transition-all"
                    style={{
                        background: 'linear-gradient(135deg, #42b6f0 0%, #7bc843 100%)',
                        boxShadow: '0 8px 24px -4px rgba(66,182,240,0.40), 0 4px 12px -2px rgba(123,200,67,0.30)',
                    }}
                >
                    Entrar
                </Link>
                <p className="text-center text-xs text-gray-400 mt-1">
                    Adquira sua licenca em{' '}
                    <span className="font-semibold" style={{ color: '#42b6f0' }}>careclose.com.br</span>
                </p>
            </div>
        </div>
    )
}
