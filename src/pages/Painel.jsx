import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Users, CheckCircle, AlertCircle, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import Layout from '../components/Layout'
import Badge from '../components/Badge'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import { getSocios, getMensalidades } from '../services/sociosService'

function parseDate(str) {
  if (!str) return new Date(0)
  if (str.includes('-')) {
    const [y, m, d] = str.split('-')
    return new Date(y, m - 1, d)
  }
  if (str.includes('/')) {
    const [d, m, y] = str.split('/')
    return new Date(y, m - 1, d)
  }
  return new Date(str)
}

function formatDateBR(str) {
  if (!str) return ''
  if (str.includes('-')) {
    const [y, m, d] = str.split('-')
    return `${d}/${m}/${y}`
  }
  return str
}

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
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

export default function Painel() {
  const [socios, setSocios] = useState([])
  const [mensalidades, setMensalidades] = useState([])
  const [mesIdx, setMesIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([getSocios(), getMensalidades()])
      .then(([sociosData, mensalidadesData]) => {
        setSocios(sociosData)
        setMensalidades(mensalidadesData)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError(`Erro ao carregar dados do painel: ${err.message}`)
        setLoading(false)
      })
  }, [])

  const mesSelecionado = MESES[mesIdx]

  const [mesNome, anoStr] = useMemo(() => {
    return (mesSelecionado || '').split('/')
  }, [mesSelecionado])

  const mesNum = useMemo(() => {
    return MESES_NOMES.indexOf(mesNome) + 1
  }, [mesNome])

  const anoNum = useMemo(() => {
    return parseInt(anoStr || '2026', 10)
  }, [anoStr])

  // Filtrar sócios com base no período selecionado (data de admissão)
  const sociosFiltrados = useMemo(() => {
    return socios.filter(s => {
      if (!s.data_entrada) return true
      const [socioAno, socioMes] = s.data_entrada.split('-').map(Number)
      if (socioAno > anoNum || (socioAno === anoNum && socioMes > mesNum)) {
        return false
      }
      return true
    })
  }, [socios, mesNum, anoNum])

  const totalAtivos = useMemo(() => {
    return sociosFiltrados.filter(s => s.status === 'Ativo').length
  }, [sociosFiltrados])

  const listInadimplentes = useMemo(() => {
    return sociosFiltrados.filter(s => {
      if (s.status !== 'Ativo') return false

      let entradaAno = 0
      let entradaMes = 0
      if (s.data_entrada) {
        const partes = s.data_entrada.split('-')
        entradaAno = parseInt(partes[0], 10)
        entradaMes = parseInt(partes[1], 10)
      }

      // Janela de 4 meses anteriores em relação ao período selecionado
      let limiteAno = anoNum
      let limiteMes = mesNum - 4
      if (limiteMes <= 0) {
        limiteAno -= 1
        limiteMes += 12
      }

      const socioMensalidades = mensalidades.filter(m => m.socio_id === s.id && !m.dependente_id)
      
      const temAtraso = socioMensalidades.some(m => {
        const isPastPeriod = m.ano < anoNum || (m.ano === anoNum && m.mes < mesNum)
        const dentroDoLookback = m.ano > limiteAno || (m.ano === limiteAno && m.mes >= limiteMes)
        const jaEstavaCadastrado = m.ano > entradaAno || (m.ano === entradaAno && m.mes >= entradaMes)

        // Exibir somente os "atrasados". Trata "Pendente" como "Em dia".
        return isPastPeriod && dentroDoLookback && jaEstavaCadastrado && m.status === 'Atrasado'
      })

      return temAtraso
    })
  }, [sociosFiltrados, mensalidades, mesNum, anoNum])

  const totalNovosMes = useMemo(() => {
    return sociosFiltrados.filter(s => {
      if (!s.data_entrada) return false
      const [socioAno, socioMes] = s.data_entrada.split('-').map(Number)
      return socioAno === anoNum && socioMes === mesNum
    }).length
  }, [sociosFiltrados, anoNum, mesNum])

  const ultimosCadastros = useMemo(() => {
    return [...sociosFiltrados]
      .sort((a, b) => parseDate(b.data_entrada) - parseDate(a.data_entrada))
      .slice(0, 5)
  }, [sociosFiltrados])

  if (loading) {
    return (
      <Layout>
        <main className="flex-1 bg-[#f0f2f5] flex items-center justify-center py-24">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-gray-500 text-sm">Carregando painel...</p>
          </div>
        </main>
      </Layout>
    )
  }

  return (
    <Layout>
      <main className="flex-1 bg-[#f0f2f5]">
        <div className="max-w-7xl mx-auto px-6 py-7">

          <div className="flex justify-between items-start mb-7 flex-wrap gap-4">
            <div>
              <h1 className="text-[#1a3560] text-3xl font-bold mb-1">Painel</h1>
              <p className="text-gray-500">Visão geral do sistema de sócios</p>
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

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            <StatCard label="Total de Sócios"  value={sociosFiltrados.length}   icon={<Users size={22} />}        colorClass="bg-blue-100 text-blue-600"  />
            <StatCard label="Sócios Ativos"    value={totalAtivos}             icon={<CheckCircle size={22} />}  colorClass="bg-green-100 text-green-700" />
            <StatCard label="Inadimplentes"    value={listInadimplentes.length} icon={<AlertCircle size={22} />}  colorClass="bg-red-100 text-red-600"    />
            <StatCard label="Novos no Mês"     value={totalNovosMes}           icon={<UserPlus size={22} />}     colorClass="bg-gray-200 text-gray-700"  />
          </div>

          <section className="bg-white rounded-2xl p-6 shadow-[0_4px_12px_rgba(0,0,0,0.08)] mb-6">
            <h3 className="text-[#1a3560] text-lg font-bold mb-5">Últimos Cadastros</h3>
            {ultimosCadastros.length === 0 ? (
              <EmptyState
                icon={<Users size={40} />}
                title="Nenhum sócio cadastrado"
                description="Cadastre um novo sócio para começar."
              />
            ) : (
              ultimosCadastros.map(socio => (
                <Link
                  key={socio.id}
                  to={`/socios/${socio.id}`}
                  className="flex justify-between items-center bg-gray-50 p-4 rounded-xl mb-3 hover:bg-blue-50 transition-colors cursor-pointer no-underline text-inherit"
                >
                  <div>
                    <h4 className="font-bold mb-1">{socio.nome}</h4>
                    <p className="text-sm text-gray-500">Cadastrado em {formatDateBR(socio.data_entrada)}</p>
                  </div>
                  <Badge color={socio.status === 'Ativo' ? 'green' : 'red'}>
                    {socio.status}
                  </Badge>
                </Link>
              ))
            )}
            <Link to="/socios" className="block text-center mt-3 text-blue-600 font-bold hover:underline">
              Ver todos os sócios →
            </Link>
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-[0_4px_12px_rgba(0,0,0,0.08)] mb-6">
            <h3 className="text-red-600 text-lg font-bold mb-5">Inadimplentes — {mesSelecionado}</h3>
            {listInadimplentes.length === 0 ? (
              <EmptyState
                icon={<CheckCircle size={40} />}
                title="Nenhum inadimplente"
                description="Todos os sócios estão com a mensalidade em dia para este período."
              />
            ) : (
              listInadimplentes.map(socio => (
                <Link
                  key={socio.id}
                  to={`/socios/${socio.id}`}
                  className="flex justify-between items-center bg-gray-50 p-4 rounded-xl mb-3 hover:bg-red-50 transition-colors cursor-pointer no-underline text-inherit"
                >
                  <div>
                    <h4 className="font-bold mb-1">{socio.nome}</h4>
                    <p className="text-sm text-red-600">Último pagamento: {socio.ultimoPagamento ? formatDateBR(socio.ultimoPagamento) : 'Não informado'}</p>
                  </div>
                  <Badge color="red">Atrasado</Badge>
                </Link>
              ))
            )}
            {listInadimplentes.length > 0 && (
              <Link to="/socios" state={{ filtroStatus: 'Atrasado' }} className="block text-center mt-3 text-blue-600 font-bold hover:underline">
                Ver todos →
              </Link>
            )}
          </section>

        </div>
      </main>
    </Layout>
  )
}
