// js/gestor.js - Lógica do gestor
console.log("👔 gestor.js carregado");

let gestorAtual = null;
let todasEletivas = [];
let tempoSelecionado = "TODOS";
let termoBusca = "";

// Variáveis para aba registros
let filtroTipoRegistros = "todas";
let filtroProfessorRegistros = "";
let filtroDiaRegistros = "";
let buscaRegistros = "";
let eletivaSelecionadaParaData = null;
let dataSelecionada = null;
let eletivaSelecionadaParaImpressao = null;

// Mapeamento de dia da semana para tempo
const diaParaTempo = {
  "segunda": "T1",
  "terca": "T3",
  "quarta": "T5",
  "quinta": "T2",
  "sexta": "T4",
};

const tempoParaDia = {
  "T1": "SEGUNDA-FEIRA",
  "T2": "QUINTA-FEIRA",
  "T3": "TERÇA-FEIRA",
  "T4": "SEXTA-FEIRA",
  "T5": "QUARTA-FEIRA",
};

// Dias da semana
const diasSemana = ["segunda", "terca", "quarta", "quinta", "sexta"];

const nomesDias = {
  segunda: "SEGUNDA-FEIRA (T1)",
  terca: "TERÇA-FEIRA (T3)",
  quarta: "QUARTA-FEIRA (T5)",
  quinta: "QUINTA-FEIRA (T2)",
  sexta: "SEXTA-FEIRA (T4)",
};

// Função para obter tempo a partir do horário
function getTempoFromHorario(horario) {
  if (!horario) return null;
  if (horario.codigoTempo) {
    return horario.codigoTempo;
  }
  if (horario.diaSemana) {
    const dia = horario.diaSemana.toLowerCase();
    if (dia === "segunda") return "T1";
    if (dia === "terca") return "T3";
    if (dia === "quarta") return "T5";
    if (dia === "quinta") return "T2";
    if (dia === "sexta") return "T4";
  }
  return null;
}

document.addEventListener("DOMContentLoaded", async function () {
  console.log("👔 Inicializando página do gestor...");

  carregarTheme();

  const gestorStorage = localStorage.getItem("gestor_atual");
  if (!gestorStorage) {
    window.location.href = "selecionar-gestor.html";
    return;
  }

  gestorAtual = JSON.parse(gestorStorage);
  console.log("👤 Gestor:", gestorAtual.nome, "Perfil:", gestorAtual.perfil);

  // Inicializar Firebase
  if (window.FirebaseConfig && typeof window.FirebaseConfig.initFirebase === "function") {
    console.log("🔥 Inicializando Firebase...");
    window.FirebaseConfig.initFirebase();
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (typeof carregarEstado === "function") {
    carregarEstado();
    todasEletivas = state.eletivas || [];
    console.log("📚 Eletivas carregadas:", todasEletivas.length);
  }

  document.getElementById("userName").textContent = gestorAtual.nome;

  const roleMap = {
    GESTOR: "Administrador",
    SECRETARIA: "Secretaria",
    GESTOR_PROFESSOR: "Gestor/Professor",
  };
  document.getElementById("userRole").textContent = roleMap[gestorAtual.perfil] || "Gestor";

  // Carregar dados iniciais
  await carregarEstatisticas();
  inicializarFiltrosRegistros();
  await carregarCardsRegistros();
});

// ========== FUNÇÕES DE UTILIDADE ==========

function mostrarLoaderGestor(mostrar) {
  const loader = document.getElementById("gestorLoader");
  if (loader) {
    if (mostrar) {
      loader.classList.add("active");
    } else {
      loader.classList.remove("active");
    }
  }
}

function formatarData(dataString) {
  if (!dataString) return "";
  if (dataString.includes("-")) {
    const [ano, mes, dia] = dataString.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return dataString;
}

window.mudarTabGestor = function (tab) {
  document.querySelectorAll(".gestor-tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".gestor-tab-btn").forEach((btn) => {
    if (btn.getAttribute("onclick")?.includes(`'${tab}'`)) {
      btn.classList.add("active");
    }
  });

  document.querySelectorAll(".gestor-tab-pane").forEach((pane) => pane.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");

  if (tab === "estatisticas") {
    carregarEstatisticas();
  } else if (tab === "registros") {
    inicializarFiltrosRegistros();
    carregarCardsRegistros();
  }
};

window.fecharModalConfirmacao = function () {
  document.getElementById("modalConfirmacao").classList.remove("active");
};

window.fazerLogout = function () {
  localStorage.removeItem("gestor_atual");
  window.location.href = "index.html";
};

// ========== FUNÇÕES DE CÁLCULO DE ESTATÍSTICAS ==========

function calcularAusenciasEletiva(eletivaId) {
  const registros = state.registros?.filter((r) => r.eletivaId === eletivaId) || [];
  let total = 0;

  registros.forEach((reg) => {
    if (reg.frequencia?.ausentes) {
      total += reg.frequencia.ausentes.length;
    }
  });

  return total;
}

function calcularMediaEletiva(eletivaId) {
  const notasRegistro = state.notas?.find((n) => n.eletivaId === eletivaId && n.semestre === "1/2026");

  if (!notasRegistro?.notas || notasRegistro.notas.length === 0) {
    return null;
  }

  const soma = notasRegistro.notas.reduce((acc, n) => acc + n.nota, 0);
  return soma / notasRegistro.notas.length;
}

function calcularEstatisticasGerais() {
  const eletivas = state.eletivas || [];
  const totalEletivas = eletivas.length;

  const alunosPorSIGE = new Set();
  const alunos = state.alunos || [];

  alunos.forEach((aluno) => {
    if (aluno.codigoSige) {
      alunosPorSIGE.add(aluno.codigoSige);
    } else {
      alunosPorSIGE.add(aluno.id);
    }
  });

  const totalEstudantes = alunosPorSIGE.size;

  let totalAusencias = 0;
  (state.registros || []).forEach((r) => {
    if (r.frequencia?.ausentes) {
      totalAusencias += r.frequencia.ausentes.length;
    }
  });

  let somaMedias = 0;
  let eletivasComNota = 0;

  eletivas.forEach((e) => {
    const media = calcularMediaEletiva(e.id);
    if (media !== null) {
      somaMedias += media;
      eletivasComNota++;
    }
  });

  const mediaGeral = eletivasComNota > 0 ? (somaMedias / eletivasComNota).toFixed(1) : "N/A";

  return { totalEletivas, totalEstudantes, totalAusencias, mediaGeral };
}

// ========== FUNÇÕES DA ABA ESTATÍSTICAS ==========

window.filtrarPorTempo = function (tempo) {
  tempoSelecionado = tempo;

  document.querySelectorAll(".tempo-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.textContent.trim() === tempo) {
      btn.classList.add("active");
    }
  });

  carregarCardsEletivas();
};

