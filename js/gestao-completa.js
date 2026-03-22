// js/gestao-completa.js - Lógica da página de gestão completa
console.log("📋 gestao-completa.js carregado");

let professorEmEdicao = null;
let professorParaTroca = null;
let eletivasSelecionadasParaTroca = [];

// ========== VARIÁVEIS DA ABA ELETIVAS ==========
let eletivaEmEdicao = null;
let filtroTempoEletiva = "TODOS";
let locais = [];

// ========== VARIÁVEIS DA ABA ESTUDANTES ==========
let filtroTempoEstudante = "TODOS";
let estudantesFiltrados = [];
let paginaAtualEstudantes = 1;
const ITENS_POR_PAGINA = 20;
let estudanteEmEdicao = null;
let estudanteParaTroca = null;

// ========== VARIÁVEIS DA ABA DADOS ==========
let configTemposPadrao = {
  T1: { diaSemana: "SEGUNDA", series: ["1ª", "2ª", "3ª"] },
  T2: { diaSemana: "QUINTA", series: ["1ª", "3ª"] },
  T3: { diaSemana: "TERÇA", series: ["1ª"] },
  T4: { diaSemana: "SEXTA", series: ["1ª"] },
  T5: { diaSemana: "QUARTA", series: ["1ª"] },
};

let liberacaoNotasPadrao = {
  semestre: "1/2026",
  periodo: {
    inicio: new Date().toISOString().split("T")[0],
    fim: new Date(new Date().setDate(new Date().getDate() + 10))
      .toISOString()
      .split("T")[0],
  },
  eletivasLiberadas: [],
};

let backups = [];

// Mapeamento de tempo eletivo baseado no horário
const mapaTempoEletiva = {
  "07:00-08:40": "T1",
  "08:55-10:35": "T2",
  "10:50-12:30": "T3",
  "13:30-15:10": "T4",
  "15:25-17:05": "T5",
};

// Dias da semana para select
const diasSemanaOpcoes = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];

// ========== FUNÇÕES DE UTILIDADE ==========
function mostrarLoader(mostrar) {
  const loader = document.getElementById("gestorLoader");
  if (loader) {
    if (mostrar) {
      loader.classList.add("active");
    } else {
      loader.classList.remove("active");
    }
  }
}

function getTempoFromHorario(horario) {
  if (!horario) return null;
  if (horario.codigoTempo) {
    return horario.codigoTempo;
  }
  return null;
}

// ========== INICIALIZAÇÃO CORRIGIDA ==========
document.addEventListener("DOMContentLoaded", async function () {
  console.log("📋 Inicializando página de gestão completa...");

  carregarTheme();

  const gestorStorage = localStorage.getItem("gestor_atual");
  if (!gestorStorage) {
    window.location.href = "selecionar-gestor.html";
    return;
  }

  // NÃO CARREGAR DO LOCALSTORAGE - aguardar Firebase
  if (typeof carregarEstado === "function") {
    await carregarEstado(); // Isso agora só inicializa arrays vazios
  }

  // Garantir que arrays existem
  if (!state.alunos) state.alunos = [];
  if (!state.professores) state.professores = [];
  if (!state.eletivas) state.eletivas = [];
  if (!state.matriculas) state.matriculas = [];
  if (!state.registros) state.registros = [];
  if (!state.notas) state.notas = [];

  console.log("📊 Estado inicializado, aguardando Firebase...");

  // 🔥 Sincronização com Firebase - FONTE PRIMÁRIA
  if (window.FirebaseConfig && typeof window.FirebaseConfig.initFirebase === "function") {
    try {
      console.log("🔥 Aguardando inicialização do Firebase...");
      if (window.FirebaseConfig.aguardarInicializacaoFirebase) {
        await window.FirebaseConfig.aguardarInicializacaoFirebase(10000);
      } else {
        window.FirebaseConfig.initFirebase();
        await new Promise(r => setTimeout(r, 1000));
      }
      console.log("✅ Firebase inicializado");
      
      // CARREGAR DADOS DO FIREBASE (FONTE ÚNICA)
      if (window.FirebaseSync && typeof window.FirebaseSync.carregarColecoesGestor === "function") {
        const carregou = await window.FirebaseSync.carregarColecoesGestor();
        if (carregou) {
          console.log("✅ Dados do Firebase carregados:", {
            eletivas: state.eletivas.length,
            alunos: state.alunos.length,
            professores: state.professores.length,
            matriculas: state.matriculas.length
          });
          
          // Salvar cache para offline
          if (window.salvarCacheFirebase) {
            window.salvarCacheFirebase("eletivas", state.eletivas);
            window.salvarCacheFirebase("alunos", state.alunos);
            window.salvarCacheFirebase("professores", state.professores);
            window.salvarCacheFirebase("matriculas", state.matriculas);
          }
        }
      }
      
      // Ativar listener em tempo real
      if (typeof window.FirebaseSync.escutarColecoesGestor === "function") {
        window.FirebaseSync.escutarColecoesGestor(function (colecao) {
          console.log(`🔄 Atualização recebida: ${colecao} - recarregando...`);
          carregarProfessores();
          carregarEletivas();
          filtrarEstudantes();
          carregarAbaDados();
        });
      }
    } catch (err) {
      console.warn("⚠️ Erro na inicialização do Firebase, usando cache offline:", err);
      
      // Fallback para cache offline
      if (window.carregarCacheOffline) {
        state.eletivas = window.carregarCacheOffline("eletivas");
        state.alunos = window.carregarCacheOffline("alunos");
        state.professores = window.carregarCacheOffline("professores");
        state.matriculas = window.carregarCacheOffline("matriculas");
        console.log("📦 Dados carregados do cache offline");
      }
    }
  }

  // Carregar dados iniciais
  carregarProfessores();
  carregarLocais();
  carregarSelectsEletivas();
  carregarEletivas();
  carregarSelectsEstudantes();
  filtrarEstudantes();
  carregarAbaDados();

  const turmas = CONFIG.turmas || [
    "1ª SÉRIE A",
    "1ª SÉRIE B",
    "1ª SÉRIE C",
    "2ª SÉRIE A",
    "2ª SÉRIE B",
    "2ª SÉRIE C",
    "3ª SÉRIE A",
    "3ª SÉRIE B",
    "3ª SÉRIE C",
  ];

  const containerTurmas = document.getElementById("turmasCheckboxContainer");
  if (containerTurmas) {
    containerTurmas.innerHTML = "";
    turmas.forEach((turma) => {
      containerTurmas.innerHTML += `
        <label style="display: flex; align-items: center; gap: 0.3rem;">
          <input type="checkbox" class="turma-checkbox" value="${turma}">
          ${turma}
        </label>
      `;
    });
  }
});

