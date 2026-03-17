'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function InstitutionRegisterPage() {
    const router = useRouter()

    // Form fields
    const [institutionName, setInstitutionName] = useState('')
    const [cnpj, setCnpj] = useState('')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [totalLicenses, setTotalLicenses] = useState(10)
    const [agreed, setAgreed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Format CNPJ as user types (XX.XXX.XXX/XXXX-XX)
    function handleCnpjChange(value: string) {
        const digits = value.replace(/\D/g, '').slice(0, 14)
        let formatted = digits
        if (digits.length > 12) formatted = digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5')
        else if (digits.length > 8) formatted = digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4')
        else if (digits.length > 5) formatted = digits.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3')
        else if (digits.length > 2) formatted = digits.replace(/^(\d{2})(\d{0,3})/, '$1.$2')
        setCnpj(formatted)
    }

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        if (!agreed) { setError('Aceite os termos para continuar.'); return }
        setLoading(true)
        setError(null)

        // 1. Create auth user
        const { data, error: signUpErr } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name, role: 'institution' } }
        })

        if (signUpErr) {
            setError(signUpErr.message)
            setLoading(false)
            return
        }

        if (!data.user) {
            setError('Erro ao criar usuário. Tente novamente.')
            setLoading(false)
            return
        }

        // 2. Insert user profile with role 'institution'
        const { error: userErr } = await supabase.from('users').upsert({
            id: data.user.id,
            name: name.trim(),
            role: 'institution',
        }, { onConflict: 'id' })

        if (userErr) {
            console.error('User profile insert error:', userErr)
            setError('Erro ao criar perfil: ' + userErr.message)
            setLoading(false)
            return
        }

        // 3. Create institution record
        const { error: instErr } = await supabase.from('institutions').insert({
            name: institutionName.trim(),
            cnpj: cnpj || null,
            plan: 'B2B Premium · Mensal',
            status: 'active',
            total_licenses: totalLicenses,
            next_billing: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            owner_user_id: data.user.id,
        })

        if (instErr) {
            console.error('Institution insert error:', instErr)
            setError('Erro ao criar instituição: ' + instErr.message)
            setLoading(false)
            return
        }

        setLoading(false)

        // If email confirmation required
        if (!data.session) {
            setSuccess(true)
            return
        }

        // Direct redirect
        window.location.href = '/institution/dashboard'
    }

    if (success) {
        return (
            <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-center px-6" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-lg text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    </div>
                    <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Instituicao criada!</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Verifique seu email <strong>{email}</strong> para confirmar sua conta. Depois faca login para acessar o painel.
                    </p>
                    <Link
                        href="/auth?mode=login"
                        className="w-full inline-block bg-[#7c3aed] text-white font-extrabold py-4 rounded-2xl text-base hover:bg-[#6d28d9] transition-all"
                    >
                        Ir para Login
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f5f5f5] flex flex-col" style={{ fontFamily: 'Lexend, sans-serif' }}>

            {/* Top Bar */}
            <div className="px-5 pt-12 pb-4 flex items-center gap-3 bg-white shadow-sm">
                <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-lg font-extrabold text-gray-900">Cadastro de Instituicao</h1>
            </div>

            <div className="flex-1 px-5 pt-8 pb-8 flex flex-col">
                <form onSubmit={handleRegister} className="flex flex-col gap-5 flex-1">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 leading-tight mb-1">Registre sua<br />instituicao</h2>
                        <p className="text-sm text-gray-400">Gerencie cuidadores e licencas em um so lugar.</p>
                    </div>

                    {/* Info Alert */}
                    <div className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3.5 flex items-start gap-3">
                        <div className="w-5 h-5 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                        </div>
                        <p className="text-sm text-purple-700 font-medium leading-relaxed">
                            Apos o cadastro, voce podera emitir codigos de ativacao para seus cuidadores.
                        </p>
                    </div>

                    {/* Institution Data */}
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1.5 block">Nome da Instituicao</label>
                            <input
                                type="text"
                                className="w-full bg-white border-2 border-gray-200 focus:border-[#7c3aed] rounded-xl px-4 py-3.5 text-gray-900 font-bold text-sm outline-none transition-all"
                                placeholder="Ex: Casa de Repouso Santa Clara"
                                value={institutionName}
                                onChange={e => setInstitutionName(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1.5 block">CNPJ <span className="text-gray-300 font-normal">(opcional)</span></label>
                            <input
                                type="text"
                                className="w-full bg-white border-2 border-gray-200 focus:border-[#7c3aed] rounded-xl px-4 py-3.5 text-gray-900 font-bold text-sm outline-none transition-all"
                                placeholder="00.000.000/0000-00"
                                value={cnpj}
                                onChange={e => handleCnpjChange(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1.5 block">Quantidade de Licencas</label>
                            <select
                                className="w-full bg-white border-2 border-gray-200 focus:border-[#7c3aed] rounded-xl px-4 py-3.5 text-gray-900 font-bold text-sm outline-none transition-all"
                                value={totalLicenses}
                                onChange={e => setTotalLicenses(Number(e.target.value))}
                            >
                                <option value={5}>5 licencas</option>
                                <option value={10}>10 licencas</option>
                                <option value={25}>25 licencas</option>
                                <option value={50}>50 licencas</option>
                                <option value={100}>100 licencas</option>
                            </select>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-1">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs font-bold text-gray-400 uppercase">Dados do Administrador</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* Admin Data */}
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1.5 block">Nome Completo</label>
                            <input
                                type="text"
                                className="w-full bg-white border-2 border-gray-200 focus:border-[#7c3aed] rounded-xl px-4 py-3.5 text-gray-900 font-bold text-sm outline-none transition-all"
                                placeholder="Seu nome completo"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1.5 block">E-mail</label>
                            <input
                                type="email"
                                className="w-full bg-white border-2 border-gray-200 focus:border-[#7c3aed] rounded-xl px-4 py-3.5 text-gray-900 font-bold text-sm outline-none transition-all"
                                placeholder="admin@instituicao.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1.5 block">Senha</label>
                            <input
                                type="password"
                                className="w-full bg-white border-2 border-gray-200 focus:border-[#7c3aed] rounded-xl px-4 py-3.5 text-gray-900 font-bold text-sm outline-none transition-all"
                                placeholder="Minimo 6 caracteres"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>

                        <label className="flex items-start gap-3 cursor-pointer">
                            <div
                                onClick={() => setAgreed(!agreed)}
                                className={`w-5 h-5 flex-shrink-0 mt-0.5 rounded-md border-2 transition-colors flex items-center justify-center ${agreed ? 'bg-[#7c3aed] border-[#7c3aed]' : 'border-gray-300'}`}
                            >
                                {agreed && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                            </div>
                            <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                Eu concordo com os <span className="text-[#7c3aed] font-bold">Termos de Uso</span> e a <span className="text-[#7c3aed] font-bold">Politica de Privacidade</span>.
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
                        className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] active:scale-[0.98] text-white font-extrabold py-4 rounded-2xl text-base transition-all shadow-lg shadow-purple-200 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {loading
                            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <>Criar Instituicao <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></>}
                    </button>

                    <p className="text-center text-sm text-gray-500 font-medium">
                        Ja possui uma conta?{' '}
                        <Link href="/auth?mode=login" className="text-[#7c3aed] font-extrabold hover:underline">Faca Login</Link>
                    </p>
                </form>
            </div>
        </div>
    )
}
