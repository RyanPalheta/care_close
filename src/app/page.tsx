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
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f5fd] via-[#f0f9ff] to-white relative overflow-hidden">
            {/* Background decorative circles */}
            <div className="absolute top-[-80px] left-[-80px] w-[280px] h-[280px] rounded-full bg-[#42b6f0]/10" />
            <div className="absolute top-[120px] right-[-60px] w-[200px] h-[200px] rounded-full bg-[#7c3aed]/8" />
            <div className="absolute bottom-[100px] left-[-40px] w-[160px] h-[160px] rounded-full bg-[#4ade80]/10" />

            {/* Main content */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 relative z-10">
                {/* Logo / icon */}
                <div className="w-28 h-28 rounded-3xl bg-white shadow-xl shadow-[#42b6f0]/20 flex items-center justify-center mb-8 border border-[#42b6f0]/10 overflow-hidden">
                    <img src="/logo.jpg" alt="Care Close" className="w-full h-full object-contain p-2" />
                </div>

                <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Care Close</h1>
                <p className="text-gray-400 text-center text-sm leading-relaxed mb-12 max-w-xs">
                    Cuidar ficou mais simples.<br />Medicamentos, rotina e saúde em um só lugar.
                </p>

                {/* Stats bar */}
                <div className="flex gap-6 mb-14">
                    {[
                        { val: '98%', label: 'Aderência' },
                        { val: '24h', label: 'Suporte' },
                        { val: '100%', label: 'Seguro' },
                    ].map(s => (
                        <div key={s.label} className="text-center">
                            <p className="text-xl font-black text-[#42b6f0]">{s.val}</p>
                            <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom CTA */}
            <div className="px-6 pb-12 flex flex-col gap-3 relative z-10">
                <Link
                    href="/auth?mode=login"
                    className="w-full py-4 rounded-2xl bg-[#42b6f0] text-white text-center font-bold text-base shadow-lg shadow-[#42b6f0]/30 hover:bg-[#2ea8e3] transition-all active:scale-95"
                >
                    Entrar
                </Link>
                <p className="text-center text-xs text-gray-400 mt-1">
                    Adquira sua licenca em{' '}
                    <span className="text-[#42b6f0] font-semibold">careclose.com.br</span>
                </p>
            </div>
        </div>
    )
}
