// js/gestao-completa.js - Lógica da página de gestão completa (VERSÃO CORRIGIDA COM MISTAS SEM MATRÍCULAS AUTOMÁTICAS)
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

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ========== INICIALIZAÇÃO ==========
document.addEventListener("DOMContentLoaded", async function () {
  console.log("📋 Inicializando página de gestão completa...");

  carregarTheme();

  const gestorStorage = localStorage.getItem("gestor_atual");
  if (!gestorStorage) {
    window.location.href = "selecionar-gestor.html";
    return;
  }

  if (typeof carregarEstado === "function") {
    await carregarEstado();
  }

  // Garantir que arrays existem
  if (!state.alunos) state.alunos = [];
  if (!state.professores) state.professores = [];
  if (!state.eletivas) state.eletivas = [];
  if (!state.matriculas) state.matriculas = [];
  if (!state.registros) state.registros = [];
  if (!state.notas) state.notas = [];

  console.log("📊 Estado inicializado, aguardando Firebase...");

  // 🔥 Sincronização com Firebase
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
      
      if (window.FirebaseSync && typeof window.FirebaseSync.carregarColecoesGestor === "function") {
        const carregou = await window.FirebaseSync.carregarColecoesGestor();
        if (carregou) {
          console.log("✅ Dados do Firebase carregados:", {
            eletivas: state.eletivas.length,
            alunos: state.alunos.length,
            professores: state.professores.length,
            matriculas: state.matriculas.length
          });
        }
      }
      
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
      console.warn("⚠️ Erro na inicialização do Firebase:", err);
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
        }

        showToast("Professor atualizado com sucesso!", "success");
      }
    } else {
      const novoId = (state.professores?.map(p => p.id) || []).reduce((max, id) => id > max ? id : max, 0) + 1;
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

// ========== FUNÇÃO CORRIGIDA: salvarEletiva ==========
// CORREÇÃO: MISTA também tem turmaOrigem (filtro) mas NÃO gera matrícula automática
// As matrículas automáticas são controladas pela função criarMatriculasBasicas() em sincronizacao.js
// que só cria matrículas para FIXAS (quando tipo === "FIXA")
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

    // Dados comuns a ambos os tipos
    const dadosBase = {
      nome: nome,
      codigo: codigo,
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
      turmaOrigem: turmasSelecionadas.join(", "), // AMBOS os tipos têm turmaOrigem (filtro)
      semestreId: "2026-1",
    };

    console.log(`📝 Salvando eletiva: ${nome} (${tipo}) - Turmas: ${dadosBase.turmaOrigem}`);

    if (eletivaEmEdicao) {
      const index = state.eletivas.findIndex((e) => e.id === eletivaEmEdicao.id);
      if (index !== -1) {
        state.eletivas[index] = {
          ...state.eletivas[index],
          ...dadosBase,
          id: eletivaEmEdicao.id,
        };

        if (window.FirebaseSync) {
          await window.FirebaseSync.salvarDadosFirebase("eletivas", state.eletivas[index], state.eletivas[index].id);
        }

        showToast("Eletiva atualizada com sucesso!", "success");
      }
    } else {
      const novoId = (state.eletivas?.map(e => e.id) || []).reduce((max, id) => id > max ? id : max, 0) + 1;
      const novaEletiva = {
        id: novoId,
        ...dadosBase,
      };

      if (!state.eletivas) state.eletivas = [];
      state.eletivas.push(novaEletiva);

      if (window.FirebaseSync) {
        await window.FirebaseSync.salvarDadosFirebase("eletivas", novaEletiva, novoId);
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

// ========== FUNÇÃO PARA EDITAR CATEGORIA DA ELETIVA ==========
window.abrirModalEditarCategoria = function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  eletivaEmEdicao = eletiva;

  document.getElementById("modalCategoriaTitulo").textContent = `📋 EDITAR CATEGORIA - ${eletiva.nome}`;
  document.getElementById("categoriaAtual").textContent = eletiva.tipo || "MISTA";

  if (eletiva.tipo === "FIXA") {
    document.getElementById("categoriaFixa").checked = true;
  } else {
    document.getElementById("categoriaMista").checked = true;
  }

  const infoDiv = document.getElementById("categoriaInfo");
  if (eletiva.tipo === "FIXA") {
    infoDiv.innerHTML = `
      <p><strong>Categoria atual: FIXA</strong></p>
      <p>📌 Esta eletiva só permite alunos da mesma turma.</p>
      <p>⚠️ Se alterar para MISTA, alunos de diferentes turmas poderão ser adicionados.</p>
    `;
  } else {
    infoDiv.innerHTML = `
      <p><strong>Categoria atual: MISTA</strong></p>
      <p>📌 Esta eletiva permite alunos de diferentes turmas e séries.</p>
      <p>⚠️ Se alterar para FIXA, apenas alunos da mesma turma poderão ser adicionados.</p>
      <p>🔍 Verifique se os alunos atuais são da mesma turma antes de alterar!</p>
    `;
  }

  document.getElementById("modalEditarCategoria").classList.add("active");
};

window.fecharModalEditarCategoria = function () {
  document.getElementById("modalEditarCategoria").classList.remove("active");
  eletivaEmEdicao = null;
};

window.salvarCategoriaEletiva = async function () {
  if (!eletivaEmEdicao) return;

  const novaCategoria = document.querySelector('input[name="categoriaEletiva"]:checked')?.value;
  if (!novaCategoria) {
    showToast("Selecione uma categoria", "error");
    return;
  }

  mostrarLoader(true);

  try {
    const index = state.eletivas.findIndex((e) => e.id === eletivaEmEdicao.id);
    if (index !== -1) {
      const categoriaAntiga = state.eletivas[index].tipo;

      state.eletivas[index] = {
        ...state.eletivas[index],
        tipo: novaCategoria,
      };

      if (window.FirebaseSync) {
        await window.FirebaseSync.salvarDadosFirebase("eletivas", state.eletivas[index], state.eletivas[index].id);
      }

      salvarEstado();

      showToast(`Categoria alterada de ${categoriaAntiga} para ${novaCategoria} com sucesso!`, "success");

      fecharModalEditarCategoria();
      carregarEletivas();
    }
  } catch (error) {
    console.error("Erro ao alterar categoria:", error);
    showToast("Erro ao alterar categoria", "error");
  } finally {
    mostrarLoader(false);
  }
};

// ========== FUNÇÕES DE TROCA RÁPIDA DE PROFESSOR ==========
window.abrirModalTrocarProfessor = function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) {
    showToast("Eletiva não encontrada", "error");
    return;
  }

  eletivaEmEdicao = eletiva;

  const professorAtual = state.professores?.find((p) => p.id === eletiva.professorId)?.nome || "Não atribuído";

  document.getElementById("modalTrocaTitulo").textContent = `🔄 TROCAR PROFESSOR - ${eletiva.nome}`;
  document.getElementById("professorAtualTroca").textContent = professorAtual;

  const select = document.getElementById("selectNovoProfessor");
  if (!select) return;

  const professores = state.professores?.filter((p) => p.id !== eletiva.professorId) || [];

  select.innerHTML = '<option value="">Selecione um professor</option>';
  professores.forEach((p) => {
    select.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
  });

  if (professores.length === 0) {
    select.innerHTML = '<option value="">Nenhum outro professor disponível</option>';
  }

  document.getElementById("modalTrocarProfessor").classList.add("active");
};