// ========== FUNÇÕES DE EXPORTAÇÃO DE JSON ==========
window.exportarJSONCompleto = function () {
  try {
    const dadosExport = {
      metadata: state.metadata || { versao: "2.0" },
      dados: {
        alunos: state.alunos || [],
        professores: state.professores || [],
        eletivasFixas: state.eletivas?.filter((e) => e.tipo === "FIXA") || [],
        eletivasMistas: state.eletivas?.filter((e) => e.tipo === "MISTA") || [],
      },
      configTempos: state.configTempos || configTemposPadrao,
      liberacaoNotas: state.liberacaoNotas || liberacaoNotasPadrao,
      estatisticas: {
        alunos: state.alunos?.length || 0,
        professores: state.professores?.length || 0,
        eletivas: state.eletivas?.length || 0,
      },
      conflitos: state.conflitos || {
        resolvidosAutomaticamente: [],
        pendentes: [],
      },
    };

    const jsonString = JSON.stringify(dadosExport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dados-sage-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast("JSON exportado com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao exportar JSON:", error);
    showToast("Erro ao exportar JSON", "error");
  }
};

// ========== FUNÇÕES DA ABA PROFESSORES ==========
function carregarProfessores() {
  const container = document.getElementById("professoresGrid");
  if (!container) return;

  const busca = document.getElementById("buscaProfessor")?.value?.toLowerCase() || "";
  let professores = state.professores || [];

  if (busca) {
    professores = professores.filter(
      (p) => p.nome?.toLowerCase().includes(busca) || p.email?.toLowerCase().includes(busca)
    );
  }

  professores.sort((a, b) => a.nome.localeCompare(b.nome));

  const contador = document.getElementById("contadorProfessores");
  if (contador) contador.textContent = `(${professores.length} professores encontrados)`;

  if (professores.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhum professor encontrado</p>';
    return;
  }

  container.innerHTML = "";

  professores.forEach((professor) => {
    const eletivas = state.eletivas?.filter((e) => e.professorId === professor.id) || [];

    const card = document.createElement("div");
    card.className = "professor-card";

    let eletivasHTML = "";
    if (eletivas.length > 0) {
      eletivasHTML = '<div class="eletivas-lista"><h4>📚 ELETIVAS:</h4>';
      eletivas.slice(0, 3).forEach((e) => {
        const matriculas = state.matriculas?.filter((m) => m.eletivaId === e.id) || [];
        eletivasHTML += `
          <div class="eletiva-item">
            <span class="eletiva-nome">${e.nome || "?"} (${e.codigo || "?"})</span>
            <span class="eletiva-detalhes">${e.horario?.diaSemana || "?"} ${e.horario?.codigoTempo || "?"} - ${matriculas.length} alunos</span>
          </div>
        `;
      });
      if (eletivas.length > 3) {
        eletivasHTML += `<div style="font-size: 0.85rem; color: var(--text-light); text-align: center; padding-top: 0.5rem;">... e mais ${eletivas.length - 3} eletivas</div>`;
      }
      eletivasHTML += "</div>";
    } else {
      eletivasHTML = '<div class="eletivas-lista"><p style="color: var(--text-light); text-align: center;">Nenhuma eletiva vinculada</p></div>';
    }

    card.innerHTML = `
      <div class="professor-header">
        <div class="professor-info">
          <h3>👤 ${escapeHtml(professor.nome || "?")}</h3>
          <p><i class="fas fa-envelope"></i> ${escapeHtml(professor.email || "?")}</p>
        </div>
        <div class="professor-actions">
          <button class="btn-primary btn-small" onclick="abrirModalEditarProfessor(${professor.id})" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-secondary btn-small" onclick="abrirModalTrocarEletivas(${professor.id})" title="Trocar eletivas">
            <i class="fas fa-exchange-alt"></i>
          </button>
          <button class="btn-danger btn-small" onclick="confirmarRemoverProfessor(${professor.id})" title="Remover">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      ${eletivasHTML}
    `;

    container.appendChild(card);
  });
}

window.filtrarProfessores = function () {
  carregarProfessores();
};

// ========== FUNÇÕES DO MODAL DE PROFESSOR ==========
window.abrirModalAdicionarProfessor = function () {
  professorEmEdicao = null;
  document.getElementById("modalProfessorTitulo").textContent = "➕ ADICIONAR PROFESSOR";
  document.getElementById("professorNome").value = "";
  document.getElementById("professorEmail").value = "";
  document.getElementById("professorId").value = "";
  document.getElementById("modalProfessor").classList.add("active");
};

window.abrirModalEditarProfessor = function (professorId) {
  const professor = state.professores?.find((p) => p.id === professorId);
  if (!professor) {
    showToast("Professor não encontrado", "error");
    return;
  }

  professorEmEdicao = professor;
  document.getElementById("modalProfessorTitulo").textContent = "✏️ EDITAR PROFESSOR";
  document.getElementById("professorNome").value = professor.nome || "";
  document.getElementById("professorEmail").value = professor.email || "";
  document.getElementById("professorId").value = professor.id;
  document.getElementById("modalProfessor").classList.add("active");
};

window.fecharModalProfessor = function () {
  document.getElementById("modalProfessor").classList.remove("active");
  professorEmEdicao = null;
};

window.salvarProfessor = async function () {
  const nome = document.getElementById("professorNome")?.value.trim();
  const email = document.getElementById("professorEmail")?.value.trim();
  const id = document.getElementById("professorId")?.value;

  if (!nome || !email) {
    showToast("Preencha todos os campos", "error");
    return;
  }

  mostrarLoader(true);

  try {
    if (professorEmEdicao) {
      const index = state.professores.findIndex((p) => p.id === professorEmEdicao.id);
      if (index !== -1) {
        state.professores[index] = {
          ...state.professores[index],
          nome: nome,
          email: email,
        };
        
        if (window.FirebaseSync) {
          await window.FirebaseSync.salvarDadosFirebase("professores", state.professores[index], state.professores[index].id);
        } else if (!navigator.onLine) {
          window.adicionarOperacaoOffline("salvar", "professores", state.professores[index], state.professores[index].id);
        }

        showToast("Professor atualizado com sucesso!", "success");
      }
    } else {
      const novoId = window.gerarUUID ? window.gerarUUID() : Date.now().toString();
      const novoProfessor = {
        id: novoId,
        nome: nome,
        email: email,
        perfil: "PROFESSOR",
      };

      if (!state.professores) state.professores = [];
      state.professores.push(novoProfessor);

      if (window.FirebaseSync) {
        await window.FirebaseSync.salvarDadosFirebase("professores", novoProfessor, novoId);
      } else if (!navigator.onLine) {
        window.adicionarOperacaoOffline("salvar", "professores", novoProfessor, novoId);
      }

      showToast("Professor adicionado com sucesso!", "success");
    }

    salvarEstado();
    fecharModalProfessor();
    carregarProfessores();
  } catch (error) {
    console.error("Erro ao salvar professor:", error);
    showToast("Erro ao salvar professor", "error");
  } finally {
    mostrarLoader(false);
  }
};

// ========== FUNÇÕES DE REMOÇÃO DE PROFESSOR ==========
window.confirmarRemoverProfessor = function (professorId) {
  const professor = state.professores?.find((p) => p.id === professorId);
  if (!professor) return;

  const eletivas = state.eletivas?.filter((e) => e.professorId === professorId) || [];

  const confirmBody = document.getElementById("confirmBody");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmBtn = document.getElementById("confirmActionBtn");

  confirmTitle.textContent = "⚠️ REMOVER PROFESSOR";
  confirmBody.innerHTML = `
    <p>Tem certeza que deseja remover <strong>${escapeHtml(professor.nome)}</strong>?</p>
    <p style="margin-top: 1rem;">Esta ação:</p>
    <ul style="margin-left: 1.5rem;">
      <li>Remove o professor do sistema</li>
      <li>As ${eletivas.length} eletivas vinculadas ficarão SEM professor</li>
      <li>NENHUM registro será apagado</li>
      <li>Você poderá atribuir um novo professor depois</li>
    </ul>
  `;

  const originalOnClick = confirmBtn.onclick;
  confirmBtn.onclick = function () {
    removerProfessor(professorId);
    fecharModalConfirmacao();
    setTimeout(() => {
      confirmBtn.onclick = originalOnClick;
    }, 100);
  };

  document.getElementById("modalConfirmacao").classList.add("active");
};

async function removerProfessor(professorId) {
  mostrarLoader(true);

  try {
    state.professores = state.professores.filter((p) => p.id !== professorId);
    state.eletivas = state.eletivas.map((e) => {
      if (e.professorId === professorId) {
        return { ...e, professorId: null, professorNome: "" };
      }
      return e;
    });

    salvarEstado();

    if (window.FirebaseSync) {
      try {
        await window.FirebaseSync.deletarDadosFirebase("professores", professorId);
      } catch(e) { console.warn("⚠️ Erro ao deletar professor:", e); }
      for (const e of state.eletivas) {
        if (e.professorId === null) {
          try {
            await window.FirebaseSync.salvarDadosFirebase("eletivas", e, e.id);
          } catch(err) { console.warn("⚠️ Erro ao atualizar eletiva:", err); }
        }
      }
    } else if (!navigator.onLine) {
      window.adicionarOperacaoOffline("deletar", "professores", null, professorId);
    }

    showToast("Professor removido com sucesso!", "success");
    carregarProfessores();
  } catch (error) {
    console.error("Erro ao remover professor:", error);
    showToast("Erro ao remover professor", "error");
  } finally {
    mostrarLoader(false);
  }
}

// ========== FUNÇÕES DE TROCA DE ELETIVAS (PROFESSORES) ==========
window.abrirModalTrocarEletivas = function (professorId) {
  const professor = state.professores?.find((p) => p.id === professorId);
  if (!professor) return;

  professorParaTroca = professor;
  eletivasSelecionadasParaTroca = [];

  document.getElementById("modalTrocarTitulo").textContent = `🔄 TROCAR ELETIVAS - ${professor.nome}`;
  document.getElementById("modalTrocarProfessor").textContent = `Professor: ${professor.nome}`;

  const eletivasOrigem = state.eletivas?.filter((e) => e.professorId === professorId) || [];

  let origemHTML = "";
  if (eletivasOrigem.length > 0) {
    eletivasOrigem.forEach((e) => {
      const matriculas = state.matriculas?.filter((m) => m.eletivaId === e.id) || [];
      origemHTML += `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem;">
          <input type="checkbox" class="eletiva-checkbox" value="${e.id}" onchange="toggleEletivaSelecionada(${e.id})">
          <label>
            <strong>${e.nome}</strong> (${e.codigo}) - ${e.horario?.diaSemana} ${e.horario?.codigoTempo} - ${matriculas.length} alunos
          </label>
        </div>
      `;
    });
  } else {
    origemHTML = '<p style="color: var(--text-light); text-align: center;">Nenhuma eletiva vinculada</p>';
  }
  document.getElementById("eletivasOrigem").innerHTML = origemHTML;

  const selectDestino = document.getElementById("selectProfessorDestino");
  selectDestino.innerHTML = '<option value="">Selecione um professor</option>';

  const outrosProfessores = state.professores?.filter((p) => p.id !== professorId) || [];
  outrosProfessores.forEach((p) => {
    selectDestino.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
  });

  document.getElementById("eletivasDestino").innerHTML = '<p style="color: var(--text-light); text-align: center;">Selecione um professor destino</p>';

  document.getElementById("modalTrocarEletivas").classList.add("active");
};

window.toggleEletivaSelecionada = function (eletivaId) {
  const index = eletivasSelecionadasParaTroca.indexOf(eletivaId);
  if (index === -1) {
    eletivasSelecionadasParaTroca.push(eletivaId);
  } else {
    eletivasSelecionadasParaTroca.splice(index, 1);
  }
};

window.carregarEletivasDestino = function () {
  const destinoId = document.getElementById("selectProfessorDestino")?.value;
  if (!destinoId) {
    document.getElementById("eletivasDestino").innerHTML = '<p style="color: var(--text-light); text-align: center;">Selecione um professor destino</p>';
    return;
  }

  const professor = state.professores?.find((p) => p.id === parseInt(destinoId));
  const eletivasDestino = state.eletivas?.filter((e) => e.professorId === parseInt(destinoId)) || [];

  let destinoHTML = "";
  if (eletivasDestino.length > 0) {
    eletivasDestino.forEach((e) => {
      const matriculas = state.matriculas?.filter((m) => m.eletivaId === e.id) || [];
      destinoHTML += `
        <div style="padding: 0.3rem;">
          <strong>${e.nome}</strong> (${e.codigo}) - ${e.horario?.diaSemana} ${e.horario?.codigoTempo} - ${matriculas.length} alunos
        </div>
      `;
    });
  } else {
    destinoHTML = '<p style="color: var(--text-light);">Nenhuma eletiva vinculada</p>';
  }

  document.getElementById("eletivasDestino").innerHTML = destinoHTML;
};

window.confirmarTrocaEletivas = async function () {
  if (!professorParaTroca) return;

  const destinoId = document.getElementById("selectProfessorDestino")?.value;
  if (!destinoId) {
    showToast("Selecione um professor destino", "error");
    return;
  }

  if (eletivasSelecionadasParaTroca.length === 0) {
    showToast("Selecione pelo menos uma eletiva para transferir", "error");
    return;
  }

  const professorDestino = state.professores?.find((p) => p.id === parseInt(destinoId));
  if (!professorDestino) return;

  mostrarLoader(true);

  try {
    for (const eletivaId of eletivasSelecionadasParaTroca) {
      const index = state.eletivas.findIndex((e) => e.id === eletivaId);
      if (index !== -1) {
        state.eletivas[index] = {
          ...state.eletivas[index],
          professorId: professorDestino.id,
          professorNome: professorDestino.nome,
        };

        if (window.FirebaseSync) {
          await window.FirebaseSync.salvarDadosFirebase("eletivas", state.eletivas[index], state.eletivas[index].id);
        } else if (!navigator.onLine) {
          window.adicionarOperacaoOffline("salvar", "eletivas", state.eletivas[index], state.eletivas[index].id);
        }
      }
    }

    salvarEstado();
    showToast(`${eletivasSelecionadasParaTroca.length} eletiva(s) transferida(s) com sucesso!`, "success");

    fecharModalTrocarEletivas();
    carregarProfessores();
  } catch (error) {
    console.error("Erro ao transferir eletivas:", error);
    showToast("Erro ao transferir eletivas", "error");
  } finally {
    mostrarLoader(false);
  }
};

window.fecharModalTrocarEletivas = function () {
  document.getElementById("modalTrocarEletivas").classList.remove("active");
  professorParaTroca = null;
  eletivasSelecionadasParaTroca = [];
};

// ========== FUNÇÕES DA ABA ELETIVAS ==========
function carregarLocais() {
  if (state.locais) {
    locais = state.locais;
  } else {
    locais = [
      { id: "sala1", nome: "Sala de Dança", capacidade: 40 },
      { id: "lab", nome: "Laboratório", capacidade: 25 },
      { id: "auditorio", nome: "Auditório", capacidade: 100 },
      { id: "sala2", nome: "Sala 2", capacidade: 35 },
      { id: "sala3", nome: "Sala 3", capacidade: 30 },
    ];
    state.locais = locais;
  }
}

function salvarLocais() {
  state.locais = locais;
  salvarEstado();

  if (window.FirebaseSync) {
    window.FirebaseSync.salvarDadosFirebase("locais", locais);
  }
}

function carregarSelectsEletivas() {
  const selectProf = document.getElementById("filtroProfessorEletiva");
  if (selectProf) {
    const professores = state.professores?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];
    selectProf.innerHTML = '<option value="">Todos os professores</option>';
    professores.forEach((p) => {
      selectProf.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
    });
  }

  const selectLocal = document.getElementById("filtroLocalEletiva");
  if (selectLocal) {
    selectLocal.innerHTML = '<option value="">Todos os locais</option>';
    locais.forEach((l) => {
      selectLocal.innerHTML += `<option value="${l.nome}">${l.nome}</option>`;
    });
  }

  const selectModalProf = document.getElementById("selectProfessorEletiva");
  if (selectModalProf) {
    const professores = state.professores?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];
    selectModalProf.innerHTML = '<option value="">Selecione um professor</option>';
    professores.forEach((p) => {
      selectModalProf.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
    });
  }

  const selectModalLocal = document.getElementById("selectLocalEletiva");
  if (selectModalLocal) {
    selectModalLocal.innerHTML = '<option value="">Selecione um local</option>';
    locais.forEach((l) => {
      selectModalLocal.innerHTML += `<option value="${l.nome}">${l.nome}</option>`;
    });
  }

  const selectDia = document.getElementById("selectDiaEletiva");
  if (selectDia) {
    selectDia.innerHTML = "";
    diasSemanaOpcoes.forEach((dia) => {
      const nomeDia = dia.charAt(0).toUpperCase() + dia.slice(1);
      selectDia.innerHTML += `<option value="${dia}">${nomeDia}-FEIRA</option>`;
    });
  }

  const selectNovoProf = document.getElementById("selectNovoProfessor");
  if (selectNovoProf) {
    const professores = state.professores?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];
    selectNovoProf.innerHTML = '<option value="">Selecione um professor</option>';
    professores.forEach((p) => {
      selectNovoProf.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
    });
  }
}

