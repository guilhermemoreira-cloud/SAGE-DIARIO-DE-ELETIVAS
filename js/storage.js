// js/storage.js - Gerenciamento de estado
console.log("📦 storage.js carregado");

let state = {
  alunos: [],
  professores: [],
  eletivas: [],
  matriculas: [],
  registros: [],
  semestres: [],
  remocoes: [],
  notas: [],
  ultimaSincronizacao: null,
  semestreAtivo: null,
  nextId: {
    aluno: 1,
    professor: 1,
    eletiva: 1,
    matricula: 1,
    registro: 1,
  },
  _versao: {
    alunos: null,
    professores: null,
    eletivas: null,
    matriculas: null,
    registros: null,
    notas: null,
  },
  _offlineQueue: [] // Fila para operações offline
};

// FUNÇÃO CORRIGIDA: Carregar estado APENAS do Firebase
async function carregarEstado() {
  console.log("📊 Carregando estado do Firebase...");

  try {
    // Não carregar do localStorage - usar Firebase como fonte primária
    // state.professores = JSON.parse(localStorage.getItem(CONFIG.storageKeys.professores)) || [];
    // state.alunos = JSON.parse(localStorage.getItem(CONFIG.storageKeys.alunos)) || [];
    // state.eletivas = JSON.parse(localStorage.getItem(CONFIG.storageKeys.eletivas)) || [];
    // state.matriculas = JSON.parse(localStorage.getItem(CONFIG.storageKeys.matriculas)) || [];
    // state.registros = JSON.parse(localStorage.getItem(CONFIG.storageKeys.registros)) || [];
    
    // Inicializar arrays vazios - Firebase vai preencher
    state.professores = [];
    state.alunos = [];
    state.eletivas = [];
    state.matriculas = [];
    state.registros = [];
    state.notas = [];
    
    // Carregar apenas configurações que são salvas localmente
    state.semestres = JSON.parse(localStorage.getItem(CONFIG.storageKeys.semestres)) || [];
    state.remocoes = JSON.parse(localStorage.getItem(CONFIG.storageKeys.remocoes)) || [];
    state.ultimaSincronizacao = localStorage.getItem(CONFIG.storageKeys.ultimaSincronizacao);
    
    // Carregar liberação de notas do localStorage (configuração do gestor)
    state.liberacaoNotas = JSON.parse(localStorage.getItem("sage_liberacao_notas")) || null;
    
    // Carregar configuração de tempos do localStorage (configuração do gestor)
    state.configTempos = JSON.parse(localStorage.getItem("sage_config_tempos")) || null;

    // Carregar fila offline
    state._offlineQueue = JSON.parse(localStorage.getItem("sage_offline_queue")) || [];

    // Carregar versões
    const versaoSalva = JSON.parse(localStorage.getItem("sage_versoes") || "{}");
    state._versao = {
      alunos: versaoSalva.alunos || null,
      professores: versaoSalva.professores || null,
      eletivas: versaoSalva.eletivas || null,
      matriculas: versaoSalva.matriculas || null,
      registros: versaoSalva.registros || null,
      notas: versaoSalva.notas || null,
    };

    if (state.semestres.length === 0) {
      state.semestres = [
        {
          id: "2026-1",
          nome: "1º Semestre 2026",
          ano: 2026,
          periodo: 1,
          ativo: true,
        },
        {
          id: "2026-2",
          nome: "2º Semestre 2026",
          ano: 2026,
          periodo: 2,
          ativo: false,
        },
      ];
    }

    state.semestreAtivo = state.semestres.find((s) => s.ativo) || state.semestres[0];

    console.log(`✅ Estado inicializado (aguardando Firebase): ${state.professores.length} professores, ${state.alunos.length} alunos`);
    
  } catch (e) {
    console.error("❌ Erro ao carregar estado:", e);
  }

  return state;
}

// FUNÇÃO CORRIGIDA: Salvar estado APENAS no localStorage para cache offline
function salvarEstado() {
  try {
    // Não salvar dados principais no localStorage - apenas cache para offline
    // localStorage.setItem(CONFIG.storageKeys.professores, JSON.stringify(state.professores));
    // localStorage.setItem(CONFIG.storageKeys.alunos, JSON.stringify(state.alunos));
    // localStorage.setItem(CONFIG.storageKeys.eletivas, JSON.stringify(state.eletivas));
    // localStorage.setItem(CONFIG.storageKeys.matriculas, JSON.stringify(state.matriculas));
    // localStorage.setItem(CONFIG.storageKeys.registros, JSON.stringify(state.registros));
    
    // Salvar apenas configurações e dados que podem ser offline
    localStorage.setItem(CONFIG.storageKeys.semestres, JSON.stringify(state.semestres));
    localStorage.setItem(CONFIG.storageKeys.remocoes, JSON.stringify(state.remocoes));
    localStorage.setItem("sage_notas_2026", JSON.stringify(state.notas || []));
    localStorage.setItem("sage_liberacao_notas", JSON.stringify(state.liberacaoNotas || null));
    localStorage.setItem("sage_config_tempos", JSON.stringify(state.configTempos || null));
    localStorage.setItem("sage_nextId_2026", JSON.stringify(state.nextId));
    localStorage.setItem("sage_versoes", JSON.stringify(state._versao));
    localStorage.setItem("sage_offline_queue", JSON.stringify(state._offlineQueue));

    console.log("💾 Configurações salvas no localStorage");
  } catch (e) {
    console.error("❌ Erro ao salvar estado:", e);
  }
}

