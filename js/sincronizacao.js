// js/sincronizacao.js - Carregando dados do arquivo JSON local
console.log("🔄 sincronizacao.js carregado");

async function carregarDadosDaPlanilha() {
  console.log("📦 Carregando dados do arquivo local...");

  try {
    showToast("Carregando dados...", "info");

    if (typeof CONFIG === "undefined") {
      throw new Error("CONFIG não definido. Verifique a ordem dos scripts.");
    }

    const response = await fetch("data/dados-planilha.json");

    if (!response.ok) {
      throw new Error(`Erro ao carregar arquivo: ${response.status}`);
    }

    const data = await response.json();

    console.log("✅ Arquivo JSON carregado com sucesso!");
    console.log("📊 Estatísticas:", data.estatisticas);

    processarDadosPlanilha(data.dados);

    const agora = new Date().toISOString();
    state.ultimaSincronizacao = agora;
    localStorage.setItem(CONFIG.storageKeys.ultimaSincronizacao, agora);

    const spanSinc = document.getElementById("ultimaSincronizacao");
    if (spanSinc) {
      spanSinc.innerHTML = `<i class="fas fa-check-circle" style="color: green;"></i> Dados carregados: ${new Date(agora).toLocaleString("pt-BR")}`;
    }

    showToast(
      `Dados carregados! ${data.estatisticas.alunos} alunos, ${data.estatisticas.professores} professores`,
      "success",
    );

    return true;
  } catch (error) {
    console.error("❌ Erro ao carregar dados:", error);
    showToast("Erro ao carregar dados. Usando fallback.", "error");
    carregarDadosFallback();
    return false;
  }
}

function processarDadosPlanilha(dados) {
  console.log("🔄 Processando dados da planilha...");

  if (typeof CONFIG === "undefined") {
    console.error("❌ CONFIG não definido. Não foi possível processar dados.");
    return;
  }

  if (dados.professores && dados.professores.length > 0) {
    const professores = dados.professores.map((p, index) => ({
      id: index + 1,
      nome: p.nome || "",
      email: p.email || "",
      cpf: p.cpf ? p.cpf.toString().replace(/\D/g, "") : "",
      perfil: p.perfil || "PROFESSOR",
    }));
    state.professores = professores;
    localStorage.setItem(
      CONFIG.storageKeys.professores,
      JSON.stringify(professores),
    );
    console.log(`✅ ${professores.length} professores processados`);
  }

  if (dados.alunos && dados.alunos.length > 0) {
    const alunos = dados.alunos.map((a, index) => {
      const turma = a.turma || "";
      return {
        id: index + 1,
        nome: a.nome || "",
        codigoSige: a.sige ? a.sige.toString() : "",
        turmaOrigem: normalizarTurma(turma),
        serie: getSerieFromTurma(turma),
      };
    });
    state.alunos = alunos;
    localStorage.setItem(CONFIG.storageKeys.alunos, JSON.stringify(alunos));
    console.log(`✅ ${alunos.length} alunos processados`);
  }

  if (dados.eletivasFixas && dados.eletivasFixas.length > 0) {
    const fixas = dados.eletivasFixas.map((f, index) => {
      const professor = state.professores.find((p) => p.nome === f.professor);
      const tempo = f.tempo || "T1";
      const horario = CONFIG.mapeamentoTempos[tempo] || {
        diaSemana: "?",
        seriesPermitidas: ["1ª", "2ª", "3ª"],
      };

      const turmaNormalizada = normalizarTurma(f.turma || "");

      return {
        id: index + 1000,
        codigo: f.codigo || "",
        nome: f.nome || "",
        tipo: "FIXA",
        professorId: professor?.id || 1,
        professorNome: professor?.nome || f.professor || "",
        horario: {
          diaSemana: horario.diaSemana || "?",
          codigoTempo: tempo,
        },
        local: turmaNormalizada || f.local || "A DEFINIR",
        vagas: 40,
        seriesPermitidas: horario.seriesPermitidas || ["1ª", "2ª", "3ª"],
        turmaOrigem: turmaNormalizada,
        semestreId: "2026-1",
      };
    });

    state.eletivas = fixas;
    localStorage.setItem(CONFIG.storageKeys.eletivas, JSON.stringify(fixas));
    console.log(`✅ ${fixas.length} eletivas fixas processadas`);
  }

  if (!state.matriculas) {
    state.matriculas = [];
  }

  criarMatriculasBasicas();

  if (!state.nextId) {
    state.nextId = {
      aluno: (state.alunos?.length || 0) + 1,
      professor: (state.professores?.length || 0) + 1,
      eletiva: (state.eletivas?.length || 0) + 1,
      matricula: (state.matriculas?.length || 0) + 1,
      registro: 1,
    };
  }
  localStorage.setItem("sage_nextId_2026", JSON.stringify(state.nextId));

  if (typeof window.salvarEstado === "function") {
    window.salvarEstado();
  }
}