window.filtrarPorTempoEletiva = function (tempo) {
  filtroTempoEletiva = tempo;

  document.querySelectorAll("#tab-eletivas .tempo-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.textContent.trim() === tempo) {
      btn.classList.add("active");
    }
  });

  carregarEletivas();
};

window.limparFiltrosEletivas = function () {
  filtroTempoEletiva = "TODOS";

  document.querySelectorAll("#tab-eletivas .tempo-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.textContent.trim() === "TODOS") {
      btn.classList.add("active");
    }
  });

  document.getElementById("filtroProfessorEletiva").value = "";
  document.getElementById("filtroLocalEletiva").value = "";
  document.getElementById("buscaEletiva").value = "";

  carregarEletivas();
};

window.filtrarEletivas = function () {
  carregarEletivas();
};

// ========== FUNÇÃO CORRIGIDA: carregarEletivas ==========
function carregarEletivas() {
  const container = document.getElementById("eletivasGrid");
  if (!container) return;

  const busca = document.getElementById("buscaEletiva")?.value?.toLowerCase() || "";
  const professorId = document.getElementById("filtroProfessorEletiva")?.value;
  const local = document.getElementById("filtroLocalEletiva")?.value;

  let eletivas = state.eletivas || [];

  if (filtroTempoEletiva !== "TODOS") {
    eletivas = eletivas.filter((e) => {
      const tempo = getTempoFromHorario(e.horario);
      return tempo === filtroTempoEletiva;
    });
  }

  if (professorId) {
    eletivas = eletivas.filter((e) => e.professorId === parseInt(professorId));
  }

  if (local) {
    eletivas = eletivas.filter((e) => e.local === local);
  }

  if (busca) {
    eletivas = eletivas.filter((e) => {
      const professor = state.professores?.find((p) => p.id === e.professorId)?.nome || "";
      return (
        e.nome?.toLowerCase().includes(busca) ||
        e.codigo?.toLowerCase().includes(busca) ||
        professor.toLowerCase().includes(busca)
      );
    });
  }

  eletivas.sort((a, b) => a.nome.localeCompare(b.nome));

  const contador = document.getElementById("contadorEletivas");
  if (contador) contador.textContent = `(${eletivas.length} eletivas encontradas)`;

  if (eletivas.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma eletiva encontrada</p>';
    return;
  }

  container.innerHTML = "";

  eletivas.forEach((eletiva) => {
    const professor = state.professores?.find((p) => p.id === eletiva.professorId)?.nome || "Não atribuído";
    const tempo = getTempoFromHorario(eletiva.horario) || "N/A";
    const matriculas = state.matriculas?.filter((m) => m.eletivaId === eletiva.id) || [];
    const totalAlunos = matriculas.length;

    const card = document.createElement("div");
    card.className = "professor-card";

    card.innerHTML = `
      <div class="professor-header">
        <div class="professor-info">
          <h3>${eletiva.nome} | Código: ${eletiva.codigo}</h3>
          <p><i class="fas fa-user"></i> Professor: ${professor}</p>
          <p><i class="fas fa-clock"></i> Tempo: ${tempo} | Local: ${eletiva.local || "Não definido"}</p>
          <p><i class="fas fa-calendar"></i> Horário: ${eletiva.horario?.diaSemana} ${eletiva.horario?.codigoTempo}</p>
          <p><i class="fas fa-users"></i> Turmas: ${eletiva.turmaOrigem || "Várias"} | ${totalAlunos} alunos</p>
          <p><i class="fas fa-tag"></i> Categoria: <span style="background: ${eletiva.tipo === "FIXA" ? "var(--info)" : "var(--success)"}; color: white; padding: 0.2rem 0.5rem; border-radius: 4px;">${eletiva.tipo || "MISTA"}</span></p>
        </div>
        <div class="professor-actions">
          <button class="btn-primary btn-small" onclick="abrirModalEditarEletiva(${eletiva.id})" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-info btn-small" onclick="abrirModalEditarCategoria(${eletiva.id})" title="Editar categoria">
            <i class="fas fa-tag"></i>
          </button>
          <button class="btn-secondary btn-small" onclick="abrirModalTrocarProfessor(${eletiva.id})" title="Trocar professor">
            <i class="fas fa-exchange-alt"></i>
          </button>
          <button class="btn-danger btn-small" onclick="confirmarRemoverEletiva(${eletiva.id})" title="Remover">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// ========== FUNÇÕES DO MODAL DE ELETIVA ==========
window.abrirModalCriarEletiva = function () {
  eletivaEmEdicao = null;
  document.getElementById("modalEletivaTitulo").textContent = "➕ CRIAR NOVA ELETIVA";

  document.getElementById("eletivaNome").value = "";
  document.getElementById("eletivaCodigo").value = "";
  document.getElementById("selectProfessorEletiva").value = "";
  document.getElementById("selectLocalEletiva").value = "";
  document.getElementById("selectDiaEletiva").value = "segunda";
  document.getElementById("horarioInicio").value = "07:00";
  document.getElementById("horarioFim").value = "08:40";
  document.getElementById("eletivaTipoMista").checked = true;

  document.querySelectorAll(".turma-checkbox").forEach((cb) => (cb.checked = false));

  document.getElementById("modalEletiva").classList.add("active");
};

window.abrirModalEditarEletiva = function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  eletivaEmEdicao = eletiva;
  document.getElementById("modalEletivaTitulo").textContent = "✏️ EDITAR ELETIVA";

  document.getElementById("eletivaNome").value = eletiva.nome;
  document.getElementById("eletivaCodigo").value = eletiva.codigo;
  document.getElementById("selectProfessorEletiva").value = eletiva.professorId || "";
  document.getElementById("selectLocalEletiva").value = eletiva.local || "";
  document.getElementById("selectDiaEletiva").value = eletiva.horario?.diaSemana || "segunda";

  const tempo = eletiva.horario?.codigoTempo || "T1";
  const horario = Object.entries(mapaTempoEletiva).find(([h, t]) => t === tempo)?.[0] || "07:00-08:40";
  const [hInicio, hFim] = horario.split("-");
  document.getElementById("horarioInicio").value = hInicio;
  document.getElementById("horarioFim").value = hFim;

  if (eletiva.tipo === "FIXA") {
    document.getElementById("eletivaTipoFixa").checked = true;
  } else {
    document.getElementById("eletivaTipoMista").checked = true;
  }

  const turmas = eletiva.turmaOrigem?.split(", ") || [];
  document.querySelectorAll(".turma-checkbox").forEach((cb) => {
    cb.checked = turmas.includes(cb.value);
  });

  document.getElementById("modalEletiva").classList.add("active");
};

window.fecharModalEletiva = function () {
  document.getElementById("modalEletiva").classList.remove("active");
  eletivaEmEdicao = null;
};

window.selecionarTodasTurmas = function (selecionar) {
  document.querySelectorAll(".turma-checkbox").forEach((cb) => {
    cb.checked = selecionar;
  });
};

window.salvarEletiva = async function () {
  const nome = document.getElementById("eletivaNome")?.value.trim();
  const codigo = document.getElementById("eletivaCodigo")?.value.trim().toUpperCase();
  const professorId = document.getElementById("selectProfessorEletiva")?.value;
  const local = document.getElementById("selectLocalEletiva")?.value;
  const dia = document.getElementById("selectDiaEletiva")?.value;
  const horarioInicio = document.getElementById("horarioInicio")?.value;
  const horarioFim = document.getElementById("horarioFim")?.value;
  const tipo = document.querySelector('input[name="tipoEletiva"]:checked')?.value || "MISTA";

  const turmasSelecionadas = [];
  document.querySelectorAll(".turma-checkbox:checked").forEach((cb) => {
    turmasSelecionadas.push(cb.value);
  });

  if (!nome || nome.length < 3) {
    showToast("Nome da eletiva é obrigatório (mínimo 3 caracteres)", "error");
    return;
  }

  if (!codigo) {
    showToast("Código da eletiva é obrigatório", "error");
    return;
  }

  if (!professorId) {
    showToast("Selecione um professor", "error");
    return;
  }

  if (turmasSelecionadas.length === 0) {
    showToast("Selecione pelo menos uma turma", "error");
    return;
  }

  if (tipo === "FIXA" && turmasSelecionadas.length > 1) {
    showToast("Eletivas FIXAS só podem ter UMA turma. Selecione apenas uma turma.", "error");
    return;
  }

  // Verificar se código já existe
  const codigoExistente = state.eletivas?.some(e => e.codigo === codigo && e.id !== eletivaEmEdicao?.id);
  if (codigoExistente) {
    showToast(`Já existe uma eletiva com o código ${codigo}`, "error");
    return;
  }

  mostrarLoader(true);

  try {
    const professor = state.professores?.find((p) => p.id === parseInt(professorId));
    const horarioCompleto = `${horarioInicio}-${horarioFim}`;
    const codigoTempo = mapaTempoEletiva[horarioCompleto] || "T1";

    if (eletivaEmEdicao) {
      const index = state.eletivas.findIndex((e) => e.id === eletivaEmEdicao.id);
      if (index !== -1) {
        state.eletivas[index] = {
          ...state.eletivas[index],
          nome: nome,
          codigo: codigo,
          professorId: parseInt(professorId),
          professorNome: professor?.nome || "",
          local: local,
          horario: {
            diaSemana: dia,
            codigoTempo: codigoTempo,
          },
          tipo: tipo,
          turmaOrigem: turmasSelecionadas.join(", "),
        };

        if (window.FirebaseSync) {
          await window.FirebaseSync.salvarDadosFirebase("eletivas", state.eletivas[index], state.eletivas[index].id);
        } else if (!navigator.onLine) {
          window.adicionarOperacaoOffline("salvar", "eletivas", state.eletivas[index], state.eletivas[index].id);
        }

        showToast("Eletiva atualizada com sucesso!", "success");
      }
    } else {
      const novoId = window.gerarUUID ? window.gerarUUID() : Date.now().toString();
      const novaEletiva = {
        id: novoId,
        codigo: codigo,
        nome: nome,
        tipo: tipo,
        professorId: parseInt(professorId),
        professorNome: professor?.nome || "",
        horario: {
          diaSemana: dia,
          codigoTempo: codigoTempo,
        },
        local: local,
        vagas: 40,
        seriesPermitidas: ["1ª", "2ª", "3ª"],
        turmaOrigem: turmasSelecionadas.join(", "),
        semestreId: "2026-1",
      };

      if (!state.eletivas) state.eletivas = [];
      state.eletivas.push(novaEletiva);

      if (window.FirebaseSync) {
        await window.FirebaseSync.salvarDadosFirebase("eletivas", novaEletiva, novoId);
      } else if (!navigator.onLine) {
        window.adicionarOperacaoOffline("salvar", "eletivas", novaEletiva, novoId);
      }

      showToast("Eletiva criada com sucesso!", "success");
    }

    salvarEstado();
    fecharModalEletiva();
    carregarEletivas();
  } catch (error) {
    console.error("Erro ao salvar eletiva:", error);
    showToast("Erro ao salvar eletiva", "error");
  } finally {
    mostrarLoader(false);
  }
};

// ========== FUNÇÕES DE REMOÇÃO DE ELETIVA ==========
async function removerEletiva(eletivaId) {
  mostrarLoader(true);
  console.log(`🗑️ Removendo eletiva ID: ${eletivaId}`);

  try {
    const idString = String(eletivaId);
    
    // Atualizar estado local
    state.eletivas = state.eletivas.filter(e => String(e.id) !== idString);
    state.matriculas = state.matriculas.filter(m => String(m.eletivaId) !== idString);
    state.registros = state.registros.filter(r => String(r.eletivaId) !== idString);
    state.notas = state.notas.filter(n => String(n.eletivaId) !== idString);
    
    salvarEstado();
    
    // Tentar remover do Firebase
    if (window.FirebaseSync) {
      try {
        await window.FirebaseSync.deletarDadosFirebase("eletivas", eletivaId);
      } catch(e) {
        console.warn("⚠️ Erro ao deletar do Firebase, adicionando à fila:", e);
        if (!navigator.onLine) {
          window.adicionarOperacaoOffline("deletar", "eletivas", null, eletivaId);
        }
      }
    }
    
    // Recarregar interface
    carregarEletivas();
    
    const contador = document.getElementById('contadorEletivas');
    if (contador) {
      contador.textContent = `(${state.eletivas.length} eletivas encontradas)`;
    }
    
    showToast(`✅ Eletiva removida com sucesso!`, "success");
    
  } catch (error) {
    console.error(`❌ Erro na exclusão da eletiva:`, error);
    showToast(`❌ Erro ao remover eletiva: ${error.message}`, "error");
  } finally {
    mostrarLoader(false);
  }
}

window.confirmarRemoverEletiva = function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  const matriculas = state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
  const registrosFrequencia = state.registros?.filter((r) => r.eletivaId === eletivaId) || [];
  const registrosNotas = state.notas?.filter((n) => n.eletivaId === eletivaId) || [];

  const confirmBody = document.getElementById("confirmBody");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmBtn = document.getElementById("confirmActionBtn");

  confirmTitle.textContent = "⚠️ REMOVER ELETIVA";
  confirmBody.innerHTML = `
    <p>Tem certeza que deseja remover a eletiva <strong>${eletiva.nome} (${eletiva.codigo})</strong>?</p>
    <p style="margin-top: 1rem; color: var(--danger); font-weight: bold;">⚠️ ESTA AÇÃO IRÁ:</p>
    <ul style="margin-left: 1.5rem; color: var(--danger);">
      <li>Remover a eletiva do sistema</li>
      <li>APAGAR TODOS OS REGISTROS de frequência (${registrosFrequencia.length})</li>
      <li>APAGAR TODOS OS REGISTROS de notas (${registrosNotas.length})</li>
      <li>Desvincular ${matriculas.length} alunos</li>
      <li>Esta ação NÃO PODE SER DESFEITA</li>
    </ul>
  `;

  const originalOnClick = confirmBtn.onclick;
  confirmBtn.onclick = function () {
    removerEletiva(eletivaId);
    fecharModalConfirmacao();
    setTimeout(() => {
      confirmBtn.onclick = originalOnClick;
    }, 100);
  };

  document.getElementById("modalConfirmacao").classList.add("active");
};

// ========== FUNÇÕES DA ABA ESTUDANTES ==========
function carregarSelectsEstudantes() {
  const selectTurma = document.getElementById("filtroTurmaEstudante");
  if (selectTurma) {
    const turmas = CONFIG.turmas || [
      "1ª SÉRIE A", "1ª SÉRIE B", "1ª SÉRIE C",
      "2ª SÉRIE A", "2ª SÉRIE B", "2ª SÉRIE C",
      "3ª SÉRIE A", "3ª SÉRIE B", "3ª SÉRIE C",
    ];

    selectTurma.innerHTML = '<option value="">Todas as turmas</option>';
    turmas.forEach((t) => {
      selectTurma.innerHTML += `<option value="${t}">${t}</option>`;
    });
  }

  const selectEletiva = document.getElementById("filtroEletivaEstudante");
  if (selectEletiva) {
    const eletivas = state.eletivas?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];
    selectEletiva.innerHTML = '<option value="">Todas as eletivas</option>';
    eletivas.forEach((e) => {
      selectEletiva.innerHTML += `<option value="${e.id}">${e.nome} (${e.codigo})</option>`;
    });
  }

  const selectTurmaModal = document.getElementById("selectTurmaEstudante");
  if (selectTurmaModal) {
    const turmas = CONFIG.turmas || [
      "1ª SÉRIE A", "1ª SÉRIE B", "1ª SÉRIE C",
      "2ª SÉRIE A", "2ª SÉRIE B", "2ª SÉRIE C",
      "3ª SÉRIE A", "3ª SÉRIE B", "3ª SÉRIE C",
    ];

    selectTurmaModal.innerHTML = '<option value="">Selecione uma turma</option>';
    turmas.forEach((t) => {
      selectTurmaModal.innerHTML += `<option value="${t}">${t}</option>`;
    });
  }
}

window.filtrarPorTempoEstudante = function (tempo) {
  filtroTempoEstudante = tempo;

  document.querySelectorAll("#tab-estudantes .tempo-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.textContent.trim() === tempo) {
      btn.classList.add("active");
    }
  });

  filtrarEstudantes();
};

window.limparFiltrosEstudantes = function () {
  filtroTempoEstudante = "TODOS";

  document.querySelectorAll("#tab-estudantes .tempo-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.textContent.trim() === "TODOS") {
      btn.classList.add("active");
    }
  });

  document.getElementById("filtroTurmaEstudante").value = "";
  document.getElementById("filtroEletivaEstudante").value = "";
  document.getElementById("buscaEstudante").value = "";

  paginaAtualEstudantes = 1;
  filtrarEstudantes();
};

function estudanteTemEletivaNoTempo(estudanteId, tempo) {
  const matriculas = state.matriculas?.filter((m) => m.alunoId === estudanteId) || [];

  for (const matricula of matriculas) {
    const eletiva = state.eletivas?.find((e) => e.id === matricula.eletivaId);
    if (eletiva) {
      const tempoEletiva = getTempoFromHorario(eletiva.horario);
      if (tempoEletiva === tempo) {
        return true;
      }
    }
  }
  return false;
}

function estudanteEstaNaEletiva(estudanteId, eletivaId) {
  return state.matriculas?.some(
    (m) => m.alunoId === estudanteId && m.eletivaId === parseInt(eletivaId),
  );
}

function getEletivasEstudante(estudanteId) {
  const matriculas = state.matriculas?.filter((m) => m.alunoId === estudanteId) || [];
  const eletivas = [];
  
  matriculas.forEach((m) => {
    const eletiva = state.eletivas?.find((e) => e.id === m.eletivaId);
    if (eletiva) {
      const professor = state.professores?.find((p) => p.id === eletiva.professorId)?.nome || "Não atribuído";
      const tempo = getTempoFromHorario(eletiva.horario) || "N/A";
      eletivas.push({
        ...eletiva,
        professorNome: professor,
        tempo: tempo,
      });
    }
  });

  return eletivas;
}

window.filtrarEstudantes = function () {
  const busca = document.getElementById("buscaEstudante")?.value?.toLowerCase() || "";
  const turma = document.getElementById("filtroTurmaEstudante")?.value;
  const eletivaId = document.getElementById("filtroEletivaEstudante")?.value;

  let estudantes = state.alunos || [];

  if (turma) {
    estudantes = estudantes.filter((e) => e.turmaOrigem === turma);
  }

  if (eletivaId) {
    estudantes = estudantes.filter((e) => estudanteEstaNaEletiva(e.id, eletivaId));
  }

  if (filtroTempoEstudante !== "TODOS") {
    estudantes = estudantes.filter((e) => estudanteTemEletivaNoTempo(e.id, filtroTempoEstudante));
  }

  if (busca) {
    estudantes = estudantes.filter(
      (e) => e.nome?.toLowerCase().includes(busca) || e.codigoSige?.includes(busca)
    );
  }

  estudantes.sort((a, b) => a.nome.localeCompare(b.nome));

  estudantesFiltrados = estudantes;
  paginaAtualEstudantes = 1;

  atualizarTabelaEstudantes();
};

function atualizarTabelaEstudantes() {
  const tbody = document.getElementById("tabelaEstudantesBody");
  if (!tbody) return;

  const totalEstudantes = estudantesFiltrados.length;
  const totalPaginas = Math.ceil(totalEstudantes / ITENS_POR_PAGINA);

  document.getElementById("contadorEstudantes").textContent = `(${totalEstudantes} estudantes encontrados)`;
  document.getElementById("infoPaginaEstudantes").textContent = `Página ${paginaAtualEstudantes} de ${totalPaginas || 1}`;
  document.getElementById("btnPaginaAnterior").disabled = paginaAtualEstudantes <= 1;
  document.getElementById("btnPaginaProxima").disabled = paginaAtualEstudantes >= totalPaginas;

  if (totalEstudantes === 0) {
    tbody.innerHTML = '}<td colspan="5" class="empty-state">Nenhum estudante encontrado</td>';
    return;
  }

  const inicio = (paginaAtualEstudantes - 1) * ITENS_POR_PAGINA;
  const fim = Math.min(inicio + ITENS_POR_PAGINA, totalEstudantes);
  const estudantesPagina = estudantesFiltrados.slice(inicio, fim);

  tbody.innerHTML = "";

  estudantesPagina.forEach((estudante) => {
    const eletivas = getEletivasEstudante(estudante.id);
    
    let eletivasHTML = "";
    if (eletivas.length > 0) {
      eletivasHTML = eletivas.map((e) => `${e.nome} (${e.tempo})`).join(", ");
    } else {
      eletivasHTML = '<span style="color: var(--text-light);">Nenhuma</span>';
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(estudante.nome)}</strong>},
      <td>${escapeHtml(estudante.turmaOrigem)}</td>
      <td>${escapeHtml(estudante.codigoSige)}</td>
      <td>${eletivasHTML}</td>
      <td>
        <button class="btn-primary btn-small" onclick="abrirModalEditarEstudante('${estudante.id}')" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-secondary btn-small" onclick="abrirModalTrocarEletivaEstudante('${estudante.id}')" title="Trocar eletiva">
          <i class="fas fa-exchange-alt"></i>
        </button>
        <button class="btn-danger btn-small" onclick="confirmarRemoverEstudante('${estudante.id}')" title="Remover">
          <i class="fas fa-trash"></i>
        </button>
       </td>
    `;
    tbody.appendChild(row);
  });
}

