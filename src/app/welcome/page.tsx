'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'

function WelcomeContent() {
    const searchParams = useSearchParams()
    const email = searchParams.get('email') || ''

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #e8f6fd 0%, #f3fae8 100%)', fontFamily: 'Lexend, sans-serif' }}
        >
            {/* Background circles */}
            <div className="absolute top-[-60px] left-[-60px] w-64 h-64 rounded-full bg-[#42b6f0]/10 pointer-events-none" />
            <div className="absolute bottom-[-40px] right-[-40px] w-48 h-48 rounded-full bg-[#7bc843]/12 pointer-events-none" />

            <div className="w-full max-w-sm relative z-10 text-center">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div
                        className="w-24 h-24 rounded-[1.75rem] bg-white flex items-center justify-center"
                        style={{ boxShadow: '0 12px 40px rgba(66,182,240,0.25), 0 6px 20px rgba(123,200,67,0.20)' }}
                    >
                        <img src="/icon-only.png" alt="Care Close" className="w-[80%] h-[80%] object-contain" />
                    </div>
                </div>

                {/* Checkmark */}
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{ background: 'linear-gradient(135deg, #42b6f0 0%, #7bc843 100%)' }}>
                    <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </div>

                <h1 className="text-2xl font-black text-gray-900 mb-2">Compra confirmada!</h1>
                <p className="text-gray-500 text-sm leading-relaxed mb-8">
                    Bem-vindo ao <span className="font-bold text-gray-700">Care Close</span>!{' '}
                    Enviamos um email para{' '}
                    {email
                        ? <><span className="font-bold text-[#42b6f0]">{email}</span> </>
                        : 'o seu endereço de email '
                    }
                    com o link para criar sua senha e acessar a plataforma.
                </p>

                {/* Steps */}
                <div className="bg-white rounded-3xl p-5 mb-6 text-left shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Próximos passos</p>
                    {[
                        { n: '1', text: 'Abra o email que enviamos', color: '#42b6f0' },
                        { n: '2', text: 'Clique em "Criar minha senha"', color: '#5cc85a' },
                        { n: '3', text: 'Defina sua senha e acesse o app', color: '#7bc843' },
                    ].map(step => (
                        <div key={step.n} className="flex items-center gap-3 mb-3 last:mb-0">
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                                style={{ background: step.color }}
                            >
                                {step.n}
                            </div>
                            <p className="text-sm font-medium text-gray-700">{step.text}</p>
                        </div>
                    ))}
                </div>

                <p className="text-xs text-gray-400 mb-6">
                    Não recebeu o email? Verifique a pasta de spam ou{' '}
                    <Link href="/auth" className="text-[#42b6f0] font-semibold">entre em contato</Link>.
                </p>

                <Link
                    href="/auth"
                    className="block w-full py-4 rounded-2xl text-white text-center font-bold text-base"
                    style={{
                        background: 'linear-gradient(135deg, #42b6f0 0%, #7bc843 100%)',
                        boxShadow: '0 8px 24px rgba(66,182,240,0.30)',
                    }}
                >
                    Já tenho minha senha → Entrar
                </Link>
            </div>
        </div>
    )
}

export default function WelcomePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
            </div>
        }>
            <WelcomeContent />
        </Suspense>
    )
}