function criarMatriculasBasicas() {
  console.log("📝 Criando matrículas para eletivas fixas...");

  if (!state.matriculas) {
    state.matriculas = [];
  }

  let idCounter = state.matriculas.length + 1;

  state.eletivas?.forEach((eletiva) => {
    if (eletiva.tipo === "FIXA" && eletiva.turmaOrigem) {
      const alunosTurma =
        state.alunos?.filter((a) => a.turmaOrigem === eletiva.turmaOrigem) ||
        [];

      alunosTurma.forEach((aluno) => {
        const jaMatriculado = state.matriculas.some(
          (m) => m.alunoId === aluno.id && m.eletivaId === eletiva.id,
        );

        if (!jaMatriculado) {
          state.matriculas.push({
            id: idCounter++,
            eletivaId: eletiva.id,
            alunoId: aluno.id,
            tipoMatricula: "automática",
            dataMatricula: new Date().toISOString().split("T")[0],
            semestreId: "2026-1",
          });
        }
      });
    }
  });

  localStorage.setItem(
    CONFIG.storageKeys.matriculas,
    JSON.stringify(state.matriculas),
  );
  console.log(`✅ ${state.matriculas.length} matrículas criadas`);
}

function carregarDadosFallback() {
  console.log("📦 Carregando dados de fallback...");

  if (!state.professores || state.professores.length === 0) {
    state.professores = [
      {
        id: 1,
        nome: "Professor Exemplo",
        email: "professor@exemplo.com",
        perfil: "PROFESSOR",
      },
    ];
  }

  if (!state.alunos || state.alunos.length === 0) {
    state.alunos = [
      {
        id: 1,
        nome: "Aluno Exemplo",
        codigoSige: "2024001",
        turmaOrigem: "1ª SÉRIE A",
        serie: "1ª",
      },
      {
        id: 2,
        nome: "Aluno Exemplo 2",
        codigoSige: "2024002",
        turmaOrigem: "1ª SÉRIE A",
        serie: "1ª",
      },
    ];
  }

  if (!state.eletivas || state.eletivas.length === 0) {
    state.eletivas = [
      {
        id: 1000,
        codigo: "EX001",
        nome: "Eletiva Exemplo",
        tipo: "FIXA",
        professorId: 1,
        professorNome: "Professor Exemplo",
        horario: { diaSemana: "Segunda", codigoTempo: "T1" },
        vagas: 40,
        seriesPermitidas: ["1ª", "2ª", "3ª"],
        turmaOrigem: "1ª SÉRIE A",
        semestreId: "2026-1",
      },
    ];
  }

  if (!state.matriculas || state.matriculas.length === 0) {
    state.matriculas = [
      { id: 1, alunoId: 1, eletivaId: 1000, semestreId: "2026-1" },
      { id: 2, alunoId: 2, eletivaId: 1000, semestreId: "2026-1" },
    ];
  }

  if (!state.registros) {
    state.registros = [];
  }

  if (!state.semestres || state.semestres.length === 0) {
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

  localStorage.setItem(
    CONFIG.storageKeys.professores,
    JSON.stringify(state.professores),
  );
  localStorage.setItem(CONFIG.storageKeys.alunos, JSON.stringify(state.alunos));
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

  if (typeof window.salvarEstado === "function") {
    window.salvarEstado();
  }

  console.log("✅ Dados de fallback carregados");
}

window.recarregarDados = async function () {
  await carregarDadosDaPlanilha();
  if (typeof window.carregarTodosDados === "function") {
    window.carregarTodosDados();
  }
};

window.carregarDadosDaPlanilha = carregarDadosDaPlanilha;
window.carregarDadosFallback = carregarDadosFallback;