window.filtrarEletivas = function () {
  termoBusca = document.getElementById("buscaEletiva")?.value || "";
  carregarCardsEletivas();
};

window.limparFiltros = function () {
  tempoSelecionado = "TODOS";
  termoBusca = "";

  document.getElementById("buscaEletiva").value = "";

  document.querySelectorAll(".tempo-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.textContent.trim() === "TODOS") {
      btn.classList.add("active");
    }
  });

  carregarCardsEletivas();
};

async function carregarEstatisticas() {
  console.log("📊 Carregando estatísticas...");

  // Sincronizar com Firebase
  if (window.FirebaseSync && window.FirebaseSync.carregarDadosFirebase) {
    try {
      if (window.FirebaseConfig && !window.FirebaseConfig.isInitialized) {
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
    } catch (error) {
      console.error("❌ Erro ao sincronizar com Firebase:", error);
    }
  }

  todasEletivas = state.eletivas || [];

  const stats = calcularEstatisticasGerais();

  document.getElementById("totalEletivas").textContent = stats.totalEletivas;
  document.getElementById("totalEstudantes").textContent = stats.totalEstudantes;
  document.getElementById("totalAusencias").textContent = stats.totalAusencias;
  document.getElementById("mediaGeral").textContent = stats.mediaGeral;

  carregarCardsEletivas();
}

function carregarCardsEletivas() {
  const container = document.getElementById("eletivasGrid");
  if (!container) return;

  let eletivasFiltradas = todasEletivas;

  if (tempoSelecionado !== "TODOS") {
    eletivasFiltradas = eletivasFiltradas.filter((e) => {
      const tempo = getTempoFromHorario(e.horario);
      return tempo === tempoSelecionado;
    });
  }

  if (termoBusca.trim() !== "") {
    const termo = termoBusca.toLowerCase();
    eletivasFiltradas = eletivasFiltradas.filter((e) => {
      const professor = state.professores?.find((p) => p.id === e.professorId)?.nome || "";
      return (
        e.nome?.toLowerCase().includes(termo) ||
        e.codigo?.toLowerCase().includes(termo) ||
        professor.toLowerCase().includes(termo)
      );
    });
  }

  if (eletivasFiltradas.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma eletiva encontrada</p>';
    return;
  }

  container.innerHTML = "";

  eletivasFiltradas.forEach((eletiva) => {
    const professor = state.professores?.find((p) => p.id === eletiva.professorId)?.nome || "Não atribuído";
    const tempo = getTempoFromHorario(eletiva.horario) || "N/A";

    const matriculas = state.matriculas?.filter((m) => m.eletivaId === eletiva.id) || [];
    const totalAlunos = matriculas.length;
    const totalAusencias = calcularAusenciasEletiva(eletiva.id);
    const media = calcularMediaEletiva(eletiva.id);
    const mediaDisplay = media !== null ? media.toFixed(1) : "N/A";

    const card = document.createElement("div");
    card.className = "eletiva-card-estatistica";

    card.innerHTML = `
      <div class="eletiva-card-header">
        <h3>${eletiva.nome}</h3>
        <span class="codigo">${eletiva.codigo}</span>
      </div>
      <div class="eletiva-info-linha">
        <i class="fas fa-user"></i> ${professor} | <i class="fas fa-clock"></i> Tempo: ${tempo}
      </div>
      <div class="eletiva-stats">
        <div class="stat-item">
          <div class="stat-valor">${totalAlunos}</div>
          <div class="stat-label">ALUNOS</div>
        </div>
        <div class="stat-item">
          <div class="stat-valor">${totalAusencias}</div>
          <div class="stat-label">AUSÊNCIAS</div>
        </div>
        <div class="stat-item">
          <div class="stat-valor">${mediaDisplay}</div>
          <div class="stat-label">MÉDIA</div>
        </div>
      </div>
      <button class="btn-primary btn-small" style="width: 100%;" onclick="verDetalhesEletiva(${eletiva.id})">
        <i class="fas fa-eye"></i> VER DETALHES
      </button>
    `;

    container.appendChild(card);
  });
}

window.verDetalhesEletiva = function (eletivaId) {
  mostrarLoaderGestor(true);

  setTimeout(() => {
    try {
      const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
      if (!eletiva) {
        mostrarLoaderGestor(false);
        return;
      }

      const professor = state.professores?.find((p) => p.id === eletiva.professorId)?.nome || "Não atribuído";
      const tempo = getTempoFromHorario(eletiva.horario) || "N/A";

      const matriculas = state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
      const alunos = state.alunos?.filter((a) => matriculas.some((m) => m.alunoId === a.id)).sort((a, b) => a.nome.localeCompare(b.nome)) || [];

      const totalAlunos = alunos.length;
      const totalAusencias = calcularAusenciasEletiva(eletivaId);
      const media = calcularMediaEletiva(eletivaId);
      const mediaDisplay = media !== null ? media.toFixed(1) : "N/A";

      const registros = state.registros?.filter((r) => r.eletivaId === eletivaId) || [];
      const ausenciasPorAluno = {};

      registros.forEach((reg) => {
        if (reg.frequencia?.ausentes) {
          reg.frequencia.ausentes.forEach((codigo) => {
            const aluno = alunos.find((a) => a.codigoSige === codigo);
            if (aluno) {
              ausenciasPorAluno[aluno.id] = (ausenciasPorAluno[aluno.id] || 0) + 1;
            }
          });
        }
      });

      const notasRegistro = state.notas?.find((n) => n.eletivaId === eletivaId && n.semestre === "1/2026");
      const notasPorAluno = {};
      if (notasRegistro?.notas) {
        notasRegistro.notas.forEach((n) => {
          notasPorAluno[n.alunoId] = n.nota;
        });
      }

      let tabelaHTML = `
        <table class="alunos-table">
          <thead>
            <tr><th>NOME</th><th>TURMA</th><th>SIGE</th><th>AUSÊNCIAS</th><th>NOTA</th></tr>
          </thead>
          <tbody>
      `;

      alunos.forEach((aluno) => {
        const ausencias = ausenciasPorAluno[aluno.id] || 0;
        const nota = notasPorAluno[aluno.id];
        const notaDisplay = nota !== undefined ? nota.toFixed(1) : "-";

        tabelaHTML += `
          <tr><td>${aluno.nome}</td><td>${aluno.turmaOrigem}</td><td>${aluno.codigoSige}</td>
          <td><span class="badge-falta">${ausencias}</span></td><td><span class="badge-nota">${notaDisplay}</span></td></tr>
        `;
      });

      tabelaHTML += `</tbody></table>`;

      document.getElementById("modalTitulo").textContent = `👥 ALUNOS - ${eletiva.nome}`;
      document.getElementById("modalInfo").innerHTML = `
        <p><strong>Professor:</strong> ${professor} | <strong>Tempo:</strong> ${tempo}</p>
        <p><strong>Total de Alunos:</strong> ${totalAlunos} | <strong>Total Ausências:</strong> ${totalAusencias} | <strong>Média:</strong> ${mediaDisplay}</p>
      `;
      document.getElementById("modalTabelaContainer").innerHTML = tabelaHTML;

      document.getElementById("btnImprimirLista").onclick = () =>
        imprimirListaAlunos(eletiva, alunos, ausenciasPorAluno, notasPorAluno, professor, tempo);

      document.getElementById("modalDetalhesEletiva").classList.add("active");
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
    } finally {
      mostrarLoaderGestor(false);
    }
  }, 50);
};

window.fecharModalDetalhes = function () {
  document.getElementById("modalDetalhesEletiva").classList.remove("active");
};

// ========== FUNÇÕES DA ABA VER REGISTROS ==========

function inicializarFiltrosRegistros() {
  carregarSelectProfessoresRegistros();
  carregarSelectDiasRegistros();
}

function carregarSelectProfessoresRegistros() {
  const select = document.getElementById("filtroProfessorRegistros");
  if (!select) return;

  const professores = state.professores?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  select.innerHTML = '<option value="">Todos os professores</option>';

  professores.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.nome;
    select.appendChild(option);
  });
}

