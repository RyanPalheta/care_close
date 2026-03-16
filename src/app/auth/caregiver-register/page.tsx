'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function CaregiverRegisterPage() {
    const router = useRouter()
    const [step, setStep] = useState<'code' | 'info'>('code')
    const [activationCode, setActivationCode] = useState('')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [agreed, setAgreed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [codeValid, setCodeValid] = useState(false)

    // Validate activation code format (INST-XXXX)
    async function handleValidateCode(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        const codePattern = /^INST-[A-Z0-9]{4,8}$/i
        if (!codePattern.test(activationCode.trim())) {
            setError('Código inválido. O formato deve ser INST-XXXX ou similar.')
            return
        }
        // TODO: validate against institutions table in Supabase
        // For now, any correctly formatted code passes
        setCodeValid(true)
        setStep('info')
    }

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        if (!agreed) { setError('Você precisa aceitar os termos para continuar.'); return }
        setLoading(true)
        setError(null)

        const { data, error: signUpErr } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name, role: 'caregiver', activation_code: activationCode } }
        })

        if (signUpErr) { setError(signUpErr.message); setLoading(false); return }

        // Insert into users table
        if (data?.user) {
            await supabase.from('users').upsert({
                id: data.user.id,
                email,
                name,
                role: 'caregiver',
            })
        }

        setLoading(false)
        router.push('/caregiver/home')
    }

    return (
        <div className="min-h-screen bg-[#f5f5f5] flex flex-col" style={{ fontFamily: 'Lexend, sans-serif' }}>

            {/* Top Bar */}
            <div className="px-5 pt-12 pb-4 flex items-center gap-3 bg-white shadow-sm">
                <button onClick={() => step === 'info' ? setStep('code') : router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-lg font-extrabold text-gray-900">Cadastro de Cuidador</h1>
            </div>

            <div className="flex-1 px-5 pt-8 pb-8 flex flex-col">

                {/* Step: Enter Code */}
                {step === 'code' && (
                    <form onSubmit={handleValidateCode} className="flex flex-col gap-6 flex-1">
                        <div>
                            <h2 className="text-3xl font-extrabold text-gray-900 leading-tight mb-2">Crie sua conta<br />profissional</h2>
                        </div>

                        {/* Info Alert */}
                        <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3.5 flex items-start gap-3">
                            <div className="w-5 h-5 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                            </div>
                            <p className="text-sm text-orange-700 font-medium leading-relaxed">
                                Para se cadastrar como cuidador profissional, você precisa de um código emitido pela sua instituição.
                            </p>
                        </div>

                        {/* Activation Code Input */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                <label className="text-sm font-extrabold text-gray-700">Código de Ativação / Convite</label>
                            </div>
                            <input
                                type="text"
                                className="w-full text-center text-2xl font-black tracking-[0.3em] bg-white border-2 border-gray-200 focus:border-[#f97316] rounded-2xl px-4 py-4 text-gray-900 placeholder-gray-300 outline-none transition-all uppercase"
                                placeholder="INST-0000"
                                value={activationCode}
                                onChange={e => setActivationCode(e.target.value.toUpperCase())}
                                maxLength={12}
                                required
                            />
                            <p className="text-xs text-gray-400 font-medium mt-2 text-center">
                                O código possui o formato da sua instituição (ex: INST-XXXX)
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-2xl px-4 py-3">{error}</div>
                        )}

                        <div className="flex-1" />

                        <button
                            type="submit"
                            className="w-full bg-[#f97316] hover:bg-orange-500 active:scale-[0.98] text-white font-extrabold py-4 rounded-2xl text-base transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2"
                        >
                            Validar Licença
                            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                        </button>

                        <p className="text-center text-sm text-gray-500 font-medium">
                            Já possui uma conta?{' '}
                            <Link href="/auth" className="text-[#f97316] font-extrabold hover:underline">Faça Login</Link>
                        </p>

                        {/* Step dots */}
                        <div className="flex justify-center gap-2">
                            <span className="w-8 h-1.5 rounded-full bg-[#f97316]" />
                            <span className="w-4 h-1.5 rounded-full bg-gray-200" />
                        </div>
                    </form>
                )}

                {/* Step: Register Info */}
                {step === 'info' && (
                    <form onSubmit={handleRegister} className="flex flex-col gap-5 flex-1">
                        <div>
                            <p className="text-xs font-extrabold text-orange-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                Código {activationCode} validado!
                            </p>
                            <h2 className="text-2xl font-extrabold text-gray-900 leading-tight">Seus Dados<br />Profissionais</h2>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1.5 block">Nome Completo</label>
                                <input
                                    type="text"
                                    className="w-full bg-white border-2 border-gray-200 focus:border-[#f97316] rounded-xl px-4 py-3.5 text-gray-900 font-bold text-sm outline-none transition-all"
                                    placeholder="Ex: Maria Oliveira"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1.5 block">E-mail Profissional</label>
                                <input
                                    type="email"
                                    className="w-full bg-white border-2 border-gray-200 focus:border-[#f97316] rounded-xl px-4 py-3.5 text-gray-900 font-bold text-sm outline-none transition-all"
                                    placeholder="exemplo@email.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1.5 block">Senha de Acesso</label>
                                <input
                                    type="password"
                                    className="w-full bg-white border-2 border-gray-200 focus:border-[#f97316] rounded-xl px-4 py-3.5 text-gray-900 font-bold text-sm outline-none transition-all"
                                    placeholder="Mínimo 8 caracteres"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    minLength={8}
                                    required
                                />
                            </div>

                            <label className="flex items-start gap-3 cursor-pointer">
                                <div
                                    onClick={() => setAgreed(!agreed)}
                                    className={`w-5 h-5 flex-shrink-0 mt-0.5 rounded-md border-2 transition-colors flex items-center justify-center ${agreed ? 'bg-[#f97316] border-[#f97316]' : 'border-gray-300'}`}
                                >
                                    {agreed && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                </div>
                                <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                    Eu concordo com os <span className="text-[#f97316] font-bold">Termos de Uso</span> e a <span className="text-[#f97316] font-bold">Política de Privacidade</span> da rede de cuidadores.
                                </p>
                            </label>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-2xl px-4 py-3">{error}</div>
                        )}

                        <div className="flex-1" />

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#f97316] hover:bg-orange-500 active:scale-[0.98] text-white font-extrabold py-4 rounded-2xl text-base transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {loading
                                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <>Validar Licença e Criar Conta <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg></>}
                        </button>

                        <p className="text-center text-sm text-gray-500 font-medium">
                            Já possui uma conta?{' '}
                            <Link href="/auth" className="text-[#f97316] font-extrabold hover:underline">Faça Login</Link>
                        </p>

                        {/* Step dots */}
                        <div className="flex justify-center gap-2">
                            <span className="w-4 h-1.5 rounded-full bg-gray-200" />
                            <span className="w-8 h-1.5 rounded-full bg-[#f97316]" />
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
