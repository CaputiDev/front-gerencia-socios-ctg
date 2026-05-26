// src/services/api.js

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const INVERNADA_TO_CATEGORIA = {
  'Nenhuma': '1',
  'Pre Mirim': '2',
  'Mirim': '3',
  'Juvenil': '4',
  'Adulto': '5',
  'Veterano': '6',
  'Xiru': '7',
  'Chula': '8'
};

const CATEGORIA_TO_INVERNADA = {
  '1': 'Nenhuma',
  '2': 'Pre Mirim',
  '3': 'Mirim',
  '4': 'Juvenil',
  '5': 'Adulto',
  '6': 'Veterano',
  '7': 'Xiru',
  '8': 'Chula'
};


const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function mapMensalidadeParaPagamento(m) {
  const nomeMes = MESES_NOMES[(m.mes - 1)] || '';
  const [y, mo, d] = (m.data_vencimento || '').split('-');
  return {
    mes: `${nomeMes}/${m.ano}`,
    valor: `R$ ${parseFloat(m.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    status: m.status,
    data: d && mo && y ? `${d}/${mo}/${y}` : '—',
  };
}

// Converte os dados recebidos do back-end para o formato em conformidade com as páginas do front-end
function mapBackendToFrontendSocio(b, mensalidades = []) {
  const enderecoStr = b.endereco && typeof b.endereco === 'string'
    ? b.endereco
    : 'Rua Não Informada, S/N - Centro - Charqueadas/RS';

  const pagamentos = mensalidades.map(mapMensalidadeParaPagamento);

  const temPendente = mensalidades.some(m => m.status === 'Atrasado' || m.status === 'Pendente');
  const ultimoPago = mensalidades
    .filter(m => m.status === 'Pago')
    .sort((a, b) => b.ano - a.ano || b.mes - a.mes)[0];

  return {
    id: Number(b.id),
    nome: b.nome,
    cpf: b.cpf,
    email: b.email || '',
    telefone: b.telefone,
    data_nascimento: b.data_nascimento,
    endereco: enderecoStr,
    status: b.status || 'Ativo',
    invernada: CATEGORIA_TO_INVERNADA[String(b.categoria_id)] || 'Nenhuma',
    dependentes: Array.isArray(b.dependentes) ? b.dependentes.length : 0,
    mensalidade: temPendente ? 'Atrasado' : 'Em dia',
    data_entrada: b.data_entrada,
    ultimoPagamento: ultimoPago ? `${String(ultimoPago.mes).padStart(2,'0')}/${ultimoPago.ano}` : null,
    pagamentos,
  };
}

// Converte os dados do front-end no JSON que o controlador PHP do back-end necessita
function mapFrontendToBackendSocio(f) {
  return {
    nome: f.nome,
    cpf: f.cpf,
    telefone: f.telefone || '',
    foto: f.foto || '',
    identidade: f.identidade || 'Não informada',
    endereco: f.endereco || '',
    data_nascimento: f.data_nascimento || '1990-01-01',
    data_entrada: f.data_entrada || new Date().toISOString().split('T')[0],
    status: f.status || 'Ativo',
    categoria_id: INVERNADA_TO_CATEGORIA[f.invernada] || '1',
    dancarino: f.dancarino !== undefined ? f.dancarino : true,
    paga_instrutor: f.paga_instrutor !== undefined ? f.paga_instrutor : false,
  };
}

async function parseError(res, defaultMsg) {
  let errorMsg = defaultMsg;
  try {
    const errData = await res.json();
    if (errData && errData.message) {
      errorMsg = errData.message;
    }
  } catch (jsonErr) {
    console.warn('Falha ao decodificar JSON de erro:', jsonErr);
  }
  const err = new Error(errorMsg);
  err.status = res.status;
  return err;
}

export const api = {
  async getSocios() {
    try {
      const [sociosRes, mensalidadesRes] = await Promise.all([
        fetch(`${BASE_URL}/socios`),
        fetch(`${BASE_URL}/mensalidades`),
      ]);
      if (!sociosRes.ok) throw await parseError(sociosRes, 'Erro ao buscar sócios');
      const socios = await sociosRes.json();
      const mensalidades = mensalidadesRes.ok ? await mensalidadesRes.json() : [];
      return Array.isArray(socios)
        ? socios.map(s => mapBackendToFrontendSocio(s, mensalidades.filter(m => m.socio_id === s.id)))
        : [];
    } catch (err) {
      if (err instanceof TypeError || err.message === 'Failed to fetch') {
        const networkErr = new Error('Falha de comunicação com o servidor. Verifique se o backend está rodando.');
        networkErr.isNetworkError = true;
        throw networkErr;
      }
      throw err;
    }
  },

  async getSocioById(id) {
    try {
      const [socioRes, mensalidadesRes] = await Promise.all([
        fetch(`${BASE_URL}/socios/${id}`),
        fetch(`${BASE_URL}/mensalidades`),
      ]);
      if (!socioRes.ok) throw await parseError(socioRes, 'Erro ao buscar sócio');
      const socio = await socioRes.json();
      const mensalidades = mensalidadesRes.ok ? await mensalidadesRes.json() : [];
      return mapBackendToFrontendSocio(socio, mensalidades.filter(m => m.socio_id === socio.id));
    } catch (err) {
      if (err instanceof TypeError || err.message === 'Failed to fetch') {
        const networkErr = new Error('Falha de comunicação com o servidor. Verifique se o backend está rodando.');
        networkErr.isNetworkError = true;
        throw networkErr;
      }
      throw err;
    }
  },

  async createSocio(socioData) {
    const backendData = mapFrontendToBackendSocio(socioData);
    try {
      const res = await fetch(`${BASE_URL}/socios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendData)
      });
      if (!res.ok) {
        throw await parseError(res, 'Erro ao cadastrar sócio');
      }
      const data = await res.json();
      return mapBackendToFrontendSocio(data);
    } catch (err) {
      if (err instanceof TypeError || err.message === 'Failed to fetch') {
        const networkErr = new Error('Falha de comunicação com o servidor. Verifique se o backend está rodando.');
        networkErr.isNetworkError = true;
        throw networkErr;
      }
      throw err;
    }
  },

  async updateSocio(id, socioData) {
    const backendData = mapFrontendToBackendSocio(socioData);
    try {
      const res = await fetch(`${BASE_URL}/socios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendData)
      });
      if (!res.ok) {
        throw await parseError(res, 'Erro ao atualizar sócio');
      }
      const data = await res.json();
      return data;
    } catch (err) {
      if (err instanceof TypeError || err.message === 'Failed to fetch') {
        const networkErr = new Error('Falha de comunicação com o servidor. Verifique se o backend está rodando.');
        networkErr.isNetworkError = true;
        throw networkErr;
      }
      throw err;
    }
  },

  async deleteSocio(id) {
    try {
      const res = await fetch(`${BASE_URL}/socios/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        throw await parseError(res, 'Erro ao excluir sócio');
      }
      return await res.json();
    } catch (err) {
      if (err instanceof TypeError || err.message === 'Failed to fetch') {
        const networkErr = new Error('Falha de comunicação com o servidor. Verifique se o backend está rodando.');
        networkErr.isNetworkError = true;
        throw networkErr;
      }
      throw err;
    }
  },

  async registrarPagamento(socioId, { mes, valor, data }) {
    const [nomeMes, anoStr] = mes.split('/');
    const mesNum = MESES_NOMES.indexOf(nomeMes) + 1;
    const ano = parseInt(anoStr);
    const valorNum = parseFloat(valor.replace(/[^\d,]/g, '').replace(',', '.'));
    const [d, m, y] = data.split('/');
    const dataISO = `${y}-${m}-${d}`;

    try {
      const mensalidadeRes = await fetch(`${BASE_URL}/mensalidades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socio_id: socioId, mes: mesNum, ano, valor: valorNum, status: 'Pago', data_vencimento: dataISO })
      });
      if (!mensalidadeRes.ok) throw await parseError(mensalidadeRes, 'Erro ao criar mensalidade');
      const mensalidade = await mensalidadeRes.json();

      const pagamentoRes = await fetch(`${BASE_URL}/pagamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensalidade_id: mensalidade.id, data_pagamento: dataISO, forma_pagamento: 'Dinheiro', valor_pago: valorNum, multa_juros_aplicados: 0 })
      });
      if (!pagamentoRes.ok) throw await parseError(pagamentoRes, 'Erro ao registrar pagamento');
      return await pagamentoRes.json();
    } catch (err) {
      if (err instanceof TypeError || err.message === 'Failed to fetch') {
        const networkErr = new Error('Falha de comunicação com o servidor. Verifique se o backend está rodando.');
        networkErr.isNetworkError = true;
        throw networkErr;
      }
      throw err;
    }
  }
};