function carregarSelectDiasRegistros() {
  const select = document.getElementById("filtroDiaRegistros");
  if (!select) return;

  select.innerHTML = '<option value="">Todos os dias</option>';

  diasSemana.forEach((dia) => {
    const option = document.createElement("option");
    option.value = dia;
    option.textContent = nomesDias[dia];
    select.appendChild(option);
  });
}

window.toggleFiltroRegistros = function () {
  const tipo = document.getElementById("filtroTipoRegistros")?.value;

  document.getElementById("filtroProfessorContainer").style.display = tipo === "professor" ? "block" : "none";
  document.getElementById("filtroDiaContainer").style.display = tipo === "dia" ? "block" : "none";

  aplicarFiltrosRegistros();
};

window.aplicarFiltrosRegistros = function () {
  buscaRegistros = document.getElementById("buscaRegistros")?.value?.toLowerCase() || "";
  filtroTipoRegistros = document.getElementById("filtroTipoRegistros")?.value || "todas";
  filtroProfessorRegistros = document.getElementById("filtroProfessorRegistros")?.value || "";
  filtroDiaRegistros = document.getElementById("filtroDiaRegistros")?.value || "";

  carregarCardsRegistros();
};

window.limparFiltrosRegistros = function () {
  document.getElementById("buscaRegistros").value = "";
  document.getElementById("filtroTipoRegistros").value = "todas";
  document.getElementById("filtroProfessorRegistros").value = "";
  document.getElementById("filtroDiaRegistros").value = "";

  document.getElementById("filtroProfessorContainer").style.display = "none";
  document.getElementById("filtroDiaContainer").style.display = "none";

  buscaRegistros = "";
  filtroTipoRegistros = "todas";
  filtroProfessorRegistros = "";
  filtroDiaRegistros = "";

  carregarCardsRegistros();
};

function filtrarEletivasRegistros() {
  let eletivas = state.eletivas || [];

  if (filtroTipoRegistros === "professor" && filtroProfessorRegistros) {
    eletivas = eletivas.filter((e) => e.professorId === parseInt(filtroProfessorRegistros));
  }

  if (filtroTipoRegistros === "dia" && filtroDiaRegistros) {
    eletivas = eletivas.filter((e) => e.horario?.diaSemana?.toLowerCase() === filtroDiaRegistros);
  }

  if (buscaRegistros) {
    eletivas = eletivas.filter((e) => {
      const professor = state.professores?.find((p) => p.id === e.professorId)?.nome || "";
      return (
        e.nome?.toLowerCase().includes(buscaRegistros) ||
        e.codigo?.toLowerCase().includes(buscaRegistros) ||
        professor.toLowerCase().includes(buscaRegistros)
      );
    });
  }

  return eletivas;
}

