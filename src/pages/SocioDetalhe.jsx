import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Badge from '../components/Badge'
import ModalPagamento from '../components/ModalPagamento'
import { INVERNADAS } from '../data/constants'
import {
  getSocioById,
  updateSocio,
  getMensalidades,
  createMensalidade,
  updateMensalidade,
  getPagamentos,
  createPagamento
} from '../services/sociosService'
import { useToast } from '../contexts/ToastContext'
import { calcularStatusSocio } from '../utils/statusHelper'

const MESES_NOMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function iniciais(nome) {
  const partes = (nome || '').trim().split(' ')
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes[partes.length - 1]?.[0] ?? ''
  return (primeira + ultima).toUpperCase()
}

function validarCPF(cpf) {
  const limpo = cpf.replace(/\D/g, '')
  if (limpo.length !== 11) return false
  if (/^(\d)\1{10}$/.test(limpo)) return false

  let soma = 0
  let resto

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(limpo.substring(i - 1, i)) * (11 - i)
  }

  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(limpo.substring(9, 10))) return false

  soma = 0
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(limpo.substring(i - 1, i)) * (12 - i)
  }

  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(limpo.substring(10, 11))) return false

  return true
}

function formatarCPF(value) {
  const digitos = value.replace(/\D/g, '')
  const limitados = digitos.substring(0, 11)
  
  if (limitados.length <= 3) return limitados
  if (limitados.length <= 6) return `${limitados.slice(0, 3)}.${limitados.slice(3)}`
  if (limitados.length <= 9) return `${limitados.slice(0, 3)}.${limitados.slice(3, 6)}.${limitados.slice(6)}`
  return `${limitados.slice(0, 3)}.${limitados.slice(3, 6)}.${limitados.slice(6, 9)}-${limitados.slice(9)}`
}

function formatarTelefone(value) {
  const digitos = value.replace(/\D/g, '')
  const limitados = digitos.substring(0, 11)
  
  if (limitados.length <= 2) return limitados
  if (limitados.length <= 7) return `(${limitados.slice(0, 2)}) ${limitados.slice(2)}`
  return `(${limitados.slice(0, 2)}) ${limitados.slice(2, 7)}-${limitados.slice(7)}`
}