window.mudarPaginaEstudantes = function (direcao) {
  const totalPaginas = Math.ceil(estudantesFiltrados.length / ITENS_POR_PAGINA);

  if (direcao === "anterior" && paginaAtualEstudantes > 1) {
    paginaAtualEstudantes--;
  } else if (direcao === "proxima" && paginaAtualEstudantes < totalPaginas) {
    paginaAtualEstudantes++;
  }

  atualizarTabelaEstudantes();
};

// ========== FUNÇÕES DO MODAL DE ESTUDANTE ==========
function carregarEletivasCheckbox(estudanteId = null) {
  const container = document.getElementById("eletivasCheckboxContainer");
  if (!container) return;

  const matriculasAtuais = estudanteId 
    ? (state.matriculas || []).filter(m => m.alunoId === estudanteId).map(m => m.eletivaId)
    : [];

  const eletivas = state.eletivas?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  const eletivasPorTempo = {};
  eletivas.forEach(e => {
    const tempo = getTempoFromHorario(e.horario) || "OUTROS";
    if (!eletivasPorTempo[tempo]) eletivasPorTempo[tempo] = [];
    eletivasPorTempo[tempo].push(e);
  });

  let html = "";
  const tempos = ["T1", "T2", "T3", "T4", "T5", "OUTROS"];
  const nomesTempo = {
    T1: "TEMPO 1 (07:00-08:40)",
    T2: "TEMPO 2 (08:55-10:35)",
    T3: "TEMPO 3 (10:50-12:30)",
    T4: "TEMPO 4 (13:30-15:10)",
    T5: "TEMPO 5 (15:25-17:05)",
    OUTROS: "OUTROS HORÁRIOS",
  };

  tempos.forEach(tempo => {
    const eletivasDoTempo = eletivasPorTempo[tempo];
    if (!eletivasDoTempo?.length) return;

    html += `<div style="margin-top: 1rem;"><strong>${nomesTempo[tempo]}:</strong></div>`;
    
    eletivasDoTempo.forEach(e => {
      const professor = state.professores?.find(p => p.id === e.professorId)?.nome || "Não atribuído";
      const matriculados = state.matriculas?.filter(m => m.eletivaId === e.id).length || 0;
      const checked = matriculasAtuais.includes(e.id) ? "checked" : "";
      
      html += `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem; border-bottom: 1px solid var(--bg-light);">
          <input type="checkbox" class="eletiva-checkbox" value="${e.id}" ${checked}>
          <div style="flex: 1;">
            <strong>${e.nome}</strong> (${e.codigo}) - ${professor} - ${matriculados} alunos
          </div>
        </div>
      `;
    });
  });

  if (eletivas.length === 0) {
    html = '<p style="color: var(--text-light);">Nenhuma eletiva cadastrada</p>';
  }

  container.innerHTML = html;
}