async function carregarCardsRegistros() {
  const container = document.getElementById("registrosCardsGrid");
  if (!container) return;

  // Sincronizar com Firebase
  if (window.FirebaseSync && window.FirebaseSync.carregarDadosFirebase) {
    try {
      if (window.FirebaseConfig && !window.FirebaseConfig.isInitialized) {
        window.FirebaseConfig.initFirebase();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const registrosFirebase = await window.FirebaseSync.carregarDadosFirebase("registros");
      if (registrosFirebase && registrosFirebase.length > 0) {
        state.registros = registrosFirebase;
        localStorage.setItem(CONFIG.storageKeys.registros, JSON.stringify(registrosFirebase));
        console.log(`✅ Sincronizados ${registrosFirebase.length} registros do Firebase`);
      }
    } catch (error) {
      console.error("❌ Erro ao sincronizar registros:", error);
    }
  }

  const eletivas = filtrarEletivasRegistros();

  const contador = document.getElementById("resultadosContadorRegistros");
  if (contador) {
    contador.textContent = `(${eletivas.length} eletivas encontradas)`;
  }

  if (eletivas.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma eletiva encontrada</p>';
    return;
  }

  container.innerHTML = "";

  eletivas.sort((a, b) => a.nome.localeCompare(b.nome));

  eletivas.forEach((eletiva) => {
    const professor = state.professores?.find((p) => p.id === eletiva.professorId)?.nome || "Não atribuído";
    const tempo = getTempoFromHorario(eletiva.horario) || "N/A";

    const registros = state.registros?.filter((r) => r.eletivaId === eletiva.id).sort((a, b) => b.data.localeCompare(a.data)) || [];
    const notas = state.notas?.filter((n) => n.eletivaId === eletiva.id) || [];

    let mediaDisplay = "N/A";
    if (notas.length > 0) {
      const todasNotas = [];
      notas.forEach((n) => {
        if (n.notas) {
          n.notas.forEach((nota) => todasNotas.push(nota.nota));
        }
      });
      if (todasNotas.length > 0) {
        const soma = todasNotas.reduce((a, b) => a + b, 0);
        mediaDisplay = (soma / todasNotas.length).toFixed(1);
      }
    }

    const card = document.createElement("div");
    card.className = "eletiva-card-estatistica";

    let registrosHTML = '<div style="margin: 0.5rem 0; font-weight: bold;">📅 ÚLTIMOS REGISTROS:</div>';

    registros.slice(0, 3).forEach((reg) => {
      const presentes = reg.frequencia?.presentes?.length || 0;
      const ausentes = reg.frequencia?.ausentes?.length || 0;
      const dataFormatada = formatarData(reg.data);
      registrosHTML += `<div style="font-size: 0.9rem; padding: 0.2rem 0;">• ${dataFormatada} - Frequência (${presentes} presentes, ${ausentes} ausentes)</div>`;
    });

    notas.slice(0, 1).forEach((nota) => {
      const mediaNota = nota.notas?.length > 0 ? (nota.notas.reduce((acc, n) => acc + n.nota, 0) / nota.notas.length).toFixed(1) : "0.0";
      registrosHTML += `<div style="font-size: 0.9rem; padding: 0.2rem 0;">• ${nota.semestre} - Notas (média: ${mediaNota})</div>`;
    });

    if (registros.length === 0 && notas.length === 0) {
      registrosHTML += '<div style="font-size: 0.9rem; color: var(--text-light);">Nenhum registro encontrado</div>';
    }

    card.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <h3 style="color: var(--primary); margin: 0 0 0.3rem 0;">${eletiva.nome} | Código: ${eletiva.codigo}</h3>
        <div style="font-size: 0.95rem; color: var(--text-light);">
          <i class="fas fa-user"></i> ${professor} | 
          <i class="fas fa-clock"></i> ${eletiva.horario?.diaSemana} ${tempo} | 
          <i class="fas fa-users"></i> Turmas: ${eletiva.turmaOrigem || "Várias"} |
          <i class="fas fa-chart-line"></i> Média: ${mediaDisplay}
        </div>
      </div>
      
      ${registrosHTML}
      
      <div style="margin-top: 1rem;">
        <button class="btn-primary btn-small" style="width: 100%;" onclick="abrirModalOpcoesImpressao(${eletiva.id})">
          <i class="fas fa-print"></i> IMPRIMIR
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

// ========== FUNÇÕES DO MODAL DE OPÇÕES DE IMPRESSÃO ==========

window.abrirModalOpcoesImpressao = function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  eletivaSelecionadaParaImpressao = eletiva;

  const professor = state.professores?.find((p) => p.id === eletiva.professorId)?.nome || "Não atribuído";

  document.getElementById("modalImpressaoTitulo").textContent = `🖨️ OPÇÕES DE IMPRESSÃO`;
  document.getElementById("modalImpressaoEletiva").textContent = `${eletiva.nome} (${eletiva.codigo}) - Prof. ${professor}`;

  document.getElementById("modalOpcoesImpressao").classList.add("active");
};

window.fecharModalOpcoesImpressao = function () {
  document.getElementById("modalOpcoesImpressao").classList.remove("active");
  eletivaSelecionadaParaImpressao = null;
};

window.selecionarOpcaoImpressao = function (opcao) {
  console.log("🎯 Opção selecionada:", opcao);

  if (!eletivaSelecionadaParaImpressao) {
    console.error("❌ Nenhuma eletiva selecionada!");
    showToast("Erro: eletiva não selecionada", "error");
    fecharModalOpcoesImpressao();
    return;
  }

  if (!eletivaSelecionadaParaImpressao.id) {
    console.error("❌ ID da eletiva inválido!");
    showToast("Erro: ID da eletiva inválido", "error");
    fecharModalOpcoesImpressao();
    return;
  }

  const eletivaId = eletivaSelecionadaParaImpressao.id;

  fecharModalOpcoesImpressao();

  setTimeout(() => {
    switch (opcao) {
      case "listaBranco":
        window.imprimirListaBrancoGestor(eletivaId);
        break;
      case "registrosData":
        window.abrirSelecaoData(eletivaId);
        break;
      case "boletim":
        window.imprimirBoletimGestor(eletivaId);
        break;
      default:
        console.error("❌ Opção desconhecida:", opcao);
    }
  }, 100);
};

// ========== FUNÇÕES DE IMPRESSÃO DA ABA REGISTROS ==========

window.imprimirListaBrancoGestor = async function (eletivaId) {
  console.log("🖨️ Chamando imprimirListaBrancoGestor para eletiva:", eletivaId);

  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) {
    showToast("Eletiva não encontrada", "error");
    return;
  }

  const professor = state.professores?.find((p) => p.id === eletiva.professorId)?.nome || "Não atribuído";

  const matriculas = state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
  const alunos = state.alunos?.filter((a) => matriculas.some((m) => m.alunoId === a.id)).sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  if (alunos.length === 0) {
    showToast("Esta eletiva não possui alunos cadastrados", "warning");
    return;
  }

  mostrarLoaderGestor(true);

  try {
    await gerarPDFListaBrancoGestor(eletiva, alunos, professor);
    showToast("Lista de frequência gerada com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao gerar lista:", error);
    showToast("Erro ao gerar lista: " + error.message, "error");
  } finally {
    mostrarLoaderGestor(false);
  }
};

async function gerarPDFListaBrancoGestor(eletiva, alunos, professorNome) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window.jspdf === "undefined") {
        reject("Biblioteca jsPDF não encontrada");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      let paginaAtual = 1;
      let y = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;

      function adicionarCabecalho() {
        let yCabecalho = 10;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 7;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 7;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`LISTA DE FREQUÊNCIA - ${eletiva.nome}`, pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 6;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Professor: ${professorNome} | Total: ${alunos.length} alunos`, pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 6;

        doc.setFontSize(10);
        doc.text(`Data: ________ / ________ / __________`, pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 8;
        return yCabecalho;
      }

      function adicionarCabecalhoTabela(yPos) {
        const colWidths = [75, 20, 20, 25, 25];
        const posNota = pageWidth - margin - colWidths[4];
        const posAus = posNota - colWidths[3] - 2;
        const posSige = posAus - colWidths[2] - 2;
        const posTurma = posSige - colWidths[1] - 2;
        const posNome = margin;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");

        doc.setFillColor(240, 240, 240);
        doc.rect(margin - 1, yPos - 5, pageWidth - 2 * margin + 2, 6, "F");

        doc.text("NOME", posNome, yPos);
        doc.text("TURMA", posTurma, yPos);
        doc.text("SIGE", posSige, yPos);
        doc.text("STATUS", posAus, yPos);
        doc.text("OBS", posNota, yPos);

        yPos += 4;
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 4;
        return { yPos, posNome, posTurma, posSige, posAus, posNota, colWidths };
      }

      y = adicionarCabecalho();
      let tabelaInfo = adicionarCabecalhoTabela(y);
      y = tabelaInfo.yPos;

      const posNome = tabelaInfo.posNome;
      const posTurma = tabelaInfo.posTurma;
      const posSige = tabelaInfo.posSige;
      const posAus = tabelaInfo.posAus;
      const posNota = tabelaInfo.posNota;
      const colWidths = tabelaInfo.colWidths;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const alturaPorLinha = 5.5;
      const linhasPorPagina = Math.floor((pageHeight - y - 25) / alturaPorLinha);

      let alunosProcessados = 0;
      let maxPaginas = 2;

      while (alunosProcessados < alunos.length && paginaAtual <= maxPaginas) {
        const alunosNestaPagina = Math.min(linhasPorPagina, alunos.length - alunosProcessados);

        for (let i = 0; i < alunosNestaPagina; i++) {
          const aluno = alunos[alunosProcessados + i];
          doc.text(aluno.nome, posNome, y);
          doc.text(aluno.turmaOrigem, posTurma, y);
          doc.text(aluno.codigoSige, posSige, y);

          const ausX = posAus + colWidths[3] / 2;
          const notaX = posNota + colWidths[4] / 2;

          doc.text("_______", ausX, y, { align: "center" });
          doc.text("___", notaX, y, { align: "center" });

          y += alturaPorLinha;
        }

        alunosProcessados += alunosNestaPagina;

        if (alunosProcessados < alunos.length && paginaAtual < maxPaginas) {
          doc.addPage();
          paginaAtual++;
          y = adicionarCabecalho();
          tabelaInfo = adicionarCabecalhoTabela(y);
          y = tabelaInfo.yPos;
        }
      }

      if (alunosProcessados < alunos.length) {
        doc.setTextColor(255, 0, 0);
        doc.setFontSize(8);
        doc.text(`⚠️ Lista parcial. ${alunos.length - alunosProcessados} alunos não listados.`, margin, y);
        doc.setTextColor(0, 0, 0);
        y += 6;
      }

      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Registro da Aula:", margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      for (let i = 0; i < 3; i++) {
        doc.text("_".repeat(100), margin, y);
        y += 5;
      }

      y += 4;

      const yAssinaturas = pageHeight - 12;

      doc.line(margin, yAssinaturas, margin + 60, yAssinaturas);
      doc.line(pageWidth - margin - 60, yAssinaturas, pageWidth - margin, yAssinaturas);

      doc.setFontSize(9);
      doc.text("Assinatura do Professor", margin, yAssinaturas + 4);
      doc.text("Assinatura do Gestor", pageWidth - margin - 60, yAssinaturas + 4);

      const pdfBlob = doc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");

      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

window.abrirSelecaoData = function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  eletivaSelecionadaParaData = eletiva;

  const registros = state.registros?.filter((r) => r.eletivaId === eletivaId).sort((a, b) => b.data.localeCompare(a.data)) || [];

  if (registros.length === 0) {
    showToast("Não há registros para esta eletiva", "warning");
    return;
  }

  let datasHTML = '<div style="padding: 0.5rem;">';
  registros.forEach((reg) => {
    const presentes = reg.frequencia?.presentes?.length || 0;
    const dataFormatada = formatarData(reg.data);
    datasHTML += `
      <div style="padding: 0.5rem; border-bottom: 1px solid var(--bg-gray); cursor: pointer;" onclick="selecionarData('${reg.data}')">
        <input type="radio" name="dataSelecionada" value="${reg.data}" id="data_${reg.data}">
        <label for="data_${reg.data}">📅 ${dataFormatada} - Frequência (${presentes} presentes)</label>
      </div>
    `;
  });
  datasHTML += "</div>";

  document.getElementById("modalDataTitulo").textContent = `📅 SELECIONAR DATA - ${eletiva.nome}`;
  document.getElementById("modalDataEletiva").textContent = `Eletiva: ${eletiva.nome} | Código: ${eletiva.codigo}`;
  document.getElementById("listaDatasContainer").innerHTML = datasHTML;

  document.getElementById("modalSelecionarData").classList.add("active");
};

window.selecionarData = function (data) {
  dataSelecionada = data;
  document.querySelectorAll('input[name="dataSelecionada"]').forEach((r) => (r.checked = false));
  const radio = document.getElementById(`data_${data}`);
  if (radio) radio.checked = true;
};

window.confirmarSelecaoData = function () {
  if (!dataSelecionada) {
    showToast("Selecione uma data", "warning");
    return;
  }

  if (!eletivaSelecionadaParaData) return;

  fecharModalSelecionarData();
  imprimirRegistroPorDataGestor(eletivaSelecionadaParaData.id, dataSelecionada);
};

window.fecharModalSelecionarData = function () {
  document.getElementById("modalSelecionarData").classList.remove("active");
  dataSelecionada = null;
};

window.imprimirRegistroPorDataGestor = async function (eletivaId, data) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) {
    showToast("Eletiva não encontrada", "error");
    return;
  }

  const registro = state.registros?.find((r) => r.eletivaId === eletivaId && r.data === data);
  if (!registro) {
    showToast("Registro não encontrado", "error");
    return;
  }

  const professor = state.professores?.find((p) => p.id === eletiva.professorId)?.nome || "Não atribuído";

  const matriculas = state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
  const alunos = state.alunos?.filter((a) => matriculas.some((m) => m.alunoId === a.id)).sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  mostrarLoaderGestor(true);

  try {
    await gerarPDFRegistroDataGestor(eletiva, alunos, registro, professor);
    showToast("Registro gerado com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao gerar registro:", error);
    showToast("Erro ao gerar registro: " + error.message, "error");
  } finally {
    mostrarLoaderGestor(false);
  }
};

async function gerarPDFRegistroDataGestor(eletiva, alunos, registro, professorNome) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window.jspdf === "undefined") {
        reject("Biblioteca jsPDF não encontrada");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      let paginaAtual = 1;
      let y = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;

      const presentesSet = new Set(registro.frequencia?.presentes || []);

      function adicionarCabecalho() {
        let yCabecalho = 10;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 7;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 7;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`REGISTRO DE FREQUÊNCIA - ${eletiva.nome}`, pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 6;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        const dataFormatada = formatarData(registro.data);
        doc.text(`Professor: ${professorNome} | Data: ${dataFormatada} | Total: ${alunos.length} alunos`, pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 8;
        return yCabecalho;
      }

      function adicionarCabecalhoTabela(yPos) {
        const colWidths = [70, 18, 18, 20, 25];
        const posObs = pageWidth - margin - colWidths[4];
        const posStatus = posObs - colWidths[3] - 2;
        const posSige = posStatus - colWidths[2] - 2;
        const posTurma = posSige - colWidths[1] - 2;
        const posNome = margin;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");

        doc.setFillColor(240, 240, 240);
        doc.rect(margin - 1, yPos - 5, pageWidth - 2 * margin + 2, 6, "F");

        doc.text("NOME", posNome, yPos);
        doc.text("TURMA", posTurma, yPos);
        doc.text("SIGE", posSige, yPos);
        doc.text("STATUS", posStatus, yPos);
        doc.text("TEMPO", posObs, yPos);

        yPos += 4;
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 4;
        return { yPos, posNome, posTurma, posSige, posStatus, posObs, colWidths };
      }

      y = adicionarCabecalho();
      let tabelaInfo = adicionarCabecalhoTabela(y);
      y = tabelaInfo.yPos;

      const posNome = tabelaInfo.posNome;
      const posTurma = tabelaInfo.posTurma;
      const posSige = tabelaInfo.posSige;
      const posStatus = tabelaInfo.posStatus;
      const posObs = tabelaInfo.posObs;
      const colWidths = tabelaInfo.colWidths;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const alturaPorLinha = 5.5;
      const linhasPorPagina = Math.floor((pageHeight - y - 35) / alturaPorLinha);

      let alunosProcessados = 0;
      let maxPaginas = 2;

      while (alunosProcessados < alunos.length && paginaAtual <= maxPaginas) {
        const alunosNestaPagina = Math.min(linhasPorPagina, alunos.length - alunosProcessados);

        for (let i = 0; i < alunosNestaPagina; i++) {
          const aluno = alunos[alunosProcessados + i];
          const isPresente = presentesSet.has(aluno.codigoSige);
          const status = isPresente ? "✅" : "❌";
          const tempo = isPresente ? eletiva.horario?.codigoTempo || "T1" : "-";

          doc.text(aluno.nome, posNome, y);
          doc.text(aluno.turmaOrigem, posTurma, y);
          doc.text(aluno.codigoSige, posSige, y);

          const statusX = posStatus + colWidths[3] / 2;
          const obsX = posObs + colWidths[4] / 2;

          doc.text(status, statusX, y, { align: "center" });
          doc.text(tempo, obsX, y, { align: "center" });

          y += alturaPorLinha;
        }

        alunosProcessados += alunosNestaPagina;

        if (alunosProcessados < alunos.length && paginaAtual < maxPaginas) {
          doc.addPage();
          paginaAtual++;
          y = adicionarCabecalho();
          tabelaInfo = adicionarCabecalhoTabela(y);
          y = tabelaInfo.yPos;
        }
      }

      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      const totalPresentes = registro.frequencia?.presentes?.length || 0;
      const totalAusentes = registro.frequencia?.ausentes?.length || 0;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("📊 RESUMO DA AULA:", margin, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`• Presentes: ${totalPresentes}`, margin + 5, y);
      y += 5;
      doc.text(`• Ausentes: ${totalAusentes}`, margin + 5, y);
      y += 6;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("📝 Conteúdo da Aula:", margin, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const linhasConteudo = doc.splitTextToSize(registro.conteudo, pageWidth - 2 * margin);
      linhasConteudo.forEach((linha) => {
        if (y > pageHeight - 25) {
          doc.addPage();
          paginaAtual++;
          y = 20;
        }
        doc.text(linha, margin, y);
        y += 5;
      });

      y += 4;

      if (paginaAtual === 1 || paginaAtual === 2) {
        const yAssinaturas = pageHeight - 12;

        doc.line(margin, yAssinaturas, margin + 60, yAssinaturas);
        doc.line(pageWidth - margin - 60, yAssinaturas, pageWidth - margin, yAssinaturas);

        doc.setFontSize(9);
        doc.text("Assinatura do Professor", margin, yAssinaturas + 4);
        doc.text("Assinatura do Gestor", pageWidth - margin - 60, yAssinaturas + 4);
      }

      const pdfBlob = doc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");

      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

window.imprimirBoletimGestor = async function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) {
    showToast("Eletiva não encontrada", "error");
    return;
  }

  const notas = state.notas?.filter((n) => n.eletivaId === eletivaId) || [];

  if (notas.length === 0) {
    showToast("Não há notas registradas para esta eletiva", "warning");
    return;
  }

  const professor = state.professores?.find((p) => p.id === eletiva.professorId)?.nome || "Não atribuído";

  const matriculas = state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
  const alunos = state.alunos?.filter((a) => matriculas.some((m) => m.alunoId === a.id)).sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  const ultimoSemestre = notas.sort((a, b) => b.semestre.localeCompare(a.semestre))[0];

  mostrarLoaderGestor(true);

  try {
    await gerarPDFBoletimGestor(eletiva, alunos, ultimoSemestre, professor);
    showToast("Boletim gerado com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao gerar boletim:", error);
    showToast("Erro ao gerar boletim: " + error.message, "error");
  } finally {
    mostrarLoaderGestor(false);
  }
};

async function gerarPDFBoletimGestor(eletiva, alunos, registroNotas, professorNome) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window.jspdf === "undefined") {
        reject("Biblioteca jsPDF não encontrada");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      let paginaAtual = 1;
      let y = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;

      const mapaNotas = {};
      if (registroNotas?.notas) {
        registroNotas.notas.forEach((n) => {
          mapaNotas[n.alunoId] = n.nota;
        });
      }

      const notasValidas = Object.values(mapaNotas).filter((n) => n !== undefined);
      const mediaGeral = notasValidas.length > 0 ? (notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length).toFixed(1) : "N/A";

      function adicionarCabecalho() {
        let yCabecalho = 10;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 7;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 7;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`BOLETIM DE NOTAS - ${eletiva.nome}`, pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 6;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Professor: ${professorNome} | Semestre: ${registroNotas?.semestre || "1/2026"} | Total: ${alunos.length} alunos`, pageWidth / 2, yCabecalho, { align: "center" });
        yCabecalho += 8;
        return yCabecalho;
      }

      function adicionarCabecalhoTabela(yPos) {
        const colWidths = [75, 20, 20, 25];
        const posNota = pageWidth - margin - colWidths[3];
        const posSige = posNota - colWidths[2] - 2;
        const posTurma = posSige - colWidths[1] - 2;
        const posNome = margin;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");

        doc.setFillColor(240, 240, 240);
        doc.rect(margin - 1, yPos - 5, pageWidth - 2 * margin + 2, 6, "F");

        doc.text("NOME", posNome, yPos);
        doc.text("TURMA", posTurma, yPos);
        doc.text("SIGE", posSige, yPos);
        doc.text("NOTA", posNota, yPos);

        yPos += 4;
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 4;
        return { yPos, posNome, posTurma, posSige, posNota, colWidths };
      }

      y = adicionarCabecalho();
      let tabelaInfo = adicionarCabecalhoTabela(y);
      y = tabelaInfo.yPos;

      const posNome = tabelaInfo.posNome;
      const posTurma = tabelaInfo.posTurma;
      const posSige = tabelaInfo.posSige;
      const posNota = tabelaInfo.posNota;
      const colWidths = tabelaInfo.colWidths;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const alturaPorLinha = 5.5;
      const linhasPorPagina = Math.floor((pageHeight - y - 35) / alturaPorLinha);

      let alunosProcessados = 0;
      let maxPaginas = 2;

      while (alunosProcessados < alunos.length && paginaAtual <= maxPaginas) {
        const alunosNestaPagina = Math.min(linhasPorPagina, alunos.length - alunosProcessados);

        for (let i = 0; i < alunosNestaPagina; i++) {
          const aluno = alunos[alunosProcessados + i];
          const nota = mapaNotas[aluno.id];
          const notaDisplay = nota !== undefined ? nota.toFixed(1) : "-";

          doc.text(aluno.nome, posNome, y);
          doc.text(aluno.turmaOrigem, posTurma, y);
          doc.text(aluno.codigoSige, posSige, y);

          const notaX = posNota + colWidths[3] / 2;
          doc.text(notaDisplay, notaX, y, { align: "center" });

          y += alturaPorLinha;
        }

        alunosProcessados += alunosNestaPagina;

        if (alunosProcessados < alunos.length && paginaAtual < maxPaginas) {
          doc.addPage();
          paginaAtual++;
          y = adicionarCabecalho();
          tabelaInfo = adicionarCabecalhoTabela(y);
          y = tabelaInfo.yPos;
        }
      }

      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("📊 RESUMO DA TURMA:", margin, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`• Média geral: ${mediaGeral}`, margin + 5, y);
      y += 6;

      const yAssinaturas = pageHeight - 12;

      doc.line(margin, yAssinaturas, margin + 60, yAssinaturas);
      doc.line(pageWidth - margin - 60, yAssinaturas, pageWidth - margin, yAssinaturas);

      doc.setFontSize(9);
      doc.text("Assinatura do Professor", margin, yAssinaturas + 4);
      doc.text("Assinatura do Gestor", pageWidth - margin - 60, yAssinaturas + 4);

      const dataAtual = new Date().toLocaleDateString("pt-BR");
      doc.setFontSize(8);
      doc.text(`Data: ${dataAtual}`, pageWidth / 2, yAssinaturas + 8, { align: "center" });

      const pdfBlob = doc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");

      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

// ========== FUNÇÕES DE IMPRESSÃO DA ABA ESTATÍSTICAS ==========

function imprimirListaAlunos(eletiva, alunos, ausenciasPorAluno, notasPorAluno, professor, tempo) {
  mostrarLoaderGestor(true);

  try {
    if (typeof window.jspdf === "undefined") {
      showToast("Biblioteca de PDF não carregada", "error");
      mostrarLoaderGestor(false);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    let y = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, y, { align: "center" });
    y += 7;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, y, { align: "center" });
    y += 7;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`LISTA DE ALUNOS - ${eletiva.nome}`, pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Professor: ${professor} | Tempo: ${tempo} | Total: ${alunos.length} alunos`, pageWidth / 2, y, { align: "center" });
    y += 8;

    const colWidths = [70, 18, 18, 20, 25];
    const posNota = pageWidth - margin - colWidths[4];
    const posAus = posNota - colWidths[3] - 2;
    const posSige = posAus - colWidths[2] - 2;
    const posTurma = posSige - colWidths[1] - 2;
    const posNome = margin;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    doc.setFillColor(240, 240, 240);
    doc.rect(margin - 1, y - 5, pageWidth - 2 * margin + 2, 6, "F");

    doc.text("NOME", posNome, y);
    doc.text("TURMA", posTurma, y);
    doc.text("SIGE", posSige, y);
    doc.text("AUS", posAus, y);
    doc.text("NOTA", posNota, y);

    y += 4;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const alturaPorLinha = 5.5;
    const espacoParaAlunos = alunos.length * alturaPorLinha;
    const espacoRestante = pageHeight - y - 20;

    let alturaAjustada = alturaPorLinha;
    if (espacoRestante < espacoParaAlunos) {
      alturaAjustada = espacoRestante / alunos.length;
    }

    alunos.forEach((aluno) => {
      if (y > pageHeight - 20) {
        doc.setTextColor(255, 0, 0);
        doc.setFontSize(8);
        doc.text(`⚠️ Lista incompleta. Faltam alunos.`, margin, y);
        doc.setTextColor(0, 0, 0);
        return;
      }

      const ausencias = ausenciasPorAluno[aluno.id] || 0;
      const nota = notasPorAluno[aluno.id];
      const notaDisplay = nota !== undefined ? nota.toFixed(1) : "-";

      doc.text(aluno.nome, posNome, y);
      doc.text(aluno.turmaOrigem, posTurma, y);
      doc.text(aluno.codigoSige, posSige, y);

      const ausX = posAus + colWidths[3] / 2;
      const notaX = posNota + colWidths[4] / 2;

      doc.text(ausencias.toString(), ausX, y, { align: "center" });
      doc.text(notaDisplay, notaX, y, { align: "center" });

      y += alturaAjustada;
    });

    y += 4;

    const yAssinaturas = pageHeight - 12;

    doc.line(margin, yAssinaturas, margin + 60, yAssinaturas);
    doc.line(pageWidth - margin - 60, yAssinaturas, pageWidth - margin, yAssinaturas);

    doc.setFontSize(9);
    doc.text("Assinatura do Professor", margin, yAssinaturas + 4);
    doc.text("Assinatura do Gestor", pageWidth - margin - 60, yAssinaturas + 4);

    const dataAtual = new Date().toLocaleDateString("pt-BR");
    doc.setFontSize(8);
    doc.text(`Data: ${dataAtual}`, pageWidth / 2, yAssinaturas + 8, { align: "center" });

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  } catch (error) {
    console.error("❌ Erro ao gerar PDF:", error);
    showToast("Erro ao gerar PDF: " + error.message, "error");
  } finally {
    mostrarLoaderGestor(false);
  }
}

// ========== FUNÇÕES DE REDIRECIONAMENTO PARA GESTÃO COMPLETA ==========

window.abrirModalEditarTempos = function () {
  window.location.href = "gestao-completa.html#dados";
};

window.abrirModalEditarLiberacao = function () {
  window.location.href = "gestao-completa.html#dados";
};

window.abrirModalRestaurarBackup = function () {
  window.location.href = "gestao-completa.html#dados";
};

window.abrirModalConflitos = function () {
  window.location.href = "gestao-completa.html#dados";
};

// ========== EVENT LISTENERS PARA ATUALIZAÇÃO AUTOMÁTICA ==========

window.addEventListener('dadosAtualizados', function(event) {
  console.log("📡 Gestor recebeu evento de atualização:", event.detail);
  if (document.visibilityState === 'visible') {
    const abaAtiva = document.querySelector('.gestor-tab-pane.active')?.id;
    if (abaAtiva === 'tab-estatisticas') {
      carregarEstatisticas();
    } else if (abaAtiva === 'tab-registros') {
      carregarCardsRegistros();
    }
  }
});

window.addEventListener('storage', function(event) {
  if (event.key === CONFIG.storageKeys.eletivas) {
    console.log("📦 Mudança detectada nas eletivas");
    if (document.visibilityState === 'visible') {
      carregarEstatisticas();
    }
  }
  if (event.key === CONFIG.storageKeys.registros) {
    console.log("📦 Mudança detectada nos registros");
    if (document.visibilityState === 'visible') {
      const abaAtiva = document.querySelector('.gestor-tab-pane.active')?.id;
      if (abaAtiva === 'tab-registros') {
        carregarCardsRegistros();
      }
    }
  }
});

setInterval(() => {
  if (document.visibilityState === 'visible') {
    const abaAtiva = document.querySelector('.gestor-tab-pane.active')?.id;
    if (abaAtiva === 'tab-estatisticas') {
      carregarEstatisticas();
    } else if (abaAtiva === 'tab-registros') {
      carregarCardsRegistros();
    }
  }
}, 30000);