window.fecharModalTrocarProfessor = function () {
  document.getElementById("modalTrocarProfessor").classList.remove("active");
  eletivaEmEdicao = null;
};

window.confirmarTrocaProfessor = async function () {
  if (!eletivaEmEdicao) {
    showToast("Nenhuma eletiva selecionada", "error");
    return;
  }

  const novoProfessorId = document.getElementById("selectNovoProfessor")?.value;
  if (!novoProfessorId) {
    showToast("Selecione um novo professor", "error");
    return;
  }

  const professor = state.professores?.find((p) => p.id === parseInt(novoProfessorId));
  if (!professor) {
    showToast("Professor não encontrado", "error");
    return;
  }

  mostrarLoader(true);

  try {
    const index = state.eletivas.findIndex((e) => e.id === eletivaEmEdicao.id);
    if (index !== -1) {
      const professorAntigo = state.eletivas[index].professorNome;

      state.eletivas[index] = {
        ...state.eletivas[index],
        professorId: professor.id,
        professorNome: professor.nome,
      };

      salvarEstado();

      if (window.FirebaseSync) {
        await window.FirebaseSync.salvarDadosFirebase("eletivas", state.eletivas[index], state.eletivas[index].id);
      }

      showToast(`Professor alterado de ${professorAntigo || "Não atribuído"} para ${professor.nome} com sucesso!`, "success");

      fecharModalTrocarProfessor();

      if (document.getElementById("tab-eletivas")?.classList.contains("active")) {
        carregarEletivas();
      }
    }
  } catch (error) {
    console.error("Erro ao trocar professor:", error);
    showToast("Erro ao trocar professor: " + error.message, "error");
  } finally {
    mostrarLoader(false);
  }
};

// ========== FUNÇÕES DE NOVO LOCAL ==========
window.abrirModalNovoLocal = function () {
  document.getElementById("novoLocalNome").value = "";
  document.getElementById("novoLocalCapacidade").value = "";
  document.getElementById("modalNovoLocal").classList.add("active");
};

window.fecharModalNovoLocal = function () {
  document.getElementById("modalNovoLocal").classList.remove("active");
};

window.salvarNovoLocal = async function () {
  const nome = document.getElementById("novoLocalNome")?.value.trim();
  const capacidade = document.getElementById("novoLocalCapacidade")?.value;

  if (!nome) {
    showToast("Nome do local é obrigatório", "error");
    return;
  }

  mostrarLoader(true);

  try {
    const novoLocal = {
      id: `local_${Date.now()}`,
      nome: nome,
      capacidade: capacidade ? parseInt(capacidade) : null,
    };

    locais.push(novoLocal);
    salvarLocais();

    carregarSelectsEletivas();

    showToast("Local adicionado com sucesso!", "success");
    fecharModalNovoLocal();
  } catch (error) {
    console.error("Erro ao adicionar local:", error);
    showToast("Erro ao adicionar local", "error");
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
        console.warn("⚠️ Erro ao deletar do Firebase:", e);
      }
    }
    
    carregarEletivas();
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