window.abrirModalAdicionarEstudante = function () {
  estudanteEmEdicao = null;
  document.getElementById("modalEstudanteTitulo").textContent = "➕ ADICIONAR ESTUDANTE";
  document.getElementById("estudanteNome").value = "";
  document.getElementById("estudanteSige").value = "";
  document.getElementById("estudanteSige").disabled = false;
  document.getElementById("selectTurmaEstudante").value = "";
  document.getElementById("sigeAviso").style.display = "none";

  carregarEletivasCheckbox();

  document.getElementById("modalEstudante").classList.add("active");
};

window.abrirModalEditarEstudante = function (estudanteId) {
  const estudante = state.alunos?.find((a) => a.id === estudanteId);
  if (!estudante) {
    showToast("Estudante não encontrado", "error");
    return;
  }

  estudanteEmEdicao = estudante;
  document.getElementById("modalEstudanteTitulo").textContent = "✏️ EDITAR ESTUDANTE";
  document.getElementById("estudanteNome").value = estudante.nome;
  document.getElementById("estudanteSige").value = estudante.codigoSige;
  document.getElementById("estudanteSige").disabled = true;
  document.getElementById("selectTurmaEstudante").value = estudante.turmaOrigem;
  document.getElementById("sigeAviso").style.display = "block";

  carregarEletivasCheckbox(estudante.id);

  document.getElementById("modalEstudante").classList.add("active");
};

