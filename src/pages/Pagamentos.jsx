import { useState, useMemo, useEffect } from 'react'
import { CheckCircle, Clock, CreditCard, Search, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import Layout from '../components/Layout'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import ModalPagamento from '../components/ModalPagamento'
import { getSocios } from '../services/sociosService'
import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'

const MESES_NOMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function gerarMeses(quantidade = 13) {
  const hoje = new Date()
  const lista = []
  for (let i = 0; i < quantidade; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    lista.push(`${MESES_NOMES[d.getMonth()]}/${d.getFullYear()}`)
  }
  return lista
}

const MESES = gerarMeses()

function iniciais(nome) {
  const partes = nome.trim().split(' ')
  return ((partes[0]?.[0] ?? '') + (partes[partes.length - 1]?.[0] ?? '')).toUpperCase()
}

function parseMoeda(str) {
  const n = parseFloat((str ?? 'R$ 80,00').replace(/[^\d,]/g, '').replace(',', '.'))
  return isNaN(n) ? 80 : n
}

export default function Pagamentos() {
  const toast = useToast()
  const [socios, setSocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [mesIdx, setMesIdx] = useState(0)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [modalSocio, setModalSocio] = useState(null)

  useEffect(() => {
    getSocios()
      .then(data => {
        setSocios(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error(`Erro ao carregar dados de pagamentos: ${err.message}`)
        setLoading(false)
      })
  }, [toast])

  const mesSelecionado = MESES[mesIdx]

  const sociosComStatus = useMemo(() =>
    socios.map(s => {
      const pag = (s.pagamentos || []).find(p => p.mes === mesSelecionado)
      return {
        ...s,
        statusMes: pag ? pag.status : 'Pendente',
        dataPagamento: pag?.data ?? null,
        valorPagamento: pag?.valor ?? null,
      }
    }),
  [socios, mesSelecionado])

  const totalPagos     = sociosComStatus.filter(s => s.statusMes === 'Pago').length
  const totalPendentes = sociosComStatus.filter(s => s.statusMes === 'Pendente').length
  const totalArrecadado = sociosComStatus
    .filter(s => s.statusMes === 'Pago')
    .reduce((acc, s) => acc + parseMoeda(s.valorPagamento), 0)

  const filtrados = sociosComStatus.filter(s => {
    const matchBusca = (s.nome || '').toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'Todos' || s.statusMes === filtroStatus
    return matchBusca && matchStatus
  })

  async function handleSalvarPagamento(pagamento) {
    await api.registrarPagamento(modalSocio.id, pagamento)
    setSocios(prev => prev.map(s =>
      s.id !== modalSocio.id ? s : {
        ...s,
        pagamentos: [pagamento, ...(s.pagamentos || [])],
        mensalidade: 'Em dia',
        ultimoPagamento: pagamento.data,
      }
    ))
    setModalSocio(null)
  }

  if (loading) {
    return (
      <Layout>
        <main className="flex-1 bg-[#f0f2f5] flex items-center justify-center py-24">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-gray-500 text-sm">Carregando dados de pagamentos...</p>
          </div>
        </main>
      </Layout>
    )
  }

  return (
    <Layout>
      <main className="flex-1 bg-[#f0f2f5]">
        <div className="max-w-7xl mx-auto px-6 py-7">

          {/* Cabeçalho */}
          <div className="flex justify-between items-start mb-7 flex-wrap gap-4">
            <div>
              <h1 className="text-[#1a3560] text-3xl font-bold mb-1">Pagamentos</h1>
              <p className="text-gray-500">Controle de mensalidades dos sócios</p>
            </div>

            {/* Navegação de mês */}
            <div className="flex items-center gap-1 bg-white rounded-2xl px-3 py-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <button
                onClick={() => setMesIdx(i => Math.min(i + 1, MESES.length - 1))}
                disabled={mesIdx === MESES.length - 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#1a3560] hover:bg-gray-100 disabled:opacity-30 cursor-pointer bg-transparent border-none transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[#1a3560] font-bold text-sm min-w-[128px] text-center px-1">
                {mesSelecionado}
              </span>
              <button
                onClick={() => setMesIdx(i => Math.max(i - 1, 0))}
                disabled={mesIdx === 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#1a3560] hover:bg-gray-100 disabled:opacity-30 cursor-pointer bg-transparent border-none transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
            <div className="bg-white rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <CreditCard size={22} />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Total arrecadado</p>
                <p className="text-2xl font-bold text-[#1a3560]">
                  R$ {totalArrecadado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Pagamentos confirmados</p>
                <p className="text-2xl font-bold text-green-700">
                  {totalPagos}
                  <span className="text-sm font-normal text-gray-400 ml-1">de {socios.length}</span>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Aguardando pagamento</p>
                <p className="text-2xl font-bold text-amber-600">{totalPendentes}</p>
              </div>
            </div>
          </div>

          {/* Barra de filtros */}
          <section className="bg-white rounded-2xl p-4 shadow-[0_4px_12px_rgba(0,0,0,0.08)] mb-6">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-gray-100 rounded-xl px-3.5">
                <Search size={15} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar sócio..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="flex-1 py-3 border-none bg-transparent text-sm outline-none"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Todos', count: null },
                  { label: 'Pago', count: totalPagos },
                  { label: 'Pendente', count: totalPendentes },
                ].map(({ label, count }) => (
                  <button
                    key={label}
                    onClick={() => setFiltroStatus(label)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer border-none ${
                      filtroStatus === label
                        ? 'bg-[#1a3560] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                    {count !== null && count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                        filtroStatus === label
                          ? 'bg-white/20 text-white'
                          : label === 'Pago'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Lista */}
          <section className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="bg-[#eef1f8] px-6 py-4 border-b border-blue-100 flex items-center justify-between">
              <span className="font-bold text-[#1a3560]">Sócios — {mesSelecionado}</span>
              <span className="text-sm text-gray-400">
                {filtrados.length} {filtrados.length === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>

            {filtrados.length === 0 ? (
              <EmptyState
                icon={<Users size={40} />}
                title="Nenhum sócio encontrado"
                description="Tente ajustar os filtros."
              />
            ) : (
              filtrados.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors ${
                    i < filtrados.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                    {iniciais(s.nome)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.invernada}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {s.statusMes === 'Pago' ? (
                      <>
                        <span className="text-xs text-gray-400 hidden sm:block">{s.dataPagamento}</span>
                        <span className="text-xs text-gray-500 hidden sm:block">{s.valorPagamento}</span>
                        <Badge color="green">Pago</Badge>
                      </>
                    ) : (
                      <>
                        <Badge color="yellow">Pendente</Badge>
                        <button
                          onClick={() => setModalSocio(s)}
                          className="bg-[#1a3560] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-900 transition-colors cursor-pointer border-none"
                        >
                          Registrar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>

        </div>
      </main>

      {modalSocio && (
        <ModalPagamento
          nomeSocio={modalSocio.nome}
          mesPadrao={mesSelecionado}
          onFechar={() => setModalSocio(null)}
          onSalvar={handleSalvarPagamento}
        />
      )}
    </Layout>
  )
}
