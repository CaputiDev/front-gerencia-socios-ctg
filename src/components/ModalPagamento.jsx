import { useState, useEffect } from 'react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function gerarMeses() {
  const hoje = new Date()
  const opcoes = []
  for (let i = 0; i < 13; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    opcoes.push(`${MESES[d.getMonth()]}/${d.getFullYear()}`)
  }
  return opcoes
}

function hojeISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoParaBR(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const MESES_OPCOES = gerarMeses()
const inputClass = 'w-full px-3.5 py-3.5 border-none rounded-xl bg-gray-100 text-sm outline-none focus:ring-2 focus:ring-blue-200'

export default function ModalPagamento({
  nomeSocio,
  socioId,
  dataEntrada,
  mesPadrao,
  mensalidades = [],
  pagamentos = [],
  onFechar,
  onSalvar
}) {
  const [mes, setMes] = useState(() => mesPadrao ?? MESES_OPCOES[0])
  const [valor, setValor] = useState('R$ 80,00')
  const [data, setData] = useState(hojeISO())
  const [formaPagamento, setFormaPagamento] = useState('Transferencia')
  const [confirmado, setConfirmado] = useState(false)
  const [erro, setErro] = useState('')
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false)
  const [statusExibido, setStatusExibido] = useState('Pendente')

  useEffect(() => {
    if (!mes || !socioId) return

    const [mesNome, anoStr] = mes.split('/')
    const mesNum = MESES.indexOf(mesNome) + 1
    const anoNum = parseInt(anoStr, 10)

    const m = mensalidades.find(
      mens => mens.socio_id === Number(socioId) &&
              mens.mes === mesNum &&
              mens.ano === anoNum &&
              !mens.dependente_id
    )

    let statusCalculado = 'Pendente'

    if (m && m.status === 'Pago') {
      const p = pagamentos.find(pg => pg.mensalidade_id === m.id)
      if (p) {
        setValor(`R$ ${Number(p.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
        setData(p.data_pagamento)
        setFormaPagamento(p.forma_pagamento)
      } else {
        setValor(`R$ ${Number(m.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
        setData(hojeISO())
        setFormaPagamento('Transferencia')
      }
      setIsAlreadyPaid(true)
      statusCalculado = 'Pago'
    } else {
      if (m) {
        setValor(`R$ ${Number(m.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
        statusCalculado = m.status
      } else {
        setValor('R$ 80,00')
        
        // Calcular status presumido se não existir registro de mensalidade
        const hoje = new Date()
        const atualAno = hoje.getFullYear()
        const atualMes = hoje.getMonth() + 1

        const isPast = anoNum < atualAno || (anoNum === atualAno && mesNum < atualMes)
        
        let admissaoAno = 0
        let admissaoMes = 0
        if (dataEntrada) {
          const partes = dataEntrada.split('-')
          admissaoAno = parseInt(partes[0], 10)
          admissaoMes = parseInt(partes[1], 10)
        }

        const jaEstavaCadastrado = admissaoAno > 0 && (anoNum > admissaoAno || (anoNum === admissaoAno && mesNum >= admissaoMes))

        if (isPast && jaEstavaCadastrado) {
          statusCalculado = 'Atrasado'
        } else {
          statusCalculado = 'Pendente'
        }
      }
      setData(hojeISO())
      setFormaPagamento('Transferencia')
      setIsAlreadyPaid(false)
    }
    
    setStatusExibido(statusCalculado)
    setErro('')
  }, [mes, socioId, dataEntrada, mensalidades, pagamentos])

  function obterStatusOpcao(opcaoMesStr) {
    if (!socioId || !opcaoMesStr) return 'Pendente'

    const [mesNome, anoStr] = opcaoMesStr.split('/')
    const mesNum = MESES.indexOf(mesNome) + 1
    const anoNum = parseInt(anoStr, 10)

    const m = mensalidades.find(
      mens => mens.socio_id === Number(socioId) &&
              mens.mes === mesNum &&
              mens.ano === anoNum &&
              !mens.dependente_id
    )

    if (m) {
      return m.status
    }

    // Calcular status presumido se não existir registro de mensalidade
    const hoje = new Date()
    const atualAno = hoje.getFullYear()
    const atualMes = hoje.getMonth() + 1

    const isPast = anoNum < atualAno || (anoNum === atualAno && mesNum < atualMes)
    
    let admissaoAno = 0
    let admissaoMes = 0
    if (dataEntrada) {
      const partes = dataEntrada.split('-')
      admissaoAno = parseInt(partes[0], 10)
      admissaoMes = parseInt(partes[1], 10)
    }

    const jaEstavaCadastrado = admissaoAno > 0 && (anoNum > admissaoAno || (anoNum === admissaoAno && mesNum >= admissaoMes))

    if (isPast && jaEstavaCadastrado) {
      return 'Atrasado'
    }
    
    return 'Pendente'
  }

  function confirmar() {
    if (isAlreadyPaid) return

    if (!mes || !valor.trim() || !data) {
      setErro('Preencha todos os campos antes de confirmar.')
      return
    }
    setErro('')
    onSalvar({
      mesStr: mes,
      valorStr: valor.trim(),
      status: 'Pago',
      dataIso: data,
      formaPagamento
    })
    setConfirmado(true)
  }

  if (confirmado) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-5">
        <div className="bg-white w-full max-w-[440px] rounded-2xl p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl mx-auto mb-5 text-green-600 font-bold">
            ✓
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Pagamento registrado!</h2>
          <p className="text-gray-500 text-sm mb-1">
            Referência: <strong>{mes}</strong>
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Sócio: <strong>{nomeSocio}</strong>
          </p>
          <button
            onClick={onFechar}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.3)] border-none"
          >
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-5">
      <div className="bg-white w-full max-w-[500px] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] overflow-hidden">

        {/* Cabeçalho */}
        <div className="bg-[#1a3560] px-6 py-5 flex justify-between items-start">
          <div>
            <h2 className="text-white text-lg font-bold">Registrar Pagamento</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-blue-200 text-sm leading-none">{nomeSocio}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full select-none leading-none ${
                statusExibido === 'Pago'
                  ? 'text-green-700 bg-green-100'
                  : statusExibido === 'Atrasado'
                  ? 'text-red-700 bg-red-100'
                  : 'text-amber-700 bg-amber-100'
              }`}>
                {statusExibido === 'Pago' ? 'Pago' : statusExibido === 'Atrasado' ? 'Atrasado' : 'Pendente'}
              </span>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="text-blue-200 hover:text-white text-3xl leading-none cursor-pointer bg-transparent border-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6">

          {/* Formulário */}
          <div className="flex flex-col gap-4 mb-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold">Mês de referência</label>
              <select value={mes} onChange={e => setMes(e.target.value)} className={inputClass}>
                {MESES_OPCOES.map(m => {
                  const statusOpcao = obterStatusOpcao(m)
                  let style = {}
                  if (statusOpcao === 'Pago') {
                    style = { color: '#15803d', fontWeight: 'bold' }
                  } else if (statusOpcao === 'Atrasado') {
                    style = { color: '#b91c1c', fontWeight: 'bold' }
                  }
                  return (
                    <option key={m} value={m} style={style}>
                      {m} {statusOpcao === 'Pago' ? ' (Pago)' : statusOpcao === 'Atrasado' ? ' (Atrasado)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">Valor</label>
                <input
                  type="text"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  className={`${inputClass} ${isAlreadyPaid ? 'opacity-60 cursor-not-allowed bg-gray-200' : ''}`}
                  disabled={isAlreadyPaid}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">Data do pagamento</label>
                <input
                  type="date"
                  value={data}
                  onChange={e => setData(e.target.value)}
                  className={`${inputClass} ${isAlreadyPaid ? 'opacity-60 cursor-not-allowed bg-gray-200' : ''}`}
                  disabled={isAlreadyPaid}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold">Forma de Pagamento</label>
              <select
                value={formaPagamento}
                onChange={e => setFormaPagamento(e.target.value)}
                className={`${inputClass} ${isAlreadyPaid ? 'opacity-60 cursor-not-allowed bg-gray-200' : ''}`}
                disabled={isAlreadyPaid}
              >
                <option value="Transferencia">Pix / Transferência</option>
                <option value="Cartao">Cartão</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>
            </div>
          </div>

          {/* Aviso se já pago */}
          {isAlreadyPaid && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 mb-5 text-sm flex flex-col gap-1 shadow-sm">
              <span className="font-bold flex items-center gap-1.5 text-green-700">
                ✓ Mensalidade já quitada!
              </span>
              <span>
                Este pagamento foi registrado em <strong>{isoParaBR(data)}</strong> via{' '}
                <strong>
                  {formaPagamento === 'Transferencia'
                    ? 'Pix / Transferência'
                    : formaPagamento === 'Cartao'
                    ? 'Cartão'
                    : 'Dinheiro'}
                </strong>.
              </span>
            </div>
          )}

          {/* Preview em tempo real */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-3">Resumo do lançamento</p>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sócio</span>
                <span className="font-semibold text-gray-800 truncate max-w-[60%] text-right">{nomeSocio}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Referência</span>
                <span className="font-semibold text-gray-800">{mes || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Valor</span>
                <span className="font-semibold text-gray-800">{valor || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Data</span>
                <span className="font-semibold text-gray-800">{isoParaBR(data)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Forma</span>
                <span className="font-semibold text-gray-800">
                  {formaPagamento === 'Transferencia' ? 'Pix / Transferência' : formaPagamento === 'Cartao' ? 'Cartão' : 'Dinheiro'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs leading-none select-none ${
                  statusExibido === 'Pago'
                    ? 'text-green-700 bg-green-100'
                    : statusExibido === 'Atrasado'
                    ? 'text-red-700 bg-red-100'
                    : 'text-amber-700 bg-amber-100'
                }`}>
                  {statusExibido === 'Pago' ? 'Pago' : statusExibido === 'Atrasado' ? 'Atrasado' : 'Pendente'}
                </span>
              </div>
            </div>
          </div>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              {erro}
            </p>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onFechar}
              className="bg-white border border-slate-300 text-gray-700 px-5 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={isAlreadyPaid}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer border-none ${
                isAlreadyPaid
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                  : 'bg-[#1a3560] text-white hover:bg-blue-800 shadow-[0_4px_12px_rgba(26,53,96,0.35)]'
              }`}
            >
              Confirmar Pagamento
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