window.fecharModalEstudante = function () {
  document.getElementById("modalEstudante").classList.remove("active");
  estudanteEmEdicao = null;
};

window.salvarEstudante = async function () {
  const nome = document.getElementById("estudanteNome")?.value.trim();
  const sige = document.getElementById("estudanteSige")?.value.trim();
  const turma = document.getElementById("selectTurmaEstudante")?.value;
  
  const eletivasSelecionadas = [];
  document.querySelectorAll("#eletivasCheckboxContainer .eletiva-checkbox:checked").forEach(cb => {
    eletivasSelecionadas.push(parseInt(cb.value));
  });

  if (!nome || nome.length < 3) {
    showToast("Nome do estudante é obrigatório (mínimo 3 caracteres)", "error");
    return;
  }
  if (!sige) {
    showToast("SIGE é obrigatório", "error");
    return;
  }
  if (!turma) {
    showToast("Selecione uma turma", "error");
    return;
  }

  mostrarLoader(true);

  try {
    if (estudanteEmEdicao) {
      const index = state.alunos.findIndex(a => a.id === estudanteEmEdicao.id);
      if (index === -1) {
        throw new Error("Estudante não encontrado");
      }
      
      // Atualizar dados básicos
      state.alunos[index] = {
        ...state.alunos[index],
        nome: nome,
        turmaOrigem: turma,
      };
      
      if (window.FirebaseSync) {
        await window.FirebaseSync.salvarDadosFirebase("alunos", state.alunos[index], state.alunos[index].id);
      } else if (!navigator.onLine) {
        window.adicionarOperacaoOffline("salvar", "alunos", state.alunos[index], state.alunos[index].id);
      }
      
      // Processar alterações nas matrículas
      const matriculasAtuais = state.matriculas.filter(m => m.alunoId === estudanteEmEdicao.id);
      const eletivasAtuais = matriculasAtuais.map(m => m.eletivaId);
      
      const idsParaAdicionar = eletivasSelecionadas.filter(id => !eletivasAtuais.includes(id));
      const idsParaRemover = eletivasAtuais.filter(id => !eletivasSelecionadas.includes(id));
      
      // Atualizar estado local
      state.matriculas = state.matriculas.filter(m => !idsParaRemover.includes(m.eletivaId) || m.alunoId !== estudanteEmEdicao.id);
      
      for (const eletivaId of idsParaAdicionar) {
        const novaMatricula = {
          id: window.gerarUUID ? window.gerarUUID() : Date.now().toString(),
          eletivaId: eletivaId,
          alunoId: estudanteEmEdicao.id,
          tipoMatricula: "manual",
          dataMatricula: new Date().toISOString().split("T")[0],
          semestreId: "2026-1",
        };
        state.matriculas.push(novaMatricula);
        
        if (window.FirebaseSync) {
          await window.FirebaseSync.salvarDadosFirebase("matriculas", novaMatricula, novaMatricula.id);
        } else if (!navigator.onLine) {
          window.adicionarOperacaoOffline("salvar", "matriculas", novaMatricula, novaMatricula.id);
        }
      }
      
      if (idsParaRemover.length > 0 && window.FirebaseSync) {
        const matriculasParaRemover = matriculasAtuais.filter(m => idsParaRemover.includes(m.eletivaId));
        for (const mat of matriculasParaRemover) {
          await window.FirebaseSync.deletarDadosFirebase("matriculas", mat.id);
        }
      }
      
      salvarEstado();
      showToast("Estudante atualizado com sucesso!", "success");
      
    } else {
      if (state.alunos?.some(a => a.codigoSige === sige)) {
        showToast(`Já existe um estudante com o SIGE ${sige}`, "error");
        mostrarLoader(false);
        return;
      }
      
      const novoId = window.gerarUUID ? window.gerarUUID() : Date.now().toString();
      const novoEstudante = {
        id: novoId,
        nome: nome,
        codigoSige: sige,
        turmaOrigem: turma,
        serie: turma?.substring(0, 3) || "1ª",
      };
      
      if (!state.alunos) state.alunos = [];
      state.alunos.push(novoEstudante);
      
      if (window.FirebaseSync) {
        await window.FirebaseSync.salvarDadosFirebase("alunos", novoEstudante, novoId);
      } else if (!navigator.onLine) {
        window.adicionarOperacaoOffline("salvar", "alunos", novoEstudante, novoId);
      }
      
      for (const eletivaId of eletivasSelecionadas) {
        const novaMatricula = {
          id: window.gerarUUID ? window.gerarUUID() : Date.now().toString(),
          eletivaId: eletivaId,
          alunoId: novoId,
          tipoMatricula: "manual",
          dataMatricula: new Date().toISOString().split("T")[0],
          semestreId: "2026-1",
        };
        if (!state.matriculas) state.matriculas = [];
        state.matriculas.push(novaMatricula);
        
        if (window.FirebaseSync) {
          await window.FirebaseSync.salvarDadosFirebase("matriculas", novaMatricula, novaMatricula.id);
        } else if (!navigator.onLine) {
          window.adicionarOperacaoOffline("salvar", "matriculas", novaMatricula, novaMatricula.id);
        }
      }
      
      salvarEstado();
      showToast("Estudante adicionado com sucesso!", "success");
    }
    
    fecharModalEstudante();
    filtrarEstudantes();
    
  } catch (error) {
    console.error("❌ Erro ao salvar estudante:", error);
    showToast(`Erro ao salvar estudante: ${error.message}`, "error");
  } finally {
    mostrarLoader(false);
  }
};

