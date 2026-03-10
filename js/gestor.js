// js/gestor.js - Lógica do gestor (OTIMIZADO)
console.log("👔 gestor.js carregado");

let gestorAtual = null;
let eletivaEmEdicao = null;
let alunoEmTroca = null;
let alunoEmEdicao = null;
let alunoParaAdicionar = null;
let flagLiberacaoNotas = {};
let historicoMovimentacoes = [];

// Cache para evitar recálculos desnecessários
let cacheEstatisticas = {};
let ultimaAtualizacaoCache = 0;

// Inicializar jsPDF (carregar sob demanda)
let jsPDFInstance = null;

function getJsPDF() {
  if (!jsPDFInstance && window.jspdf) {
    jsPDFInstance = window.jspdf.jsPDF;
  }
  return jsPDFInstance;
}

// Dias da semana para dropdown
const diasSemana = [
  "SEGUNDA-FEIRA",
  "TERÇA-FEIRA",
  "QUARTA-FEIRA",
  "QUINTA-FEIRA",
  "SEXTA-FEIRA",
  "SÁBADO",
  "DOMINGO",
];

document.addEventListener("DOMContentLoaded", function () {
  console.log("👔 Inicializando página do gestor...");

  // Carregar funções essenciais primeiro
  carregarTheme();

  const gestorStorage = localStorage.getItem("gestor_atual");
  if (!gestorStorage) {
    window.location.href = "selecionar-gestor.html";
    return;
  }

  gestorAtual = JSON.parse(gestorStorage);
  console.log("👤 Gestor:", gestorAtual.nome, "Perfil:", gestorAtual.perfil);

  // Carregar estado básico
  if (typeof carregarEstado === "function") {
    carregarEstado();

    // Inicializar estruturas
    carregarFlagLiberacao();
    carregarHistoricoMovimentacoes();
  }

  // Atualizar UI imediatamente
  document.getElementById("userName").textContent = gestorAtual.nome;

  const roleMap = {
    GESTOR: "Administrador",
    SECRETARIA: "Secretaria",
    GESTOR_PROFESSOR: "Gestor/Professor",
  };
  document.getElementById("userRole").textContent =
    roleMap[gestorAtual.perfil] || "Gestor";

  // Setar datas padrão (rápido)
  const hoje = new Date().toISOString().split("T")[0];
  const dataLiberacao = document.getElementById("dataLiberacao");
  if (dataLiberacao) dataLiberacao.value = hoje;

  const fimSemestre = new Date();
  fimSemestre.setMonth(6);
  fimSemestre.setDate(30);
  const dataEncerramento = document.getElementById("dataEncerramento");
  if (dataEncerramento)
    dataEncerramento.value = fimSemestre.toISOString().split("T")[0];

  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
  const filtroInicio = document.getElementById("filtroDataInicioRegistros");
  const filtroFim = document.getElementById("filtroDataFimRegistros");
  if (filtroInicio)
    filtroInicio.value = trintaDiasAtras.toISOString().split("T")[0];
  if (filtroFim) filtroFim.value = hoje;

  // Carregar dados pesados de forma assíncrona
  setTimeout(() => {
    console.log("📊 Carregando dados completos em segundo plano...");
    carregarSelectProfessoresRegistros();
    carregarEstatisticas();
    carregarEletivasOrganizar();
    carregarEletivasLiberacao();
    atualizarStatusLiberacao();
    carregarSelectProfessoresFiltro();
    carregarSelectDiasFiltro();
    carregarSelectProfessoresModal();
  }, 100);
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

function mostrarSucesso(mensagem) {
  showToast(mensagem, "success");
}

function mostrarErro(mensagem) {
  showToast(mensagem, "error");
}

function mostrarAviso(mensagem) {
  showToast(mensagem, "warning");
}

function mostrarLoading(mensagem) {
  const loader = document.getElementById("gestorLoader");
  if (loader) {
    loader.querySelector("p").textContent = mensagem;
    loader.classList.add("active");
  }
}

function fecharLoading() {
  const loader = document.getElementById("gestorLoader");
  if (loader) {
    loader.classList.remove("active");
    loader.querySelector("p").textContent = "Carregando...";
  }
}

// Carregar flag de liberação do localStorage
function carregarFlagLiberacao() {
  try {
    const saved = localStorage.getItem("sage_liberacao_notas");
    if (saved) {
      flagLiberacaoNotas = JSON.parse(saved);
    } else {
      flagLiberacaoNotas = {
        "1/2026": {},
        "2/2026": {},
      };
    }
  } catch (e) {
    console.warn("Erro ao carregar flag de liberação:", e);
    flagLiberacaoNotas = {
      "1/2026": {},
      "2/2026": {},
    };
  }
}

// Salvar flag de liberação
function salvarFlagLiberacao() {
  try {
    localStorage.setItem(
      "sage_liberacao_notas",
      JSON.stringify(flagLiberacaoNotas),
    );

    if (window.FirebaseSync) {
      window.FirebaseSync.salvarDadosFirebase(
        "liberacao_notas",
        flagLiberacaoNotas,
      );
    }
  } catch (e) {
    console.warn("Erro ao salvar flag de liberação:", e);
  }
}

// Carregar histórico de movimentações
function carregarHistoricoMovimentacoes() {
  try {
    const saved = localStorage.getItem("sage_historico_alunos");
    if (saved) {
      historicoMovimentacoes = JSON.parse(saved);
    } else {
      historicoMovimentacoes = [];
    }
  } catch (e) {
    console.warn("Erro ao carregar histórico:", e);
    historicoMovimentacoes = [];
  }
}

// Salvar histórico de movimentações
function salvarHistoricoMovimentacoes() {
  try {
    localStorage.setItem(
      "sage_historico_alunos",
      JSON.stringify(historicoMovimentacoes),
    );
  } catch (e) {
    console.warn("Erro ao salvar histórico:", e);
  }
}

// Registrar movimentação
function registrarMovimentacao(tipo, dados) {
  const movimentacao = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    tipo: tipo,
    ...dados,
  };

  historicoMovimentacoes.push(movimentacao);
  salvarHistoricoMovimentacoes();
}

// Verificar se notas estão liberadas
function verificarNotasLiberadasGestor(eletivaId, semestre = "1/2026") {
  return flagLiberacaoNotas[semestre]?.[eletivaId] === true;
}

// Verificar se duas eletivas têm mesmo horário
function temMesmoHorario(eletiva1, eletiva2) {
  if (!eletiva1?.horario || !eletiva2?.horario) return false;

  return (
    eletiva1.horario.diaSemana === eletiva2.horario.diaSemana &&
    eletiva1.horario.codigoTempo === eletiva2.horario.codigoTempo
  );
}

// Mudar de aba (otimizado)
window.mudarTabGestor = function (tab) {
  // Atualizar UI imediatamente
  document
    .querySelectorAll(".gestor-tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".gestor-tab-btn").forEach((btn) => {
    if (btn.getAttribute("onclick")?.includes(`'${tab}'`)) {
      btn.classList.add("active");
    }
  });

  document
    .querySelectorAll(".gestor-tab-pane")
    .forEach((pane) => pane.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");

  // Carregar dados específicos da aba de forma assíncrona
  setTimeout(() => {
    if (tab === "estatisticas") {
      carregarEstatisticas();
    } else if (tab === "registros") {
      carregarRegistrosGestor();
    } else if (tab === "organizar") {
      carregarEletivasOrganizar();
    } else if (tab === "liberar") {
      carregarEletivasLiberacao();
      atualizarStatusLiberacao();
    }
  }, 50);
};

// ========== FUNÇÕES DE ORDENAÇÃO ==========

// Ordenar eletivas por dia da semana
function ordenarEletivasPorDia(eletivas) {
  const ordemDias = {
    segunda: 1,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sabado: 6,
    domingo: 7,
  };

  return [...eletivas].sort((a, b) => {
    const diaA = ordemDias[a.horario?.diaSemana?.toLowerCase()] || 99;
    const diaB = ordemDias[b.horario?.diaSemana?.toLowerCase()] || 99;

    if (diaA !== diaB) return diaA - diaB;

    const tempoA = parseInt(a.horario?.codigoTempo?.replace("T", "") || 0);
    const tempoB = parseInt(b.horario?.codigoTempo?.replace("T", "") || 0);
    return tempoA - tempoB;
  });
}

// Agrupar eletivas por dia
function agruparEletivasPorDia(eletivas) {
  const grupos = {};

  eletivas.forEach((eletiva) => {
    const dia = eletiva.horario?.diaSemana?.toLowerCase() || "outros";
    if (!grupos[dia]) grupos[dia] = [];
    grupos[dia].push(eletiva);
  });

  return grupos;
}

// Formatar nome do dia
function formatarNomeDia(dia) {
  const nomes = {
    segunda: "SEGUNDA-FEIRA",
    terca: "TERÇA-FEIRA",
    quarta: "QUARTA-FEIRA",
    quinta: "QUINTA-FEIRA",
    sexta: "SEXTA-FEIRA",
    sabado: "SÁBADO",
    domingo: "DOMINGO",
    outros: "OUTROS DIAS",
  };
  return nomes[dia] || dia.toUpperCase();
}

// ========== FUNÇÕES DE ESTATÍSTICAS ==========

// Calcular estatísticas de uma eletiva (com cache)
function calcularEstatisticasEletiva(eletivaId, semestre = "1/2026") {
  const chaveCache = `${eletivaId}_${semestre}`;
  const agora = Date.now();

  // Cache por 5 segundos
  if (
    cacheEstatisticas[chaveCache] &&
    agora - cacheEstatisticas[chaveCache].timestamp < 5000
  ) {
    return cacheEstatisticas[chaveCache].dados;
  }

  const matriculas =
    state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
  const alunosIds = matriculas.map((m) => m.alunoId);
  const totalAlunos = alunosIds.length;

  // Calcular média de notas
  const notasRegistro = state.notas?.find(
    (n) => n.eletivaId === eletivaId && n.semestre === semestre,
  );
  let mediaNotas = 0;
  if (notasRegistro?.notas?.length > 0) {
    const soma = notasRegistro.notas.reduce((acc, n) => acc + n.nota, 0);
    mediaNotas = soma / notasRegistro.notas.length;
  }

  // Calcular total de faltas
  const registros =
    state.registros?.filter((r) => r.eletivaId === eletivaId) || [];
  let totalFaltas = 0;

  registros.forEach((reg) => {
    if (reg.frequencia?.ausentes) {
      totalFaltas += reg.frequencia.ausentes.length;
    }
  });

  const mediaFaltas =
    totalAlunos > 0 ? (totalFaltas / totalAlunos).toFixed(1) : 0;

  const resultado = {
    totalAlunos,
    mediaNotas: mediaNotas.toFixed(1),
    totalFaltas,
    mediaFaltas,
  };

  // Salvar no cache
  cacheEstatisticas[chaveCache] = {
    timestamp: agora,
    dados: resultado,
  };

  return resultado;
}

// Calcular estatísticas seguras para PDF
async function calcularEstatisticasSeguro(eletivaId, semestre = "1/2026") {
  const matriculas =
    state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
  const alunosIds = matriculas.map((m) => m.alunoId);
  const totalAlunos = alunosIds.length;

  // Calcular notas
  const notasRegistro = state.notas?.find(
    (n) => n.eletivaId === eletivaId && n.semestre === semestre,
  );
  const notasPorAluno = {};
  let somaNotas = 0;
  let qtdNotas = 0;

  if (notasRegistro?.notas) {
    notasRegistro.notas.forEach((n) => {
      notasPorAluno[n.alunoId] = n.nota;
      somaNotas += n.nota;
      qtdNotas++;
    });
  }

  // Calcular faltas
  const registros =
    state.registros?.filter((r) => r.eletivaId === eletivaId) || [];
  const ausenciasPorAluno = {};
  let totalAusencias = 0;

  registros.forEach((reg) => {
    if (reg.frequencia?.ausentes) {
      reg.frequencia.ausentes.forEach((codigo) => {
        const aluno = state.alunos?.find((a) => a.codigoSige === codigo);
        if (aluno) {
          ausenciasPorAluno[aluno.id] = (ausenciasPorAluno[aluno.id] || 0) + 1;
          totalAusencias++;
        }
      });
    }
  });

  // Estatísticas
  const notasArray = Object.values(notasPorAluno);
  const mediaNotas = qtdNotas > 0 ? somaNotas / qtdNotas : 0;
  const mediaFaltas = totalAlunos > 0 ? totalAusencias / totalAlunos : 0;

  const maiorNota = notasArray.length > 0 ? Math.max(...notasArray) : null;
  const menorNota = notasArray.length > 0 ? Math.min(...notasArray) : null;

  const acimaMedia = notasArray.filter((n) => n > mediaNotas).length;
  const abaixoMedia = notasArray.filter((n) => n < mediaNotas).length;

  return {
    ausenciasPorAluno,
    notasPorAluno,
    totalAusencias,
    mediaFaltas,
    mediaNotas,
    maiorNota,
    menorNota,
    acimaMedia,
    abaixoMedia,
  };
}

// Carregar estatísticas (CORRIGIDO - SEM ÍCONES)
window.carregarEstatisticas = function () {
  const container = document.getElementById("estatisticasContainer");
  if (!container) return;

  const semestre =
    document.getElementById("semestreEstatisticas")?.value || "1/2026";
  const termoBusca =
    document.getElementById("buscaEletiva")?.value?.toLowerCase() || "";

  let eletivas = state.eletivas || [];

  // Filtrar por busca
  if (termoBusca) {
    eletivas = eletivas.filter(
      (e) =>
        e.nome?.toLowerCase().includes(termoBusca) ||
        e.codigo?.toLowerCase().includes(termoBusca),
    );
  }

  const eletivasOrdenadas = ordenarEletivasPorDia(eletivas);
  const eletivasPorDia = agruparEletivasPorDia(eletivasOrdenadas);

  // Usar DocumentFragment para melhor performance
  const fragment = document.createDocumentFragment();

  // Limpar container de uma vez
  container.innerHTML = "";

  const ordemDias = [
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
    "domingo",
    "outros",
  ];

  ordemDias.forEach((dia) => {
    const eletivasDoDia = eletivasPorDia[dia];
    if (!eletivasDoDia?.length) return;

    const diaTitulo = document.createElement("h3");
    diaTitulo.className = "dia-titulo";
    diaTitulo.textContent = `─────── ${formatarNomeDia(dia)} ───────`;
    fragment.appendChild(diaTitulo);

    eletivasDoDia.forEach((eletiva) => {
      const stats = calcularEstatisticasEletiva(eletiva.id, semestre);
      const professor = state.professores?.find(
        (p) => p.id === eletiva.professorId,
      );

      const card = document.createElement("div");
      card.className = "eletiva-card-estatistica";

      card.innerHTML = `
        <div class="eletiva-header-estatistica">
          <div style="display: flex; align-items: center;">
            <div class="eletiva-info">
              <h3>${eletiva.nome}</h3>
              <p>Código: ${eletiva.codigo} | Professor: ${professor?.nome || "Não atribuído"}</p>
              <p>Horário: ${eletiva.horario?.diaSemana} ${eletiva.horario?.codigoTempo}</p>
            </div>
          </div>
        </div>

        <div class="estatisticas-grid">
          <div class="estatistica-item">
            <div class="estatistica-valor">${stats.totalAlunos}</div>
            <div class="estatistica-label">ALUNOS</div>
          </div>
          <div class="estatistica-item">
            <div class="estatistica-valor">${stats.mediaNotas}</div>
            <div class="estatistica-label">MÉDIA</div>
          </div>
          <div class="estatistica-item">
            <div class="estatistica-valor">${stats.totalFaltas}</div>
            <div class="estatistica-label">FALTAS</div>
          </div>
          <div class="estatistica-item">
            <div class="estatistica-valor">${stats.mediaFaltas}</div>
            <div class="estatistica-label">FALTAS/ALUNO</div>
          </div>
        </div>

        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button class="btn-primary btn-small" onclick="verAlunosEstatisticas(${eletiva.id}, '${semestre}')">
            <i class="fas fa-eye"></i> VER ALUNOS
          </button>
          <button class="btn-secondary btn-small" onclick="imprimirRelatorioEletiva(${eletiva.id}, '${semestre}')">
            <i class="fas fa-print"></i> IMPRIMIR RELATÓRIO
          </button>
        </div>
      `;

      fragment.appendChild(card);
    });
  });

  if (fragment.children.length === 0) {
    container.innerHTML =
      '<p class="empty-state">Nenhuma eletiva encontrada</p>';
  } else {
    container.appendChild(fragment);
  }
};

// Filtrar estatísticas
window.filtrarEletivasEstatisticas = function () {
  carregarEstatisticas();
};

// ========== FUNÇÕES DE ALUNOS ==========

// Ver alunos nas estatísticas (MODAL ÚNICO)
window.verAlunosEstatisticas = function (eletivaId, semestre) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  mostrarLoaderGestor(true);

  // Usar setTimeout para não travar a UI
  setTimeout(() => {
    try {
      const matriculas =
        state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
      const alunos =
        state.alunos
          ?.filter((a) => matriculas.some((m) => m.alunoId === a.id))
          .sort((a, b) => a.nome.localeCompare(b.nome)) || [];

      const notasRegistro = state.notas?.find(
        (n) => n.eletivaId === eletivaId && n.semestre === semestre,
      );
      const mapaNotas = {};
      if (notasRegistro?.notas) {
        notasRegistro.notas.forEach((n) => {
          mapaNotas[n.alunoId] = n.nota;
        });
      }

      // Calcular faltas por aluno
      const registros =
        state.registros?.filter((r) => r.eletivaId === eletivaId) || [];
      const faltasPorAluno = {};

      registros.forEach((reg) => {
        if (reg.frequencia?.ausentes) {
          reg.frequencia.ausentes.forEach((codigo) => {
            const aluno = alunos.find((a) => a.codigoSige === codigo);
            if (aluno) {
              faltasPorAluno[aluno.id] = (faltasPorAluno[aluno.id] || 0) + 1;
            }
          });
        }
      });

      // Calcular estatísticas para o resumo
      const notasArray = Object.values(mapaNotas).filter((n) => n !== "-");
      const mediaGeral =
        notasArray.length > 0
          ? (notasArray.reduce((a, b) => a + b, 0) / notasArray.length).toFixed(
              1,
            )
          : 0;

      const totalAusencias = Object.values(faltasPorAluno).reduce(
        (a, b) => a + b,
        0,
      );
      const mediaFaltas =
        alunos.length > 0 ? (totalAusencias / alunos.length).toFixed(1) : 0;

      const maiorNota = notasArray.length > 0 ? Math.max(...notasArray) : 0;
      const menorNota = notasArray.length > 0 ? Math.min(...notasArray) : 0;

      const acimaMedia = notasArray.filter((n) => n > mediaGeral).length;
      const abaixoMedia = notasArray.filter((n) => n < mediaGeral).length;

      let tabelaHTML = `
        <p><strong>Eletiva:</strong> ${eletiva.nome} | <strong>Professor:</strong> ${eletiva.professorNome}</p>
        <p><strong>Semestre:</strong> ${semestre} | <strong>Total de alunos:</strong> ${alunos.length}</p>
        
        <div class="search-box" style="margin: 1rem 0;">
          <i class="fas fa-search"></i>
          <input type="text" id="buscaAlunoModal" placeholder="Buscar aluno..." oninput="filtrarAlunosModal()">
        </div>
        
        <div class="alunos-table-container" style="max-height: 300px; overflow-y: auto;">
          <table class="alunos-table-gestor">
            <thead>
              <tr>
                <th>NOME</th>
                <th>TURMA</th>
                <th>SIGE</th>
                <th>FALTAS</th>
                <th>NOTA</th>
              </tr>
            </thead>
            <tbody id="tabelaAlunosBody">
      `;

      alunos.forEach((aluno) => {
        const faltas = faltasPorAluno[aluno.id] || 0;
        const nota = mapaNotas[aluno.id] || "-";

        tabelaHTML += `
          <tr class="aluno-row" data-nome="${aluno.nome.toLowerCase()}" data-sige="${aluno.codigoSige}">
            <td>${aluno.nome}</td>
            <td>${aluno.turmaOrigem}</td>
            <td>${aluno.codigoSige}</td>
            <td><span class="badge-falta">${faltas}</span></td>
            <td><span class="badge-nota">${nota !== "-" ? nota.toFixed(1) : "-"}</span></td>
          </tr>
        `;
      });

      tabelaHTML += `
            </tbody>
          </table>
        </div>
        
        <div style="margin-top: 1rem; background: var(--bg-light); padding: 1rem; border-radius: 8px;">
          <p><strong>Resumo da Turma:</strong></p>
          <p>• Total de alunos: ${alunos.length}</p>
          <p>• Total de ausências no semestre: ${totalAusencias}</p>
          <p>• Média de faltas por aluno: ${mediaFaltas}</p>
          <p>• Média geral da turma: ${mediaGeral}</p>
          <p>• Maior nota: ${maiorNota.toFixed(1)}</p>
          <p>• Menor nota: ${menorNota.toFixed(1)}</p>
          <p>• Alunos acima da média: ${acimaMedia}</p>
          <p>• Alunos abaixo da média: ${abaixoMedia}</p>
        </div>
      `;

      document.getElementById("modalAlunosTitulo").textContent =
        `👥 ALUNOS - ${eletiva.nome}`;
      document.getElementById("modalAlunosBody").innerHTML = tabelaHTML;
      document.getElementById("modalAlunosImprimir").onclick = () =>
        imprimirRelatorioEletiva(eletivaId, semestre);
      document.getElementById("modalAlunosExportar").onclick = () =>
        exportarAlunosExcel(eletivaId);

      document.getElementById("modalVerAlunos").classList.add("active");

      // Adicionar função de filtro
      window.filtrarAlunosModal = function () {
        const termo =
          document.getElementById("buscaAlunoModal")?.value.toLowerCase() || "";
        document.querySelectorAll(".aluno-row").forEach((row) => {
          const nome = row.dataset.nome;
          const sige = row.dataset.sige;
          if (nome.includes(termo) || sige.includes(termo)) {
            row.style.display = "";
          } else {
            row.style.display = "none";
          }
        });
      };
    } catch (error) {
      console.error("Erro ao carregar alunos:", error);
      mostrarErro("Erro ao carregar alunos");
    } finally {
      mostrarLoaderGestor(false);
    }
  }, 50);
};

