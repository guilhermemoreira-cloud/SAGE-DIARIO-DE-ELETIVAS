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
  ultimaSincronizacao: null,
  semestreAtivo: null,
  nextId: {
    aluno: 1,
    professor: 1,
    eletiva: 1,
    matricula: 1,
    registro: 1,
  },
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

    const nextId = JSON.parse(localStorage.getItem("sage_nextId_2026")) || {
      aluno: state.alunos.length + 1,
      professor: state.professores.length + 1,
      eletiva: state.eletivas.length + 1,
      matricula: state.matriculas.length + 1,
      registro: state.registros.length + 1,
    };
    state.nextId = nextId;

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
      `   Eletivas: ${state.eletivas.length}, Matrículas: ${state.matriculas.length}`,
    );
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
    localStorage.setItem("sage_nextId_2026", JSON.stringify(state.nextId));

    console.log("💾 Estado salvo no localStorage");
  } catch (e) {
    console.error("❌ Erro ao salvar estado:", e);
  }
}

function getNextId(tipo) {
  const id = state.nextId[tipo];
  state.nextId[tipo] += 1;
  salvarEstado();
  return id;
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
window.atualizarIndicadorSemestre = atualizarIndicadorSemestre;
window.getEstatisticas = getEstatisticas;