// ========== FUNÇÕES DE REMOÇÃO DE ESTUDANTE ==========
window.confirmarRemoverEstudante = function (estudanteId) {
  const estudante = state.alunos?.find((a) => a.id === estudanteId);
  if (!estudante) {
    showToast("Estudante não encontrado. Recarregando lista...", "warning");
    filtrarEstudantes();
    return;
  }

  const matriculas = state.matriculas?.filter((m) => m.alunoId === estudanteId) || [];

  const confirmBody = document.getElementById("confirmBody");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmBtn = document.getElementById("confirmActionBtn");

  confirmTitle.textContent = "⚠️ REMOVER ESTUDANTE";
  confirmBody.innerHTML = `
    <p>Tem certeza que deseja remover <strong>${escapeHtml(estudante.nome)} (${estudante.codigoSige})</strong>?</p>
    <p style="margin-top: 1rem;">Esta ação irá:</p>
    <ul style="margin-left: 1.5rem;">
      <li>Remover o estudante de TODAS as eletivas (${matriculas.length})</li>
      <li>Manter os registros de frequência e notas já existentes</li>
      <li>O estudante não poderá mais ser vinculado a novas eletivas (a menos que seja adicionado novamente)</li>
    </ul>
  `;

  const originalOnClick = confirmBtn.onclick;
  confirmBtn.onclick = function () {
    removerEstudante(estudanteId);
    fecharModalConfirmacao();
    setTimeout(() => {
      confirmBtn.onclick = originalOnClick;
    }, 100);
  };

  document.getElementById("modalConfirmacao").classList.add("active");
};