// Fechar modal de alunos
window.fecharModalAlunos = function () {
  document.getElementById("modalVerAlunos").classList.remove("active");
};

// ========== FUNÇÕES DE REGISTROS ==========

// Carregar select de professores para registros
function carregarSelectProfessoresRegistros() {
  const select = document.getElementById("filtroProfessorRegistros");
  if (!select) return;

  const professores =
    state.professores?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  select.innerHTML = '<option value="">Todos os professores</option>';

  // Usar fragment para melhor performance
  const fragment = document.createDocumentFragment();

  professores.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.nome;
    fragment.appendChild(option);
  });

  select.appendChild(fragment);
}

// Carregar registros do gestor (otimizado)
async function carregarRegistrosGestor() {
  const container = document.getElementById("registrosVisualizarContainer");
  if (!container) return;

  mostrarLoaderGestor(true);

  try {
    const filtroProfessor = document.getElementById(
      "filtroProfessorRegistros",
    )?.value;
    const dataInicio = document.getElementById(
      "filtroDataInicioRegistros",
    )?.value;
    const dataFim = document.getElementById("filtroDataFimRegistros")?.value;

    // Usar setTimeout para não travar
    setTimeout(async () => {
      try {
        let registros = [];

        if (window.FirebaseSync) {
          registros = await window.FirebaseSync.carregarRegistrosFirebase();
        }

        if (!registros || registros.length === 0) {
          registros = state.registros || [];
        }

        // Aplicar filtros
        if (filtroProfessor) {
          registros = registros.filter(
            (r) => r.professorId === parseInt(filtroProfessor),
          );
        }

        if (dataInicio) {
          registros = registros.filter((r) => r.data >= dataInicio);
        }
        if (dataFim) {
          registros = registros.filter((r) => r.data <= dataFim);
        }

        // Agrupar por professor
        const registrosPorProfessor = {};
        registros.forEach((r) => {
          if (!registrosPorProfessor[r.professorId]) {
            registrosPorProfessor[r.professorId] = [];
          }
          registrosPorProfessor[r.professorId].push(r);
        });

        const professores = state.professores || [];

        // Usar fragment para melhor performance
        const fragment = document.createDocumentFragment();
        container.innerHTML = "";

        for (const professor of professores) {
          const registrosProf = registrosPorProfessor[professor.id] || [];
          if (registrosProf.length === 0 && filtroProfessor) continue;

          // Agrupar por eletiva
          const registrosPorEletiva = {};
          registrosProf.forEach((r) => {
            if (!registrosPorEletiva[r.eletivaId]) {
              registrosPorEletiva[r.eletivaId] = [];
            }
            registrosPorEletiva[r.eletivaId].push(r);
          });

          // Buscar notas
          const notasProf =
            state.notas?.filter((n) => n.professorId === professor.id) || [];
          const notasPorEletiva = {};
          notasProf.forEach((n) => {
            if (!notasPorEletiva[n.eletivaId]) {
              notasPorEletiva[n.eletivaId] = [];
            }
            notasPorEletiva[n.eletivaId].push(n);
          });

          const professorSection = document.createElement("div");
          professorSection.className = "professor-section";

          professorSection.innerHTML = `
            <div class="professor-titulo">
              <i class="fas fa-user-circle"></i>
              <h2>👤 PROFESSOR: ${professor.nome}</h2>
            </div>
          `;

          const eletivasProfessor =
            state.eletivas?.filter((e) => e.professorId === professor.id) || [];

          for (const eletiva of eletivasProfessor) {
            const registrosEletiva = registrosPorEletiva[eletiva.id] || [];
            const notasEletiva = notasPorEletiva[eletiva.id] || [];

            registrosEletiva.sort((a, b) => b.data.localeCompare(a.data));

            const card = document.createElement("div");
            card.className = "eletiva-card-gestor";

            let registrosHTML = "";

            registrosEletiva.slice(0, 5).forEach((r) => {
              const presentes = r.frequencia?.presentes?.length || 0;
              const ausentes = r.frequencia?.ausentes?.length || 0;

              registrosHTML += `
                <div class="registro-item-gestor" onclick='abrirDetalhesRegistroGestor(${JSON.stringify(r).replace(/'/g, "\\'")})'>
                  <span class="registro-data-gestor">📅 ${formatarData(r.data)}</span>
                  <span class="registro-resumo">${presentes} presentes, ${ausentes} ausentes</span>
                  <span class="registro-tipo frequencia">Frequência</span>
                </div>
              `;
            });

            notasEletiva.slice(0, 2).forEach((n) => {
              const media =
                n.notas?.length > 0
                  ? (
                      n.notas.reduce((acc, nota) => acc + nota.nota, 0) /
                      n.notas.length
                    ).toFixed(1)
                  : "0.0";

              registrosHTML += `
                <div class="registro-item-gestor" onclick='abrirDetalhesNotasGestor(${JSON.stringify(n).replace(/'/g, "\\'")})'>
                  <span class="registro-data-gestor">📊 ${n.semestre}</span>
                  <span class="registro-resumo">Média: ${media}</span>
                  <span class="registro-tipo notas">Notas</span>
                </div>
              `;
            });

            card.innerHTML = `
              <div class="eletiva-header">
                <div class="eletiva-info">
                  <h3>ELETIVA: ${eletiva.nome} | Código: ${eletiva.codigo}</h3>
                  <div class="eletiva-meta">
                    <span><i class="fas fa-users"></i> Turmas: ${eletiva.turmaOrigem || "Várias"}</span>
                    <span><i class="fas fa-clock"></i> Horário: ${eletiva.horario?.diaSemana} ${eletiva.horario?.codigoTempo}</span>
                  </div>
                </div>
                <div class="eletiva-actions">
                  <button class="btn-primary btn-small" onclick="imprimirListaFrequenciaGestor(${eletiva.id})">
                    <i class="fas fa-print"></i> FREQUÊNCIA
                  </button>
                  <button class="btn-success btn-small" onclick="imprimirNotasGestor(${eletiva.id})">
                    <i class="fas fa-chart-bar"></i> NOTAS
                  </button>
                </div>
              </div>
              <div class="registros-lista-gestor">
                ${registrosHTML || '<p class="empty-state" style="padding: 1rem;">Nenhum registro encontrado</p>'}
              </div>
            `;

            professorSection.appendChild(card);
          }

          if (professorSection.children.length > 1) {
            fragment.appendChild(professorSection);
          }
        }

        if (fragment.children.length === 0) {
          container.innerHTML =
            '<p class="empty-state">Nenhum registro encontrado</p>';
        } else {
          container.appendChild(fragment);
        }
      } catch (error) {
        console.error("Erro ao carregar registros:", error);
        container.innerHTML =
          '<p class="empty-state">Erro ao carregar registros</p>';
      } finally {
        mostrarLoaderGestor(false);
      }
    }, 50);
  } catch (error) {
    console.error("Erro ao carregar registros:", error);
    container.innerHTML =
      '<p class="empty-state">Erro ao carregar registros</p>';
    mostrarLoaderGestor(false);
  }
}

