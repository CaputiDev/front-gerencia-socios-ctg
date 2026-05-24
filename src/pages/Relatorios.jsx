import { useState } from 'react'
import Layout from '../components/Layout'
import Badge from '../components/Badge'
import { getSocios, getMensalidades, getPagamentos } from '../services/sociosService'
import { useToast } from '../contexts/ToastContext'
import { INVERNADAS } from '../data/constants'
import { exportarExcel, exportarWord, exportarPDF } from '../utils/reportExporter'

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function gerarMesesOpcoes(quantidade = 13) {
  const hoje = new Date()
  const lista = []
  for (let i = 0; i < quantidade; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    lista.push(`${MESES_NOMES[d.getMonth()]}/${d.getFullYear()}`)
  }
  return lista
}

const MESES_FILTRO = gerarMesesOpcoes()

export default function Relatorios() {
  const toast = useToast()
  const [tipoRelatorio, setTipoRelatorio] = useState('')
  const [situacao, setSituacao] = useState('Todas as Situações')
  const [invernada, setInvernada] = useState('Todas as Invernadas')
  const [pagamento, setPagamento] = useState('Todos')

  // Novos filtros temporais solicitados pelo usuário
  const [tipoFiltroTemporal, setTipoFiltroTemporal] = useState('mes') // 'mes' ou 'periodo'
  const [filtroMes, setFiltroMes] = useState('Todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const [resultado, setResultado] = useState(null)
  const [erroTipo, setErroTipo] = useState(false)
  const [loading, setLoading] = useState(false)

  const inputClass = 'w-full px-3.5 py-3.5 border-none rounded-xl bg-gray-100 text-sm outline-none focus:ring-2 focus:ring-blue-300 focus:bg-white transition-colors'

  async function gerar() {
    if (!tipoRelatorio) {
      setErroTipo(true)
      return
    }
    setErroTipo(false)
    setLoading(true)

    try {
      const [sociosData, mensalidadesData, pagamentosData] = await Promise.all([
        getSocios(),
        getMensalidades(),
        getPagamentos()
      ])

      // Parse do mês de referência selecionado
      const [filtroMesNome, filtroAnoStr] = filtroMes.split('/')
      const filtroMesNum = MESES_NOMES.indexOf(filtroMesNome) + 1
      const filtroAnoNum = parseInt(filtroAnoStr, 10)

      // Mapeamento dinâmico do status de adimplência do sócio
      const mappedSocios = sociosData.map(s => {
        const socioMensalidades = mensalidadesData.filter(m => m.socio_id === s.id && !m.dependente_id)

        let statusPagamento = 'Em dia'

        if (tipoFiltroTemporal === 'mes' && filtroMes !== 'Todos') {
          // Se houver mês selecionado, checa se a mensalidade específica daquele mês está pendente/atrasada
          const targetM = socioMensalidades.find(
            m => m.mes === filtroMesNum && m.ano === filtroAnoNum
          )
          
          if (targetM) {
            if (targetM.status === 'Atrasado') {
              statusPagamento = 'Atrasado'
            } else {
              // 'Pago' ou 'Pendente' são considerados 'Em dia' no relatório
              statusPagamento = 'Em dia'
            }
          } else {
            // Se não criada ainda no banco:
            // Checar se é um mês no passado (anterior ao corrente) e se o sócio já estava admitido
            const hoje = new Date()
            const atualAno = hoje.getFullYear()
            const atualMes = hoje.getMonth() + 1
            const isPast = filtroAnoNum < atualAno || (filtroAnoNum === atualAno && filtroMesNum < atualMes)

            let entradaAno = 0
            let entradaMes = 0
            if (s.data_entrada) {
              const partes = s.data_entrada.split('-')
              entradaAno = parseInt(partes[0], 10)
              entradaMes = parseInt(partes[1], 10)
            }

            const jaEstavaCadastrado = entradaAno > 0 && (filtroAnoNum > entradaAno || (filtroAnoNum === entradaAno && filtroMesNum >= entradaMes))

            if (isPast && jaEstavaCadastrado) {
              statusPagamento = 'Atrasado'
            } else {
              statusPagamento = 'Em dia' // Pendente vira 'Em dia' no relatório
            }
          }
        } else {
          // Caso contrário, checa se possui qualquer mensalidade em atraso
          // Considera apenas 'Atrasado' (Pendente/Pago viram 'Em dia')
          const hasAtrasado = socioMensalidades.some(m => {
            const hoje = new Date()
            const atualAno = hoje.getFullYear()
            const atualMes = hoje.getMonth() + 1
            const isPast = m.ano < atualAno || (m.ano === atualAno && m.mes < atualMes)

            let entradaAno = 0
            let entradaMes = 0
            if (s.data_entrada) {
              const partes = s.data_entrada.split('-')
              entradaAno = parseInt(partes[0], 10)
              entradaMes = parseInt(partes[1], 10)
            }

            const jaEstavaCadastrado = entradaAno > 0 && (m.ano > entradaAno || (m.ano === entradaAno && m.mes >= entradaMes))

            return isPast && jaEstavaCadastrado && m.status === 'Atrasado'
          })

          statusPagamento = hasAtrasado ? 'Atrasado' : 'Em dia'
        }

        return {
          ...s,
          statusPagamento
        }
      })

      let dadosFiltrados = []

      if (tipoRelatorio === 'Sócios Ativos' || tipoRelatorio === 'Sócios Inadimplentes') {
        dadosFiltrados = mappedSocios.filter(s => {
          // Filtro de acordo com o tipo de relatório
          if (tipoRelatorio === 'Sócios Ativos' && s.status !== 'Ativo') return false
          if (tipoRelatorio === 'Sócios Inadimplentes' && s.statusPagamento !== 'Atrasado') return false

          // Filtro por Situação
          if (situacao === 'Ativo' && s.status !== 'Ativo') return false
          if (situacao === 'Inativo' && s.status !== 'Inativo') return false

          // Filtro por Invernada
          if (invernada !== 'Todas as Invernadas') {
            if (s.invernada !== invernada) return false
          }

          // Filtro por Status de Pagamento
          if (pagamento !== 'Todos') {
            if (pagamento === 'Em dia' && s.statusPagamento !== 'Em dia') return false
            if (pagamento === 'Atrasado' && s.statusPagamento !== 'Atrasado') return false
          }

          // Só devem aparecer no relatório os sócios que estavam naquele período (entraram antes ou durante o mês de referência)
          if (tipoFiltroTemporal === 'mes' && filtroMes !== 'Todos' && s.data_entrada) {
            const [socioAno, socioMes] = s.data_entrada.split('-').map(Number)
            if (socioAno > filtroAnoNum || (socioAno === filtroAnoNum && socioMes > filtroMesNum)) {
              return false
            }
          }

          // Filtro por Intervalo de Tempo (baseado na data de admissão do sócio)
          if (tipoFiltroTemporal === 'periodo') {
            if (dataInicio && s.data_entrada < dataInicio) return false
            if (dataFim && s.data_entrada > dataFim) return false
          }

          return true
        })
      } else if (tipoRelatorio === 'Dependentes') {
        const mockDependentes = [
          { id: 1, nome: 'Lucas Silva', socioTitular: 'João Silva', cpf: '111.222.333-00', telefone: '(11) 99999-9999', dataNascimento: '2012-05-10', dataEntrada: '2026-01-15', invernada: 'Mirim' },
          { id: 2, nome: 'Julia Santos', socioTitular: 'Maria Santos', cpf: '222.333.444-00', telefone: '(11) 98888-8888', dataNascimento: '2015-07-25', dataEntrada: '2026-02-01', invernada: 'Mirim' },
          { id: 3, nome: 'Felipe Costa', socioTitular: 'Ana Costa', cpf: '333.444.555-00', telefone: '(11) 96666-6666', dataNascimento: '2008-09-12', dataEntrada: '2026-03-01', invernada: 'Juvenil' }
        ]

        dadosFiltrados = mockDependentes.filter(d => {
          if (invernada !== 'Todas as Invernadas') {
            if (d.invernada !== invernada) return false
          }
          // Só devem aparecer no relatório os dependentes que estavam naquele período (entraram antes ou durante o mês de referência)
          if (tipoFiltroTemporal === 'mes' && filtroMes !== 'Todos' && d.dataEntrada) {
            const [depAno, depMes] = d.dataEntrada.split('-').map(Number)
            if (depAno > filtroAnoNum || (depAno === filtroAnoNum && depMes > filtroMesNum)) {
              return false
            }
          }
          if (tipoFiltroTemporal === 'periodo') {
            if (dataInicio && d.dataEntrada < dataInicio) return false
            if (dataFim && d.dataEntrada > dataFim) return false
          }
          return true
        })
      } else if (tipoRelatorio === 'Relatório Financeiro') {
        const matches = {}

        mensalidadesData.forEach(m => {
          // Filtro por mês específico se selecionado
          if (tipoFiltroTemporal === 'mes' && filtroMes !== 'Todos') {
            if (m.mes !== filtroMesNum || m.ano !== filtroAnoNum) return
          }

          const key = `${m.mes}/${m.ano}`
          if (!matches[key]) {
            matches[key] = {
              mesNum: m.mes,
              anoNum: m.ano,
              mesAno: `${MESES_NOMES[m.mes - 1]}/${m.ano}`,
              totalMensalidades: 0,
              totalPago: 0
            }
          }
          matches[key].totalMensalidades += Number(m.valor)

          const p = pagamentosData.find(pg => pg.mensalidade_id === m.id)
          if (p) {
            matches[key].totalPago += Number(p.valor_pago)
          }
        })

        // Mapeia e filtra pelo intervalo de datas
        dadosFiltrados = Object.values(matches)
          .map(item => {
            const totalPendente = Math.max(0, item.totalMensalidades - item.totalPago)
            const taxaAdimplencia = item.totalMensalidades > 0
              ? (item.totalPago / item.totalMensalidades) * 100
              : 100
            return {
              ...item,
              totalPendente,
              taxaAdimplencia
            }
          })
          .filter(item => {
            // Filtro por Intervalo de Datas no financeiro
            if (tipoFiltroTemporal === 'periodo') {
              const recordDateStr = `${item.anoNum}-${String(item.mesNum).padStart(2, '0')}-01`
              if (dataInicio) {
                const startLimit = dataInicio.slice(0, 7) + '-01'
                if (recordDateStr < startLimit) return false
              }
              if (dataFim) {
                const endLimit = dataFim.slice(0, 7) + '-01'
                if (recordDateStr > endLimit) return false
              }
            }
            return true
          })
          .sort((a, b) => b.anoNum - a.anoNum || b.mesNum - a.mesNum)
      }

      setResultado({
        tipo: tipoRelatorio,
        dados: dadosFiltrados,
        situacao,
        invernada,
        pagamento,
        tipoFiltroTemporal,
        filtroMes,
        dataInicio,
        dataFim
      })
      toast.success('Relatório gerado com sucesso!')
    } catch (err) {
      console.error(err)
      toast.error(`Erro ao consultar servidor: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }


  return (
    <Layout>
      <main className="flex-1 bg-[#f0f2f5]">
        <div className="max-w-7xl mx-auto px-6 py-7">

          {/* Folha de estilos CSS reativa para Impressão limpa do PDF */}
          <style>{`
            @media print {
              body, main, #root {
                background: white !important;
                color: black !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              aside, nav, header, button, select, input, label, .no-print, .toast, .sidebar, .navbar {
                display: none !important;
              }
              .print-container {
                display: block !important;
                width: 100% !important;
                position: absolute;
                left: 0;
                top: 0;
                padding: 10px !important;
              }
              .print-table {
                border-collapse: collapse !important;
                width: 100% !important;
                margin-top: 15px !important;
              }
              .print-table th, .print-table td {
                border: 1px solid #c0c0c0 !important;
                padding: 8px !important;
                font-size: 11px !important;
                text-align: left !important;
              }
              .print-table th {
                background-color: #f5f5f5 !important;
                color: black !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          `}</style>

          <div className="mb-6 no-print">
            <h1 className="text-[#1a3560] text-3xl font-bold mb-1.5">Relatórios</h1>
            <p className="text-gray-500">Gere relatórios personalizados e exporte em diversos formatos</p>
          </div>

          {/* Configurar Relatório - Ocultado na Impressão */}
          <section className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] mb-6 overflow-hidden no-print">
            <div className="bg-[#eef1f8] px-6 py-4 font-bold text-[#1a3560] border-b border-blue-100">
              Configurar Relatório
            </div>
            <div className="p-6">

              {/* Linha 1 de Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-sm font-bold">Tipo de Relatório *</label>
                  <select
                    value={tipoRelatorio}
                    onChange={e => { setTipoRelatorio(e.target.value); setErroTipo(false) }}
                    className={`${inputClass} ${erroTipo ? 'ring-2 ring-red-400' : ''}`}
                    disabled={loading}
                  >
                    <option value="">Selecione o tipo de relatório</option>
                    <option>Sócios Ativos</option>
                    <option>Sócios Inadimplentes</option>
                    <option>Dependentes</option>
                    <option>Relatório Financeiro</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold">Situação</label>
                  <select value={situacao} onChange={e => setSituacao(e.target.value)} className={inputClass} disabled={loading || tipoRelatorio === 'Dependentes' || tipoRelatorio === 'Relatório Financeiro'}>
                    <option>Todas as Situações</option>
                    <option>Ativo</option>
                    <option>Inativo</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold">Invernada</label>
                  <select value={invernada} onChange={e => setInvernada(e.target.value)} className={inputClass} disabled={loading || tipoRelatorio === 'Relatório Financeiro'}>
                    <option value="Todas as Invernadas">Todas as Invernadas</option>
                    {INVERNADAS.filter(inv => inv !== 'Nenhuma').map(inv => (
                      <option key={inv} value={inv}>{inv}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linha 2 de Filtros (Filtros Temporais Alternáveis Exclusivos) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold">Status de Pagamento</label>
                  <select value={pagamento} onChange={e => setPagamento(e.target.value)} className={inputClass} disabled={loading || tipoRelatorio === 'Dependentes' || tipoRelatorio === 'Relatório Financeiro'}>
                    <option>Todos</option>
                    <option>Em dia</option>
                    <option>Atrasado</option>
                  </select>
                </div>

                {/* Alternador de Filtro Temporal para evitar confusão do usuário */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold">Filtro Temporal</label>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setTipoFiltroTemporal('mes')
                        setDataInicio('')
                        setDataFim('')
                      }}
                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${tipoFiltroTemporal === 'mes'
                          ? 'bg-[#1a3560] text-white shadow-sm'
                          : 'bg-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Mês Único
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTipoFiltroTemporal('periodo')
                        setFiltroMes('Todos')
                      }}
                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${tipoFiltroTemporal === 'periodo'
                          ? 'bg-[#1a3560] text-white shadow-sm'
                          : 'bg-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Período
                    </button>
                  </div>
                </div>

                {tipoFiltroTemporal === 'mes' ? (
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-sm font-bold">Mês de Referência</label>
                    <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={inputClass} disabled={loading || tipoRelatorio === 'Dependentes'}>
                      <option value="Todos">Todos os Meses</option>
                      {MESES_FILTRO.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold">Data Inicial</label>
                      <input
                        type="date"
                        value={dataInicio}
                        onChange={e => setDataInicio(e.target.value)}
                        className={inputClass}
                        disabled={loading}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold">Data Final</label>
                      <input
                        type="date"
                        value={dataFim}
                        onChange={e => setDataFim(e.target.value)}
                        className={inputClass}
                        disabled={loading}
                      />
                    </div>
                  </>
                )}
              </div>

              {erroTipo && (
                <div className="mb-4">
                  <p className="text-red-500 text-sm font-medium">Selecione um tipo de relatório para continuar.</p>
                </div>
              )}

              <button
                onClick={gerar}
                disabled={loading}
                className="bg-blue-600 text-white px-5 py-3.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-[0_4px_12px_rgba(37,99,235,0.3)] cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Buscando dados no BD...
                  </>
                ) : (
                  'Gerar Relatório'
                )}
              </button>
            </div>
          </section>

          {/* Container Principal de Impressão e Exibição de Resultados */}
          {resultado && (
            <div className="print-container">

              {/* O cabeçalho de impressão se torna visível apenas no PDF */}
              <div className="hidden print:block border-b-2 border-[#1a3560] pb-2.5 mb-5">
                <h1 className="text-2xl font-bold text-[#1a3560] m-0">CTG — Sistema de Gestão de Sócios</h1>
                <p className="text-xs text-gray-500 m-0.5">
                  <strong>Relatório de Emissão:</strong> {resultado.tipo} | <strong>Gerado em:</strong> {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}
                </p>
                <p className="text-xs text-gray-500 m-0">
                  <strong>Filtros aplicados:</strong> Situação: {resultado.situacao} | Invernada: {resultado.invernada} | Pagamento: {resultado.pagamento} | {resultado.tipoFiltroTemporal === 'mes' ? `Mês de Referência: ${resultado.filtroMes}` : `Período: ${resultado.dataInicio ? resultado.dataInicio.split('-').reverse().join('/') : '—'} a ${resultado.dataFim ? resultado.dataFim.split('-').reverse().join('/') : '—'}`}
                </p>
              </div>

              <section className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] overflow-hidden">

                {/* Painel Superior - Ocultado na Impressão */}
                <div className="bg-[#eef1f8] px-6 py-4 border-b border-blue-100 flex justify-between items-center flex-wrap gap-4 no-print">
                  <div>
                    <h3 className="font-bold text-[#1a3560] text-lg">{resultado.tipo}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 animate-pulse">
                      Filtros: {resultado.situacao} · {resultado.invernada} · {resultado.tipoFiltroTemporal === 'mes' ? `Mês: ${resultado.filtroMes}` : `Período: ${resultado.dataInicio ? resultado.dataInicio.split('-').reverse().join('/') : '—'} a ${resultado.dataFim ? resultado.dataFim.split('-').reverse().join('/') : '—'}`}
                    </p>
                  </div>

                  {resultado.dados.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => exportarExcel(resultado, toast)}
                        className="px-4 py-2.5 rounded-xl font-bold text-xs bg-green-100 text-green-700 hover:bg-green-200 transition-colors cursor-pointer border-none"
                      >
                        Excel (CSV)
                      </button>
                      <button
                        onClick={() => exportarWord(resultado, toast)}
                        className="px-4 py-2.5 rounded-xl font-bold text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors cursor-pointer border-none"
                      >
                        Word (DOC)
                      </button>
                      <button
                        onClick={() => exportarPDF(resultado, toast)}
                        className="px-4 py-2.5 rounded-xl font-bold text-xs bg-red-100 text-red-600 hover:bg-red-200 transition-colors cursor-pointer border-none"
                      >
                        Baixar PDF
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-6">

                  {/* Descrição resumida da quantidade de registros */}
                  <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
                    <span className="text-sm font-semibold text-[#1a3560]">
                      Registros encontrados: <strong className="text-base">{resultado.dados.length}</strong>
                    </span>
                    <span className="text-xs text-gray-400 print:hidden">
                      * Utilize os botões acima para baixar este relatório.
                    </span>
                  </div>

                  {resultado.tipo === 'Dependentes' && (
                    <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium no-print">
                      💡 <strong>Nota Técnica:</strong> O endpoint de consulta de dependentes (`/api/dependentes`) não está exposto pelo backend PHP. Apresentamos acima os dados correspondentes à estrutura de teste do banco de dados (`seed.sql`) para fins de simulação e exportação de alta fidelidade.
                    </div>
                  )}

                  {resultado.dados.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                      Nenhum registro correspondente aos filtros foi encontrado no banco de dados.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">

                      {/* Tabela de Sócios */}
                      {(resultado.tipo === 'Sócios Ativos' || resultado.tipo === 'Sócios Inadimplentes') && (
                        <table className="w-full border-collapse min-w-[600px] print-table">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              {['Nome', 'CPF', 'Telefone', 'Situação', 'Invernada', 'Status Pagamento', 'Data Entrada'].map(h => (
                                <th key={h} className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wide">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {resultado.dados.map((d, i) => (
                              <tr key={i} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                                <td className="py-3.5 px-4 text-sm font-semibold text-gray-800">{d.nome}</td>
                                <td className="py-3.5 px-4 text-sm text-gray-500 font-mono">{d.cpf}</td>
                                <td className="py-3.5 px-4 text-sm text-gray-500">{d.telefone || '—'}</td>
                                <td className="py-3.5 px-4 text-xs">
                                  <Badge color={d.status === 'Ativo' ? 'green' : 'red'}>{d.status}</Badge>
                                </td>
                                <td className="py-3.5 px-4 text-sm text-gray-600 font-medium">{d.invernada}</td>
                                <td className="py-3.5 px-4 text-xs">
                                  <Badge color={d.statusPagamento === 'Em dia' ? 'green' : 'red'}>
                                    {d.statusPagamento}
                                  </Badge>
                                </td>
                                <td className="py-3.5 px-4 text-sm text-gray-500">
                                  {d.data_entrada ? d.data_entrada.split('-').reverse().join('/') : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Tabela de Dependentes */}
                      {resultado.tipo === 'Dependentes' && (
                        <table className="w-full border-collapse min-w-[600px] print-table">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              {['Nome do Dependente', 'Sócio Titular', 'CPF', 'Telefone', 'Data Nasc.', 'Data Entrada', 'Invernada'].map(h => (
                                <th key={h} className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wide">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {resultado.dados.map((d, i) => (
                              <tr key={i} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                                <td className="py-3.5 px-4 text-sm font-semibold text-gray-800">{d.nome}</td>
                                <td className="py-3.5 px-4 text-sm text-gray-600 font-medium">{d.socioTitular}</td>
                                <td className="py-3.5 px-4 text-sm text-gray-500 font-mono">{d.cpf}</td>
                                <td className="py-3.5 px-4 text-sm text-gray-500">{d.telefone}</td>
                                <td className="py-3.5 px-4 text-sm text-gray-500">
                                  {d.dataNascimento.split('-').reverse().join('/')}
                                </td>
                                <td className="py-3.5 px-4 text-sm text-gray-500">
                                  {d.dataEntrada ? d.dataEntrada.split('-').reverse().join('/') : '—'}
                                </td>
                                <td className="py-3.5 px-4 text-xs">
                                  <Badge color="purple">{d.invernada}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Tabela de Relatório Financeiro */}
                      {resultado.tipo === 'Relatório Financeiro' && (
                        <table className="w-full border-collapse min-w-[600px] print-table">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              {['Mês/Ano', 'Total Mensalidades', 'Total Recebido', 'Total Pendente', 'Adimplência'].map(h => (
                                <th key={h} className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wide">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {resultado.dados.map((d, i) => (
                              <tr key={i} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                                <td className="py-3.5 px-4 text-sm font-bold text-gray-800">{d.mesAno}</td>
                                <td className="py-3.5 px-4 text-sm font-semibold text-blue-900">
                                  R$ {d.totalMensalidades.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3.5 px-4 text-sm font-semibold text-green-700">
                                  R$ {d.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3.5 px-4 text-sm font-semibold text-amber-600">
                                  R$ {d.totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3.5 px-4 text-xs">
                                  <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${d.taxaAdimplencia >= 90
                                      ? 'bg-green-50 text-green-700 border border-green-200'
                                      : d.taxaAdimplencia >= 50
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {d.taxaAdimplencia.toFixed(1).replace('.', ',')}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                    </div>
                  )}

                  {/* Rodapé visível apenas na impressão PDF */}
                  <div className="hidden print:block text-right mt-12 pt-5 border-t border-gray-200 text-[10px] text-gray-400">
                    Documento Oficial extraído do Sistema CTG - Página 1 de 1.
                  </div>

                </div>
              </section>
            </div>
          )}

        </div>
      </main>
    </Layout>
  )
}
