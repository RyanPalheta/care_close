import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// The anon key here is actually the service_role key based on the payload analysis.
const supabase = createClient(supaUrl, supaKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function run() {
    console.log('--- Inciando Configuração Automática da Instituição ---')

    // 1. Criar o usuário da instituição na auth.users
    console.log('1. Criando usuário Instituição...')
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: 'instituicao@carecloseteste.com',
        password: 'CareClose@2025',
        email_confirm: true,
        user_metadata: { name: 'Instituição Teste', role: 'institution' }
    })

    if (authErr && !authErr.message.includes('already been registered')) {
        console.error('Erro ao cirar admin user:', authErr.message)
        return
    }

    let instUserId = authData?.user?.id
    if (!instUserId) {
        // Find existing user if already there
        const { data: users } = await supabase.auth.admin.listUsers()
        const ext = users.users.find(u => u.email === 'instituicao@carecloseteste.com')
        if (ext) instUserId = ext.id
        else {
            console.error('Falha ao encontrar o id do usuário existente')
            return
        }
    }
    console.log('   ID do usuário:', instUserId)

    // 2. Colocar ele no public.users
    const { error: userUpsertErr } = await supabase.from('users').upsert({
        id: instUserId,
        name: 'Instituição Teste',
        role: 'institution'
    })
    if (userUpsertErr) console.error('Erro ao salvar no public.users:', userUpsertErr)

    // 3. Criar a linha em public.institutions
    console.log('2. Criando o perfil comercial (Institution)...')
    const { data: instData, error: instErr } = await supabase.from('institutions').insert({
        owner_user_id: instUserId,
        name: 'Care Close Instituição Base',
        cnpj: '00.000.000/0001-00',
        plan: 'Plano Start',
        total_licenses: 50,
        next_billing: '2025-12-01'
    }).select('id').single()

    if (instErr) { console.error('Erro ao criar intuição:', instErr); return }
    const institutionId = instData.id
    console.log('   Instituição ID:', institutionId)

    // 4. Buscar os cuidadores / pacientes antigos e criar as licenças
    console.log('3. Atualizando cuidadores anteriores...')
    const { data: usersData, error: usersErr } = await supabase.from('users')
        .select('id, name, role')
        .in('role', ['caregiver', 'patient'])

    if (usersErr) { console.error('Erro ao listar users:', usersErr); return }

    for (let i = 0; i < (usersData || []).length; i++) {
        const u = usersData![i]
        const code = `INST-${Math.floor(1000 + Math.random() * 9000)}-${i}`

        // Insere a licença
        await supabase.from('licenses').upsert({
            institution_id: institutionId,
            assigned_to: u.id,
            code: code,
            status: 'active',
            activated_at: new Date().toISOString()
        }, { onConflict: 'assigned_to' })

        // Atualiza a coluna institution_id na tabela users
        await supabase.from('users').update({ institution_id: institutionId }).eq('id', u.id)

        console.log(`   [${u.role}] ${u.name} agora possui licença ${code}`)
    }

    console.log('--- Finalizado com sucesso! ---')
}

run()