// Aplicar filtros de registros
window.aplicarFiltrosRegistros = function () {
  carregarRegistrosGestor();
};

// Limpar filtros de registros
window.limparFiltrosRegistros = function () {
  document.getElementById("filtroProfessorRegistros").value = "";

  const hoje = new Date().toISOString().split("T")[0];
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  document.getElementById("filtroDataInicioRegistros").value = trintaDiasAtras
    .toISOString()
    .split("T")[0];
  document.getElementById("filtroDataFimRegistros").value = hoje;

  carregarRegistrosGestor();
};

// Sincronizar dados
window.sincronizarDadosGestor = async function () {
  mostrarLoaderGestor(true);
  try {
    if (window.FirebaseSync) {
      await window.FirebaseSync.processarFilaPendente();
      mostrarSucesso("Dados sincronizados com sucesso!");
    }
    carregarRegistrosGestor();
  } catch (error) {
    console.error("Erro na sincronização:", error);
    mostrarErro("Erro ao sincronizar dados");
  } finally {
    mostrarLoaderGestor(false);
  }
};

// Abrir detalhes do registro
window.abrirDetalhesRegistroGestor = function (registro) {
  if (typeof registro === "string") {
    try {
      registro = JSON.parse(registro);
    } catch (e) {
      console.error("Erro ao parsear registro:", e);
      return;
    }
  }

  const eletiva = state.eletivas?.find((e) => e.id === registro.eletivaId);
  const professor = state.professores?.find(
    (p) => p.id === registro.professorId,
  );

  if (!eletiva || !professor) return;

  const matriculas =
    state.matriculas?.filter((m) => m.eletivaId === registro.eletivaId) || [];
  const alunos =
    state.alunos
      ?.filter((a) => matriculas.some((m) => m.alunoId === a.id))
      .sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  const presentes = registro.frequencia?.presentes || [];
  const ausentes = registro.frequencia?.ausentes || [];

  let tabelaHTML = `
    <p><strong>Professor:</strong> ${professor.nome}</p>
    <p><strong>Total de Alunos:</strong> ${alunos.length} | <strong>Presentes:</strong> ${presentes.length} | <strong>Ausentes:</strong> ${ausentes.length}</p>
    
    <div class="alunos-table-container">
      <table class="alunos-table-gestor">
        <thead>
          <tr>
            <th>Nome do Aluno</th>
            <th>Turma</th>
            <th>SIGE</th>
            <th>Status</th>
            <th>Tempo</th>
          </tr>
        </thead>
        <tbody>
  `;

  alunos.forEach((aluno) => {
    const isPresente = presentes.includes(aluno.codigoSige);
    const status = isPresente ? "✅ Presente" : "❌ Ausente";
    const tempo = isPresente ? eletiva.horario?.codigoTempo || "T1" : "-";

    tabelaHTML += `
      <tr>
        <td>${aluno.nome}</td>
        <td>${aluno.turmaOrigem}</td>
        <td>${aluno.codigoSige}</td>
        <td>${status}</td>
        <td>${tempo}</td>
      </tr>
    `;
  });

  tabelaHTML += `
        </tbody>
      </table>
    </div>
    
    <p><strong>Registro da Aula:</strong></p>
    <p style="background: var(--bg-light); padding: 1rem; border-radius: 8px;">${registro.conteudo}</p>
  `;

  document.getElementById("modalDetalhesTitulo").textContent =
    `📋 DETALHES DO REGISTRO - ${eletiva.nome} - ${formatarData(registro.data)}`;
  document.getElementById("modalDetalhesBody").innerHTML = tabelaHTML;
  document.getElementById("modalDetalhesImprimir").style.display =
    "inline-flex";
  document.getElementById("modalDetalhesImprimir").onclick = () => {
    if (window.imprimirRegistrosPorData) {
      window.imprimirRegistrosPorData(registro.eletivaId, registro.data);
    }
  };

  document.getElementById("modalDetalhesRegistro").classList.add("active");
};

