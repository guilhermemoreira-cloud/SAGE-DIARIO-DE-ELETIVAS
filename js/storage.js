// js/storage.js - Gerenciamento de estado
console.log("📦 storage.js carregado");

let state = {
  alunos: [],
  professores: [],
  eletivas: [],
  matriculas: [],
  registros: [],
  notas: [],
  semestres: [],
  remocoes: [],
  ultimaSincronizacao: null,
  semestreAtivo: null,
  configTempos: null,
  liberacaoNotas: null,
  locais: [],
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
    state.professores = JSON.parse(localStorage.getItem(CONFIG.storageKeys.professores)) || [];
    state.alunos = JSON.parse(localStorage.getItem(CONFIG.storageKeys.alunos)) || [];
    state.eletivas = JSON.parse(localStorage.getItem(CONFIG.storageKeys.eletivas)) || [];
    state.matriculas = JSON.parse(localStorage.getItem(CONFIG.storageKeys.matriculas)) || [];
    state.registros = JSON.parse(localStorage.getItem(CONFIG.storageKeys.registros)) || [];
    state.notas = JSON.parse(localStorage.getItem("sage_notas_2026")) || [];
    state.semestres = JSON.parse(localStorage.getItem(CONFIG.storageKeys.semestres)) || [];
    state.remocoes = JSON.parse(localStorage.getItem(CONFIG.storageKeys.remocoes)) || [];
    state.ultimaSincronizacao = localStorage.getItem(CONFIG.storageKeys.ultimaSincronizacao);
    state.locais = JSON.parse(localStorage.getItem("sage_locais_2026")) || [];
    
    state.configTempos = JSON.parse(localStorage.getItem("sage_config_tempos")) || null;
    state.liberacaoNotas = JSON.parse(localStorage.getItem("sage_liberacao_notas")) || null;

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
        { id: "2026-1", nome: "1º Semestre 2026", ano: 2026, periodo: 1, ativo: true },
        { id: "2026-2", nome: "2º Semestre 2026", ano: 2026, periodo: 2, ativo: false },
      ];
    }

    state.semestreAtivo = state.semestres.find((s) => s.ativo) || state.semestres[0];

    console.log(`✅ Estado carregado: ${state.professores.length} professores, ${state.alunos.length} alunos`);
    console.log(`   Eletivas: ${state.eletivas.length}, Matrículas: ${state.matriculas.length}`);
    console.log(`   Registros: ${state.registros.length}, Notas: ${state.notas.length}`);
  } catch (e) {
    console.error("❌ Erro ao carregar estado:", e);
  }

  return state;
}