// ========== FUNÇÕES DE IMPRESSÃO ==========
window.imprimirListaProfessores = function () {
  const professores = state.professores || [];

  if (professores.length === 0) {
    showToast("Nenhum professor para imprimir", "warning");
    return;
  }

  mostrarLoader(true);

  try {
    if (typeof window.jspdf === "undefined") {
      showToast("Biblioteca de PDF não carregada", "error");
      mostrarLoader(false);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LISTA DE PROFESSORES", pageWidth / 2, y, { align: "center" });
    y += 10;

    const colWidths = [80, 60, 30];

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("NOME", margin, y);
    doc.text("EMAIL", margin + colWidths[0], y);
    doc.text("ELETIVAS", margin + colWidths[0] + colWidths[1], y);

    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    professores.sort((a, b) => a.nome.localeCompare(b.nome)).forEach((professor) => {
      const eletivas = state.eletivas?.filter((e) => e.professorId === professor.id) || [];

      if (y > 180) {
        doc.addPage();
        y = 20;
      }

      doc.text(professor.nome, margin, y);
      doc.text(professor.email, margin + colWidths[0], y);
      doc.text(eletivas.length.toString(), margin + colWidths[0] + colWidths[1], y);

      y += 6;
    });

    y += 10;

    const totalEletivas = state.eletivas?.length || 0;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total de Professores: ${professores.length}`, margin, y);
    y += 5;
    doc.text(`Total de Eletivas: ${totalEletivas}`, margin, y);
    y += 10;

    const dataAtual = new Date().toLocaleDateString("pt-BR");
    doc.text(`Data: ${dataAtual}`, pageWidth / 2, y, { align: "center" });

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    showToast("Erro ao gerar PDF", "error");
  } finally {
    mostrarLoader(false);
  }
};

window.imprimirListaEletivas = function () {
  const eletivas = state.eletivas || [];

  if (eletivas.length === 0) {
    showToast("Nenhuma eletiva para imprimir", "warning");
    return;
  }

  mostrarLoader(true);

  try {
    if (typeof window.jspdf === "undefined") {
      showToast("Biblioteca de PDF não carregada", "error");
      mostrarLoader(false);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LISTA DE ELETIVAS", pageWidth / 2, y, { align: "center" });
    y += 10;

    const colWidths = [60, 25, 50, 20, 30];

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("ELETIVA", margin, y);
    doc.text("CÓDIGO", margin + colWidths[0], y);
    doc.text("PROFESSOR", margin + colWidths[0] + colWidths[1], y);
    doc.text("TEMPO", margin + colWidths[0] + colWidths[1] + colWidths[2], y);
    doc.text("LOCAL", margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y);

    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    eletivas.sort((a, b) => a.nome.localeCompare(b.nome)).forEach((eletiva) => {
      const professor = state.professores?.find((p) => p.id === eletiva.professorId)?.nome || "Não atribuído";
      const tempo = getTempoFromHorario(eletiva.horario) || "N/A";

      if (y > 180) {
        doc.addPage();
        y = 20;
      }

      doc.text(eletiva.nome, margin, y);
      doc.text(eletiva.codigo, margin + colWidths[0], y);
      doc.text(professor, margin + colWidths[0] + colWidths[1], y);
      doc.text(tempo, margin + colWidths[0] + colWidths[1] + colWidths[2], y);
      doc.text(eletiva.local || "-", margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y);

      y += 6;
    });

    y += 10;

    const totalProfessores = state.professores?.length || 0;
    const totalAlunos = state.alunos?.length || 0;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total de Eletivas: ${eletivas.length}`, margin, y);
    y += 5;
    doc.text(`Total de Professores: ${totalProfessores}`, margin, y);
    y += 5;
    doc.text(`Total de Alunos: ${totalAlunos}`, margin, y);
    y += 10;

    const dataAtual = new Date().toLocaleDateString("pt-BR");
    doc.text(`Data: ${dataAtual}`, pageWidth / 2, y, { align: "center" });

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    showToast("Erro ao gerar PDF", "error");
  } finally {
    mostrarLoader(false);
  }
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
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum estudante encontrado</td></tr>';
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
      <td><strong>${escapeHtml(estudante.nome)}</strong></td>
      <td>${escapeHtml(estudante.turmaOrigem)}</td>
      <td>${escapeHtml(estudante.codigoSige)}</td>
      <td>${eletivasHTML}</td>
      <td>
        <button class="btn-primary btn-small" onclick="abrirModalEditarEstudante(${estudante.id})" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-secondary btn-small" onclick="abrirModalTrocarEletivaEstudante(${estudante.id})" title="Trocar eletiva">
          <i class="fas fa-exchange-alt"></i>
        </button>
        <button class="btn-danger btn-small" onclick="confirmarRemoverEstudante(${estudante.id})" title="Remover">
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
  const idNum = typeof estudanteId === 'string' ? parseInt(estudanteId) : estudanteId;
  const estudante = state.alunos?.find((a) => a.id === idNum);
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
          id: (state.matriculas?.map(m => m.id) || []).reduce((max, id) => id > max ? id : max, 0) + 1,
          eletivaId: eletivaId,
          alunoId: estudanteEmEdicao.id,
          tipoMatricula: "manual",
          dataMatricula: new Date().toISOString().split("T")[0],
          semestreId: "2026-1",
        };
        state.matriculas.push(novaMatricula);
        
        if (window.FirebaseSync) {
          await window.FirebaseSync.salvarDadosFirebase("matriculas", novaMatricula, novaMatricula.id);
        }
      }
      
      salvarEstado();
      showToast("Estudante atualizado com sucesso!", "success");
      
    } else {
      // Adicionar novo estudante
      if (state.alunos?.some(a => a.codigoSige === sige)) {
        showToast(`Já existe um estudante com o SIGE ${sige}`, "error");
        mostrarLoader(false);
        return;
      }
      
      const novoId = (state.alunos?.map(a => a.id) || []).reduce((max, id) => id > max ? id : max, 0) + 1;
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
      }
      
      for (const eletivaId of eletivasSelecionadas) {
        const novaMatricula = {
          id: (state.matriculas?.map(m => m.id) || []).reduce((max, id) => id > max ? id : max, 0) + 1,
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

// ========== FUNÇÕES DE TROCA DE ELETIVA DO ESTUDANTE ==========
window.abrirModalTrocarEletivaEstudante = function (estudanteId) {
  const idNum = typeof estudanteId === 'string' ? parseInt(estudanteId) : estudanteId;
  const estudante = state.alunos?.find((a) => a.id === idNum);
  if (!estudante) {
    showToast("Estudante não encontrado", "error");
    return;
  }

  estudanteParaTroca = estudante;

  document.getElementById("modalTrocaEstudanteTitulo").textContent = `🔄 TROCAR ELETIVA - ${estudante.nome}`;
  document.getElementById("estudanteTrocaInfo").textContent = `${estudante.nome} (SIGE: ${estudante.codigoSige})`;

  const eletivasAtuais = getEletivasEstudante(estudante.id);

  let atuaisHTML = "";
  if (eletivasAtuais.length > 0) {
    eletivasAtuais.forEach((e) => {
      atuaisHTML += `<div style="padding: 0.3rem; background: var(--bg-light); margin-bottom: 0.3rem; border-radius: 4px;">• ${e.nome} (${e.tempo}) - ${e.professorNome}</div>`;
    });
  } else {
    atuaisHTML = '<p style="color: var(--text-light);">Nenhuma eletiva</p>';
  }
  document.getElementById("eletivasAtuaisEstudante").innerHTML = atuaisHTML;

  carregarEletivasDisponiveisTroca(estudante.id);

  document.getElementById("modalTrocarEletivaEstudante").classList.add("active");
};

function carregarEletivasDisponiveisTroca(estudanteId = null) {
  const container = document.getElementById("eletivasDisponiveisContainer");
  if (!container) return;

  const eletivas = state.eletivas?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  const eletivasPorTempo = {};
  eletivas.forEach((e) => {
    const tempo = getTempoFromHorario(e.horario) || "OUTROS";
    if (!eletivasPorTempo[tempo]) eletivasPorTempo[tempo] = [];
    eletivasPorTempo[tempo].push(e);
  });

  let html = "";
  const tempos = ["T1", "T2", "T3", "T4", "T5", "OUTROS"];

  tempos.forEach((tempo) => {
    const eletivasDoTempo = eletivasPorTempo[tempo];
    if (!eletivasDoTempo || eletivasDoTempo.length === 0) return;

    html += `<div style="margin-top: 1rem;"><strong>TEMPO ${tempo}:</strong></div>`;

    eletivasDoTempo.forEach((e) => {
      const professor = state.professores?.find((p) => p.id === e.professorId)?.nome || "Não atribuído";
      const matriculados = state.matriculas?.filter((m) => m.eletivaId === e.id).length || 0;

      html += `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem; border-bottom: 1px solid var(--bg-light);">
          <input type="radio" name="eletivaDestino" value="${e.id}" id="eletiva_${e.id}">
          <label for="eletiva_${e.id}" style="flex: 1;">
            <strong>${e.nome}</strong> (${e.codigo}) - ${professor} - ${matriculados} alunos
          </label>
        </div>
      `;
    });
  });

  if (eletivas.length === 0) {
    html = '<p style="color: var(--text-light);">Nenhuma eletiva cadastrada</p>';
  }

  container.innerHTML = html;
}

window.fecharModalTrocarEletivaEstudante = function () {
  document.getElementById("modalTrocarEletivaEstudante").classList.remove("active");
  estudanteParaTroca = null;
};

window.confirmarTrocaEletivaEstudante = async function () {
  if (!estudanteParaTroca) return;

  const eletivaDestinoId = document.querySelector('input[name="eletivaDestino"]:checked')?.value;
  if (!eletivaDestinoId) {
    showToast("Selecione uma eletiva de destino", "error");
    return;
  }

  const eletivaDestino = state.eletivas?.find((e) => e.id === parseInt(eletivaDestinoId));
  if (!eletivaDestino) return;

  mostrarLoader(true);

  try {
    const novaMatricula = {
      id: (state.matriculas?.map(m => m.id) || []).reduce((max, id) => id > max ? id : max, 0) + 1,
      eletivaId: parseInt(eletivaDestinoId),
      alunoId: estudanteParaTroca.id,
      tipoMatricula: "troca",
      dataMatricula: new Date().toISOString().split("T")[0],
      semestreId: "2026-1",
    };

    if (!state.matriculas) state.matriculas = [];
    state.matriculas.push(novaMatricula);

    if (window.FirebaseSync) {
      await window.FirebaseSync.salvarDadosFirebase("matriculas", novaMatricula, novaMatricula.id);
    }

    salvarEstado();

    showToast(`Estudante adicionado à eletiva ${eletivaDestino.nome}!`, "success");

    fecharModalTrocarEletivaEstudante();
    filtrarEstudantes();
  } catch (error) {
    console.error("Erro ao adicionar estudante à eletiva:", error);
    showToast("Erro ao adicionar estudante à eletiva", "error");
  } finally {
    mostrarLoader(false);
  }
};

// ========== FUNÇÕES DE REMOÇÃO DE ESTUDANTE ==========
window.confirmarRemoverEstudante = function (estudanteId) {
  const idNum = typeof estudanteId === 'string' ? parseInt(estudanteId) : estudanteId;
  const estudante = state.alunos?.find((a) => a.id === idNum);
  if (!estudante) {
    showToast("Estudante não encontrado. Recarregando lista...", "warning");
    filtrarEstudantes();
    return;
  }

  const matriculas = state.matriculas?.filter((m) => m.alunoId === estudante.id) || [];

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
    removerEstudante(estudante.id);
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
    state.matriculas = state.matriculas.filter((m) => m.alunoId !== estudanteId);
    state.alunos = state.alunos.filter((a) => a.id !== estudanteId);

    salvarEstado();

    if (window.FirebaseSync) {
      try {
        await window.FirebaseSync.deletarDadosFirebase("alunos", estudanteId);
      } catch (e) {
        console.warn("⚠️ Erro ao deletar aluno do Firebase:", e);
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

window.imprimirListaEstudantes = function () {
  if (estudantesFiltrados.length === 0) {
    showToast("Nenhum estudante para imprimir", "warning");
    return;
  }

  mostrarLoader(true);

  try {
    if (typeof window.jspdf === "undefined") {
      showToast("Biblioteca de PDF não carregada", "error");
      mostrarLoader(false);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LISTA DE ESTUDANTES", pageWidth / 2, y, { align: "center" });
    y += 6;

    const filtros = [];
    if (filtroTempoEstudante !== "TODOS") filtros.push(`Tempo ${filtroTempoEstudante}`);
    const turma = document.getElementById("filtroTurmaEstudante")?.value;
    if (turma) filtros.push(`Turma ${turma}`);
    const eletivaId = document.getElementById("filtroEletivaEstudante")?.value;
    if (eletivaId) {
      const eletiva = state.eletivas?.find((e) => e.id === parseInt(eletivaId));
      if (eletiva) filtros.push(`Eletiva: ${eletiva.nome}`);
    }

    if (filtros.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text(`Filtros aplicados: ${filtros.join(" | ")}`, pageWidth / 2, y, { align: "center" });
      y += 6;
    }

    y += 4;

    const colWidths = [80, 25, 25, 50];

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("NOME", margin, y);
    doc.text("TURMA", margin + colWidths[0], y);
    doc.text("SIGE", margin + colWidths[0] + colWidths[1], y);
    doc.text("ELETIVAS", margin + colWidths[0] + colWidths[1] + colWidths[2], y);

    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    estudantesFiltrados.forEach((estudante) => {
      const eletivas = getEletivasEstudante(estudante.id);
      const eletivasStr = eletivas.map((e) => `${e.nome} (${e.tempo})`).join(", ");

      if (y > 180) {
        doc.addPage();
        y = 20;
      }

      doc.text(estudante.nome, margin, y);
      doc.text(estudante.turmaOrigem, margin + colWidths[0], y);
      doc.text(estudante.codigoSige, margin + colWidths[0] + colWidths[1], y);
      doc.text(eletivasStr, margin + colWidths[0] + colWidths[1] + colWidths[2], y);

      y += 6;
    });

    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total de Estudantes: ${estudantesFiltrados.length}`, margin, y);
    y += 10;

    const dataAtual = new Date().toLocaleDateString("pt-BR");
    doc.text(`Data: ${dataAtual}`, pageWidth / 2, y, { align: "center" });

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    showToast("Erro ao gerar PDF", "error");
  } finally {
    mostrarLoader(false);
  }
};

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
        <tr><strong>${tempo}</strong>},
        <td>${tempoConfig.diaSemana || "?"}),
        <td>${tempoConfig.series?.join(", ") || "Todas"}),
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

// ========== FUNÇÕES DE IMPORTAÇÃO SAGE ==========
window.importarJSONSage = async function () {
  const jsonString = document.getElementById("jsonInput")?.value.trim();

  if (!jsonString) {
    showToast("Cole o JSON primeiro", "error");
    return;
  }

  mostrarLoader(true);

  try {
    let dadosNovos;
    try {
      dadosNovos = JSON.parse(jsonString);
    } catch (e) {
      throw new Error("JSON inválido. Verifique o formato.");
    }

    const erros = validarEstruturaSAGE(dadosNovos);
    if (erros.length > 0) {
      throw new Error("Estrutura inválida:\n" + erros.join("\n"));
    }

    await criarBackupAutomatico("antes_importacao_sage");

    const dadosAtuais = {
      configTempos: state.configTempos || configTemposPadrao,
      liberacaoNotas: state.liberacaoNotas || liberacaoNotasPadrao,
      metadata: state.metadata || {},
    };

    const eletivasFixas = (dadosNovos.dados.eletivasFixas || []).map((e) => ({
      ...e,
      tipo: "FIXA",
      id: e.codigo ? e.codigo : `FIXA_${Math.random()}`,
    }));

    const eletivasMistas = (dadosNovos.dados.eletivasMistas || []).map((e) => ({
      ...e,
      tipo: "MISTA",
      id: e.codigo ? e.codigo : `MISTA_${Math.random()}`,
    }));

    const todasEletivas = [...eletivasFixas, ...eletivasMistas];
    const configTempos = dadosAtuais.configTempos;
    const resultadoChoques = resolverChoquesHorario(todasEletivas, dadosNovos.dados.alunos || [], configTempos);
    const eletivasProcessadas = aplicarResolucaoAutomatica(todasEletivas, resultadoChoques.remocoesAutomaticas);

    const estatisticas = {
      alunos: dadosNovos.estatisticas?.alunos || 0,
      professores: dadosNovos.estatisticas?.professores || 0,
      eletivasFixas: eletivasProcessadas.filter((e) => e.tipo === "FIXA").length,
      eletivasMistas: eletivasProcessadas.filter((e) => e.tipo === "MISTA").length,
    };

    const dadosMesclados = {
      metadata: { ...dadosAtuais.metadata, ultimaImportacao: new Date().toISOString(), ultimaSincronizacao: dadosNovos.timestamp || new Date().toISOString(), versao: "2.0", fonte: "SAGE ELETIVAS + Configurações Manuais" },
      dados: { alunos: dadosNovos.dados.alunos || [], professores: dadosNovos.dados.professores || [], eletivasFixas: eletivasProcessadas.filter((e) => e.tipo === "FIXA"), eletivasMistas: eletivasProcessadas.filter((e) => e.tipo === "MISTA") },
      configTempos: dadosAtuais.configTempos,
      liberacaoNotas: dadosAtuais.liberacaoNotas,
      estatisticas: estatisticas,
      conflitos: { resolvidosAutomaticamente: resultadoChoques.remocoesAutomaticas, pendentes: resultadoChoques.conflitosPendentes },
    };

    dadosMesclados.eletivas = [...dadosMesclados.dados.eletivasFixas, ...dadosMesclados.dados.eletivasMistas];

    Object.assign(state, dadosMesclados);
    salvarEstado();

    if (window.FirebaseSync) {
      setTimeout(() => { window.FirebaseSync.salvarDadosFirebase("dados_completos", dadosMesclados); }, 100);
    }

    carregarAbaDados();
    if (typeof carregarEletivas === "function") carregarEletivas();
    if (typeof carregarProfessores === "function") carregarProfessores();
    if (typeof filtrarEstudantes === "function") filtrarEstudantes();

    mostrarLoader(false);

    if (resultadoChoques.conflitosPendentes.length > 0) {
      showToast(`⚠️ Importação concluída com ${resultadoChoques.conflitosPendentes.length} conflitos pendentes.\n${resultadoChoques.remocoesAutomaticas.length} conflitos resolvidos automaticamente.`, "warning");
    } else {
      showToast(`✅ Dados importados com sucesso!\n${resultadoChoques.remocoesAutomaticas.length} conflitos resolvidos automaticamente.`, "success");
    }

    document.getElementById("jsonInput").value = "";
  } catch (error) {
    mostrarLoader(false);
    showToast("Erro na importação: " + error.message, "error");
    console.error(error);
  }
};

function validarEstruturaSAGE(dados) {
  const erros = [];
  if (!dados.success) erros.push("Campo 'success' ausente ou false");
  if (!dados.timestamp) erros.push("Campo 'timestamp' ausente");
  if (!dados.estatisticas) erros.push("Campo 'estatisticas' ausente");
  if (!dados.dados) erros.push("Campo 'dados' ausente");
  if (dados.estatisticas) {
    if (typeof dados.estatisticas.alunos !== "number") erros.push("estatisticas.alunos deve ser número");
    if (typeof dados.estatisticas.professores !== "number") erros.push("estatisticas.professores deve ser número");
  }
  if (dados.dados) {
    if (!Array.isArray(dados.dados.alunos)) erros.push("dados.alunos deve ser um array");
    if (!Array.isArray(dados.dados.professores)) erros.push("dados.professores deve ser um array");
    if (!Array.isArray(dados.dados.eletivasFixas)) erros.push("dados.eletivasFixas deve ser um array");
    if (!Array.isArray(dados.dados.eletivasMistas)) erros.push("dados.eletivasMistas deve ser um array");
  }
  return erros;
}

function determinarTempo(horarioInicio, configTempos) {
  if (!horarioInicio) return "T1";
  const hora = horarioInicio.split(":")[0];
  const mapaHorario = { "07": "T1", "08": "T1", 13: "T3", 14: "T2", 15: "T4", 16: "T5" };
  return mapaHorario[hora] || "T1";
}

function resolverChoquesHorario(eletivas, alunos, configTempos) {
  console.log("🔍 Resolvendo choques de horário (MISTA prioritária)...");
  const eletivasComTempo = eletivas.map((e) => ({ ...e, tempo: determinarTempo(e.horarioInicio || e.horario?.split("-")[0], configTempos) }));
  const eletivasPorTempo = {};
  eletivasComTempo.forEach((e) => { if (!eletivasPorTempo[e.tempo]) eletivasPorTempo[e.tempo] = []; eletivasPorTempo[e.tempo].push(e); });
  const remocoesAutomaticas = [];
  const conflitosPendentes = [];
  Object.entries(eletivasPorTempo).forEach(([tempo, eletivasDoTempo]) => {
    const alunoEletivas = {};
    eletivasDoTempo.forEach((eletiva) => {
      const alunosEletiva = eletiva.alunos || [];
      alunosEletiva.forEach((alunoRef) => {
        const alunoId = typeof alunoRef === "object" ? alunoRef.id || alunoRef.sige : alunoRef;
        if (!alunoEletivas[alunoId]) alunoEletivas[alunoId] = [];
        alunoEletivas[alunoId].push({ eletivaId: eletiva.codigo || eletiva.id, tipo: eletiva.tipo, nome: eletiva.nome, eletivaObj: eletiva });
      });
    });
    Object.entries(alunoEletivas).forEach(([alunoId, eletivasDoAluno]) => {
      if (eletivasDoAluno.length <= 1) return;
      const fixas = eletivasDoAluno.filter((e) => e.tipo === "FIXA");
      const mistas = eletivasDoAluno.filter((e) => e.tipo === "MISTA");
      if (mistas.length > 0 && fixas.length > 0) {
        const fixasRemover = fixas;
        remocoesAutomaticas.push({ alunoId, tempo, motivo: `Prioridade MISTA sobre FIXA (aluno removido de ${fixasRemover.length} fixa(s) e mantido em ${mistas.length} mista(s))`, acao: `Removido de ${fixasRemover.length} fixa(s)`, detalhes: { mantidas: mistas.map((m) => ({ nome: m.nome, eletivaId: m.eletivaId })), removidos: fixasRemover.map((f) => ({ nome: f.nome, eletivaId: f.eletivaId })) } });
      } else if (fixas.length > 1 && mistas.length === 0) {
        conflitosPendentes.push({ alunoId, tempo, tipo: "fixa", eletivas: fixas.map((f) => ({ nome: f.nome, eletivaId: f.eletivaId })), gravidade: "alta", descricao: `Aluno está em ${fixas.length} eletivas FIXAS no mesmo tempo` });
      } else if (mistas.length > 1 && fixas.length === 0) {
        conflitosPendentes.push({ alunoId, tempo, tipo: "mista", eletivas: mistas.map((m) => ({ nome: m.nome, eletivaId: m.eletivaId })), gravidade: "media", descricao: `Aluno está em ${mistas.length} eletivas MISTAS no mesmo tempo` });
      }
    });
  });
  return { remocoesAutomaticas, conflitosPendentes };
}

function aplicarResolucaoAutomatica(eletivas, remocoesAutomaticas) {
  const eletivasProcessadas = JSON.parse(JSON.stringify(eletivas));
  remocoesAutomaticas.forEach((remocao) => {
    remocao.detalhes.removidos.forEach((item) => {
      const eletiva = eletivasProcessadas.find((el) => el.codigo === item.eletivaId || el.id === item.eletivaId);
      if (eletiva && eletiva.alunos) {
        eletiva.alunos = eletiva.alunos.filter((ref) => { const alunoId = typeof ref === "object" ? ref.id || ref.sige : ref; return alunoId !== remocao.alunoId; });
      }
    });
  });
  return eletivasProcessadas;
}

// ========== FUNÇÕES DE BACKUP ==========
async function criarBackupAutomatico(nome) {
  const backup = { id: `backup_${Date.now()}`, nome: nome, data: new Date().toISOString(), dados: JSON.parse(JSON.stringify(state)) };
  backups.push(backup);
  if (backups.length > 10) backups = backups.slice(-10);
  localStorage.setItem("sage_backups", JSON.stringify(backups));
}

window.criarBackup = async function () {
  const nome = prompt("Digite um nome para o backup:", `backup_${new Date().toLocaleDateString()}`);
  if (!nome) return;
  mostrarLoader(true);
  try {
    await criarBackupAutomatico(nome);
    carregarListaBackups();
    showToast("Backup criado com sucesso!", "success");
  } catch (error) { showToast("Erro ao criar backup", "error"); } finally { mostrarLoader(false); }
};

window.restaurarBackup = function (backupId) {
  const backup = backups.find((b) => b.id === backupId);
  if (!backup) return;
  const confirmBody = document.getElementById("confirmBody"), confirmTitle = document.getElementById("confirmTitle"), confirmBtn = document.getElementById("confirmActionBtn");
  confirmTitle.textContent = "⚠️ RESTAURAR BACKUP";
  confirmBody.innerHTML = `<p>Tem certeza que deseja restaurar o backup <strong>${backup.nome}</strong>?</p><p style="margin-top: 1rem; color: var(--danger);">Esta ação irá sobrescrever todos os dados atuais!</p>`;
  const originalOnClick = confirmBtn.onclick;
  confirmBtn.onclick = function () { executarRestauracao(backup); fecharModalConfirmacao(); setTimeout(() => { confirmBtn.onclick = originalOnClick; }, 100); };
  document.getElementById("modalConfirmacao").classList.add("active");
};

async function executarRestauracao(backup) {
  mostrarLoader(true);
  try {
    Object.assign(state, backup.dados);
    salvarEstado();
    if (window.FirebaseSync) await window.FirebaseSync.salvarDadosFirebase("dados_completos", state);
    carregarAbaDados();
    if (typeof carregarEletivas === "function") carregarEletivas();
    if (typeof carregarProfessores === "function") carregarProfessores();
    if (typeof filtrarEstudantes === "function") filtrarEstudantes();
    showToast("Backup restaurado com sucesso!", "success");
  } catch (error) { showToast("Erro ao restaurar backup", "error"); } finally { mostrarLoader(false); }
}

// ========== MODAL DE EDIÇÃO DE TEMPOS ==========
window.abrirModalEditarTempos = function () {
  console.log("⚙️ Abrindo modal de edição de tempos");
  const container = document.getElementById("temposEditContainer");
  if (!container) return;
  const config = state.configTempos || configTemposPadrao;
  let html = "";
  const dias = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
  ["T1", "T2", "T3", "T4", "T5"].forEach((tempo) => {
    const tempoConfig = config[tempo] || { diaSemana: "SEGUNDA", series: ["1ª", "2ª", "3ª"] };
    html += `<div class="tempo-edit-item"><div class="tempo-label">${tempo}</div><div class="tempo-dia"><label>Dia da semana:</label><select id="tempo_dia_${tempo}" class="semestre-selector">${dias.map((d) => `<option value="${d}" ${tempoConfig.diaSemana?.toUpperCase() === d ? "selected" : ""}>${d}-FEIRA</option>`).join("")}</select></div><div class="tempo-series"><label>Séries participantes:</label><div style="display: flex; gap: 1rem;">${["1ª", "2ª", "3ª"].map((serie) => `<label><input type="checkbox" id="tempo_${tempo}_serie_${serie}" value="${serie}" ${(tempoConfig.series || []).includes(serie) ? "checked" : ""}> ${serie} SÉRIE</label>`).join("")}</div></div></div>`;
  });
  container.innerHTML = html;
  document.getElementById("modalEditarTempos").classList.add("active");
};

window.fecharModalEditarTempos = function () { document.getElementById("modalEditarTempos").classList.remove("active"); };

window.salvarConfigTempos = async function () {
  mostrarLoader(true);
  try {
    const novaConfig = {}, diasUsados = new Set(), erros = [];
    ["T1", "T2", "T3", "T4", "T5"].forEach((tempo) => {
      const diaSelect = document.getElementById(`tempo_dia_${tempo}`);
      if (!diaSelect) return;
      const dia = diaSelect.value;
      if (diasUsados.has(dia)) erros.push(`Tempo ${tempo}: dia ${dia} já utilizado por outro tempo`);
      else diasUsados.add(dia);
      const series = [];
      ["1ª", "2ª", "3ª"].forEach((serie) => { const checkbox = document.getElementById(`tempo_${tempo}_serie_${serie}`); if (checkbox && checkbox.checked) series.push(serie); });
      if (series.length === 0) erros.push(`Tempo ${tempo}: selecione pelo menos uma série`);
      novaConfig[tempo] = { diaSemana: dia, series: series };
    });
    if (erros.length > 0) { showToast("Erros na configuração:\n" + erros.join("\n"), "error"); mostrarLoader(false); return; }
    state.configTempos = novaConfig; salvarEstado();
    if (window.FirebaseSync) await window.FirebaseSync.salvarDadosFirebase("config_tempos", novaConfig);
    carregarTabelaTempos();
    showToast("✅ Configuração dos tempos salva com sucesso!", "success");
    fecharModalEditarTempos();
  } catch (error) { console.error("Erro ao salvar configuração:", error); showToast("Erro ao salvar configuração", "error"); } finally { mostrarLoader(false); }
};

// ========== MODAL DE LIBERAÇÃO DE NOTAS ==========
window.abrirModalEditarLiberacao = function () {
  console.log("📊 Abrindo modal de liberação de notas");
  const hoje = new Date();
  const inicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 10);
  const formatarDataInput = (data) => data.toISOString().split("T")[0];
  const liberacao = state.liberacaoNotas || { semestre: "1/2026", periodo: { inicio: formatarDataInput(inicioPadrao), fim: formatarDataInput(fimPadrao) }, eletivasLiberadas: [] };
  document.getElementById("selectSemestreLiberacao").value = liberacao.semestre || "1/2026";
  document.getElementById("dataInicioLiberacao").value = liberacao.periodo?.inicio || formatarDataInput(inicioPadrao);
  document.getElementById("dataFimLiberacao").value = liberacao.periodo?.fim || formatarDataInput(fimPadrao);
  const container = document.getElementById("eletivasLiberacaoContainer");
  if (!container) return;
  const eletivas = state.eletivas || [];
  if (eletivas.length === 0) { container.innerHTML = '<p class="empty-state">Nenhuma eletiva cadastrada</p>'; document.getElementById("modalLiberacaoNotas").classList.add("active"); return; }
  const liberadasSet = new Set(liberacao.eletivasLiberadas || []);
  let html = "";
  eletivas.sort((a, b) => a.nome.localeCompare(b.nome)).forEach((e) => {
    const professor = state.professores?.find((p) => p.id === e.professorId)?.nome || "Não atribuído";
    const chave = `${e.id}_${liberacao.semestre}`;
    const checked = liberadasSet.has(chave) ? "checked" : "";
    html += `<div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid var(--bg-gray);"><input type="checkbox" class="eletiva-liberacao-checkbox" value="${e.id}" data-chave="${chave}" ${checked}><div style="flex: 1;"><strong>${e.nome}</strong> (${e.codigo}) - ${professor} - ${e.horario?.diaSemana} ${e.horario?.codigoTempo}</div></div>`;
  });
  container.innerHTML = html;
  document.getElementById("modalLiberacaoNotas").classList.add("active");
};

window.fecharModalLiberacaoNotas = function () { document.getElementById("modalLiberacaoNotas").classList.remove("active"); };
window.selecionarTodasEletivasLiberacao = function (selecionar) { document.querySelectorAll(".eletiva-liberacao-checkbox").forEach((cb) => { cb.checked = selecionar; }); };

window.salvarLiberacaoNotas = async function () {
  const semestre = document.getElementById("selectSemestreLiberacao")?.value;
  const dataInicio = document.getElementById("dataInicioLiberacao")?.value;
  const dataFim = document.getElementById("dataFimLiberacao")?.value;
  if (!semestre || !dataInicio || !dataFim) { showToast("Preencha todos os campos", "error"); return; }
  if (new Date(dataInicio) > new Date(dataFim)) { showToast("Data de início não pode ser maior que data de fim", "error"); return; }
  mostrarLoader(true);
  try {
    const eletivasLiberadas = [];
    document.querySelectorAll(".eletiva-liberacao-checkbox:checked").forEach((cb) => { eletivasLiberadas.push(cb.dataset.chave || `${cb.value}_${semestre}`); });
    const novaConfig = { semestre: semestre, periodo: { inicio: dataInicio, fim: dataFim }, eletivasLiberadas: eletivasLiberadas };
    state.liberacaoNotas = novaConfig; salvarEstado();
    if (window.FirebaseSync) await window.FirebaseSync.salvarDadosFirebase("liberacao_notas", novaConfig);
    document.getElementById("semestreAtual").textContent = novaConfig.semestre;
    document.getElementById("periodoLiberacao").textContent = `${new Date(dataInicio).toLocaleDateString()} a ${new Date(dataFim).toLocaleDateString()}`;
    const totalEletivas = state.eletivas?.length || 0;
    document.getElementById("eletivasLiberadas").textContent = `${eletivasLiberadas.length} de ${totalEletivas}`;
    showToast("✅ Configuração de notas salva com sucesso!", "success");
    fecharModalLiberacaoNotas();
  } catch (error) { console.error("Erro ao salvar liberação:", error); showToast("Erro ao salvar liberação", "error"); } finally { mostrarLoader(false); }
};

// ========== MODAL DE RESTAURAÇÃO DE BACKUP ==========
window.abrirModalRestaurarBackup = function () {
  console.log("🔄 Abrindo modal de restauração de backup");
  const container = document.getElementById("listaBackupsRestaurar");
  if (!container) return;
  try { const backupsSalvos = JSON.parse(localStorage.getItem("sage_backups") || "[]"); backups = backupsSalvos; } catch (e) { backups = []; }
  if (backups.length === 0) { container.innerHTML = '<p class="empty-state">Nenhum backup encontrado</p>'; document.getElementById("btnConfirmarRestaurarBackup").disabled = true; document.getElementById("modalRestaurarBackup").classList.add("active"); return; }
  const backupsOrdenados = backups.sort((a, b) => new Date(b.data) - new Date(a.data));
  let html = "";
  backupsOrdenados.forEach((backup) => { const dataFormatada = new Date(backup.data).toLocaleString("pt-BR"); html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; margin-bottom: 0.5rem; background: var(--bg-light); border-radius: 8px; border-left: 4px solid var(--info);"><div><input type="radio" name="backupSelecionado" value="${backup.id}" id="backup_${backup.id}" style="margin-right: 0.5rem;"><label for="backup_${backup.id}"><strong>${backup.nome}</strong><span style="display: block; font-size: 0.85rem; color: var(--text-light);">${dataFormatada}</span></label></div></div>`; });
  container.innerHTML = html;
  const radios = container.querySelectorAll('input[type="radio"]');
  radios.forEach((radio) => { radio.addEventListener("change", () => { document.getElementById("btnConfirmarRestaurarBackup").disabled = false; }); });
  document.getElementById("btnConfirmarRestaurarBackup").onclick = confirmarRestaurarBackup;
  document.getElementById("btnConfirmarRestaurarBackup").disabled = true;
  document.getElementById("modalRestaurarBackup").classList.add("active");
};

window.fecharModalRestaurarBackup = function () { document.getElementById("modalRestaurarBackup").classList.remove("active"); };
window.confirmarRestaurarBackup = async function () {
  const radioSelecionado = document.querySelector('input[name="backupSelecionado"]:checked');
  if (!radioSelecionado) { showToast("Selecione um backup", "error"); return; }
  const backupId = radioSelecionado.value;
  const backup = backups.find((b) => b.id === backupId);
  if (!backup) { showToast("Backup não encontrado", "error"); return; }
  const confirmBody = document.getElementById("confirmBody"), confirmTitle = document.getElementById("confirmTitle"), confirmBtn = document.getElementById("confirmActionBtn");
  confirmTitle.textContent = "⚠️ CONFIRMAR RESTAURAÇÃO";
  confirmBody.innerHTML = `<p>Tem certeza que deseja restaurar o backup <strong>${backup.nome}</strong>?</p><p style="margin-top: 1rem; color: var(--danger); font-weight: bold;">⚠️ ESTA AÇÃO IRÁ SOBRESCREVER TODOS OS DADOS ATUAIS!</p><p style="margin-top: 0.5rem;">Data do backup: ${new Date(backup.data).toLocaleString("pt-BR")}</p>`;
  const originalOnClick = confirmBtn.onclick;
  confirmBtn.onclick = async function () { fecharModalConfirmacao(); await executarRestauracaoBackup(backup); setTimeout(() => { confirmBtn.onclick = originalOnClick; }, 100); };
  document.getElementById("modalConfirmacao").classList.add("active");
  fecharModalRestaurarBackup();
};

async function executarRestauracaoBackup(backup) {
  mostrarLoader(true);
  try {
    console.log("🔄 Restaurando backup:", backup.nome);
    Object.assign(state, backup.dados);
    salvarEstado();
    if (window.FirebaseSync) {
      if (state.professores) for (const prof of state.professores) await window.FirebaseSync.salvarDadosFirebase("professores", prof, prof.id);
      if (state.alunos) for (const aluno of state.alunos) await window.FirebaseSync.salvarDadosFirebase("alunos", aluno, aluno.id);
      if (state.eletivas) for (const eletiva of state.eletivas) await window.FirebaseSync.salvarDadosFirebase("eletivas", eletiva, eletiva.id);
      if (state.matriculas) for (const mat of state.matriculas) await window.FirebaseSync.salvarDadosFirebase("matriculas", mat, mat.id);
      if (state.registros) for (const reg of state.registros) await window.FirebaseSync.salvarDadosFirebase("registros", reg, reg.id);
      if (state.notas) for (const nota of state.notas) await window.FirebaseSync.salvarDadosFirebase("notas", nota, nota.id);
      if (state.configTempos) await window.FirebaseSync.salvarDadosFirebase("config_tempos", state.configTempos);
      if (state.liberacaoNotas) await window.FirebaseSync.salvarDadosFirebase("liberacao_notas", state.liberacaoNotas);
    }
    if (typeof carregarEletivas === "function") carregarEletivas();
    if (typeof carregarProfessores === "function") carregarProfessores();
    if (typeof filtrarEstudantes === "function") filtrarEstudantes();
    carregarAbaDados();
    showToast("✅ Backup restaurado com sucesso!", "success");
  } catch (error) { console.error("Erro ao restaurar backup:", error); showToast("Erro ao restaurar backup: " + error.message, "error"); } finally { mostrarLoader(false); }
}

// ========== MODAL DE CONFLITOS DETALHADOS ==========
window.abrirModalConflitos = function () {
  console.log("⚠️ Abrindo modal de conflitos");
  const container = document.getElementById("conflitosDetalhadosContainer");
  if (!container) return;
  const conflitos = state.conflitos?.pendentes || [];
  if (conflitos.length === 0) { container.innerHTML = '<p class="empty-state">Nenhum conflito pendente</p>'; document.getElementById("modalConflitos").classList.add("active"); return; }
  let html = "";
  conflitos.forEach((conflito, index) => {
    const aluno = state.alunos?.find((a) => a.id === parseInt(conflito.alunoId) || a.codigoSige === conflito.alunoId);
    const nomeAluno = aluno ? aluno.nome : `Aluno ID: ${conflito.alunoId}`;
    const turmaAluno = aluno ? aluno.turmaOrigem : "Turma desconhecida";
    const tipoClasse = conflito.tipo === "fixa" ? "fixa" : "mista";
    const tipoTexto = conflito.tipo === "fixa" ? "FIXA x FIXA" : "MISTA x MISTA";
    const corBorda = conflito.tipo === "fixa" ? "var(--danger)" : "var(--warning)";
    html += `<div class="conflito-item ${tipoClasse}" style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-white); border-radius: 8px; border-left: 4px solid ${corBorda}; box-shadow: var(--shadow);"><h4 style="margin: 0 0 0.5rem 0; color: var(--text-dark);">⚠️ Conflito #${index + 1} - ${tipoTexto}</h4><div style="margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-light); border-radius: 4px;"><p><strong>👤 Aluno:</strong> ${escapeHtml(nomeAluno)} (${turmaAluno} - SIGE: ${aluno?.codigoSige || "N/A"})</p><p><strong>⏰ Tempo:</strong> ${conflito.tempo || "N/A"}</p></div><p style="margin: 0.5rem 0 0.2rem 0; font-weight: bold;">📚 Eletivas em conflito:</p><ul style="margin: 0 0 0.5rem 1.5rem;">${(conflito.eletivas || []).map((e) => { const eletiva = state.eletivas?.find((el) => el.id === e.eletivaId || el.codigo === e.eletivaId); const prof = state.professores?.find((p) => p.id === eletiva?.professorId)?.nome || "N/A"; return `<li><strong>${e.nome || eletiva?.nome}</strong> (${eletiva?.codigo || "N/A"}) - Prof. ${prof}</li>`; }).join("")}</ul><div style="margin-top: 0.5rem; padding: 0.5rem; background: ${corBorda}20; border-radius: 4px;"><p style="margin: 0; font-size: 0.9rem;"><strong>💡 Recomendação:</strong> ${conflito.tipo === "fixa" ? "Eletivas FIXAS exigem que o aluno esteja em apenas UMA por tempo. Remova uma das matrículas." : "Eletivas MISTAS também permitem apenas UMA por tempo. Remova uma das matrículas."}</p></div></div>`;
  });
  container.innerHTML = html;
  document.getElementById("modalConflitos").classList.add("active");
};

window.fecharModalConflitos = function () { document.getElementById("modalConflitos").classList.remove("active"); };

// ========== MUDAR ABA GESTÃO ==========
window.mudarTabGestao = function (tab) {
  document.querySelectorAll(".gestao-tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".gestao-tab-btn").forEach((btn) => { if (btn.getAttribute("onclick")?.includes(`'${tab}'`)) { btn.classList.add("active"); } });
  document.querySelectorAll(".gestao-tab-pane").forEach((pane) => pane.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
  if (tab === "professores") carregarProfessores();
  else if (tab === "eletivas") carregarEletivas();
  else if (tab === "estudantes") filtrarEstudantes();
  else if (tab === "dados") carregarAbaDados();
};
