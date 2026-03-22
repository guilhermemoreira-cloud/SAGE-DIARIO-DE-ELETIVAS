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
  }
};

function carregarEstado() {
  console.log("📊 Carregando estado do localStorage...");

  try {
    state.professores =
      JSON.parse(localStorage.getItem(CONFIG.storageKeys.professores)) || [];
    state.alunos =
      JSON.parse(localStorage.getItem(CONFIG.storageKeys.alunos)) || [];
    state.eletivas =
      JSON.parse(localStorage.getItem(CONFIG.storageKeys.eletivas)) || [];
    state.matriculas =
      JSON.parse(localStorage.getItem(CONFIG.storageKeys.matriculas)) || [];
    state.registros =
      JSON.parse(localStorage.getItem(CONFIG.storageKeys.registros)) || [];
    state.semestres =
      JSON.parse(localStorage.getItem(CONFIG.storageKeys.semestres)) || [];
    state.remocoes =
      JSON.parse(localStorage.getItem(CONFIG.storageKeys.remocoes)) || [];
    state.ultimaSincronizacao = localStorage.getItem(
      CONFIG.storageKeys.ultimaSincronizacao,
    );
    
    // Carregar notas
    state.notas = JSON.parse(localStorage.getItem("sage_notas_2026")) || [];
    
    // Carregar liberação de notas
    state.liberacaoNotas = JSON.parse(localStorage.getItem("sage_liberacao_notas")) || null;
    
    // Carregar configuração de tempos
    state.configTempos = JSON.parse(localStorage.getItem("sage_config_tempos")) || null;

    // Carregar nextId (compatibilidade com novo formato)
    const nextIdSaved = JSON.parse(localStorage.getItem("sage_nextId_2026")) || {};
    state.nextId = {
      aluno: nextIdSaved.aluno || state.alunos.length + 1,
      professor: nextIdSaved.professor || state.professores.length + 1,
      eletiva: nextIdSaved.eletiva || state.eletivas.length + 1,
      matricula: nextIdSaved.matricula || state.matriculas.length + 1,
      registro: nextIdSaved.registro || state.registros.length + 1,
    };
    
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

    state.semestreAtivo =
      state.semestres.find((s) => s.ativo) || state.semestres[0];

    console.log(
      `✅ Estado carregado: ${state.professores.length} professores, ${state.alunos.length} alunos`,
    );
    console.log(
      `   Eletivas: ${state.eletivas.length}, Matrículas: ${state.matriculas.length}, Notas: ${state.notas.length}`,
    );
    
    // Executar migração de IDs em background
    setTimeout(() => {
      if (window.migrarTodosIds) {
        window.migrarTodosIds().then(() => {
          salvarEstado();
          if (window.verificarIntegridadeReferencias) {
            window.verificarIntegridadeReferencias();
          }
        });
      }
    }, 1000);
    
  } catch (e) {
    console.error("❌ Erro ao carregar estado:", e);
  }

  return state;
}

function salvarEstado() {
  try {
    localStorage.setItem(
      CONFIG.storageKeys.professores,
      JSON.stringify(state.professores),
    );
    localStorage.setItem(
      CONFIG.storageKeys.alunos,
      JSON.stringify(state.alunos),
    );
    localStorage.setItem(
      CONFIG.storageKeys.eletivas,
      JSON.stringify(state.eletivas),
    );
    localStorage.setItem(
      CONFIG.storageKeys.matriculas,
      JSON.stringify(state.matriculas),
    );
    localStorage.setItem(
      CONFIG.storageKeys.registros,
      JSON.stringify(state.registros),
    );
    localStorage.setItem(
      CONFIG.storageKeys.semestres,
      JSON.stringify(state.semestres),
    );
    localStorage.setItem(
      CONFIG.storageKeys.remocoes,
      JSON.stringify(state.remocoes),
    );
    localStorage.setItem("sage_notas_2026", JSON.stringify(state.notas || []));
    localStorage.setItem("sage_liberacao_notas", JSON.stringify(state.liberacaoNotas || null));
    localStorage.setItem("sage_config_tempos", JSON.stringify(state.configTempos || null));
    localStorage.setItem("sage_nextId_2026", JSON.stringify(state.nextId));
    localStorage.setItem("sage_versoes", JSON.stringify(state._versao));

    console.log("💾 Estado salvo no localStorage");
  } catch (e) {
    console.error("❌ Erro ao salvar estado:", e);
  }
}

// MODIFICADO: Gerar UUID em vez de número sequencial
function getNextId(tipo) {
  // Gerar UUID para novos objetos
  const novoId = window.gerarUUID ? window.gerarUUID() : `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Manter contagem para referência
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
window.getNextId = getNextId;
window.criarObjetoComUuid = criarObjetoComUuid;
window.atualizarVersao = atualizarVersao;
window.obterVersao = obterVersao;
window.atualizarIndicadorSemestre = atualizarIndicadorSemestre;
window.getEstatisticas = getEstatisticas;