// Abrir detalhes de notas
window.abrirDetalhesNotasGestor = function (nota) {
  if (typeof nota === "string") {
    try {
      nota = JSON.parse(nota);
    } catch (e) {
      console.error("Erro ao parsear nota:", e);
      return;
    }
  }

  const eletiva = state.eletivas?.find((e) => e.id === nota.eletivaId);
  if (!eletiva) return;

  const media =
    nota.notas?.length > 0
      ? (
          nota.notas.reduce((acc, n) => acc + n.nota, 0) / nota.notas.length
        ).toFixed(1)
      : "0.0";

  let alunosHTML = `
    <p><strong>Eletiva:</strong> ${eletiva.nome} | <strong>Semestre:</strong> ${nota.semestre}</p>
    <p><strong>Média da turma:</strong> ${media}</p>
    
    <div class="alunos-table-container">
      <table class="alunos-table-gestor">
        <thead>
          <tr>
            <th>Nome do Aluno</th>
            <th>Turma</th>
            <th>SIGE</th>
            <th>Nota</th>
          </tr>
        </thead>
        <tbody>
  `;

  nota.notas?.forEach((n) => {
    alunosHTML += `
      <tr>
        <td>${n.nome}</td>
        <td>${n.turma}</td>
        <td>${n.sige}</td>
        <td><span class="badge-nota">${n.nota.toFixed(1)}</span></td>
      </tr>
    `;
  });

  alunosHTML += `
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("modalDetalhesTitulo").textContent =
    `📊 DETALHES DAS NOTAS - ${eletiva.nome}`;
  document.getElementById("modalDetalhesBody").innerHTML = alunosHTML;
  document.getElementById("modalDetalhesImprimir").style.display =
    "inline-flex";
  document.getElementById("modalDetalhesImprimir").onclick = () => {
    if (window.imprimirPDFNotas) {
      window.imprimirPDFNotas(eletiva.id, nota.semestre);
    }
  };

  document.getElementById("modalDetalhesRegistro").classList.add("active");
};

// Fechar modal de detalhes
window.fecharModalDetalhes = function () {
  document.getElementById("modalDetalhesRegistro").classList.remove("active");
};

// ========== FUNÇÕES DE ORGANIZAÇÃO COM FILTROS E BUSCA ==========

// Carregar select de professores para filtro
function carregarSelectProfessoresFiltro() {
  const select = document.getElementById("filtroProfessorOrganizar");
  if (!select) return;

  const professores =
    state.professores?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  select.innerHTML = '<option value="TODOS">Todos os professores</option>';

  professores.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.nome;
    select.appendChild(option);
  });
}

// Carregar select de dias para filtro
function carregarSelectDiasFiltro() {
  const select = document.getElementById("filtroDiaOrganizar");
  if (!select) return;

  select.innerHTML = '<option value="TODOS">Todos os dias</option>';

  diasSemana.forEach((dia) => {
    const option = document.createElement("option");
    option.value = dia;
    option.textContent = dia;
    select.appendChild(option);
  });
}

// Carregar select de professores para modal de criação
function carregarSelectProfessoresModal() {
  const select = document.getElementById("selectProfessorNovaEletiva");
  if (!select) return;

  const professores =
    state.professores?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  select.innerHTML = '<option value="">Selecione um professor</option>';

  professores.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.nome;
    select.appendChild(option);
  });
}

// Carregar checkboxes de turmas
function carregarTurmasCheckboxes() {
  const container = document.getElementById("turmasCheckboxContainer");
  if (!container) return;

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

  let html =
    '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">';

  turmas.forEach((turma) => {
    html += `
      <label style="display: flex; align-items: center; gap: 0.3rem;">
        <input type="checkbox" class="turma-checkbox" value="${turma}">
        ${turma}
      </label>
    `;
  });

  html += "</div>";

  container.innerHTML = html;
}

// Selecionar todas as turmas
window.selecionarTodasTurmas = function (selecionar) {
  document.querySelectorAll(".turma-checkbox").forEach((cb) => {
    cb.checked = selecionar;
  });
};

// Aplicar filtros na organização
window.aplicarFiltrosOrganizar = function () {
  carregarEletivasOrganizar();
};

// Limpar filtros e busca
window.limparFiltrosOrganizar = function () {
  document.getElementById("buscaOrganizar").value = "";
  document.getElementById("filtroTipoOrganizar").value = "todas";
  document.getElementById("filtroDiaOrganizar").value = "TODOS";
  document.getElementById("filtroProfessorOrganizar").value = "TODOS";
  document.getElementById("filtroDiaOrganizarContainer").style.display = "none";
  document.getElementById("filtroProfOrganizarContainer").style.display =
    "none";
  carregarEletivasOrganizar();
};

// Mostrar/esconder campos de filtro
window.mudarTipoFiltro = function () {
  const tipo = document.getElementById("filtroTipoOrganizar")?.value;

  if (tipo === "dia") {
    document.getElementById("filtroDiaOrganizarContainer").style.display =
      "block";
    document.getElementById("filtroProfOrganizarContainer").style.display =
      "none";
  } else if (tipo === "professor") {
    document.getElementById("filtroDiaOrganizarContainer").style.display =
      "none";
    document.getElementById("filtroProfOrganizarContainer").style.display =
      "block";
  } else {
    document.getElementById("filtroDiaOrganizarContainer").style.display =
      "none";
    document.getElementById("filtroProfOrganizarContainer").style.display =
      "none";
  }
};

// Validar formato do código da eletiva
function validarFormatoCodigo(codigo) {
  // Entre 3 e 6 caracteres, apenas letras e números
  const regex = /^[A-Za-z0-9]{3,6}$/;
  return regex.test(codigo);
}

// Verificar se código já existe
async function verificarCodigoExistente(codigo) {
  try {
    // Padronizar para maiúsculas
    codigo = codigo.toUpperCase();

    // Verificar no state
    if (state.eletivas?.some((e) => e.codigo?.toUpperCase() === codigo)) {
      return true;
    }

    // Verificar no Firebase se disponível
    if (window.FirebaseSync) {
      const dados = await window.FirebaseSync.carregarDadosFirebase("eletivas");
      if (dados?.some((e) => e.codigo?.toUpperCase() === codigo)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Erro ao verificar código:", error);
    return false;
  }
}

// Verificar código em tempo real
window.verificarCodigoTempoReal = async function () {
  const input = document.getElementById("novoEletivaCodigo");
  const status = document.getElementById("codigoStatus");

  if (!input || !status) return;

  const codigo = input.value.trim();

  if (codigo.length < 3) {
    status.innerHTML =
      '<span style="color: var(--warning);">🔍 Mínimo 3 caracteres</span>';
    return;
  }

  if (!validarFormatoCodigo(codigo)) {
    status.innerHTML =
      '<span style="color: var(--danger);">❌ Código deve ter 3-6 caracteres (letras e números)</span>';
    return;
  }

  mostrarLoading("Verificando disponibilidade...");

  try {
    const existe = await verificarCodigoExistente(codigo);

    if (existe) {
      status.innerHTML = `<span style="color: var(--danger);">❌ Código ${codigo.toUpperCase()} já existe!</span>`;
    } else {
      status.innerHTML = `<span style="color: var(--success);">✅ Código ${codigo.toUpperCase()} disponível!</span>`;
    }
  } catch (error) {
    status.innerHTML =
      '<span style="color: var(--warning);">⚠️ Erro ao verificar</span>';
  } finally {
    fecharLoading();
  }
};

// Abrir modal de nova eletiva
window.abrirModalNovaEletiva = function () {
  // Resetar formulário
  document.getElementById("novoEletivaNome").value = "";
  document.getElementById("novoEletivaCodigo").value = "";
  document.getElementById("codigoStatus").innerHTML = "";
  document.getElementById("selectProfessorNovaEletiva").value = "";
  document
    .querySelectorAll('input[name="tipoEletiva"]')
    .forEach((r) => (r.checked = false));
  document.getElementById("tipoMista").checked = true;
  document.getElementById("selectDiaNovaEletiva").value = "SEGUNDA-FEIRA";
  document.getElementById("horarioInicio").value = "14:00";
  document.getElementById("horarioFim").value = "15:30";

  // Carregar turmas
  carregarTurmasCheckboxes();

  // Carregar professores
  carregarSelectProfessoresModal();

  // Abrir modal
  document.getElementById("modalNovaEletiva").classList.add("active");
};

// Fechar modal de nova eletiva
window.fecharModalNovaEletiva = function () {
  document.getElementById("modalNovaEletiva").classList.remove("active");
};

// Abrir modal de novo professor
window.abrirModalNovoProfessor = function () {
  document.getElementById("novoProfessorNome").value = "";
  document.getElementById("novoProfessorEmail").value = "";
  document.getElementById("modalNovoProfessor").classList.add("active");
};

// Fechar modal de novo professor
window.fecharModalNovoProfessor = function () {
  document.getElementById("modalNovoProfessor").classList.remove("active");
};

// Cadastrar novo professor
window.cadastrarNovoProfessor = async function () {
  const nome = document.getElementById("novoProfessorNome")?.value.trim();
  const email = document.getElementById("novoProfessorEmail")?.value.trim();

  if (!nome || !email) {
    mostrarErro("Preencha todos os campos");
    return;
  }

  mostrarLoading("Cadastrando professor...");

  try {
    // Criar novo professor
    const novoId = (state.professores?.length || 0) + 1;
    const novoProfessor = {
      id: novoId,
      nome: nome,
      email: email,
      perfil: "PROFESSOR",
    };

    if (!state.professores) state.professores = [];
    state.professores.push(novoProfessor);
    salvarEstado();

    if (window.FirebaseSync) {
      await window.FirebaseSync.salvarDadosFirebase(
        "professores",
        novoProfessor,
        novoId,
      );
    }

    // Atualizar selects
    carregarSelectProfessoresModal();
    carregarSelectProfessoresFiltro();
    carregarSelectProfessoresRegistros();

    mostrarSucesso("Professor cadastrado com sucesso!");
    fecharModalNovoProfessor();

    // Selecionar o novo professor no dropdown
    document.getElementById("selectProfessorNovaEletiva").value = novoId;
  } catch (error) {
    console.error("Erro ao cadastrar professor:", error);
    mostrarErro("Erro ao cadastrar professor");
  } finally {
    fecharLoading();
  }
};

// Criar nova eletiva
window.criarNovaEletiva = async function () {
  const nome = document.getElementById("novoEletivaNome")?.value.trim();
  const codigo = document.getElementById("novoEletivaCodigo")?.value.trim();
  const professorId = document.getElementById(
    "selectProfessorNovaEletiva",
  )?.value;
  const tipo =
    document.querySelector('input[name="tipoEletiva"]:checked')?.value ||
    "MISTA";
  const dia = document.getElementById("selectDiaNovaEletiva")?.value;
  const horarioInicio = document.getElementById("horarioInicio")?.value;
  const horarioFim = document.getElementById("horarioFim")?.value;

  // Coletar turmas selecionadas
  const turmasSelecionadas = [];
  document.querySelectorAll(".turma-checkbox:checked").forEach((cb) => {
    turmasSelecionadas.push(cb.value);
  });

  // Validações
  if (!nome || nome.length < 3) {
    mostrarErro("Nome da eletiva é obrigatório (mínimo 3 caracteres)");
    return;
  }

  if (!codigo) {
    mostrarErro("Código da eletiva é obrigatório");
    return;
  }

  if (!validarFormatoCodigo(codigo)) {
    mostrarErro("Código deve ter entre 3 e 6 caracteres (letras e números)");
    return;
  }

  const codigoExistente = await verificarCodigoExistente(codigo);
  if (codigoExistente) {
    mostrarErro(`Já existe uma eletiva com o código ${codigo.toUpperCase()}`);
    return;
  }

  if (!professorId) {
    mostrarErro("Selecione um professor");
    return;
  }

  if (turmasSelecionadas.length === 0) {
    mostrarErro("Selecione pelo menos uma turma");
    return;
  }

  mostrarLoading("Criando nova eletiva...");

  try {
    const professor = state.professores?.find(
      (p) => p.id === parseInt(professorId),
    );

    // Mapear dia da semana para formato do sistema
    const diaMap = {
      "SEGUNDA-FEIRA": "segunda",
      "TERÇA-FEIRA": "terca",
      "QUARTA-FEIRA": "quarta",
      "QUINTA-FEIRA": "quinta",
      "SEXTA-FEIRA": "sexta",
      SÁBADO: "sabado",
      DOMINGO: "domingo",
    };

    // Mapear horário para código de tempo
    const horarioMap = {
      "07:00-08:40": "T1",
      "08:55-10:35": "T2",
      "10:50-12:30": "T3",
      "13:30-15:10": "T4",
      "15:25-17:05": "T5",
    };

    const horarioCompleto = `${horarioInicio}-${horarioFim}`;
    const codigoTempo = horarioMap[horarioCompleto] || "T1";

    // Criar nova eletiva
    const novaEletiva = {
      id: state.eletivas.length + 1000 + Math.floor(Math.random() * 100),
      codigo: codigo.toUpperCase(),
      nome: nome,
      tipo: tipo,
      professorId: parseInt(professorId),
      professorNome: professor?.nome || "",
      horario: {
        diaSemana: diaMap[dia] || "segunda",
        codigoTempo: codigoTempo,
      },
      local: turmasSelecionadas.join(", "),
      vagas: 40,
      seriesPermitidas: ["1ª", "2ª", "3ª"],
      turmaOrigem: turmasSelecionadas.join(", "),
      semestreId: "2026-1",
      dataCriacao: new Date().toISOString(),
    };

    if (!state.eletivas) state.eletivas = [];
    state.eletivas.push(novaEletiva);
    salvarEstado();

    if (window.FirebaseSync) {
      await window.FirebaseSync.salvarDadosFirebase(
        "eletivas",
        novaEletiva,
        novaEletiva.id,
      );
    }

    mostrarSucesso("Eletiva criada com sucesso!");
    fecharModalNovaEletiva();

    // Recarregar listas
    carregarEletivasOrganizar();
    carregarEstatisticas();
    carregarEletivasLiberacao();
  } catch (error) {
    console.error("Erro ao criar eletiva:", error);
    mostrarErro("Erro ao criar eletiva");
  } finally {
    fecharLoading();
  }
};

// Filtrar eletivas (função auxiliar)
function filtrarEletivas(eletivas) {
  const tipo = document.getElementById("filtroTipoOrganizar")?.value;
  const dia = document.getElementById("filtroDiaOrganizar")?.value;
  const professorId = document.getElementById(
    "filtroProfessorOrganizar",
  )?.value;
  const busca =
    document.getElementById("buscaOrganizar")?.value?.toLowerCase() || "";

  const diaMap = {
    "SEGUNDA-FEIRA": "segunda",
    "TERÇA-FEIRA": "terca",
    "QUARTA-FEIRA": "quarta",
    "QUINTA-FEIRA": "quinta",
    "SEXTA-FEIRA": "sexta",
    SÁBADO: "sabado",
    DOMINGO: "domingo",
  };

  return eletivas.filter((eletiva) => {
    // Aplicar filtro por tipo
    if (tipo === "dia" && dia !== "TODOS") {
      const diaSistema = diaMap[dia] || dia.toLowerCase();
      if (eletiva.horario?.diaSemana?.toLowerCase() !== diaSistema)
        return false;
    }

    if (tipo === "professor" && professorId !== "TODOS") {
      if (eletiva.professorId !== parseInt(professorId)) return false;
    }

    // Aplicar busca
    if (busca) {
      const professor =
        state.professores?.find((p) => p.id === eletiva.professorId)?.nome ||
        "";
      return (
        eletiva.nome?.toLowerCase().includes(busca) ||
        eletiva.codigo?.toLowerCase().includes(busca) ||
        professor.toLowerCase().includes(busca)
      );
    }

    return true;
  });
}

// Carregar eletivas para organização (COM FILTROS E BUSCA)
function carregarEletivasOrganizar() {
  const container = document.getElementById("eletivasOrganizarContainer");
  if (!container) return;

  const todasEletivas = state.eletivas || [];
  const eletivasFiltradas = filtrarEletivas(todasEletivas);

  container.innerHTML = "";

  // Atualizar contador de resultados
  const contador = document.getElementById("resultadosContador");
  if (contador) {
    contador.textContent = `(${eletivasFiltradas.length} eletivas encontradas)`;
  }

  if (eletivasFiltradas.length === 0) {
    container.innerHTML =
      '<p class="empty-state">Nenhuma eletiva encontrada com os critérios selecionados</p>';
    return;
  }

  eletivasFiltradas.sort((a, b) => a.nome.localeCompare(b.nome));

  eletivasFiltradas.forEach((eletiva) => {
    const professor = state.professores?.find(
      (p) => p.id === eletiva.professorId,
    );
    const matriculas =
      state.matriculas?.filter((m) => m.eletivaId === eletiva.id) || [];
    const totalAlunos = matriculas.length;

    const card = document.createElement("div");
    card.className = "eletiva-card-organizacao";

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <div>
          <h3 style="color: var(--primary);">${eletiva.nome} | Código: ${eletiva.codigo}</h3>
          <p style="font-size: 0.9rem; color: var(--text-light);">Professor: ${professor?.nome || "Não atribuído"}</p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn-primary btn-small" onclick="editarEletivaOrganizacao(${eletiva.id})">
            <i class="fas fa-edit"></i> EDITAR
          </button>
          <button class="btn-danger btn-small" onclick="confirmarRemoverEletiva(${eletiva.id})">
            <i class="fas fa-trash"></i> REMOVER
          </button>
        </div>
      </div>

      <div style="background: var(--bg-light); padding: 0.8rem; border-radius: 8px; margin-bottom: 0.8rem;">
        <p><strong>Tipo:</strong> ${eletiva.tipo || "MISTA"} | <strong>Turmas:</strong> ${eletiva.turmaOrigem || "Várias"} | <strong>Horário:</strong> ${eletiva.horario?.diaSemana} ${eletiva.horario?.codigoTempo}</p>
        <p><strong>👥 Total de alunos:</strong> ${totalAlunos}</p>
      </div>

      <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
        <button class="btn-secondary btn-small" onclick="verAlunosEstatisticas(${eletiva.id}, '1/2026')">
          <i class="fas fa-eye"></i> VER ALUNOS
        </button>
        <button class="btn-success btn-small" onclick="abrirAdicionarAluno(${eletiva.id})">
          <i class="fas fa-plus"></i> ADICIONAR
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

// Editar eletiva na organização
window.editarEletivaOrganizacao = function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  eletivaEmEdicao = eletiva;

  const professores =
    state.professores?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  let optionsHTML = professores
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === eletiva.professorId ? "selected" : ""}>${p.nome}</option>`,
    )
    .join("");

  const horario = eletiva.horario || {
    diaSemana: "segunda",
    codigoTempo: "T1",
  };
  const horarios = CONFIG.horarios || [];

  const diasOptions = [
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
    "domingo",
  ]
    .map(
      (dia) =>
        `<option value="${dia}" ${dia === horario.diaSemana ? "selected" : ""}>${dia.charAt(0).toUpperCase() + dia.slice(1)}</option>`,
    )
    .join("");

  const tempoOptions = horarios
    .map(
      (h) =>
        `<option value="${h.codigo}" ${h.codigo === horario.codigoTempo ? "selected" : ""}>${h.descricao}</option>`,
    )
    .join("");

  const modalBody = `
    <form id="formEditarEletiva">
      <div class="form-group">
        <label>Nome da Eletiva:</label>
        <input type="text" id="editNomeEletiva" value="${eletiva.nome}" required>
      </div>
      
      <div class="form-group">
        <label>Código:</label>
        <input type="text" id="editCodigoEletiva" value="${eletiva.codigo}" required readonly style="background: var(--bg-gray);">
      </div>
      
      <div class="form-group">
        <label>Professor:</label>
        <select id="editProfessorEletiva" required>
          ${optionsHTML}
        </select>
      </div>
      
      <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label>Dia da semana:</label>
          <select id="editDiaEletiva">
            ${diasOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Horário:</label>
          <select id="editHorarioEletiva">
            ${tempoOptions}
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label>Turmas atendidas:</label>
        <input type="text" id="editTurmasEletiva" value="${eletiva.turmaOrigem || ""}" placeholder="Ex: 3ºA, 3ºB">
      </div>
      
      <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-light); border-radius: 8px;">
        <p><strong>⚠️ AVISOS:</strong></p>
        <ul style="margin-left: 1.5rem;">
          <li>Alterar professor mantém todos os registros da eletiva</li>
          <li>Alunos vinculados serão mantidos</li>
        </ul>
      </div>
    </form>
  `;

  document.getElementById("modalEditarTitulo").textContent =
    `✏️ EDITAR ELETIVA - ${eletiva.nome}`;
  document.getElementById("modalEditarBody").innerHTML = modalBody;
  document.getElementById("modalEditarEletiva").classList.add("active");
};

