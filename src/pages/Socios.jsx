import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ChevronRight, Users } from 'lucide-react'
import Layout from '../components/Layout'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { INVERNADAS } from '../data/constants'
import { getSocios, getMensalidades } from '../services/sociosService'
import { useToast } from '../contexts/ToastContext'
import { calcularStatusSocio } from '../utils/statusHelper'

const INVERNADAS_FILTRO = ['Todas as Invernadas', ...INVERNADAS]

const inputClass = 'w-full px-3.5 py-3.5 border-none rounded-xl bg-gray-100 text-sm outline-none focus:ring-2 focus:ring-blue-300 focus:bg-white transition-colors'

function iniciais(nome) {
  const partes = (nome || '').trim().split(' ')
  return ((partes[0]?.[0] ?? '') + (partes[partes.length - 1]?.[0] ?? '')).toUpperCase()
}

export default function Socios() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [dadosIniciais, setDadosIniciais] = useState([])
  const [loading, setLoading] = useState(true)
  const [ordenacao, setOrdenacao] = useState('Nome (A-Z)')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('Todas as Categorias')
  const [status, setStatus] = useState(() => location.state?.filtroStatus ?? 'Todos os Status')
  const [invernada, setInvernada] = useState('Todas as Invernadas')

  useEffect(() => {
    Promise.all([getSocios(), getMensalidades()])
      .then(([sociosData, mensalidadesData]) => {
        const mapped = sociosData.map(s => {
          return {
            ...s,
            mensalidade: calcularStatusSocio(s, mensalidadesData)
          }
        })
        setDadosIniciais(mapped)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error(`Erro ao carregar sócios: ${err.message}`)
        setLoading(false)
      })
  }, [toast])

  const filtrados = useMemo(() => {
    return dadosIniciais.filter(s => {
      const matchBusca = (s.nome || '').toLowerCase().includes(busca.toLowerCase()) || (s.cpf || '').includes(busca)
      const matchCategoria = categoria === 'Todas as Categorias' || s.status === categoria
      const matchStatus = status === 'Todos os Status' || s.mensalidade === status
      const matchInvernada = invernada === 'Todas as Invernadas' || s.invernada === invernada
      return matchBusca && matchCategoria && matchStatus && matchInvernada
    })
  }, [dadosIniciais, busca, categoria, status, invernada])

  const ordenados = useMemo(() => {
    return [...filtrados].sort((a, b) => {
      if (ordenacao === 'Nome (A-Z)') {
        return (a.nome || '').localeCompare(b.nome || '')
      }
      if (ordenacao === 'Nome (Z-A)') {
        return (b.nome || '').localeCompare(a.nome || '')
      }
      if (ordenacao === 'Mais Recentes') {
        const da = a.data_entrada ? new Date(a.data_entrada) : new Date(0)
        const db = b.data_entrada ? new Date(b.data_entrada) : new Date(0)
        return db - da
      }
      if (ordenacao === 'Mais Antigos') {
        const da = a.data_entrada ? new Date(a.data_entrada) : new Date(0)
        const db = b.data_entrada ? new Date(b.data_entrada) : new Date(0)
        return da - db
      }
      if (ordenacao === 'Mais Dependentes') {
        return (b.dependentes || 0) - (a.dependentes || 0)
      }
      return 0
    })
  }, [filtrados, ordenacao])

  return (
    <Layout>
      <main className="flex-1 bg-[#f0f2f5]">
        <div className="max-w-7xl mx-auto px-6 py-7">

          <div className="flex justify-between items-center mb-6 flex-wrap gap-4 max-md:flex-col max-md:items-start">
            <div>
              <h1 className="text-[#1a3560] text-3xl font-bold">Sócios</h1>
              <p className="text-gray-500">Gerenciar cadastro de sócios do CTG</p>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <Link
                to="/socios/novo"
                className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-[0_4px_12px_rgba(37,99,235,0.3)] no-underline"
              >
                Cadastrar novo sócio
              </Link>
            </div>
          </div>

          <section className="bg-white rounded-2xl p-6 shadow-[0_4px_12px_rgba(0,0,0,0.08)] mb-6">
            <h2 className="text-[#1a3560] text-xl font-bold mb-5">Filtros</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <input
                type="text"
                placeholder="Buscar por nome ou CPF..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className={inputClass}
              />
              <select value={categoria} onChange={e => setCategoria(e.target.value)} className={inputClass}>
                <option>Todas as Categorias</option>
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
                <option>Todos os Status</option>
                <option>Em dia</option>
                <option>Atrasado</option>
                <option>Pendente</option>
                <option>Inativo</option>
              </select>
              <select value={invernada} onChange={e => setInvernada(e.target.value)} className={inputClass}>
                {INVERNADAS_FILTRO.map(inv => <option key={inv}>{inv}</option>)}
              </select>
              <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} className={inputClass}>
                <option value="Nome (A-Z)">Nome (A-Z)</option>
                <option value="Nome (Z-A)">Nome (Z-A)</option>
                <option value="Mais Recentes">Mais Recentes</option>
                <option value="Mais Antigos">Mais Antigos</option>
                <option value="Mais Dependentes">Mais Dependentes</option>
              </select>
            </div>
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-[0_4px_12px_rgba(0,0,0,0.08)] mb-6">
            {!loading && (
              <p className="text-gray-500 mb-4 text-sm">
                Mostrando <span className="font-semibold">{filtrados.length}</span> de {dadosIniciais.length} sócios
              </p>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                <p className="text-gray-500 text-sm">Carregando sócios...</p>
              </div>
            ) : filtrados.length === 0 ? (
              <EmptyState
                icon={<Users size={40} />}
                title="Nenhum sócio encontrado"
                description="Tente ajustar os filtros para ver resultados."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[800px]">
                  <thead>
                    <tr>
                      {['Foto', 'Nome', 'CPF', 'Endereço', 'Categoria', 'Invernada', 'Dep.', 'Mensalidade', ''].map(h => (
                        <th key={h} className="text-left py-3.5 px-2.5 border-b border-gray-200 text-sm font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ordenados.map(s => (
                      <tr
                        key={s.id}
                        className="cursor-pointer hover:bg-blue-50 transition-colors"
                        onClick={() => navigate(`/socios/${s.id}`)}
                        title="Clique para ver detalhes"
                      >
                        <td className="py-4 px-2.5 border-b border-gray-100">
                          <div className="w-[42px] h-[42px] rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                            {iniciais(s.nome)}
                          </div>
                        </td>
                        <td className="py-4 px-2.5 border-b border-gray-100 text-sm font-medium">{s.nome}</td>
                        <td className="py-4 px-2.5 border-b border-gray-100 text-sm text-gray-500">{s.cpf}</td>
                        <td className="py-4 px-2.5 border-b border-gray-100 text-sm text-gray-500">{s.endereco}</td>
                        <td className="py-4 px-2.5 border-b border-gray-100"><Badge color="green">{s.status}</Badge></td>
                        <td className="py-4 px-2.5 border-b border-gray-100 text-sm text-gray-600">{s.invernada}</td>
                        <td className="py-4 px-2.5 border-b border-gray-100 text-sm text-center font-medium text-gray-700">{s.dependentes}</td>
                        <td className="py-4 px-2.5 border-b border-gray-100">
                          <Badge color={s.mensalidade === 'Em dia' ? 'green' : s.mensalidade === 'Atrasado' ? 'red' : s.mensalidade === 'Inativo' ? 'gray' : 'yellow'}>
                            {s.mensalidade}
                          </Badge>
                        </td>
                        <td className="py-4 px-2.5 border-b border-gray-100 text-blue-400">
                          <ChevronRight size={18} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </main>
    </Layout>
  )
}