// Salvar dados do Firebase no cache (para leitura offline)
function salvarCacheFirebase(colecao, dados) {
  try {
    const cacheKey = `sage_cache_${colecao}`;
    localStorage.setItem(cacheKey, JSON.stringify(dados));
    console.log(`💾 Cache salvo: ${colecao} (${dados.length} itens)`);
  } catch (e) {
    console.warn("Erro ao salvar cache:", e);
  }
}

// Carregar cache offline (quando sem conexão)
function carregarCacheOffline(colecao) {
  try {
    const cacheKey = `sage_cache_${colecao}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn("Erro ao carregar cache:", e);
  }
  return [];
}

// Adicionar operação à fila offline
function adicionarOperacaoOffline(tipo, colecao, dados, id) {
  const operacao = {
    id: Date.now() + Math.random(),
    tipo: tipo, // 'salvar', 'deletar', 'atualizar'
    colecao: colecao,
    dados: dados,
    documentoId: id,
    timestamp: new Date().toISOString(),
    tentativas: 0
  };
  state._offlineQueue.push(operacao);
  localStorage.setItem("sage_offline_queue", JSON.stringify(state._offlineQueue));
  console.log(`📦 Operação adicionada à fila offline: ${tipo} - ${colecao}`);
  return operacao.id;
}

// Processar fila offline quando conexão restabelecer
async function processarFilaOffline() {
  if (!navigator.onLine) return;
  if (state._offlineQueue.length === 0) return;
  
  console.log(`🔄 Processando ${state._offlineQueue.length} operações offline...`);
  
  const pendentes = [...state._offlineQueue];
  state._offlineQueue = [];
  
  for (const op of pendentes) {
    try {
      if (op.tipo === 'salvar' && window.FirebaseSync) {
        await window.FirebaseSync.salvarDadosFirebase(op.colecao, op.dados, op.documentoId);
      } else if (op.tipo === 'deletar' && window.FirebaseSync) {
        await window.FirebaseSync.deletarDadosFirebase(op.colecao, op.documentoId);
      }
      console.log(`✅ Operação offline processada: ${op.tipo} - ${op.colecao}`);
    } catch (error) {
      console.warn(`⚠️ Falha ao processar operação offline:`, error);
      state._offlineQueue.push(op);
    }
  }
  
  localStorage.setItem("sage_offline_queue", JSON.stringify(state._offlineQueue));
}

function getNextId(tipo) {
  const novoId = window.gerarUUID ? window.gerarUUID() : `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (!state.nextId) state.nextId = {};
  if (!state.nextId[tipo]) state.nextId[tipo] = 1;
  state.nextId[tipo] += 1;
  
  salvarEstado();
  return novoId;
}

function criarObjetoComUuid(tipo, dados) {
  const id = window.gerarUUID ? window.gerarUUID() : getNextId(tipo);
  return {
    id: id,
    ...dados,
    _criadoEm: new Date().toISOString(),
    _tipo: tipo,
  };
}

function atualizarVersao(colecao, timestamp) {
  if (!state._versao) state._versao = {};
  state._versao[colecao] = timestamp;
  localStorage.setItem("sage_versoes", JSON.stringify(state._versao));
}

function obterVersao(colecao) {
  return state._versao?.[colecao] || null;
}

function atualizarIndicadorSemestre() {
  const badge = document.getElementById("semestreAtivoBadge");
  if (badge && state.semestreAtivo) {
    badge.textContent = `${state.semestreAtivo.id} - ATIVO`;
  }
}

function getEstatisticas() {
  return {
    totalAlunos: state.alunos.length,
    totalProfessores: state.professores.length,
    totalEletivas: state.eletivas.length,
    totalMatriculas: state.matriculas.length,
  };
}

window.state = state;
window.carregarEstado = carregarEstado;
window.salvarEstado = salvarEstado;
window.salvarCacheFirebase = salvarCacheFirebase;
window.carregarCacheOffline = carregarCacheOffline;
window.adicionarOperacaoOffline = adicionarOperacaoOffline;
window.processarFilaOffline = processarFilaOffline;
window.getNextId = getNextId;
window.criarObjetoComUuid = criarObjetoComUuid;
window.atualizarVersao = atualizarVersao;
window.obterVersao = obterVersao;
window.atualizarIndicadorSemestre = atualizarIndicadorSemestre;
window.getEstatisticas = getEstatisticas;