// Salvar edição da eletiva
window.salvarEdicaoEletiva = function () {
  if (!eletivaEmEdicao) return;

  const nome = document.getElementById("editNomeEletiva")?.value;
  const professorId = document.getElementById("editProfessorEletiva")?.value;
  const dia = document.getElementById("editDiaEletiva")?.value;
  const horarioCodigo = document.getElementById("editHorarioEletiva")?.value;
  const turmas = document.getElementById("editTurmasEletiva")?.value;

  if (!nome || !professorId) {
    mostrarErro("Preencha todos os campos obrigatórios");
    return;
  }

  const professor = state.professores?.find(
    (p) => p.id === parseInt(professorId),
  );

  const index = state.eletivas.findIndex((e) => e.id === eletivaEmEdicao.id);
  if (index !== -1) {
    state.eletivas[index] = {
      ...eletivaEmEdicao,
      nome: nome,
      professorId: parseInt(professorId),
      professorNome: professor?.nome || "",
      horario: {
        diaSemana: dia,
        codigoTempo: horarioCodigo,
      },
      turmaOrigem: turmas,
    };

    salvarEstado();

    if (window.FirebaseSync) {
      window.FirebaseSync.salvarDadosFirebase(
        "eletivas",
        state.eletivas[index],
        state.eletivas[index].id,
      );
    }

    mostrarSucesso("Eletiva atualizada com sucesso!");
    fecharModalEditarEletiva();
    carregarEletivasOrganizar();
    carregarEstatisticas();
    carregarEletivasLiberacao();
  }
};

// Fechar modal de edição
window.fecharModalEditarEletiva = function () {
  document.getElementById("modalEditarEletiva").classList.remove("active");
  eletivaEmEdicao = null;
};