async function removerEstudante(estudanteId) {
  mostrarLoader(true);

  try {
    const matriculasEstudante = state.matriculas.filter((m) => m.alunoId === estudanteId);
    
    state.matriculas = state.matriculas.filter((m) => m.alunoId !== estudanteId);
    state.alunos = state.alunos.filter((a) => a.id !== estudanteId);

    salvarEstado();

    if (window.FirebaseSync) {
      try {
        await window.FirebaseSync.deletarDadosFirebase("alunos", estudanteId);
      } catch (e) {
        console.warn("⚠️ Erro ao deletar aluno do Firebase:", e);
      }
      
      for (const mat of matriculasEstudante) {
        try {
          await window.FirebaseSync.deletarDadosFirebase("matriculas", mat.id);
        } catch (e) {
          console.warn("⚠️ Erro ao deletar matrícula do Firebase:", e);
        }
      }
    } else if (!navigator.onLine) {
      window.adicionarOperacaoOffline("deletar", "alunos", null, estudanteId);
      for (const mat of matriculasEstudante) {
        window.adicionarOperacaoOffline("deletar", "matriculas", null, mat.id);
      }
    }

    showToast("Estudante removido com sucesso!", "success");
    filtrarEstudantes();
  } catch (error) {
    console.error("Erro ao remover estudante:", error);
    showToast("Erro ao remover estudante", "error");
  } finally {
    mostrarLoader(false);
  }
}

// ========== FUNÇÕES DA ABA DADOS ==========
function carregarAbaDados() {
  atualizarStatusDados();
  carregarTabelaTempos();
  carregarListaBackups();
}

function atualizarStatusDados() {
  const metadata = state.metadata || {};
  const estatisticas = state.estatisticas || {};
  const dados = state.dados || {};
  const conflitos = state.conflitos || { pendentes: [] };

  document.getElementById("ultimaImportacao").textContent = metadata.ultimaImportacao
    ? new Date(metadata.ultimaImportacao).toLocaleString()
    : "Nunca";
  document.getElementById("totalAlunosDados").textContent = estatisticas.alunos || state.alunos?.length || 0;
  document.getElementById("totalProfessoresDados").textContent = estatisticas.professores || state.professores?.length || 0;
  document.getElementById("totalFixas").textContent = state.eletivas?.filter((e) => e.tipo === "FIXA").length || 0;
  document.getElementById("totalMistas").textContent = state.eletivas?.filter((e) => e.tipo === "MISTA").length || 0;
  document.getElementById("totalConflitos").textContent = conflitos.pendentes?.length || 0;

  const lib = state.liberacaoNotas || liberacaoNotasPadrao;
  document.getElementById("semestreAtual").textContent = lib.semestre || "1º/2026";
  document.getElementById("periodoLiberacao").textContent = `${lib.periodo?.inicio ? new Date(lib.periodo.inicio).toLocaleDateString() : "10/03/2026"} a ${lib.periodo?.fim ? new Date(lib.periodo.fim).toLocaleDateString() : "20/03/2026"}`;

  const totalEletivas = state.eletivas?.length || 0;
  const liberadas = lib.eletivasLiberadas?.length || 0;
  document.getElementById("eletivasLiberadas").textContent = `${liberadas} de ${totalEletivas}`;
}

function carregarTabelaTempos() {
  const tbody = document.getElementById("tabelaTempos");
  if (!tbody) return;

  const config = state.configTempos || configTemposPadrao;

  tbody.innerHTML = "";

  ["T1", "T2", "T3", "T4", "T5"].forEach((tempo) => {
    const row = document.createElement("tr");
    const tempoConfig = config[tempo] || { diaSemana: "?", series: [] };

    row.innerHTML = `
        <td><strong>${tempo}</strong>},
        <td>${tempoConfig.diaSemana || "?"}},
        <td>${tempoConfig.series?.join(", ") || "Todas"}},
    `;

    tbody.appendChild(row);
  });
}

function carregarListaBackups() {
  const container = document.getElementById("listaBackups");
  if (!container) return;

  try {
    const backupsSalvos = JSON.parse(localStorage.getItem("sage_backups") || "[]");
    backups = backupsSalvos;
  } catch (e) {
    backups = [];
  }

  if (backups.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhum backup encontrado</p>';
    return;
  }

  container.innerHTML = backups.sort((a, b) => new Date(b.data) - new Date(a.data)).map((backup) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--bg-gray);">
      <div>
        <strong>${backup.nome}</strong>
        <span style="font-size: 0.85rem; color: var(--text-light); margin-left: 0.5rem;">${new Date(backup.data).toLocaleString()}</span>
      </div>
      <button class="btn-secondary btn-small" onclick="restaurarBackup('${backup.id}')"><i class="fas fa-undo"></i> Restaurar</button>
    </div>
  `).join("");
}

// ========== MUDAR ABA GESTÃO ==========
window.mudarTabGestao = function (tab) {
  document.querySelectorAll(".gestao-tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".gestao-tab-btn").forEach((btn) => {
    if (btn.getAttribute("onclick")?.includes(`'${tab}'`)) {
      btn.classList.add("active");
    }
  });

  document.querySelectorAll(".gestao-tab-pane").forEach((pane) => pane.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");

  if (tab === "professores") carregarProfessores();
  else if (tab === "eletivas") carregarEletivas();
  else if (tab === "estudantes") filtrarEstudantes();
  else if (tab === "dados") carregarAbaDados();
};

// ========== FUNÇÃO ESCAPE HTML ==========
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