function salvarEstado() {
  try {
    localStorage.setItem(CONFIG.storageKeys.professores, JSON.stringify(state.professores));
    localStorage.setItem(CONFIG.storageKeys.alunos, JSON.stringify(state.alunos));
    localStorage.setItem(CONFIG.storageKeys.eletivas, JSON.stringify(state.eletivas));
    localStorage.setItem(CONFIG.storageKeys.matriculas, JSON.stringify(state.matriculas));
    localStorage.setItem(CONFIG.storageKeys.registros, JSON.stringify(state.registros));
    localStorage.setItem("sage_notas_2026", JSON.stringify(state.notas || []));
    localStorage.setItem(CONFIG.storageKeys.semestres, JSON.stringify(state.semestres));
    localStorage.setItem(CONFIG.storageKeys.remocoes, JSON.stringify(state.remocoes));
    localStorage.setItem("sage_locais_2026", JSON.stringify(state.locais || []));
    localStorage.setItem("sage_nextId_2026", JSON.stringify(state.nextId));
    
    if (state.configTempos) {
      localStorage.setItem("sage_config_tempos", JSON.stringify(state.configTempos));
    }
    if (state.liberacaoNotas) {
      localStorage.setItem("sage_liberacao_notas", JSON.stringify(state.liberacaoNotas));
    }

    console.log("💾 Estado salvo no localStorage");
    
    window.dispatchEvent(new CustomEvent('sageStateUpdated', { 
      detail: { timestamp: new Date().toISOString(), type: 'state_saved' } 
    }));
    
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

// ========== FUNÇÃO GLOBAL PARA FORCAR RECARREGAMENTO DE DADOS ==========

window.forcarRecarregamentoGlobal = async function(origem = "manual") {
    console.log(`🔄 Forçando recarregamento global de dados (origem: ${origem})...`);
    
    if (typeof carregarEstado === "function") {
        carregarEstado();
        console.log("✅ Estado recarregado do localStorage");
    }
    
    if (window.FirebaseSync && window.FirebaseSync.carregarDadosFirebase) {
        try {
            if (window.FirebaseConfig && !window.FirebaseConfig.isInitialized) {
                console.log("🔄 Inicializando Firebase...");
                window.FirebaseConfig.initFirebase();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const eletivasFirebase = await window.FirebaseSync.carregarDadosFirebase("eletivas");
            if (eletivasFirebase && eletivasFirebase.length > 0) {
                const eletivasUnicas = [];
                const idsVistos = new Set();
                eletivasFirebase.forEach(e => {
                    if (!idsVistos.has(e.id)) {
                        idsVistos.add(e.id);
                        eletivasUnicas.push(e);
                    }
                });
                state.eletivas = eletivasUnicas;
                localStorage.setItem(CONFIG.storageKeys.eletivas, JSON.stringify(eletivasUnicas));
                console.log(`✅ Sincronizadas ${eletivasUnicas.length} eletivas do Firebase`);
            }
            
            const registrosFirebase = await window.FirebaseSync.carregarDadosFirebase("registros");
            if (registrosFirebase && registrosFirebase.length > 0) {
                state.registros = registrosFirebase;
                localStorage.setItem(CONFIG.storageKeys.registros, JSON.stringify(registrosFirebase));
                console.log(`✅ Sincronizados ${registrosFirebase.length} registros do Firebase`);
            }
            
            const matriculasFirebase = await window.FirebaseSync.carregarDadosFirebase("matriculas");
            if (matriculasFirebase && matriculasFirebase.length > 0) {
                state.matriculas = matriculasFirebase;
                localStorage.setItem(CONFIG.storageKeys.matriculas, JSON.stringify(matriculasFirebase));
                console.log(`✅ Sincronizadas ${matriculasFirebase.length} matrículas do Firebase`);
            }
            
            const notasFirebase = await window.FirebaseSync.carregarDadosFirebase("notas");
            if (notasFirebase && notasFirebase.length > 0) {
                state.notas = notasFirebase;
                localStorage.setItem("sage_notas_2026", JSON.stringify(notasFirebase));
                console.log(`✅ Sincronizadas ${notasFirebase.length} notas do Firebase`);
            }
            
        } catch (error) {
            console.error("❌ Erro ao carregar do Firebase:", error);
        }
    }
    
    window.dispatchEvent(new CustomEvent('dadosAtualizados', { 
        detail: { timestamp: new Date().toISOString(), origem: origem } 
    }));
    
    console.log("✅ Recarregamento global concluído. Total de eletivas:", state.eletivas.length);
    return true;
};

window.addEventListener('storage', function(event) {
    if (event.key && event.key.includes('sage_')) {
        console.log("📦 Mudança detectada no localStorage:", event.key);
        if (typeof window.forcarRecarregamentoGlobal === 'function') {
            window.forcarRecarregamentoGlobal('storage_event');
        }
    }
});

window.state = state;
window.carregarEstado = carregarEstado;
window.salvarEstado = salvarEstado;
window.getNextId = getNextId;
window.atualizarIndicadorSemestre = atualizarIndicadorSemestre;
window.getEstatisticas = getEstatisticas;
window.forcarRecarregamentoGlobal = forcarRecarregamentoGlobal;