// Confirmar remover eletiva
window.confirmarRemoverEletiva = function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  const confirmBody = document.getElementById("confirmBody");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmBtn = document.getElementById("confirmActionBtn");

  confirmTitle.textContent = "Confirmar Exclusão";
  confirmBody.innerHTML = `
    <p>Tem certeza que deseja remover a eletiva <strong>${eletiva.nome}</strong>?</p>
    <p style="color: var(--danger); margin-top: 0.5rem;">⚠️ TODOS os registros desta eletiva serão apagados!</p>
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

// Remover eletiva
function removerEletiva(eletivaId) {
  state.eletivas = state.eletivas.filter((e) => e.id !== eletivaId);
  state.matriculas = state.matriculas.filter((m) => m.eletivaId !== eletivaId);
  state.registros = state.registros.filter((r) => r.eletivaId !== eletivaId);
  state.notas = state.notas.filter((n) => n.eletivaId !== eletivaId);

  salvarEstado();

  if (window.FirebaseSync) {
    window.FirebaseSync.salvarDadosFirebase("eletivas", null, eletivaId);
  }

  registrarMovimentacao("remocao_eletiva", { eletivaId });

  mostrarSucesso("Eletiva removida com sucesso!");
  carregarEletivasOrganizar();
  carregarEstatisticas();
  carregarEletivasLiberacao();
}

// ========== FUNÇÕES DE TROCA DE ALUNO ==========

// Abrir trocar aluno
window.abrirTrocarAluno = function (eletivaId, alunoId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  const aluno = state.alunos?.find((a) => a.id === alunoId);
  const professor = state.professores?.find(
    (p) => p.id === eletiva?.professorId,
  );

  if (!eletiva || !aluno) return;

  alunoEmTroca = { eletivaId, alunoId };

  // Buscar outras eletivas no MESMO HORÁRIO
  const outrasEletivas =
    state.eletivas?.filter(
      (e) => e.id !== eletivaId && temMesmoHorario(e, eletiva),
    ) || [];

  // Buscar eletivas em horários diferentes
  const outrasEletivasDiferentes =
    state.eletivas?.filter(
      (e) => e.id !== eletivaId && !temMesmoHorario(e, eletiva),
    ) || [];

  let opcoesHTML = "";

  if (outrasEletivas.length > 0) {
    opcoesHTML +=
      "<p><strong>✅ ELETIVAS DISPONÍVEIS NO MESMO HORÁRIO:</strong></p>";
    outrasEletivas.forEach((e) => {
      const prof = state.professores?.find((p) => p.id === e.professorId);
      opcoesHTML += `
        <div class="eletiva-radio-option">
          <input type="radio" name="novaEletiva" value="${e.id}" id="eletiva_${e.id}">
          <label for="eletiva_${e.id}">
            <strong>${e.nome}</strong> (${prof?.nome}) - ${e.horario?.diaSemana} ${e.horario?.codigoTempo}
          </label>
        </div>
      `;
    });
  }

  if (outrasEletivasDiferentes.length > 0) {
    opcoesHTML +=
      '<p style="margin-top: 1rem;"><strong>❌ ELETIVAS EM HORÁRIOS DIFERENTES (NÃO PERMITIDO):</strong></p>';
    outrasEletivasDiferentes.slice(0, 3).forEach((e) => {
      const prof = state.professores?.find((p) => p.id === e.professorId);
      opcoesHTML += `
        <div class="eletiva-radio-option disabled">
          <input type="radio" disabled>
          <label>
            <strong>${e.nome}</strong> (${prof?.nome}) - ${e.horario?.diaSemana} ${e.horario?.codigoTempo}
          </label>
        </div>
      `;
    });
    if (outrasEletivasDiferentes.length > 3) {
      opcoesHTML += `<p style="color: var(--text-light);">... e mais ${outrasEletivasDiferentes.length - 3} eletivas</p>`;
    }
  }

  if (outrasEletivas.length === 0) {
    opcoesHTML =
      '<p class="empty-state">Nenhuma eletiva disponível no mesmo horário</p>';
  }

  const modalBody = `
    <p><strong>Aluno:</strong> ${aluno.nome} (${aluno.turmaOrigem}) - SIGE: ${aluno.codigoSige}</p>
    <p><strong>Eletiva atual:</strong> ${eletiva.nome} (${professor?.nome}) - ${eletiva.horario?.diaSemana} ${eletiva.horario?.codigoTempo}</p>
    
    <div class="eletivas-disponiveis" style="margin-top: 1.5rem;">
      ${opcoesHTML}
    </div>
    
    <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-light); border-radius: 8px;">
      <p><strong>⚠️ REGRAS:</strong></p>
      <ul style="margin-left: 1.5rem;">
        <li>Aluno só pode trocar para eletivas no MESMO horário</li>
        <li>Registros anteriores permanecem na eletiva original</li>
      </ul>
    </div>
  `;

  document.getElementById("modalTrocarAlunoBody").innerHTML = modalBody;
  document.getElementById("modalTrocarAluno").classList.add("active");
};

// Confirmar troca de aluno
window.confirmarTrocaAluno = function () {
  if (!alunoEmTroca) return;

  const radioSelecionado = document.querySelector(
    'input[name="novaEletiva"]:checked',
  );
  if (!radioSelecionado) {
    mostrarErro("Selecione uma nova eletiva");
    return;
  }

  const novaEletivaId = parseInt(radioSelecionado.value);
  const eletivaOrigem = state.eletivas?.find(
    (e) => e.id === alunoEmTroca.eletivaId,
  );
  const eletivaDestino = state.eletivas?.find((e) => e.id === novaEletivaId);
  const aluno = state.alunos?.find((a) => a.id === alunoEmTroca.alunoId);

  if (!eletivaOrigem || !eletivaDestino || !aluno) return;

  // Validar mesmo horário
  if (!temMesmoHorario(eletivaOrigem, eletivaDestino)) {
    mostrarErro("Só é possível trocar para eletivas no mesmo horário");
    return;
  }

  // Remover matrícula antiga
  state.matriculas = state.matriculas.filter(
    (m) =>
      !(
        m.alunoId === alunoEmTroca.alunoId &&
        m.eletivaId === alunoEmTroca.eletivaId
      ),
  );

  // Adicionar nova matrícula
  const novaMatricula = {
    id: state.matriculas.length + 1,
    eletivaId: novaEletivaId,
    alunoId: alunoEmTroca.alunoId,
    tipoMatricula: "troca",
    dataMatricula: new Date().toISOString().split("T")[0],
    semestreId: "2026-1",
  };

  state.matriculas.push(novaMatricula);
  salvarEstado();

  if (window.FirebaseSync) {
    window.FirebaseSync.salvarDadosFirebase(
      "matriculas",
      novaMatricula,
      novaMatricula.id,
    );
  }

  registrarMovimentacao("troca", {
    alunoId: aluno.id,
    alunoNome: aluno.nome,
    origem: eletivaOrigem.id,
    origemNome: eletivaOrigem.nome,
    destino: eletivaDestino.id,
    destinoNome: eletivaDestino.nome,
  });

  mostrarSucesso("Aluno trocado de eletiva com sucesso!");
  fecharModalTrocarAluno();
  carregarEletivasOrganizar();
  carregarEstatisticas();
};

// Fechar modal de troca
window.fecharModalTrocarAluno = function () {
  document.getElementById("modalTrocarAluno").classList.remove("active");
  alunoEmTroca = null;
};

// ========== FUNÇÕES DE EDIÇÃO DE ALUNO (COM SIGE INAUTERÁVEL) ==========

// Editar aluno
window.editarAluno = function (alunoId, eletivaId) {
  const aluno = state.alunos?.find((a) => a.id === alunoId);
  if (!aluno) return;

  alunoEmEdicao = { aluno, eletivaId };

  const turmasOptions = CONFIG.turmas
    ?.map(
      (t) =>
        `<option value="${t}" ${t === aluno.turmaOrigem ? "selected" : ""}>${t}</option>`,
    )
    .join("");

  const modalBody = `
    <p><strong>Aluno:</strong> ${aluno.nome}</p>
    <p><strong>SIGE:</strong> ${aluno.codigoSige} <span style="color: var(--danger);">(🔒 NÃO ALTERÁVEL)</span></p>
    
    <div class="form-group">
      <label>Nome completo:</label>
      <input type="text" id="editAlunoNome" value="${aluno.nome}" required>
    </div>
    
    <div class="form-group">
      <label>Turma:</label>
      <select id="editAlunoTurma">
        ${turmasOptions}
      </select>
    </div>
    
    <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-light); border-radius: 8px;">
      <p><strong>⚠️ AVISO IMPORTANTE:</strong></p>
      <p>O SIGE é a identificação única do aluno e <strong>NÃO PODE SER ALTERADO</strong>.</p>
      <p>Se o SIGE estiver incorreto, remova o aluno e adicione novamente com o SIGE correto (o histórico será perdido).</p>
    </div>
  `;

  document.getElementById("modalEditarAlunoBody").innerHTML = modalBody;
  document.getElementById("modalEditarAluno").classList.add("active");
};

// Editar aluno no modal de estatísticas
window.editarAlunoModal = function (alunoId, eletivaId) {
  editarAluno(alunoId, eletivaId);
};

// Salvar edição de aluno (SEM SIGE)
window.salvarEdicaoAluno = function () {
  if (!alunoEmEdicao) return;

  const nome = document.getElementById("editAlunoNome")?.value;
  const turma = document.getElementById("editAlunoTurma")?.value;

  if (!nome || !turma) {
    mostrarErro("Preencha todos os campos");
    return;
  }

  const index = state.alunos.findIndex((a) => a.id === alunoEmEdicao.aluno.id);
  if (index !== -1) {
    state.alunos[index] = {
      ...state.alunos[index],
      nome: nome,
      turmaOrigem: turma,
      // SIGE NÃO É ALTERADO
    };

    salvarEstado();

    if (window.FirebaseSync) {
      window.FirebaseSync.salvarDadosFirebase(
        "alunos",
        state.alunos[index],
        state.alunos[index].id,
      );
    }

    registrarMovimentacao("edicao_aluno", {
      alunoId: alunoEmEdicao.aluno.id,
      nomeAntigo: alunoEmEdicao.aluno.nome,
      nomeNovo: nome,
    });

    mostrarSucesso("Aluno atualizado com sucesso!");
    fecharModalEditarAluno();

    // Recarregar visualizações
    carregarEletivasOrganizar();
    if (
      document.getElementById("tab-estatisticas").classList.contains("active")
    ) {
      carregarEstatisticas();
    }
  }
};

// Fechar modal de edição de aluno
window.fecharModalEditarAluno = function () {
  document.getElementById("modalEditarAluno").classList.remove("active");
  alunoEmEdicao = null;
};

// Confirmar remover aluno
window.confirmarRemoverAluno = function (eletivaId, alunoId) {
  const aluno = state.alunos?.find((a) => a.id === alunoId);
  if (!aluno) return;

  const confirmBody = document.getElementById("confirmBody");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmBtn = document.getElementById("confirmActionBtn");

  confirmTitle.textContent = "Confirmar Remoção";
  confirmBody.innerHTML = `
    <p>Remover aluno <strong>${aluno.nome}</strong> desta eletiva?</p>
    <p style="margin-top: 0.5rem;">⚠️ Registros anteriores serão mantidos.</p>
  `;

  const originalOnClick = confirmBtn.onclick;
  confirmBtn.onclick = function () {
    removerAlunoDaEletiva(eletivaId, alunoId);
    fecharModalConfirmacao();
    setTimeout(() => {
      confirmBtn.onclick = originalOnClick;
    }, 100);
  };

  document.getElementById("modalConfirmacao").classList.add("active");
};

// Remover aluno da eletiva
function removerAlunoDaEletiva(eletivaId, alunoId) {
  const aluno = state.alunos?.find((a) => a.id === alunoId);
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);

  state.matriculas = state.matriculas.filter(
    (m) => !(m.alunoId === alunoId && m.eletivaId === eletivaId),
  );

  salvarEstado();

  registrarMovimentacao("remocao", {
    alunoId,
    alunoNome: aluno?.nome,
    eletivaId,
    eletivaNome: eletiva?.nome,
  });

  mostrarSucesso("Aluno removido da eletiva");
  carregarEletivasOrganizar();
  if (
    document.getElementById("tab-estatisticas").classList.contains("active")
  ) {
    carregarEstatisticas();
  }
}

// ========== FUNÇÕES DE ADIÇÃO DE ALUNO ==========

// Abrir adicionar aluno (COM AVISO SOBRE SIGE)
window.abrirAdicionarAluno = function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  const turmasOptions = CONFIG.turmas
    ?.map((t) => `<option value="${t}">${t}</option>`)
    .join("");

  const modalBody = `
    <p><strong>Adicionar novo aluno à eletiva:</strong> ${eletiva.nome}</p>
    
    <div class="form-group">
      <label>Nome completo:</label>
      <input type="text" id="novoAlunoNome" placeholder="Digite o nome completo" required>
    </div>
    
    <div class="form-group">
      <label>SIGE (número de matrícula):</label>
      <input type="text" id="novoAlunoSige" placeholder="Apenas números" required pattern="\\d+">
      <small style="color: var(--danger);">⚠️ SIGE NÃO PODE SER ALTERADO DEPOIS</small>
    </div>
    
    <div class="form-group">
      <label>Turma de origem:</label>
      <select id="novoAlunoTurma">
        ${turmasOptions}
      </select>
    </div>
    
    <div class="form-group">
      <label>Data de entrada:</label>
      <input type="date" id="novoAlunoData" value="${new Date().toISOString().split("T")[0]}" readonly>
    </div>
    
    <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-light); border-radius: 8px;">
      <p><strong>⚠️ AVISO:</strong> Aluno será adicionado à eletiva imediatamente</p>
    </div>
  `;

  document.getElementById("modalAdicionarTitulo").textContent =
    `➕ ADICIONAR NOVO ALUNO - ${eletiva.nome}`;
  document.getElementById("modalAdicionarAlunoBody").innerHTML = modalBody;
  document.getElementById("modalAdicionarAluno").classList.add("active");
  alunoParaAdicionar = { eletivaId };
};

// Confirmar adicionar aluno
window.confirmarAdicionarAluno = function () {
  if (!alunoParaAdicionar) return;

  const nome = document.getElementById("novoAlunoNome")?.value;
  const sige = document.getElementById("novoAlunoSige")?.value;
  const turma = document.getElementById("novoAlunoTurma")?.value;

  if (!nome || !sige || !turma) {
    mostrarErro("Preencha todos os campos");
    return;
  }

  if (!/^\d+$/.test(sige)) {
    mostrarErro("SIGE deve conter apenas números");
    return;
  }

  // Verificar se aluno já existe por SIGE
  const alunoExistente = state.alunos?.find((a) => a.codigoSige === sige);
  let alunoId;

  if (alunoExistente) {
    // Usar aluno existente
    alunoId = alunoExistente.id;
    mostrarAviso("Aluno já cadastrado no sistema. Adicionando à eletiva...");
  } else {
    // Criar novo aluno
    alunoId = (state.alunos?.length || 0) + 1;
    const novoAluno = {
      id: alunoId,
      nome: nome,
      codigoSige: sige,
      turmaOrigem: turma,
      serie: turma?.substring(0, 3) || "1ª",
    };

    if (!state.alunos) state.alunos = [];
    state.alunos.push(novoAluno);
  }

  // Verificar se já está matriculado
  const jaMatriculado = state.matriculas?.some(
    (m) =>
      m.alunoId === alunoId && m.eletivaId === alunoParaAdicionar.eletivaId,
  );

  if (jaMatriculado) {
    mostrarAviso("Aluno já está matriculado nesta eletiva");
    fecharModalAdicionarAluno();
    return;
  }

  // Criar matrícula
  const novaMatricula = {
    id: (state.matriculas?.length || 0) + 1,
    eletivaId: alunoParaAdicionar.eletivaId,
    alunoId: alunoId,
    tipoMatricula: "manual",
    dataMatricula: new Date().toISOString().split("T")[0],
    semestreId: "2026-1",
  };

  if (!state.matriculas) state.matriculas = [];
  state.matriculas.push(novaMatricula);
  salvarEstado();

  if (window.FirebaseSync) {
    window.FirebaseSync.salvarDadosFirebase(
      "matriculas",
      novaMatricula,
      novaMatricula.id,
    );
    if (!alunoExistente) {
      window.FirebaseSync.salvarDadosFirebase(
        "alunos",
        state.alunos[state.alunos.length - 1],
        alunoId,
      );
    }
  }

  registrarMovimentacao("novo_aluno", {
    alunoId,
    alunoNome: nome,
    eletivaId: alunoParaAdicionar.eletivaId,
    sige,
  });

  mostrarSucesso("Aluno adicionado com sucesso!");
  fecharModalAdicionarAluno();
  carregarEletivasOrganizar();
  if (
    document.getElementById("tab-estatisticas").classList.contains("active")
  ) {
    carregarEstatisticas();
  }
};

// Fechar modal de adicionar aluno
window.fecharModalAdicionarAluno = function () {
  document.getElementById("modalAdicionarAluno").classList.remove("active");
  alunoParaAdicionar = null;
};

// Abrir adicionar aluno existente
window.abrirAdicionarExistente = function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  // Listar todos os alunos que NÃO estão nesta eletiva
  const matriculasIds =
    state.matriculas
      ?.filter((m) => m.eletivaId === eletivaId)
      .map((m) => m.alunoId) || [];
  const alunosDisponiveis =
    state.alunos
      ?.filter((a) => !matriculasIds.includes(a.id))
      .sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  let resultadosHTML = "";

  if (alunosDisponiveis.length === 0) {
    resultadosHTML =
      '<p class="empty-state">Nenhum aluno disponível para adicionar</p>';
  } else {
    alunosDisponiveis.slice(0, 10).forEach((aluno) => {
      resultadosHTML += `
        <div class="resultado-item">
          <input type="radio" name="alunoExistente" value="${aluno.id}" id="aluno_${aluno.id}">
          <label for="aluno_${aluno.id}">
            <strong>${aluno.nome}</strong> (${aluno.turmaOrigem}) - SIGE: ${aluno.codigoSige}
          </label>
        </div>
      `;
    });

    if (alunosDisponiveis.length > 10) {
      resultadosHTML += `<p style="text-align: center; color: var(--text-light);">... e mais ${alunosDisponiveis.length - 10} alunos</p>`;
    }
  }

  const modalBody = `
    <p><strong>Adicionar aluno existente à eletiva:</strong> ${eletiva.nome}</p>
    
    <div class="search-box" style="margin: 1rem 0;">
      <i class="fas fa-search"></i>
      <input type="text" id="buscaAlunoExistente" placeholder="Buscar aluno por nome ou SIGE..." oninput="filtrarAlunosExistentes(${eletivaId})">
    </div>
    
    <div class="resultado-busca" id="resultadoBuscaExistente">
      ${resultadosHTML}
    </div>
    
    <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-light); border-radius: 8px;">
      <p><strong>⚠️ REGRAS:</strong></p>
      <ul style="margin-left: 1.5rem;">
        <li>Aluno pode estar em outra eletiva (se horários diferentes)</li>
        <li>Verificar conflito de horários</li>
      </ul>
    </div>
  `;

  document.getElementById("modalAdicionarExistenteBody").innerHTML = modalBody;
  document.getElementById("modalAdicionarExistente").classList.add("active");
  alunoParaAdicionar = { eletivaId };

  // Função de filtro
  window.filtrarAlunosExistentes = function (eletivaId) {
    const termo =
      document.getElementById("buscaAlunoExistente")?.value.toLowerCase() || "";
    const matriculasIds =
      state.matriculas
        ?.filter((m) => m.eletivaId === eletivaId)
        .map((m) => m.alunoId) || [];
    const alunosFiltrados =
      state.alunos?.filter(
        (a) =>
          !matriculasIds.includes(a.id) &&
          (a.nome.toLowerCase().includes(termo) ||
            a.codigoSige.includes(termo)),
      ) || [];

    let resultados = "";
    alunosFiltrados.slice(0, 10).forEach((aluno) => {
      resultados += `
        <div class="resultado-item">
          <input type="radio" name="alunoExistente" value="${aluno.id}" id="aluno_${aluno.id}">
          <label for="aluno_${aluno.id}">
            <strong>${aluno.nome}</strong> (${aluno.turmaOrigem}) - SIGE: ${aluno.codigoSige}
          </label>
        </div>
      `;
    });

    if (alunosFiltrados.length > 10) {
      resultados += `<p style="text-align: center; color: var(--text-light);">... e mais ${alunosFiltrados.length - 10} alunos</p>`;
    }

    document.getElementById("resultadoBuscaExistente").innerHTML =
      resultados || '<p class="empty-state">Nenhum aluno encontrado</p>';
  };
};

// Confirmar adicionar aluno existente
window.confirmarAdicionarExistente = function () {
  if (!alunoParaAdicionar) return;

  const radioSelecionado = document.querySelector(
    'input[name="alunoExistente"]:checked',
  );
  if (!radioSelecionado) {
    mostrarErro("Selecione um aluno");
    return;
  }

  const alunoId = parseInt(radioSelecionado.value);

  // Verificar se já está matriculado
  const jaMatriculado = state.matriculas?.some(
    (m) =>
      m.alunoId === alunoId && m.eletivaId === alunoParaAdicionar.eletivaId,
  );

  if (jaMatriculado) {
    mostrarAviso("Aluno já está matriculado nesta eletiva");
    fecharModalAdicionarExistente();
    return;
  }

  // Verificar conflito de horários
  const eletivaDestino = state.eletivas?.find(
    (e) => e.id === alunoParaAdicionar.eletivaId,
  );
  const matriculasAluno =
    state.matriculas?.filter((m) => m.alunoId === alunoId) || [];

  for (const matricula of matriculasAluno) {
    const eletivaAluno = state.eletivas?.find(
      (e) => e.id === matricula.eletivaId,
    );
    if (eletivaAluno && temMesmoHorario(eletivaDestino, eletivaAluno)) {
      if (
        !confirm(
          `Aluno já está em ${eletivaAluno.nome} no mesmo horário. Deseja adicionar mesmo assim?`,
        )
      ) {
        return;
      }
    }
  }

  // Criar matrícula
  const novaMatricula = {
    id: (state.matriculas?.length || 0) + 1,
    eletivaId: alunoParaAdicionar.eletivaId,
    alunoId: alunoId,
    tipoMatricula: "manual",
    dataMatricula: new Date().toISOString().split("T")[0],
    semestreId: "2026-1",
  };

  if (!state.matriculas) state.matriculas = [];
  state.matriculas.push(novaMatricula);
  salvarEstado();

  if (window.FirebaseSync) {
    window.FirebaseSync.salvarDadosFirebase(
      "matriculas",
      novaMatricula,
      novaMatricula.id,
    );
  }

  const aluno = state.alunos?.find((a) => a.id === alunoId);
  registrarMovimentacao("adicao_existente", {
    alunoId,
    alunoNome: aluno?.nome,
    eletivaId: alunoParaAdicionar.eletivaId,
    eletivaNome: eletivaDestino?.nome,
  });

  mostrarSucesso("Aluno adicionado com sucesso!");
  fecharModalAdicionarExistente();
  carregarEletivasOrganizar();
  if (
    document.getElementById("tab-estatisticas").classList.contains("active")
  ) {
    carregarEstatisticas();
  }
};

// Fechar modal de adicionar existente
window.fecharModalAdicionarExistente = function () {
  document.getElementById("modalAdicionarExistente").classList.remove("active");
  alunoParaAdicionar = null;
};

// Salvar todas as alterações
window.salvarTodasAlteracoes = function () {
  salvarEstado();
  if (window.FirebaseSync) {
    window.FirebaseSync.processarFilaPendente();
  }
  mostrarSucesso("Todas as alterações salvas!");
};

// ========== FUNÇÕES DE JSON ==========

// Abrir modal JSON
window.abrirModalJSON = function () {
  const dadosExport = {
    eletivas: state.eletivas || [],
    professores: state.professores || [],
    alunos: state.alunos || [],
    matriculas: state.matriculas || [],
  };

  document.getElementById("jsonViewerContent").textContent = JSON.stringify(
    dadosExport,
    null,
    2,
  );
  document.getElementById("modalVerJSON").classList.add("active");
};

// Fechar modal JSON
window.fecharModalJSON = function () {
  document.getElementById("modalVerJSON").classList.remove("active");
};

// Copiar JSON
window.copiarJSON = function () {
  const jsonContent = document.getElementById("jsonViewerContent").textContent;
  navigator.clipboard
    .writeText(jsonContent)
    .then(() => {
      mostrarSucesso("JSON copiado!");
    })
    .catch(() => {
      mostrarErro("Erro ao copiar");
    });
};

// Exportar JSON
window.exportarJSON = function () {
  const jsonContent = document.getElementById("jsonViewerContent").textContent;
  const blob = new Blob([jsonContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dados-planilha.json";
  a.click();
  URL.revokeObjectURL(url);
};

// Abrir modal importar JSON
window.abrirModalImportarJSON = function () {
  document.getElementById("jsonImportTextarea").value = "";
  document.getElementById("modalImportarJSON").classList.add("active");
};

// Fechar modal importar JSON
window.fecharModalImportarJSON = function () {
  document.getElementById("modalImportarJSON").classList.remove("active");
};

// Validar JSON
window.validarJSON = function () {
  const jsonText = document.getElementById("jsonImportTextarea")?.value;
  if (!jsonText) {
    mostrarErro("Cole o JSON primeiro");
    return;
  }

  try {
    const parsed = JSON.parse(jsonText);
    mostrarSucesso("✅ JSON válido!");
  } catch (e) {
    mostrarErro("❌ JSON inválido: " + e.message);
  }
};

// Importar JSON
window.importarJSON = function () {
  const jsonText = document.getElementById("jsonImportTextarea")?.value;
  if (!jsonText) {
    mostrarErro("Cole o JSON primeiro");
    return;
  }

  try {
    const parsed = JSON.parse(jsonText);

    // Mapear eletivas existentes por código
    const eletivasExistentes = {};
    state.eletivas?.forEach((e) => {
      eletivasExistentes[e.codigo] = e;
    });

    // Atualizar ou adicionar novas eletivas
    if (parsed.eletivas) {
      parsed.eletivas.forEach((nova, index) => {
        if (eletivasExistentes[nova.codigo]) {
          // Atualizar existente (manter ID)
          const indexExistente = state.eletivas.findIndex(
            (e) => e.codigo === nova.codigo,
          );
          if (indexExistente !== -1) {
            state.eletivas[indexExistente] = {
              ...eletivasExistentes[nova.codigo],
              nome: nova.nome,
              tipo: nova.tipo || "MISTA",
              horario: nova.horario || {
                diaSemana: "segunda",
                codigoTempo: "T1",
              },
              turmaOrigem: nova.turmaOrigem || "",
            };
          }
        } else {
          // Adicionar nova
          state.eletivas.push({
            id: state.eletivas.length + 1000 + index,
            codigo: nova.codigo,
            nome: nova.nome,
            tipo: nova.tipo || "MISTA",
            professorId: nova.professorId || 1,
            professorNome: nova.professorNome || "",
            horario: nova.horario || {
              diaSemana: "segunda",
              codigoTempo: "T1",
            },
            vagas: 40,
            seriesPermitidas: ["1ª", "2ª", "3ª"],
            turmaOrigem: nova.turmaOrigem || "",
            semestreId: "2026-1",
          });
        }
      });
    }

    salvarEstado();
    mostrarSucesso("JSON importado com sucesso!");
    fecharModalImportarJSON();
    carregarEletivasOrganizar();
    carregarEstatisticas();
    carregarEletivasLiberacao();
  } catch (e) {
    mostrarErro("Erro ao importar JSON: " + e.message);
  }
};

// ========== FUNÇÕES DE LIBERAÇÃO DE NOTAS ==========

// Carregar eletivas para liberação
function carregarEletivasLiberacao() {
  const container = document.getElementById("eletivasLiberacaoContainer");
  if (!container) return;

  const semestre =
    document.getElementById("selectSemestreLiberacao")?.value || "1/2026";
  const eletivas =
    state.eletivas?.sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  container.innerHTML = "";

  eletivas.forEach((eletiva) => {
    const professor = state.professores?.find(
      (p) => p.id === eletiva.professorId,
    );
    const matriculas =
      state.matriculas?.filter((m) => m.eletivaId === eletiva.id) || [];
    const liberada = verificarNotasLiberadasGestor(eletiva.id, semestre);

    const div = document.createElement("div");
    div.className = "eletiva-liberacao-item";
    div.style.cssText = `
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.8rem;
      border-bottom: 1px solid var(--bg-gray);
    `;

    div.innerHTML = `
      <input type="checkbox" id="liberacao_${eletiva.id}" value="${eletiva.id}" ${liberada ? "checked" : ""}>
      <div style="flex: 1;">
        <strong>${eletiva.nome}</strong> (${professor?.nome || "Sem professor"})
        <span style="font-size: 0.85rem; color: var(--text-light); margin-left: 0.5rem;">${matriculas.length} alunos</span>
      </div>
      <span style="font-size: 0.85rem; padding: 0.2rem 0.8rem; border-radius: 20px; background: ${liberada ? "var(--success)" : "var(--bg-gray)"}; color: ${liberada ? "white" : "var(--text-light)"};">
        ${liberada ? "✅ Liberado" : "🔒 Bloqueado"}
      </span>
    `;

    container.appendChild(div);
  });

  if (eletivas.length === 0) {
    container.innerHTML =
      '<p class="empty-state">Nenhuma eletiva cadastrada</p>';
  }
}

// Atualizar status de liberação
function atualizarStatusLiberacao() {
  const statusDiv = document.getElementById("statusLiberacao");
  const semestre =
    document.getElementById("selectSemestreLiberacao")?.value || "1/2026";

  const eletivasLiberadas = Object.values(
    flagLiberacaoNotas[semestre] || {},
  ).filter((v) => v).length;

  if (eletivasLiberadas > 0) {
    statusDiv.className = "status-liberacao liberado";
    statusDiv.innerHTML = `
      <i class="fas fa-lock-open" style="font-size: 1.5rem;"></i>
      <div>
        <strong>Status atual:</strong> 🔓 LIBERADO para ${eletivasLiberadas} eletivas
      </div>
    `;
  } else {
    statusDiv.className = "status-liberacao bloqueado";
    statusDiv.innerHTML = `
      <i class="fas fa-lock" style="font-size: 1.5rem;"></i>
      <div>
        <strong>Status atual:</strong> 🔒 BLOQUEADO para professores
      </div>
    `;
  }
}

// Selecionar todas as eletivas
window.selecionarTodasEletivas = function (selecionar) {
  const checkboxes = document.querySelectorAll(
    '#eletivasLiberacaoContainer input[type="checkbox"]',
  );
  checkboxes.forEach((cb) => {
    cb.checked = selecionar;
  });
};

// Habilitar notas selecionadas
window.habilitarNotasSelecionadas = function () {
  const semestre =
    document.getElementById("selectSemestreLiberacao")?.value || "1/2026";
  const checkboxes = document.querySelectorAll(
    '#eletivasLiberacaoContainer input[type="checkbox"]:checked',
  );

  checkboxes.forEach((cb) => {
    const eletivaId = parseInt(cb.value);
    if (!flagLiberacaoNotas[semestre]) {
      flagLiberacaoNotas[semestre] = {};
    }
    flagLiberacaoNotas[semestre][eletivaId] = true;
  });

  salvarFlagLiberacao();
  mostrarSucesso(`Notas habilitadas para ${checkboxes.length} eletivas!`);
  carregarEletivasLiberacao();
  atualizarStatusLiberacao();
};

// Bloquear notas selecionadas
window.bloquearNotasSelecionadas = function () {
  const semestre =
    document.getElementById("selectSemestreLiberacao")?.value || "1/2026";
  const checkboxes = document.querySelectorAll(
    '#eletivasLiberacaoContainer input[type="checkbox"]:checked',
  );

  checkboxes.forEach((cb) => {
    const eletivaId = parseInt(cb.value);
    if (flagLiberacaoNotas[semestre]) {
      delete flagLiberacaoNotas[semestre][eletivaId];
    }
  });

  salvarFlagLiberacao();
  mostrarSucesso(`Notas bloqueadas para ${checkboxes.length} eletivas!`);
  carregarEletivasLiberacao();
  atualizarStatusLiberacao();
};

// ========== FUNÇÕES DE IMPRESSÃO ==========

// Carregar logo para PDF
async function carregarLogoBase64() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = this.width;
      canvas.height = this.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(this, 0, 0);
      const dataURL = canvas.toDataURL("image/png");
      resolve(dataURL);
    };
    img.onerror = function () {
      console.warn("⚠️ Erro ao carregar logo");
      resolve(null);
    };
    img.src = "assets/logo-escola.png";
  });
}

// Imprimir lista de frequência
window.imprimirListaFrequenciaGestor = async function (eletivaId) {
  if (window.imprimirListaFrequencia) {
    window.imprimirListaFrequencia(eletivaId);
  }
};

// Imprimir notas
window.imprimirNotasGestor = async function (eletivaId) {
  if (window.imprimirPDFNotas) {
    window.imprimirPDFNotas(eletivaId, "1/2026");
  }
};

// Gerar PDF seguro
async function gerarPDFSeguro(dadosPDF, nomeArquivo) {
  try {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Logo
    if (dadosPDF.cabecalho.logo) {
      try {
        const logoBase64 = await carregarLogoBase64();
        if (logoBase64) {
          doc.addImage(logoBase64, "PNG", pageWidth / 2 - 26, y - 10, 52, 19.5);
          y += 15;
        }
      } catch (e) {
        console.warn("Erro ao adicionar logo:", e);
      }
    }

    // Título
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(
      dadosPDF.cabecalho.titulo ||
        "DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS",
      pageWidth / 2,
      y,
      { align: "center" },
    );
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(
      dadosPDF.cabecalho.escola || "EEMTI Filgueiras Lima - Inep: 23142804",
      pageWidth / 2,
      y,
      { align: "center" },
    );
    y += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`RELATÓRIO DE FREQUÊNCIA E NOTAS`, pageWidth / 2, y, {
      align: "center",
    });
    y += 8;

    doc.setFontSize(12);
    doc.text(
      `${dadosPDF.cabecalho.eletiva || ""} - ${dadosPDF.cabecalho.semestre || ""}`,
      pageWidth / 2,
      y,
      { align: "center" },
    );
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Professor(a): ${dadosPDF.cabecalho.professor || ""}`,
      pageWidth / 2,
      y,
      { align: "center" },
    );
    y += 10;

    // Tabela
    const colWidths = [80, 25, 25, 20, 25];

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("NOME DO ALUNO", margin, y);
    doc.text("TURMA", margin + colWidths[0], y);
    doc.text("SIGE", margin + colWidths[0] + colWidths[1], y);
    doc.text("FALTAS", margin + colWidths[0] + colWidths[1] + colWidths[2], y);
    doc.text(
      "NOTA",
      margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
      y,
    );

    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    (dadosPDF.alunos || []).forEach((aluno) => {
      if (y > 150) {
        doc.addPage();
        y = 20;
      }

      doc.text(aluno.nome.substring(0, 35), margin, y);
      doc.text(aluno.turma, margin + colWidths[0], y);
      doc.text(aluno.sige, margin + colWidths[0] + colWidths[1], y);
      doc.text(
        aluno.faltas.toString(),
        margin + colWidths[0] + colWidths[1] + colWidths[2],
        y,
      );
      doc.text(
        aluno.nota !== "N/A" ? aluno.nota.toFixed(1) : "-",
        margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
        y,
      );

      y += 5;
    });

    y += 10;

    // Resumo
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("📊 RESUMO DA TURMA:", margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `• Total de Alunos: ${dadosPDF.resumo.totalAlunos || 0}`,
      margin + 5,
      y,
    );
    y += 5;
    doc.text(
      `• Total de Ausências no Semestre: ${dadosPDF.resumo.totalAusencias || 0}`,
      margin + 5,
      y,
    );
    y += 5;
    doc.text(
      `• Média de Faltas por Aluno: ${dadosPDF.resumo.mediaFaltas || "0.0"}`,
      margin + 5,
      y,
    );
    y += 5;
    doc.text(
      `• Média Geral da Turma: ${dadosPDF.resumo.mediaGeral || "0.0"}`,
      margin + 5,
      y,
    );
    y += 5;
    doc.text(
      `• Maior Nota: ${dadosPDF.resumo.maiorNota !== "N/A" ? dadosPDF.resumo.maiorNota.toFixed(1) : "N/A"}`,
      margin + 5,
      y,
    );
    y += 5;
    doc.text(
      `• Menor Nota: ${dadosPDF.resumo.menorNota !== "N/A" ? dadosPDF.resumo.menorNota.toFixed(1) : "N/A"}`,
      margin + 5,
      y,
    );
    y += 5;
    doc.text(
      `• Alunos Acima da Média: ${dadosPDF.resumo.acimaMedia || 0}`,
      margin + 5,
      y,
    );
    y += 5;
    doc.text(
      `• Alunos Abaixo da Média: ${dadosPDF.resumo.abaixoMedia || 0}`,
      margin + 5,
      y,
    );
    y += 10;

    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Assinaturas
    doc.line(margin, y, margin + 70, y);
    doc.line(pageWidth - margin - 70, y, pageWidth - margin, y);
    y += 5;

    doc.text("Assinatura do Professor", margin, y);
    doc.text("Assinatura do Gestor", pageWidth - margin - 70, y);
    y += 8;

    doc.text(`Data: ____/____/______`, pageWidth / 2, y, { align: "center" });

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    throw error;
  }
}

