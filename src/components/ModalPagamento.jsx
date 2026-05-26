import { useState } from 'react'

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

export default function ModalPagamento({ nomeSocio, mesPadrao, onFechar, onSalvar }) {
  const [mes, setMes] = useState(() => mesPadrao ?? MESES_OPCOES[0])
  const [valor, setValor] = useState('R$ 80,00')
  const [data, setData] = useState(hojeISO())
  const [confirmado, setConfirmado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    if (!mes || !valor.trim() || !data) {
      setErro('Preencha todos os campos antes de confirmar.')
      return
    }
    setErro('')
    setSalvando(true)
    try {
      await onSalvar({ mes, valor: valor.trim(), status: 'Pago', data: isoParaBR(data) })
      setConfirmado(true)
    } catch (err) {
      setErro(err.message || 'Erro ao registrar pagamento.')
    } finally {
      setSalvando(false)
    }
  }

  if (confirmado) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-5">
        <div className="bg-white w-full max-w-[440px] rounded-2xl p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl mx-auto mb-5">
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
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.3)]"
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
            <p className="text-blue-200 text-sm mt-0.5">{nomeSocio}</p>
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
                {MESES_OPCOES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">Valor</label>
                <input
                  type="text"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">Data do pagamento</label>
                <input
                  type="date"
                  value={data}
                  onChange={e => setData(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

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
                <span className="text-gray-500">Status</span>
                <span className="font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full text-xs">Pago</span>
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
              disabled={salvando}
              className="bg-[#1a3560] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-800 transition-colors shadow-[0_4px_12px_rgba(26,53,96,0.35)] cursor-pointer disabled:opacity-60"
            >
              {salvando ? 'Salvando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