export default function SocioDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [original, setOriginal] = useState(null)
  const [form, setForm] = useState(null)
  const [salvo, setSalvo] = useState(false)
  const [modalPagamento, setModalPagamento] = useState(false)
  const [mensalidades, setMensalidades] = useState([])
  const [pagamentos, setPagamentos] = useState([])

  const carregarDados = () => {
    setLoading(true)
    Promise.all([getSocioById(id), getMensalidades(), getPagamentos()])
      .then(([socioData, mensalidadesData, pagamentosData]) => {
        const socioMensalidades = mensalidadesData.filter(m => m.socio_id === Number(id))
        
        const historicoMapeado = socioMensalidades.map(m => {
          const p = pagamentosData.find(pg => pg.mensalidade_id === m.id)
          return {
            id: m.id,
            mesNum: m.mes,
            anoNum: m.ano,
            mes: `${MESES_NOMES[m.mes - 1]}/${m.ano}`,
            valor: `R$ ${Number(m.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            valorNum: Number(m.valor),
            status: m.status,
            data: p ? p.data_pagamento.split('-').reverse().join('/') : '—',
            dataIso: p ? p.data_pagamento : null,
            formaPagamento: p ? p.forma_pagamento : null
          }
        }).sort((a, b) => b.anoNum - a.anoNum || b.mesNum - a.mesNum)

        setMensalidades(socioMensalidades)
        setPagamentos(pagamentosData)

        const statusAutomatico = calcularStatusSocio(socioData, mensalidadesData)

        const formObject = {
          ...socioData,
          mensalidade: statusAutomatico,
          pagamentos: historicoMapeado
        }

        setOriginal(formObject)
        setForm(formObject)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error(`Erro ao carregar dados do sócio: ${err.message}`)
        setLoading(false)
      })
  }

  useEffect(() => {
    carregarDados()
  }, [id])

  const statusAutomatico = useMemo(() => {
    if (!form) return 'Pendente'
    return calcularStatusSocio(form, mensalidades)
  }, [form?.status, form?.data_entrada, mensalidades])

  if (loading) {
    return (
      <Layout>
        <main className="flex-1 bg-[#f0f2f5] flex items-center justify-center py-24">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-gray-500 text-sm">Carregando detalhes do sócio...</p>
          </div>
        </main>
      </Layout>
    )
  }

  if (!form) {
    return (
      <Layout>
        <main className="flex-1 flex items-center justify-center p-6 bg-[#f0f2f5]">
          <div className="text-center bg-white p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            <p className="text-gray-500 text-lg mb-4">Sócio não encontrado.</p>
            <Link to="/socios" className="text-blue-600 font-bold hover:underline">← Voltar para Sócios</Link>
          </div>
        </main>
      </Layout>
    )
  }

  const inputClass = 'w-full px-3.5 py-3.5 border-none rounded-xl bg-gray-100 text-sm outline-none focus:ring-2 focus:ring-blue-300 focus:bg-white transition-colors'

  function setField(key, value) {
    setSalvo(false)
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function salvar() {
    if (!form.nome || !form.cpf) {
      toast.error('Preencha os campos obrigatórios: Nome e CPF.')
      return
    }

    if (!validarCPF(form.cpf)) {
      toast.error('O CPF informado é inválido. Por favor, verifique os dígitos.')
      return
    }

    setSaving(true)
    setSalvo(false)
    const payload = {
      ...form,
      mensalidade: statusAutomatico
    }
    updateSocio(id, payload)
      .then(() => {
        setOriginal(payload)
        setForm(payload)
        setSalvo(true)
        setSaving(false)
        toast.success('Alterações salvas com sucesso!')
      })
      .catch(err => {
        console.error(err)
        setSaving(false)

        if (err.isNetworkError) {
          toast.error(err.message)
        } else if (err.status === 500 || err.message === 'Unable to process this request!') {
          toast.error('Este CPF já está cadastrado ou há um conflito de dados no servidor.')
        } else {
          toast.error(`Erro ao salvar alterações do sócio: ${err.message}`)
        }
      })
  }

  function cancelar() {
    setForm({ ...original })
    setSalvo(false)
  }

  async function handleSalvarPagamento(payload) {
    const { mesStr, valorStr, dataIso, formaPagamento } = payload
    
    const [mesNome, anoStr] = mesStr.split('/')
    const mesNum = MESES_NOMES.indexOf(mesNome) + 1
    const anoNum = parseInt(anoStr, 10)
    
    const cleanValor = (val) => {
      if (typeof val === 'number') return val
      const str = String(val ?? '80.00')
      const n = parseFloat(str.replace(/[^\d,]/g, '').replace(',', '.'))
      return isNaN(n) ? 80 : n
    }
    const valorNum = cleanValor(valorStr)

    setLoading(true)
    try {
      // 1. Buscar se mensalidade existe
      const m = mensalidades.find(
        mens => mens.mes === mesNum &&
                mens.ano === anoNum &&
                !mens.dependente_id
      )

      let mId;
      if (m) {
        await updateMensalidade(m.id, {
          socio_id: Number(id),
          dependente_id: null,
          mes: m.mes,
          ano: m.ano,
          valor: m.valor,
          status: 'Pago',
          data_vencimento: m.data_vencimento
        })
        mId = m.id
      } else {
        const dataVenc = `${anoNum}-${String(mesNum).padStart(2, '0')}-28`
        const novaM = await createMensalidade({
          socio_id: Number(id),
          dependente_id: null,
          mes: mesNum,
          ano: anoNum,
          valor: valorNum,
          status: 'Pago',
          data_vencimento: dataVenc
        })
        mId = novaM.id
      }

      // 2. Criar pagamento
      await createPagamento({
        mensalidade_id: mId,
        data_pagamento: dataIso,
        forma_pagamento: formaPagamento,
        valor_pago: valorNum,
        multa_juros_aplicados: 0
      })

      toast.success('Pagamento registrado com sucesso no servidor!')
      carregarDados()
    } catch (err) {
      console.error(err)
      toast.error(`Erro ao salvar pagamento: ${err.message}`)
      setLoading(false)
    }
  }

  const pagos     = form.pagamentos.filter(p => p.status === 'Pago').length
  const pendentes = form.pagamentos.filter(p => p.status !== 'Pago').length
  const somaPago  = form.pagamentos
    .filter(p => p.status === 'Pago')
    .reduce((acc, p) => acc + p.valorNum, 0)
  const totalPago = `R$ ${somaPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <Layout>
      <main className="flex-1 bg-[#f0f2f5]">
        <div className="max-w-5xl mx-auto px-6 py-7 w-full">

        {/* Voltar */}
        <button
          onClick={() => navigate('/socios')}
          className="flex items-center gap-2 text-blue-600 font-semibold text-sm mb-6 hover:underline cursor-pointer bg-transparent border-none p-0"
        >
          ← Voltar para Sócios
        </button>

        {/* Cabeçalho do sócio */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_4px_12px_rgba(0,0,0,0.08)] mb-6 flex items-center gap-6 flex-wrap">
          <div className="w-[80px] h-[80px] rounded-full bg-[#1a3560] flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {iniciais(form.nome)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[#1a3560] text-3xl font-bold mb-1 truncate">{form.nome}</h1>
            <p className="text-gray-500 text-sm mb-3">CPF: {form.cpf} · Sócio desde {form.data_entrada}</p>
            <div className="flex gap-2 flex-wrap">
              <Badge color={form.status === 'Ativo' ? 'green' : 'red'}>{form.status}</Badge>
              <Badge color={statusAutomatico === 'Em dia' ? 'green' : statusAutomatico === 'Atrasado' ? 'red' : statusAutomatico === 'Inativo' ? 'gray' : 'yellow'}>
                {statusAutomatico === 'Em dia' ? 'Mensalidade em dia' : statusAutomatico === 'Atrasado' ? 'Mensalidade atrasada' : statusAutomatico === 'Inativo' ? 'Sócio inativo' : 'Mensalidade pendente'}
              </Badge>
              <Badge color="purple">{form.invernada}</Badge>
            </div>
          </div>
        </div>

        {/* Dados pessoais */}
        <section className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] mb-6 overflow-hidden">
          <div className="bg-[#eef1f8] px-6 py-4 font-bold text-[#1a3560] border-b border-blue-100">
            Dados Pessoais
          </div>
          <div className="p-6">
            {salvo && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
                ✓ Alterações salvas com sucesso.
              </div>
            )}

            <p className="text-xs text-gray-400 mb-4">* Campo obrigatório</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-sm font-bold">Nome Completo *</label>
                <input type="text" value={form.nome} onChange={e => setField('nome', e.target.value)} className={inputClass} disabled={saving} />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">CPF *</label>
                <input type="text" value={form.cpf} onChange={e => setField('cpf', formatarCPF(e.target.value))} className={inputClass} maxLength={14} disabled={saving} />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">Data de Nascimento</label>
                <input type="date" value={form.data_nascimento} onChange={e => setField('data_nascimento', e.target.value)} className={inputClass} disabled={saving} />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">Telefone</label>
                <input type="text" placeholder="(00) 00000-0000" value={form.telefone} onChange={e => setField('telefone', formatarTelefone(e.target.value))} className={inputClass} maxLength={15} disabled={saving} />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">E-mail</label>
                <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} className={inputClass} disabled={saving} />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-sm font-bold">Endereço Completo</label>
                <input type="text" value={form.endereco} onChange={e => setField('endereco', e.target.value)} className={inputClass} disabled={saving} />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">Categoria</label>
                <select value={form.status} onChange={e => setField('status', e.target.value)} className={inputClass} disabled={saving}>
                  <option>Ativo</option>
                  <option>Inativo</option>
                </select>
              </div>



              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">Invernada de Dança</label>
                <select value={form.invernada} onChange={e => setField('invernada', e.target.value)} className={inputClass} disabled={saving}>
                  {INVERNADAS.map(inv => <option key={inv}>{inv}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">Número de Dependentes</label>
                <input type="number" value={form.dependentes}
                  onChange={e => setField('dependentes', Number(e.target.value))} className={inputClass} disabled={saving} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={cancelar}
                disabled={saving}
                className="bg-white border border-slate-300 text-gray-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Desfazer alterações
              </button>
              <button
                onClick={salvar}
                disabled={saving}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-[0_4px_12px_rgba(37,99,235,0.3)] cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Histórico de Pagamentos */}
        <section className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] mb-6 overflow-hidden">
          <div className="bg-[#eef1f8] px-6 py-4 border-b border-blue-100 flex justify-between items-center gap-3 flex-wrap">
            <span className="font-bold text-[#1a3560]">Histórico de Pagamentos</span>
            <button
              onClick={() => setModalPagamento(true)}
              className="bg-[#1a3560] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-800 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(23,55,183,0.3)]"
            >
              + Registrar Pagamento
            </button>
          </div>
          <div className="p-6">

            {/* Resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-sm mb-1">Total Pago</p>
                <p className="text-[#1a3560] text-2xl font-bold">{totalPago}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-sm mb-1">Pagamentos em Dia</p>
                <p className="text-green-700 text-2xl font-bold">{pagos}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-sm mb-1">Pendentes / Atrasados</p>
                <p className="text-red-600 text-2xl font-bold">{pendentes}</p>
              </div>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[500px]">
                <thead>
                  <tr>
                    {['Mês', 'Valor', 'Status', 'Data de Pagamento'].map(h => (
                      <th key={h} className="text-left py-3.5 px-4 border-b border-gray-200 text-sm font-semibold text-gray-600">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.pagamentos.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 px-4 border-b border-gray-100 text-sm font-medium">{p.mes}</td>
                      <td className="py-3.5 px-4 border-b border-gray-100 text-sm">{p.valor}</td>
                      <td className="py-3.5 px-4 border-b border-gray-100">
                        <Badge color={p.status === 'Pago' ? 'green' : p.status === 'Atrasado' ? 'red' : 'yellow'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 border-b border-gray-100 text-sm text-gray-500">{p.data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </section>

        </div>
      </main>

      {modalPagamento && (
        <ModalPagamento
          nomeSocio={form.nome}
          socioId={form.id}
          dataEntrada={form.data_entrada}
          mensalidades={mensalidades}
          pagamentos={pagamentos}
          onFechar={() => setModalPagamento(false)}
          onSalvar={handleSalvarPagamento}
        />
      )}
    </Layout>
  )
}