// Imprimir relatório completo da eletiva (NOVO - CORRIGIDO)
window.imprimirRelatorioEletiva = async function (
  eletivaId,
  semestre = "1/2026",
) {
  mostrarLoaderGestor(true);

  try {
    const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
    if (!eletiva) {
      mostrarErro("Eletiva não encontrada");
      return;
    }

    const professor = state.professores?.find(
      (p) => p.id === eletiva.professorId,
    );
    const matriculas =
      state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
    const alunos =
      state.alunos
        ?.filter((a) => matriculas.some((m) => m.alunoId === a.id))
        .sort((a, b) => a.nome.localeCompare(b.nome)) || [];

    if (alunos.length === 0) {
      mostrarAviso("Esta eletiva não possui alunos cadastrados.");
      return;
    }

    const estatisticas = await calcularEstatisticasSeguro(eletivaId, semestre);

    const dadosPDF = {
      cabecalho: {
        logo: "assets/logo-escola.png",
        titulo: "DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS",
        escola: "EEMTI Filgueiras Lima - Inep: 23142804",
        eletiva: eletiva.nome || "Sem nome",
        codigo: eletiva.codigo || "Sem código",
        professor: professor?.nome || eletiva.professorNome || "Não atribuído",
        semestre: semestre || "1º/2026",
      },
      alunos: alunos.map((aluno) => ({
        nome: aluno.nome || "Sem nome",
        turma: aluno.turmaOrigem || "Sem turma",
        sige: aluno.codigoSige || "000000",
        faltas: estatisticas.ausenciasPorAluno?.[aluno.id] || 0,
        nota: estatisticas.notasPorAluno?.[aluno.id] || "N/A",
      })),
      resumo: {
        totalAlunos: alunos.length,
        totalAusencias: estatisticas.totalAusencias || 0,
        mediaFaltas: (estatisticas.mediaFaltas || 0).toFixed(1),
        mediaGeral: (estatisticas.mediaNotas || 0).toFixed(1),
        maiorNota: estatisticas.maiorNota || "N/A",
        menorNota: estatisticas.menorNota || "N/A",
        acimaMedia: estatisticas.acimaMedia || 0,
        abaixoMedia: estatisticas.abaixoMedia || 0,
      },
    };

    dadosPDF.alunos.sort((a, b) => a.nome.localeCompare(b.nome));

    await gerarPDFSeguro(dadosPDF, `relatorio-${eletiva.codigo}-${semestre}`);

    mostrarSucesso("Relatório gerado com sucesso!");
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    mostrarErro("Não foi possível gerar o relatório. Tente novamente.");
  } finally {
    mostrarLoaderGestor(false);
  }
};

// Imprimir lista de alunos
window.imprimirListaAlunos = async function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  const matriculas =
    state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
  const alunos =
    state.alunos
      ?.filter((a) => matriculas.some((m) => m.alunoId === a.id))
      .sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  if (alunos.length === 0) {
    mostrarAviso("Nenhum aluno matriculado");
    return;
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("LISTA DE ALUNOS POR ELETIVA", pageWidth / 2, y, {
    align: "center",
  });
  y += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Eletiva: ${eletiva.nome} | Código: ${eletiva.codigo} | Professor: ${eletiva.professorNome}`,
    pageWidth / 2,
    y,
    { align: "center" },
  );
  y += 10;

  const margin = 15;
  const colWidths = [80, 30, 30, 60];

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("NOME DO ALUNO", margin, y);
  doc.text("TURMA", margin + colWidths[0], y);
  doc.text("SIGE", margin + colWidths[0] + colWidths[1], y);
  doc.text(
    "OBSERVAÇÕES",
    margin + colWidths[0] + colWidths[1] + colWidths[2],
    y,
  );

  y += 5;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  alunos.forEach((aluno, index) => {
    if (y > 180) {
      doc.addPage();
      y = 20;
    }

    doc.text(aluno.nome.substring(0, 35), margin, y);
    doc.text(aluno.turmaOrigem, margin + colWidths[0], y);
    doc.text(aluno.codigoSige, margin + colWidths[0] + colWidths[1], y);
    doc.text("", margin + colWidths[0] + colWidths[1] + colWidths[2], y);

    y += 6;
  });

  y += 10;
  doc.text(`Total de Alunos: ${alunos.length}`, margin, y);
  y += 15;

  doc.line(margin, y, margin + 70, y);
  doc.line(pageWidth - margin - 70, y, pageWidth - margin, y);
  y += 5;

  doc.text("Assinatura do Professor", margin, y);
  doc.text("Assinatura do Gestor", pageWidth - margin - 70, y);

  const pdfBlob = doc.output("blob");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, "_blank");
};

// Exportar alunos para Excel
window.exportarAlunosExcel = function (eletivaId) {
  const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
  if (!eletiva) return;

  const matriculas =
    state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
  const alunos =
    state.alunos
      ?.filter((a) => matriculas.some((m) => m.alunoId === a.id))
      .sort((a, b) => a.nome.localeCompare(b.nome)) || [];

  if (alunos.length === 0) {
    mostrarAviso("Nenhum aluno para exportar");
    return;
  }

  const dados = alunos.map((a) => ({
    Nome: a.nome,
    Turma: a.turmaOrigem,
    SIGE: a.codigoSige,
  }));

  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Alunos");

  const nomeArquivo = `alunos_${eletiva.codigo}_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(wb, nomeArquivo);
};

// ========== FUNÇÕES DIVERSAS ==========

// Fechar modal de confirmação
window.fecharModalConfirmacao = function () {
  document.getElementById("modalConfirmacao").classList.remove("active");
};

// Fazer logout
window.fazerLogout = function () {
  localStorage.removeItem("gestor_atual");
  window.location.href = "index.html";
};
