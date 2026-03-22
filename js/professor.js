// js/professor.js - Lógica do professor
console.log("👨‍🏫 professor.js carregado");

let professorAtual = null;
let registroEmEdicao = null;
let registroNotasEmEdicao = null;
let eletivaSelecionadaRegistro = null;
let registroParaExcluir = null;
let operacoesPendentes = 0;

// Função para verificar se notas estão liberadas para uma eletiva
function verificarNotasLiberadas(eletivaId, semestre = "1/2026") {
  if (!state.liberacaoNotas) {
    console.log("📊 Nenhuma configuração de liberação encontrada");
    return false;
  }

  if (state.liberacaoNotas.semestre !== semestre) {
    console.log(`📊 Semestre diferente: config=${state.liberacaoNotas.semestre}, solicitado=${semestre}`);
    return false;
  }

  const chaveLiberacao = `${eletivaId}_${semestre}`;
  const estaNaLista = state.liberacaoNotas.eletivasLiberadas?.includes(chaveLiberacao) || false;

  if (!estaNaLista) {
    console.log(`📊 Eletiva ${eletivaId} não está na lista de liberadas`);
    return false;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dataInicio = state.liberacaoNotas.periodo?.inicio
    ? new Date(state.liberacaoNotas.periodo.inicio)
    : null;
  const dataFim = state.liberacaoNotas.periodo?.fim
    ? new Date(state.liberacaoNotas.periodo.fim)
    : null;

  if (dataInicio && dataFim) {
    dataInicio.setHours(0, 0, 0, 0);
    dataFim.setHours(23, 59, 59, 999);

    const dentroDoPeriodo = hoje >= dataInicio && hoje <= dataFim;

    if (!dentroDoPeriodo) {
      console.log(`📊 Fora do período de liberação`);
      return false;
    }
  }

  console.log(`✅ Notas liberadas para eletiva ${eletivaId} - ${semestre}`);
  return true;
}

// Função utilitária para formatar data
function formatarDataCorrigida(dataString) {
  if (!dataString) return "";
  if (typeof dataString === "string" && dataString.includes("-")) {
    const [ano, mes, dia] = dataString.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  if (dataString instanceof Date) {
    const dia = dataString.getDate().toString().padStart(2, "0");
    const mes = (dataString.getMonth() + 1).toString().padStart(2, "0");
    const ano = dataString.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
  return dataString;
}

function normalizarDataParaSalvar(data) {
  if (!data) return "";
  if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return data;
  }
  try {
    const dateObj = new Date(data);
    if (!isNaN(dateObj.getTime())) {
      const ano = dateObj.getFullYear();
      const mes = (dateObj.getMonth() + 1).toString().padStart(2, "0");
      const dia = dateObj.getDate().toString().padStart(2, "0");
      return `${ano}-${mes}-${dia}`;
    }
  } catch (e) {
    console.warn("Erro ao normalizar data:", e);
  }
  return data;
}

function calcularLinhasPorPagina(pageHeight, marginTop, marginBottom, headerHeight, footerHeight) {
  const espacoDisponivel = pageHeight - marginTop - marginBottom - headerHeight - footerHeight;
  return Math.floor(espacoDisponivel / 5);
}

function verificarConexao() {
  return navigator.onLine;
}

function atualizarStatusSincronizacao() {
  const syncBtn = document.getElementById("syncButton");
  const syncBadge = document.getElementById("syncBadge");
  const connectionStatus = document.getElementById("connectionStatus");

  if (!syncBtn) return;

  const online = verificarConexao();
  const pendentes = window.FirebaseSync?.getPendingCount?.() || 0;
  operacoesPendentes = pendentes;

  if (connectionStatus) {
    if (!online) {
      connectionStatus.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline';
      connectionStatus.className = "connection-status offline";
    } else if (pendentes > 0) {
      connectionStatus.innerHTML = `<i class="fas fa-clock"></i> ${pendentes} pendente(s)`;
      connectionStatus.className = "connection-status pending";
    } else {
      connectionStatus.innerHTML = '<i class="fas fa-check-circle"></i> Sincronizado';
      connectionStatus.className = "connection-status online";
    }
  }

  if (!online) {
    syncBtn.disabled = true;
    syncBtn.title = "Sem conexão com a internet";
    syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar';
    if (syncBadge) syncBadge.style.display = "none";
  } else if (pendentes > 0) {
    syncBtn.disabled = false;
    syncBtn.title = `Clique para enviar ${pendentes} registro(s)`;
    syncBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Sincronizar <span class="sync-badge" id="syncBadge">${pendentes}</span>`;
    if (syncBadge) {
      syncBadge.textContent = pendentes;
      syncBadge.style.display = "inline-block";
    }
  } else {
    syncBtn.disabled = true;
    syncBtn.title = "Tudo sincronizado";
    syncBtn.innerHTML = '<i class="fas fa-check"></i> Sincronizado';
    if (syncBadge) syncBadge.style.display = "none";
  }
}

window.sincronizarAgora = async function () {
  const syncBtn = document.getElementById("syncButton");
  const originalText = syncBtn.innerHTML;

  syncBtn.disabled = true;
  syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

  try {
    if (window.FirebaseSync) {
      await window.FirebaseSync.processarFilaPendente();
      showToast("Todos os registros foram enviados com sucesso!", "success");
    }
  } catch (error) {
    console.error("Erro na sincronização:", error);
    showToast("Erro ao enviar registros. Tente novamente.", "error");
  } finally {
    setTimeout(() => {
      atualizarStatusSincronizacao();
    }, 1000);
  }
};

function carregarLogoBase64() {
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
      console.warn("⚠️ Erro ao carregar logo, usando placeholder");
      resolve(null);
    };
    img.src = "assets/logo-escola.png";
  });
}

async function adicionarCabecalhoPadronizado(doc, eletiva, dataFormatada = null, semestre = null) {
  const marginTop = 15;
  const marginSides = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = marginTop;

  try {
    const logoBase64 = await carregarLogoBase64();
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", pageWidth / 2 - 26, y - 5, 52, 19.5);
      y += 24;
    } else {
      y += 5;
    }
  } catch (e) {
    console.warn("Erro ao adicionar logo:", e);
    y += 5;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, y, {
    align: "center",
  });
  y += 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, y, {
    align: "center",
  });
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");

  let infoTexto = `Eletiva: ${eletiva.codigo} - ${eletiva.nome} | Professor(a): ${professorAtual.nome}`;

  if (semestre) {
    infoTexto += ` | Semestre: ${semestre}`;
  } else if (dataFormatada) {
    infoTexto += ` | Data: ${dataFormatada}`;
  } else {
    infoTexto += ` | Data: ___ / ___ / ______`;
  }

  doc.text(infoTexto, pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setDrawColor(0, 0, 0);
  doc.line(marginSides, y, pageWidth - marginSides, y);
  y += 6;

  return { y, marginTop, marginSides };
}

function adicionarCabecalhoTabela(doc, x, y, larguras, tipo = "frequencia") {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");

  doc.text("Nome do Aluno", x, y);
  doc.text("Turma", x + larguras[0], y);
  doc.text("SIGE", x + larguras[0] + larguras[1], y);

  if (tipo === "notas") {
    doc.text("Nota (0-10)", x + larguras[0] + larguras[1] + larguras[2], y);
  } else {
    doc.text("Status", x + larguras[0] + larguras[1] + larguras[2], y);
    if (tipo === "frequencia") {
      doc.text("Observações", x + larguras[0] + larguras[1] + larguras[2] + larguras[3], y);
    } else {
      doc.text("Tempo Eletivo", x + larguras[0] + larguras[1] + larguras[2] + larguras[3], y);
    }
  }

  return y + 4;
}

function adicionarRodape(doc, y, incluirData = false) {
  const marginSides = 15;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.line(marginSides, y, marginSides + 70, y);
  doc.line(pageWidth - marginSides - 70, y, pageWidth - marginSides, y);
  y += 5;

  doc.setFontSize(9);
  doc.text("Assinatura do Professor", marginSides, y);
  doc.text("Assinatura do Gestor", pageWidth - marginSides - 70, y);

  if (incluirData) {
    y += 8;
    doc.text(`Data: ____/____/______`, pageWidth / 2, y, { align: "center" });
  }

  return y + 5;
}

function adicionarNumeracaoPagina(doc, paginaAtual, totalPaginas) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginBottom = 10;
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Página ${paginaAtual} de ${totalPaginas}`, pageWidth / 2, pageHeight - marginBottom, {
    align: "center",
  });
}

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

  return eletivas.sort((a, b) => {
    const diaA = ordemDias[a.horario?.diaSemana?.toLowerCase()] || 99;
    const diaB = ordemDias[b.horario?.diaSemana?.toLowerCase()] || 99;

    if (diaA !== diaB) {
      return diaA - diaB;
    }

    const tempoA = parseInt(a.horario?.codigoTempo?.replace("T", "") || 0);
    const tempoB = parseInt(b.horario?.codigoTempo?.replace("T", "") || 0);
    return tempoA - tempoB;
  });
}

function agruparEletivasPorDia(eletivas) {
  const grupos = {};
  const dias = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

  dias.forEach((dia) => {
    grupos[dia] = [];
  });

  eletivas.forEach((eletiva) => {
    const dia = eletiva.horario?.diaSemana?.toLowerCase() || "outros";
    if (grupos[dia]) {
      grupos[dia].push(eletiva);
    } else {
      if (!grupos["outros"]) grupos["outros"] = [];
      grupos["outros"].push(eletiva);
    }
  });

  return grupos;
}

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

function mostrarLoaderPDF(mostrar) {
  const loader = document.getElementById("pdfLoader");
  if (loader) {
    if (mostrar) {
      loader.classList.add("active");
    } else {
      loader.classList.remove("active");
    }
  }
}

function mostrarLoaderExclusao(mostrar) {
  const loader = document.getElementById("pdfLoader");
  if (loader) {
    if (mostrar) {
      loader.querySelector("p").textContent = "Excluindo registro...";
      loader.classList.add("active");
    } else {
      loader.classList.remove("active");
      loader.querySelector("p").textContent = "Gerando PDF...";
    }
  }
}

// ========== FUNÇÕES DE CARREGAMENTO ==========
document.addEventListener("DOMContentLoaded", async function () {
  console.log("👨‍🏫 Inicializando página do professor...");

  carregarTheme();

  const profStorage = localStorage.getItem("professor_atual");
  if (!profStorage) {
    window.location.href = "selecionar-professor.html";
    return;
  }

  professorAtual = JSON.parse(profStorage);
  console.log("👤 Professor:", professorAtual.nome);

  if (typeof carregarEstado === "function") {
    carregarEstado();
    if (!state.notas) state.notas = [];
  }

  document.getElementById("userName").textContent = professorAtual.nome;
  document.getElementById("userRole").textContent = "Professor";
  document.getElementById("professorInfoHeader").innerHTML = `<span>${professorAtual.nome}</span>`;

  setInterval(atualizarStatusSincronizacao, 5000);
  window.addEventListener("online", atualizarStatusSincronizacao);
  window.addEventListener("offline", atualizarStatusSincronizacao);
  setTimeout(atualizarStatusSincronizacao, 1000);

  carregarEletivasProfessor();
  carregarSelectEletivasRegistros();

  // 🔥 Sincronização com Firebase - SEM TIMEOUTS FIXOS
  if (window.FirebaseConfig && typeof window.FirebaseConfig.initFirebase === 'function') {
    try {
      console.log("🔥 Aguardando inicialização do Firebase...");
      await window.FirebaseConfig.aguardarInicializacaoFirebase(10000);
      console.log("✅ Firebase inicializado");
      
      if (window.FirebaseSync && typeof window.FirebaseSync.carregarColecoesGestor === 'function') {
        const carregou = await window.FirebaseSync.carregarColecoesGestor();
        if (carregou) {
          console.log('✅ Dados do gestor carregados do Firebase');
          carregarEletivasProfessor();
          carregarSelectEletivasRegistros();
        }
      }

      if (typeof window.FirebaseSync.escutarColecoesGestor === 'function') {
        window.FirebaseSync.escutarColecoesGestor(function (colecao) {
          console.log(`🔄 Atualização do gestor recebida: ${colecao}`);
          
          if (colecao === 'eletivas' || colecao === 'professores' || colecao === 'alunos') {
            carregarEletivasProfessor();
            carregarSelectEletivasRegistros();
          }
          if (colecao === 'registros' || colecao === 'notas') {
            carregarRegistrosRealizados();
          }
          if (colecao === 'matriculas') {
            carregarEletivasProfessor();
            carregarSelectEletivasRegistros();
            if (document.getElementById("tab-registros")?.classList.contains("active")) {
              carregarRegistrosRealizados();
            }
          }
        });
      }
    } catch (err) {
      console.warn('⚠️ Erro na inicialização do Firebase:', err);
    }
  }

  const hoje = new Date().toISOString().split("T")[0];
  if (document.getElementById("dataAula")) {
    document.getElementById("dataAula").value = hoje;
  }
});

// ========== FUNÇÕES DE IMPRESSÃO ==========
window.gerarListaFrequenciaBranco = async function (eletivaId) {
  mostrarLoaderPDF(true);

  try {
    const eletiva = state.eletivas?.find((e) => e.id === eletivaId);
    if (!eletiva) {
      showToast("Eletiva não encontrada", "error");
      return;
    }

    const matriculas = state.matriculas?.filter((m) => m.eletivaId === eletivaId) || [];
    const alunos = state.alunos
      ?.filter((a) => matriculas.some((m) => m.alunoId === a.id))
      .sort((a, b) => a.nome.localeCompare(b.nome)) || [];

    if (alunos.length === 0) {
      showToast("Esta eletiva não possui alunos cadastrados", "warning");
      return;
    }

    await gerarPDFListaBranco(eletiva, alunos, professorAtual.nome);
    showToast("Lista de frequência gerada com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao gerar lista:", error);
    showToast("Erro ao gerar lista. Tente novamente.", "error");
  } finally {
    mostrarLoaderPDF(false);
  }
};

async function gerarPDFListaBranco(eletiva, alunos, professorNome) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window.jspdf === "undefined") {
        reject("Biblioteca jsPDF não encontrada");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let paginaAtual = 1;
      let y = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;

      function adicionarCabecalho() {
        let yCabecalho = 10;

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, yCabecalho, {
          align: "center",
        });
        yCabecalho += 7;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, yCabecalho, {
          align: "center",
        });
        yCabecalho += 7;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`LISTA DE FREQUÊNCIA - ${eletiva.nome}`, pageWidth / 2, yCabecalho, {
          align: "center",
        });
        yCabecalho += 6;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Professor: ${professorNome} | Total: ${alunos.length} alunos`, pageWidth / 2, yCabecalho, {
          align: "center",
        });
        yCabecalho += 6;

        doc.setFontSize(10);
        doc.text(`Data: ________ / ________ / __________`, pageWidth / 2, yCabecalho, {
          align: "center",
        });
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

      while (alunosProcessados < alunos.length) {
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

        if (alunosProcessados < alunos.length) {
          doc.addPage();
          paginaAtual++;
          y = adicionarCabecalho();
          tabelaInfo = adicionarCabecalhoTabela(y);
          y = tabelaInfo.yPos;
        }
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
      console.error("Erro ao gerar PDF:", error);
      reject(error);
    }
  });
}

window.imprimirListaFrequencia = async function (eletivaId) {
  mostrarLoaderPDF(true);

  try {
    const eletiva = state.eletivas.find((e) => e.id === eletivaId);
    if (!eletiva) {
      showToast("Eletiva não encontrada", "error");
      return;
    }

    const matriculas = state.matriculas.filter((m) => m.eletivaId === eletivaId);
    const alunos = state.alunos
      .filter((a) => matriculas.some((m) => m.alunoId === a.id))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    if (alunos.length === 0) {
      showToast("Nenhum aluno matriculado nesta eletiva", "warning");
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    doc.setFont("helvetica");

    const marginTop = 15;
    const marginBottom = 10;
    const marginSides = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - 2 * marginSides;

    const larguras = [
      contentWidth * 0.35,
      contentWidth * 0.1,
      contentWidth * 0.15,
      contentWidth * 0.15,
      contentWidth * 0.25,
    ];

    const alturaCabecalho = 55;
    const alturaRodape = 15;
    const linhasPorPagina = calcularLinhasPorPagina(
      pageHeight,
      marginTop,
      marginBottom,
      alturaCabecalho,
      alturaRodape,
    );

    const cabecalho = await adicionarCabecalhoPadronizado(doc, eletiva);
    let y = cabecalho.y;
    let paginaAtual = 1;
    let linhasUsadas = 0;

    y = adicionarCabecalhoTabela(doc, marginSides, y, larguras, "frequencia");
    y += 2;
    doc.line(marginSides, y, pageWidth - marginSides, y);
    y += 4;

    for (let i = 0; i < alunos.length; i++) {
      const aluno = alunos[i];

      if (linhasUsadas >= linhasPorPagina) {
        const espacoRestante = pageHeight - y - marginBottom - 10;
        if (espacoRestante > 0) {
          y = pageHeight - marginBottom - 15;
          adicionarRodape(doc, y);
        }

        adicionarNumeracaoPagina(doc, paginaAtual, Math.ceil(alunos.length / linhasPorPagina));

        doc.addPage();
        paginaAtual++;
        linhasUsadas = 0;

        const novoCabecalho = await adicionarCabecalhoPadronizado(doc, eletiva);
        y = novoCabecalho.y;
        y = adicionarCabecalhoTabela(doc, marginSides, y, larguras, "frequencia");
        y += 2;
        doc.line(marginSides, y, pageWidth - marginSides, y);
        y += 4;
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      doc.text(aluno.nome.substring(0, 30), marginSides, y);
      doc.text(aluno.turmaOrigem, marginSides + larguras[0], y);
      doc.text(aluno.codigoSige, marginSides + larguras[0] + larguras[1], y);
      doc.text("______", marginSides + larguras[0] + larguras[1] + larguras[2], y);
      doc.text("________________", marginSides + larguras[0] + larguras[1] + larguras[2] + larguras[3], y);

      y += 5;
      linhasUsadas++;
    }

    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Registro da Aula:", marginSides, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    for (let i = 0; i < 3; i++) {
      doc.text("_".repeat(140), marginSides, y);
      y += 5;
    }

    y += 8;
    adicionarRodape(doc, y);
    adicionarNumeracaoPagina(doc, paginaAtual, Math.ceil(alunos.length / linhasPorPagina));

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");

    showToast("PDF gerado com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    showToast("Erro ao gerar PDF: " + error.message, "error");
  } finally {
    mostrarLoaderPDF(false);
  }
};

window.imprimirRegistrosPorData = async function (eletivaId, dataISO) {
  mostrarLoaderPDF(true);

  try {
    const eletiva = state.eletivas.find((e) => e.id === eletivaId);
    if (!eletiva) {
      showToast("Eletiva não encontrada", "error");
      return;
    }

    let registros = [];

    if (window.FirebaseSync) {
      try {
        registros = await window.FirebaseSync.carregarRegistrosFirebase(eletivaId);
      } catch (e) {
        console.warn("Erro ao carregar do Firebase:", e);
      }
    }

    if (!registros || registros.length === 0) {
      registros = (window.state?.registros || []).filter((r) => r.eletivaId === eletivaId);
    }

    const dataNormalizada = normalizarDataParaSalvar(dataISO);
    const registroEncontrado = registros.find((r) => {
      const rDataNormalizada = normalizarDataParaSalvar(r.data);
      return rDataNormalizada === dataNormalizada;
    });

    if (!registroEncontrado) {
      showToast("Nenhum registro encontrado para esta data", "warning");
      return;
    }

    const matriculas = state.matriculas.filter((m) => m.eletivaId === eletivaId);
    const alunos = state.alunos
      .filter((a) => matriculas.some((m) => m.alunoId === a.id))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    await gerarPDFRegistroAula(eletiva, alunos, registroEncontrado, professorAtual.nome);

    showToast("PDF gerado com sucesso!", "success");
  } catch (error) {
    console.error("❌ Erro ao gerar PDF:", error);
    showToast("Erro ao gerar PDF: " + error.message, "error");
  } finally {
    mostrarLoaderPDF(false);
  }
};

async function gerarPDFRegistroAula(eletiva, alunos, registro, professorNome) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window.jspdf === "undefined") {
        reject("Biblioteca jsPDF não encontrada");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let paginaAtual = 1;
      let y = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;

      const presentesSet = new Set(registro.frequencia?.presentes || []);
      const justificativas = registro.frequencia?.justificativas || {};

      function adicionarCabecalho() {
        let yCabecalho = 10;

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, yCabecalho, {
          align: "center",
        });
        yCabecalho += 7;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, yCabecalho, {
          align: "center",
        });
        yCabecalho += 7;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`REGISTRO DE AULA - ${eletiva.nome}`, pageWidth / 2, yCabecalho, {
          align: "center",
        });
        yCabecalho += 6;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        const dataFormatada = formatarDataCorrigida(registro.data);
        doc.text(`Professor: ${professorNome} | Data: ${dataFormatada} | Total: ${alunos.length} alunos`, pageWidth / 2, yCabecalho, {
          align: "center",
        });
        yCabecalho += 8;

        return yCabecalho;
      }

      function adicionarCabecalhoTabela(yPos) {
        const colWidths = [70, 18, 18, 15, 15, 20];
        const posObs = pageWidth - margin - colWidths[5];
        const posAus = posObs - colWidths[4] - 2;
        const posStatus = posAus - colWidths[3] - 2;
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
        doc.text("AUS", posAus, yPos);
        doc.text("OBS", posObs, yPos);

        yPos += 4;
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 4;

        return { yPos, posNome, posTurma, posSige, posStatus, posAus, posObs, colWidths };
      }

      y = adicionarCabecalho();
      let tabelaInfo = adicionarCabecalhoTabela(y);
      y = tabelaInfo.yPos;

      const posNome = tabelaInfo.posNome;
      const posTurma = tabelaInfo.posTurma;
      const posSige = tabelaInfo.posSige;
      const posStatus = tabelaInfo.posStatus;
      const posAus = tabelaInfo.posAus;
      const posObs = tabelaInfo.posObs;
      const colWidths = tabelaInfo.colWidths;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const alturaPorLinha = 5.5;
      const linhasPorPagina = Math.floor((pageHeight - y - 35) / alturaPorLinha);

      let alunosProcessados = 0;

      while (alunosProcessados < alunos.length) {
        const alunosNestaPagina = Math.min(linhasPorPagina, alunos.length - alunosProcessados);

        for (let i = 0; i < alunosNestaPagina; i++) {
          const aluno = alunos[alunosProcessados + i];

          const isPresente = presentesSet.has(aluno.codigoSige);
          const status = isPresente ? "✅" : "❌";
          const ausencias = isPresente ? 0 : 1;
          const justificativa = justificativas[aluno.codigoSige] || "";
          const obsDisplay = justificativa.substring(0, 15);

          doc.text(aluno.nome.substring(0, 25), posNome, y);
          doc.text(aluno.turmaOrigem, posTurma, y);
          doc.text(aluno.codigoSige, posSige, y);

          const statusX = posStatus + colWidths[3] / 2;
          const ausX = posAus + colWidths[4] / 2;
          const obsX = posObs + colWidths[5] / 2;

          doc.text(status, statusX, y, { align: "center" });
          doc.text(ausencias.toString(), ausX, y, { align: "center" });
          doc.text(obsDisplay, obsX, y, { align: "center" });

          y += alturaPorLinha;
        }

        alunosProcessados += alunosNestaPagina;

        if (alunosProcessados < alunos.length) {
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
      doc.text(`• Total de alunos: ${alunos.length}`, margin + 5, y);
      y += 5;
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

      if (paginaAtual === Math.ceil(alunos.length / linhasPorPagina)) {
        const yAssinaturas = Math.min(y + 10, pageHeight - 12);

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
      console.error("Erro ao gerar PDF:", error);
      reject(error);
    }
  });
}

window.imprimirPDFNotas = async function (eletivaId, semestre = "1/2026") {
  mostrarLoaderPDF(true);

  try {
    const eletiva = state.eletivas.find((e) => e.id === eletivaId);
    if (!eletiva) {
      showToast("Eletiva não encontrada", "error");
      return;
    }

    const registroNotas = state.notas?.find((n) => n.eletivaId === eletivaId && n.semestre === semestre);

    const matriculas = state.matriculas.filter((m) => m.eletivaId === eletivaId);
    const alunos = state.alunos
      .filter((a) => matriculas.some((m) => m.alunoId === a.id))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    if (alunos.length === 0) {
      showToast("Nenhum aluno matriculado nesta eletiva", "warning");
      return;
    }

    await gerarPDFBoletimNotas(eletiva, alunos, registroNotas, professorAtual.nome, semestre);

    showToast("PDF gerado com sucesso!", "success");
  } catch (error) {
    console.error("❌ Erro ao gerar PDF de notas:", error);
    showToast("Erro ao gerar PDF: " + error.message, "error");
  } finally {
    mostrarLoaderPDF(false);
  }
};

async function gerarPDFBoletimNotas(eletiva, alunos, registroNotas, professorNome, semestre) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window.jspdf === "undefined") {
        reject("Biblioteca jsPDF não encontrada");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

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
      const mediaGeral = notasValidas.length > 0
        ? (notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length).toFixed(1)
        : "N/A";
      const maiorNota = notasValidas.length > 0 ? Math.max(...notasValidas).toFixed(1) : "N/A";
      const menorNota = notasValidas.length > 0 ? Math.min(...notasValidas).toFixed(1) : "N/A";

      function adicionarCabecalho() {
        let yCabecalho = 10;

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, yCabecalho, {
          align: "center",
        });
        yCabecalho += 7;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, yCabecalho, {
          align: "center",
        });
        yCabecalho += 7;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`BOLETIM DE NOTAS - ${eletiva.nome}`, pageWidth / 2, yCabecalho, {
          align: "center",
        });
        yCabecalho += 6;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Professor: ${professorNome} | Semestre: ${semestre} | Total: ${alunos.length} alunos`, pageWidth / 2, yCabecalho, {
          align: "center",
        });
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

      while (alunosProcessados < alunos.length) {
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

        if (alunosProcessados < alunos.length) {
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
      doc.text(`• Total de alunos: ${alunos.length}`, margin + 5, y);
      y += 5;
      doc.text(`• Média geral: ${mediaGeral}`, margin + 5, y);
      y += 5;
      doc.text(`• Maior nota: ${maiorNota}`, margin + 5, y);
      y += 5;
      doc.text(`• Menor nota: ${menorNota}`, margin + 5, y);
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
      console.error("Erro ao gerar PDF:", error);
      reject(error);
    }
  });
}

// ========== FUNÇÕES DE MUDANÇA DE ABA ==========
window.mudarTab = function (tab) {
  document.querySelectorAll(".professor-tabs .tab-btn").forEach((btn) => btn.classList.remove("active"));

  document.querySelectorAll(".professor-tabs .tab-btn").forEach((btn) => {
    if (btn.getAttribute("onclick")?.includes(`'${tab}'`)) {
      btn.classList.add("active");
    }
  });

  document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");

  if (tab === "registros") {
    carregarRegistrosRealizados();
  } else if (tab === "dashboard") {
    carregarEletivasProfessor();
  }
};

// ========== FUNÇÕES DE CARREGAMENTO DE ELETIVAS ==========
function carregarEletivasProfessor() {
  const container = document.getElementById("professorEletivasCards");
  if (!container) return;

  const eletivas = state.eletivas.filter((e) => e.professorId === professorAtual.id);

  if (eletivas.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma eletiva encontrada para este professor</p>';
    return;
  }

  const eletivasOrdenadas = ordenarEletivasPorDia(eletivas);
  const eletivasPorDia = agruparEletivasPorDia(eletivasOrdenadas);

  container.innerHTML = "";

  Object.keys(eletivasPorDia).forEach((dia) => {
    const eletivasDoDia = eletivasPorDia[dia];
    if (eletivasDoDia.length === 0) return;

    const diaTitulo = document.createElement("h4");
    diaTitulo.className = "dia-titulo";
    diaTitulo.textContent = formatarNomeDia(dia);
    diaTitulo.style.margin = "1.5rem 0 1rem 0";
    diaTitulo.style.color = "var(--primary)";
    diaTitulo.style.borderBottom = "2px solid var(--primary-light)";
    diaTitulo.style.paddingBottom = "0.5rem";
    container.appendChild(diaTitulo);

    eletivasDoDia.forEach((eletiva) => {
      const matriculas = state.matriculas.filter((m) => m.eletivaId === eletiva.id).length;

      const registrosEletiva =
        state.registros?.filter((r) => r.eletivaId === eletiva.id)
          .sort((a, b) => new Date(b.data) - new Date(a.data))
          .slice(0, 3) || [];

      const ultimosRegistros = registrosEletiva.map((r) => formatarDataCorrigida(r.data).substring(0, 5)).join(", ");

      const semestreAtual = "1/2026";
      const notasLiberadas = verificarNotasLiberadas(eletiva.id, semestreAtual);
      const notaExistente = state.notas?.find((n) => n.eletivaId === eletiva.id && n.semestre === semestreAtual);

      const iconeNotas = notasLiberadas ? "fa-pen" : "fa-lock";
      const tooltipNotas = notasLiberadas ? "Registrar notas do semestre" : "Aguardando liberação do gestor";
      const classeBotaoNotas = notasLiberadas ? "btn-primary" : "btn-secondary btn-bloqueado";
      const textoNotas = notasLiberadas ? (notaExistente ? "Editar Notas" : "Registrar Notas") : "Notas (bloqueado)";

      const card = document.createElement("div");
      card.className = "eletiva-card";
      card.dataset.eletivaId = eletiva.id;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <div style="flex: 1;">
            <h3 style="margin-bottom: 0.3rem; color: var(--primary);">ELETIVA: ${eletiva.nome} | Código: ${eletiva.codigo}</h3>
            <p style="margin: 0.2rem 0;"><i class="fas fa-user"></i> Professor: ${professorAtual.nome}</p>
            <p style="margin: 0.2rem 0;"><i class="fas fa-clock"></i> Horário: ${eletiva.horario.diaSemana} ${eletiva.horario.codigoTempo} | Turmas: ${eletiva.turmaOrigem || "Várias"}</p>
          </div>
        </div>
        
        <div style="display: flex; gap: 0.5rem; margin: 1rem 0; flex-wrap: wrap;">
          <button class="btn-primary btn-small" onclick="abrirRegistroAula(${eletiva.id})" title="Registrar frequência da aula">
            <i class="fas fa-pen"></i> REGISTRAR FREQUÊNCIA
          </button>
          
          <button class="btn-secondary btn-small" onclick="gerarListaFrequenciaBranco(${eletiva.id})" title="Gerar lista de frequência em branco">
            <i class="fas fa-print"></i> LISTA EM BRANCO
          </button>
          
          <button class="${classeBotaoNotas} btn-small" onclick="abrirModalNotas(${eletiva.id}, '${semestreAtual}')" title="${tooltipNotas}" ${!notasLiberadas ? "disabled" : ""}>
            <i class="fas ${iconeNotas}"></i> ${textoNotas}
          </button>
        </div>
        
        <div style="margin-top: 0.8rem; padding-top: 0.8rem; border-top: 1px dashed var(--bg-gray); font-size: 0.9rem; color: var(--text-light);">
          <i class="fas fa-history"></i> Últimos registros: ${ultimosRegistros || "Nenhum"}
          ${!notasLiberadas ? '<span style="margin-left: 1rem; font-style: italic;"><i class="fas fa-lock"></i> Notas aguardando liberação</span>' : ""}
        </div>
      `;

      container.appendChild(card);
    });
  });
}

// ========== FUNÇÕES DE REGISTRO DE AULA ==========
window.abrirRegistroAula = function (eletivaId) {
  eletivaSelecionadaRegistro = eletivaId;
  document.getElementById("modalRegistroAula").classList.add("active");
  carregarAlunosParaChamada(eletivaId);
};

function carregarAlunosParaChamada(eletivaId) {
  const matriculas = state.matriculas.filter((m) => m.eletivaId === eletivaId);
  const alunos = state.alunos.filter((a) => matriculas.some((m) => m.alunoId === a.id));

  if (alunos.length === 0) {
    alert("Nenhum aluno matriculado nesta eletiva");
    fecharModalRegistro();
    return;
  }

  const container = document.getElementById("listaAlunosChamada");
  container.innerHTML = "";

  alunos.forEach((aluno) => {
    const div = document.createElement("div");
    div.className = "aluno-chamada-item";
    div.innerHTML = `
      <label class="toggle-switch">
        <input type="checkbox" id="aluno_${aluno.id}" value="${aluno.codigoSige}" checked onchange="atualizarResumoChamada()">
        <span class="toggle-slider"></span>
      </label>
      <div class="aluno-info">
        <strong>${aluno.codigoSige}</strong> - ${aluno.nome}
        <span class="aluno-turma">${aluno.turmaOrigem}</span>
      </div>
    `;

    container.appendChild(div);
  });

  atualizarResumoChamada();
}

window.atualizarResumoChamada = function () {
  const checkboxes = document.querySelectorAll('#listaAlunosChamada input[type="checkbox"]');
  const presentes = Array.from(checkboxes).filter((cb) => cb.checked).length;
  const ausentes = checkboxes.length - presentes;

  document.getElementById("presentesCount").textContent = presentes;
  document.getElementById("ausentesCount").textContent = ausentes;
  document.getElementById("totalAlunosCount").textContent = checkboxes.length;
};

window.marcarTodosPresentes = function () {
  document.querySelectorAll('#listaAlunosChamada input[type="checkbox"]').forEach((cb) => {
    cb.checked = true;
  });
  atualizarResumoChamada();
};

window.marcarTodosAusentes = function () {
  document.querySelectorAll('#listaAlunosChamada input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
  });
  atualizarResumoChamada();
};

window.salvarRegistroAula = function (event) {
  event.preventDefault();

  if (!eletivaSelecionadaRegistro) {
    showToast("Erro: eletiva não selecionada", "error");
    return;
  }

  const data = document.getElementById("dataAula").value;
  const conteudo = document.getElementById("conteudoAula").value;

  if (!data || !conteudo) {
    showToast("Preencha todos os campos obrigatórios!", "error");
    return;
  }

  const dataNormalizada = normalizarDataParaSalvar(data);

  const presentes = [];
  const ausentes = [];

  document.querySelectorAll('#listaAlunosChamada input[type="checkbox"]').forEach((cb) => {
    if (cb.checked) {
      presentes.push(cb.value);
    } else {
      ausentes.push(cb.value);
    }
  });

  const registroExistente = state.registros?.find(
    (r) => r.eletivaId === eletivaSelecionadaRegistro && normalizarDataParaSalvar(r.data) === dataNormalizada
  );

  if (registroExistente) {
    if (!confirm("Já existe um registro para esta data. Deseja substituí-lo?")) {
      return;
    }
    state.registros = state.registros.filter((r) => r.id !== registroExistente.id);
  }

  const registro = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    eletivaId: eletivaSelecionadaRegistro,
    data: dataNormalizada,
    conteudo: conteudo,
    observacoes: "",
    frequencia: {
      presentes: presentes,
      ausentes: ausentes,
      justificativas: {},
    },
    professorId: professorAtual.id,
    professorNome: professorAtual.nome,
    semestreId: "2026-1",
    createdAt: new Date().toISOString(),
    _offline: !verificarConexao(),
  };

  if (!state.registros) state.registros = [];
  state.registros.push(registro);
  salvarEstado();

  if (window.FirebaseSync) {
    window.FirebaseSync.salvarRegistroAulaOffline(registro).then(() => {
      atualizarStatusSincronizacao();
      showToast(verificarConexao() ? "Registro salvo com sucesso!" : "Registro salvo no dispositivo", "success");
    });
  } else {
    showToast("Registro salvo com sucesso!", "success");
  }

  fecharModalRegistro();
  document.getElementById("registroAulaForm").reset();
  const hoje = new Date().toISOString().split("T")[0];
  document.getElementById("dataAula").value = hoje;

  if (document.getElementById("tab-registros").classList.contains("active")) {
    carregarRegistrosRealizados();
  } else {
    carregarEletivasProfessor();
  }
};

window.fecharModalRegistro = function () {
  document.getElementById("modalRegistroAula").classList.remove("active");
  eletivaSelecionadaRegistro = null;
};

// ========== FUNÇÕES DE NOTAS ==========
window.abrirModalNotas = function (eletivaId, semestre = "1/2026") {
  if (!verificarNotasLiberadas(eletivaId, semestre)) {
    showToast("⛔ Registro de notas liberado apenas pelo gestor", "warning");
    return;
  }

  const eletiva = state.eletivas.find((e) => e.id === eletivaId);
  if (!eletiva) {
    showToast("Eletiva não encontrada", "error");
    return;
  }

  const registroExistente = state.notas?.find((n) => n.eletivaId === eletivaId && n.semestre === semestre);

  registroNotasEmEdicao = {
    id: registroExistente?.id,
    eletivaId: eletivaId,
    semestre: semestre,
    notas: registroExistente ? [...registroExistente.notas] : [],
  };

  document.getElementById("modalNotasTitle").textContent = `Registro de Notas - ${eletiva.codigo} - ${eletiva.nome}`;
  document.getElementById("modalNotasSubtitulo").textContent = `${semestre}`;

  carregarAlunosParaNotas(eletivaId, semestre);

  document.getElementById("modalRegistroNotas").classList.add("active");
};

function carregarAlunosParaNotas(eletivaId, semestre) {
  const matriculas = state.matriculas.filter((m) => m.eletivaId === eletivaId);
  const alunos = state.alunos
    .filter((a) => matriculas.some((m) => m.alunoId === a.id))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  if (alunos.length === 0) {
    alert("Nenhum aluno matriculado nesta eletiva");
    fecharModalNotas();
    return;
  }

  const container = document.getElementById("listaAlunosNotas");
  container.innerHTML = "";

  const mapaNotas = {};
  if (registroNotasEmEdicao?.notas) {
    registroNotasEmEdicao.notas.forEach((n) => {
      mapaNotas[n.alunoId] = n.nota;
    });
  }

  alunos.forEach((aluno) => {
    const notaAtual = mapaNotas[aluno.id] || 6.0;
    const isAlterado = Math.abs(notaAtual - 6.0) > 0.01;

    const div = document.createElement("div");
    div.className = "aluno-nota-item";
    div.dataset.alunoId = aluno.id;
    div.dataset.notaOriginal = notaAtual;
    div.innerHTML = `
      <div class="aluno-info">
        <strong>${aluno.codigoSige}</strong> - ${aluno.nome}
        <span class="aluno-turma">${aluno.turmaOrigem}</span>
      </div>
      <input type="number" class="nota-input ${isAlterado ? "nota-alterada" : ""}" 
              id="nota_${aluno.id}" value="${notaAtual.toFixed(1)}" 
              min="0" max="10" step="0.1" onchange="marcarNotaAlterada(this)">
    `;

    container.appendChild(div);
  });

  atualizarResumoNotas();
}

window.marcarNotaAlterada = function (input) {
  const valorOriginal = parseFloat(input.closest(".aluno-nota-item")?.dataset.notaOriginal || 6.0);
  const valorAtual = parseFloat(input.value);

  if (Math.abs(valorAtual - valorOriginal) > 0.01) {
    input.classList.add("nota-alterada");
  } else {
    input.classList.remove("nota-alterada");
  }

  atualizarResumoNotas();
};

function atualizarResumoNotas() {
  const inputs = document.querySelectorAll("#listaAlunosNotas .nota-input");
  const totalAlunos = inputs.length;
  let totalNotas = 0;
  let notasValidas = 0;

  inputs.forEach((input) => {
    const valor = parseFloat(input.value);
    if (!isNaN(valor) && valor >= 0 && valor <= 10) {
      totalNotas += valor;
      notasValidas++;
    }
  });

  const media = notasValidas > 0 ? (totalNotas / notasValidas).toFixed(1) : "0.0";

  const resumo = document.getElementById("notasResumo");
  if (resumo) {
    resumo.innerHTML = `Total: ${totalAlunos} alunos | Média: ${media}`;
  }
}

window.salvarNotas = async function () {
  if (!registroNotasEmEdicao) {
    showToast("Erro: dados não identificados", "error");
    return;
  }

  const notas = [];
  const inputs = document.querySelectorAll("#listaAlunosNotas .aluno-nota-item");

  inputs.forEach((item) => {
    const alunoId = item.dataset.alunoId;
    const input = item.querySelector(".nota-input");
    const valor = parseFloat(input.value);

    if (!isNaN(valor) && valor >= 0 && valor <= 10) {
      const aluno = state.alunos.find((a) => a.id === alunoId);
      if (aluno) {
        notas.push({
          alunoId: alunoId,
          nome: aluno.nome,
          turma: aluno.turmaOrigem,
          sige: aluno.codigoSige,
          nota: valor,
        });
      }
    }
  });

  if (notas.length === 0) {
    showToast("Nenhuma nota válida para salvar", "error");
    return;
  }

  const registroNotas = {
    id: registroNotasEmEdicao.id || Date.now() + Math.floor(Math.random() * 1000),
    eletivaId: registroNotasEmEdicao.eletivaId,
    semestre: registroNotasEmEdicao.semestre,
    dataRegistro: formatarDataCorrigida(new Date().toISOString().split("T")[0]),
    notas: notas,
    status: "finalizado",
    professorId: professorAtual.id,
    professorNome: professorAtual.nome,
    dataCriacao: new Date().toISOString(),
  };

  if (!state.notas) state.notas = [];

  const index = state.notas.findIndex(
    (n) => n.eletivaId === registroNotas.eletivaId && n.semestre === registroNotas.semestre
  );

  if (index !== -1) {
    state.notas[index] = registroNotas;
  } else {
    state.notas.push(registroNotas);
  }

  salvarEstado();

  if (window.FirebaseSync) {
    try {
      await window.FirebaseSync.salvarDadosFirebase("notas", registroNotas, registroNotas.id);
    } catch (e) {
      console.warn("Erro ao salvar no Firebase:", e);
    }
  }

  showToast("✅ Notas registradas com sucesso!", "success");
  fecharModalNotas();

  carregarRegistrosRealizados();
  carregarEletivasProfessor();
};

window.fecharModalNotas = function () {
  document.getElementById("modalRegistroNotas").classList.remove("active");
  registroNotasEmEdicao = null;
};

// ========== FUNÇÕES DE REGISTROS REALIZADOS ==========
window.verRegistrosEletiva = function (eletivaId) {
  document.getElementById("filtroEletivaRegistros").value = eletivaId;
  mudarTab("registros");
};

function carregarSelectEletivasRegistros() {
  const select = document.getElementById("filtroEletivaRegistros");
  if (!select) return;

  const eletivas = state.eletivas.filter((e) => e.professorId === professorAtual.id);

  select.innerHTML = '<option value="">Todas as eletivas</option>';
  eletivas.forEach((e) => {
    select.innerHTML += `<option value="${e.id}">${e.codigo} - ${e.nome}</option>`;
  });
}

window.carregarRegistrosRealizados = async function () {
  const container = document.getElementById("registrosRealizadosContainer");
  if (!container) return;

  const filtroEletiva = document.getElementById("filtroEletivaRegistros")?.value;
  const dataInicio = document.getElementById("filtroDataInicio")?.value;
  const dataFim = document.getElementById("filtroDataFim")?.value;

  let registros = [];

  if (window.FirebaseSync && window.FirebaseSync.carregarRegistrosFirebase) {
    try {
      registros = await window.FirebaseSync.carregarRegistrosFirebase(filtroEletiva || null, dataInicio || null, dataFim || null);
    } catch (e) {
      console.warn("Erro ao carregar do Firebase (usando fallback):", e);
    }
  }

  if (!registros || registros.length === 0) {
    registros = (window.state?.registros || []).filter((r) => r.professorId === professorAtual.id);
  }

  if (filtroEletiva) {
    registros = registros.filter((r) => r.eletivaId === parseInt(filtroEletiva));
  }

  if (dataInicio) {
    const dataInicioNormalizada = normalizarDataParaSalvar(dataInicio);
    registros = registros.filter((r) => normalizarDataParaSalvar(r.data) >= dataInicioNormalizada);
  }
  if (dataFim) {
    const dataFimNormalizada = normalizarDataParaSalvar(dataFim);
    registros = registros.filter((r) => normalizarDataParaSalvar(r.data) <= dataFimNormalizada);
  }

  const registrosUnicos = [];
  const mapaRegistros = new Map();

  registros.forEach((reg) => {
    const chave = `${reg.eletivaId}_${normalizarDataParaSalvar(reg.data)}`;
    const existente = mapaRegistros.get(chave);

    if (!existente || (reg.createdAt && existente.createdAt && reg.createdAt > existente.createdAt)) {
      mapaRegistros.set(chave, reg);
    }
  });

  mapaRegistros.forEach((reg) => registrosUnicos.push(reg));

  const registrosPorEletiva = {};
  registrosUnicos.forEach((r) => {
    if (!registrosPorEletiva[r.eletivaId]) {
      registrosPorEletiva[r.eletivaId] = [];
    }
    registrosPorEletiva[r.eletivaId].push(r);
  });

  const notasPorEletiva = {};
  if (state.notas && state.notas.length > 0) {
    state.notas.forEach((nota) => {
      if (!notasPorEletiva[nota.eletivaId]) {
        notasPorEletiva[nota.eletivaId] = [];
      }
      notasPorEletiva[nota.eletivaId].push(nota);
    });
  } else {
    if (!state.notas) {
      state.notas = [];
    }
  }

  container.innerHTML = "";

  const eletivasProfessor = state.eletivas?.filter((e) => e.professorId === professorAtual?.id) || [];

  if (eletivasProfessor.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma eletiva encontrada para este professor</p>';
    return;
  }

  const eletivasOrdenadas = ordenarEletivasPorDia(eletivasProfessor);
  const eletivasPorDia = agruparEletivasPorDia(eletivasOrdenadas);

  Object.keys(eletivasPorDia).forEach((dia) => {
    const eletivasDoDia = eletivasPorDia[dia];
    if (eletivasDoDia.length === 0) return;

    const diaTitulo = document.createElement("h4");
    diaTitulo.className = "dia-titulo";
    diaTitulo.textContent = formatarNomeDia(dia);
    diaTitulo.style.margin = "1.5rem 0 1rem 0";
    diaTitulo.style.color = "var(--primary)";
    diaTitulo.style.borderBottom = "2px solid var(--primary-light)";
    diaTitulo.style.paddingBottom = "0.5rem";
    container.appendChild(diaTitulo);

    eletivasDoDia.forEach((eletiva) => {
      const registrosEletiva = registrosPorEletiva[eletiva.id] || [];
      const notasEletiva = notasPorEletiva[eletiva.id] || [];

      registrosEletiva.sort((a, b) => {
        const dataA = normalizarDataParaSalvar(a.data);
        const dataB = normalizarDataParaSalvar(b.data);
        return dataB.localeCompare(dataA);
      });

      const card = document.createElement("div");
      card.className = "eletiva-card registros-card";
      card.dataset.eletivaId = eletiva.id;

      const header = document.createElement("div");
      header.innerHTML = `
        <h3 style="display: flex; justify-content: space-between; align-items: center;">
          ${eletiva.codigo} - ${eletiva.nome}
          <span class="badge" style="background: var(--primary); color: white; padding: 0.2rem 1rem; border-radius: 20px;">
            ${registrosEletiva.length + notasEletiva.length} registros
          </span>
        </h3>
      `;
      card.appendChild(header);

      const registrosLista = document.createElement("div");
      registrosLista.className = "registros-lista";
      registrosLista.style.display = "none";

      registrosEletiva.forEach((reg) => {
        const temOffline = reg._offline ? ' <i class="fas fa-mobile-alt" style="color: var(--warning);" title="Registro salvo no dispositivo"></i>' : "";
        const registroItem = document.createElement("div");
        registroItem.className = "registro-item-card";

        const dataFormatada = formatarDataCorrigida(reg.data);

        registroItem.innerHTML = `
          <div class="registro-header-card">
            <span class="registro-data-card">📅 ${dataFormatada} - Frequência ${temOffline}</span>
            <div class="registro-actions">
              <button class="btn-editar" onclick="event.stopPropagation(); abrirEdicaoRegistro(${reg.id})">
                <i class="fas fa-edit"></i> Editar
              </button>
              <button class="btn-excluir" onclick="event.stopPropagation(); confirmarExclusaoRegistro(${reg.id})">
                <i class="fas fa-trash"></i> Excluir
              </button>
              <button class="btn-imprimir" onclick="event.stopPropagation(); imprimirRegistrosPorData(${eletiva.id}, '${reg.data}')">
                <i class="fas fa-print"></i> Imprimir
              </button>
            </div>
          </div>
          <div class="registro-conteudo">${reg.conteudo.substring(0, 100)}${reg.conteudo.length > 100 ? "..." : ""}</div>
          <div class="registro-frequencia">
            <span class="presentes">✅ Presentes: ${reg.frequencia?.presentes?.length || 0}</span>
            <span class="ausentes">❌ Ausentes: ${reg.frequencia?.ausentes?.length || 0}</span>
          </div>
        `;
        registrosLista.appendChild(registroItem);
      });

      const semestreAtual = "1/2026";
      const notasLiberadas = verificarNotasLiberadas(eletiva.id, semestreAtual);
      const notaExistente = notasEletiva.find((n) => n.semestre === semestreAtual);

      if (notaExistente) {
        const media = notaExistente.notas?.length > 0
          ? (notaExistente.notas.reduce((acc, n) => acc + n.nota, 0) / notaExistente.notas.length).toFixed(1)
          : "0.0";

        const registroItem = document.createElement("div");
        registroItem.className = "registro-item-card";

        const icone = notasLiberadas ? "fa-edit" : "fa-lock";
        const textoBotao = notasLiberadas ? "Editar" : "Bloqueado";

        registroItem.innerHTML = `
          <div class="registro-header-card">
            <span class="registro-data-card">📊 ${notaExistente.semestre} - Notas (média: ${media})</span>
            <div class="registro-actions">
              <button class="btn-editar" onclick="event.stopPropagation(); abrirModalNotas(${eletiva.id}, '${notaExistente.semestre}')">
                <i class="fas ${icone}"></i> ${textoBotao}
              </button>
              <button class="btn-imprimir" onclick="event.stopPropagation(); imprimirPDFNotas(${eletiva.id}, '${notaExistente.semestre}')">
                <i class="fas fa-print"></i> Imprimir
              </button>
            </div>
          </div>
          <div class="registro-conteudo">Registro de notas do ${notaExistente.semestre}</div>
        `;
        registrosLista.appendChild(registroItem);
      } else {
        const registroItem = document.createElement("div");
        registroItem.className = "registro-item-card";

        const icone = notasLiberadas ? "fa-plus-circle" : "fa-lock";
        const textoBotao = notasLiberadas ? "Registrar Notas" : "Bloqueado";
        const corBotao = notasLiberadas ? "btn-success" : "btn-editar";

        registroItem.innerHTML = `
          <div class="registro-header-card">
            <span class="registro-data-card">📊 ${semestreAtual} - Notas (não registrado)</span>
            <div class="registro-actions">
              <button class="${corBotao}" onclick="event.stopPropagation(); abrirModalNotas(${eletiva.id}, '${semestreAtual}')" ${!notasLiberadas ? "disabled" : ""}>
                <i class="fas ${icone}"></i> ${textoBotao}
              </button>
              ${notasLiberadas ? `
              <button class="btn-imprimir" onclick="event.stopPropagation(); imprimirPDFNotas(${eletiva.id}, '${semestreAtual}')">
                <i class="fas fa-print"></i> Prévia
              </button>
              ` : ""}
            </div>
          </div>
          <div class="registro-conteudo">${notasLiberadas ? "Clique para registrar as notas do semestre" : "⛔ Função bloqueada pelo gestor"}</div>
        `;
        registrosLista.appendChild(registroItem);
      }

      card.appendChild(registrosLista);

      card.addEventListener("click", function (e) {
        if (e.target.closest(".btn-editar") || e.target.closest(".btn-excluir") || e.target.closest(".btn-imprimir") || e.target.closest(".btn-success")) return;

        const lista = this.querySelector(".registros-lista");
        const isExpanded = this.classList.contains("expanded");

        document.querySelectorAll(".eletiva-card.registros-card.expanded").forEach((c) => {
          if (c !== this) {
            c.classList.remove("expanded");
            c.querySelector(".registros-lista").style.display = "none";
          }
        });

        if (isExpanded) {
          this.classList.remove("expanded");
          lista.style.display = "none";
        } else {
          this.classList.add("expanded");
          lista.style.display = "block";
        }
      });

      container.appendChild(card);
    });
  });
};

window.limparFiltrosRegistros = function () {
  document.getElementById("filtroEletivaRegistros").value = "";
  document.getElementById("filtroDataInicio").value = "";
  document.getElementById("filtroDataFim").value = "";
  carregarRegistrosRealizados();
};

// ========== FUNÇÕES DE EDIÇÃO DE REGISTRO ==========
window.abrirEdicaoRegistro = async function (registroId) {
  let registro = null;

  if (window.state?.registros) {
    registro = window.state.registros.find((r) => r.id === registroId);
  }

  if (!registro && window.FirebaseSync) {
    const registros = await window.FirebaseSync.carregarRegistrosFirebase();
    registro = registros.find((r) => r.id === registroId);
  }

  if (!registro) {
    showToast("Registro não encontrado", "error");
    return;
  }

  registroEmEdicao = registro;

  document.getElementById("editarDataAula").value = normalizarDataParaSalvar(registro.data);
  document.getElementById("editarConteudoAula").value = registro.conteudo;
  document.getElementById("editarObservacoesAula").value = registro.observacoes || "";

  carregarAlunosParaEdicao(registro);

  document.getElementById("modalEditarRegistro").classList.add("active");
};

async function carregarAlunosParaEdicao(registro) {
  const eletivaId = registro.eletivaId;

  const matriculas = state.matriculas.filter((m) => m.eletivaId === eletivaId);
  const alunos = state.alunos.filter((a) => matriculas.some((m) => m.alunoId === a.id));

  const container = document.getElementById("editarListaAlunosChamada");
  container.innerHTML = "";

  alunos.forEach((aluno) => {
    const isPresente = registro.frequencia?.presentes?.includes(aluno.codigoSige);
    const justificativa = registro.frequencia?.justificativas?.[aluno.codigoSige] || "";

    const div = document.createElement("div");
    div.className = "aluno-chamada-item";
    div.innerHTML = `
      <label class="toggle-switch">
        <input type="checkbox" id="editar_aluno_${aluno.id}" value="${aluno.codigoSige}" ${isPresente ? "checked" : ""} onchange="atualizarResumoChamadaEdicao()">
        <span class="toggle-slider"></span>
      </label>
      <div class="aluno-info">
        <strong>${aluno.codigoSige}</strong> - ${aluno.nome}
        <span class="aluno-turma">${aluno.turmaOrigem}</span>
      </div>
      <input type="text" class="justificativa-input" placeholder="Justificativa (se ausente)" 
              value="${justificativa}" onchange="atualizarResumoChamadaEdicao()" ${isPresente ? "disabled" : ""}>
    `;

    const checkbox = div.querySelector('input[type="checkbox"]');
    const justificativaInput = div.querySelector(".justificativa-input");

    checkbox.addEventListener("change", () => {
      justificativaInput.disabled = checkbox.checked;
      if (!checkbox.checked) {
        justificativaInput.focus();
      } else {
        justificativaInput.value = "";
      }
      atualizarResumoChamadaEdicao();
    });

    container.appendChild(div);
  });

  atualizarResumoChamadaEdicao();
}

window.atualizarResumoChamadaEdicao = function () {
  const checkboxes = document.querySelectorAll('#editarListaAlunosChamada input[type="checkbox"]');
  const presentes = Array.from(checkboxes).filter((cb) => cb.checked).length;
  const ausentes = checkboxes.length - presentes;

  document.getElementById("editarPresentesCount").textContent = presentes;
  document.getElementById("editarAusentesCount").textContent = ausentes;
  document.getElementById("editarTotalAlunosCount").textContent = checkboxes.length;
};

window.marcarTodosPresentesEdicao = function () {
  document.querySelectorAll('#editarListaAlunosChamada input[type="checkbox"]').forEach((cb) => {
    cb.checked = true;
    const event = new Event("change", { bubbles: true });
    cb.dispatchEvent(event);
  });
};

window.marcarTodosAusentesEdicao = function () {
  document.querySelectorAll('#editarListaAlunosChamada input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
    const event = new Event("change", { bubbles: true });
    cb.dispatchEvent(event);
  });
};

window.salvarEdicaoRegistro = async function (event) {
  event.preventDefault();

  if (!registroEmEdicao) {
    showToast("Erro: registro não identificado", "error");
    return;
  }

  const data = document.getElementById("editarDataAula").value;
  const conteudo = document.getElementById("editarConteudoAula").value;
  const observacoes = document.getElementById("editarObservacoesAula").value;

  if (!data || !conteudo) {
    showToast("Preencha todos os campos obrigatórios!", "error");
    return;
  }

  const dataNormalizada = normalizarDataParaSalvar(data);

  const presentes = [];
  const ausentes = [];
  const justificativas = {};

  document.querySelectorAll("#editarListaAlunosChamada .aluno-chamada-item").forEach((item) => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    const codigo = checkbox.value;
    const justificativa = item.querySelector(".justificativa-input").value;

    if (checkbox.checked) {
      presentes.push(codigo);
    } else {
      ausentes.push(codigo);
      if (justificativa) {
        justificativas[codigo] = justificativa;
      }
    }
  });

  const registroAtualizado = {
    ...registroEmEdicao,
    data: dataNormalizada,
    conteudo: conteudo,
    observacoes: observacoes,
    frequencia: {
      presentes: presentes,
      ausentes: ausentes,
      justificativas: justificativas,
    },
    editadoEm: new Date().toISOString(),
    _offline: !verificarConexao(),
  };

  const registroConflitante = state.registros?.find(
    (r) =>
      r.id !== registroEmEdicao.id &&
      r.eletivaId === registroEmEdicao.eletivaId &&
      normalizarDataParaSalvar(r.data) === dataNormalizada
  );

  if (registroConflitante) {
    if (!confirm("Já existe outro registro para esta data. Deseja substituí-lo?")) {
      return;
    }
    state.registros = state.registros.filter((r) => r.id !== registroConflitante.id);
  }

  const index = state.registros.findIndex((r) => r.id === registroEmEdicao.id);
  if (index !== -1) {
    state.registros[index] = registroAtualizado;
    salvarEstado();
  }

  if (window.FirebaseSync) {
    await window.FirebaseSync.salvarDadosFirebase("registros", registroAtualizado, registroAtualizado.id);
    atualizarStatusSincronizacao();
  }

  showToast(verificarConexao() ? "Registro atualizado com sucesso!" : "Registro atualizado no dispositivo", "success");

  fecharModalEditar();
  carregarRegistrosRealizados();
  carregarEletivasProfessor();
};

window.fecharModalEditar = function () {
  document.getElementById("modalEditarRegistro").classList.remove("active");
  registroEmEdicao = null;
};

// ========== FUNÇÕES DE EXCLUSÃO DE REGISTRO ==========
window.confirmarExclusaoRegistro = function (registroId) {
  console.log("🔍 Confirmar exclusão do registro:", registroId);

  registroParaExcluir = registroId;

  const modal = document.getElementById("modalConfirmacao");
  const confirmBody = document.getElementById("confirmBody");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmBtn = document.getElementById("confirmActionBtn");

  if (modal && confirmBody && confirmTitle && confirmBtn) {
    confirmTitle.textContent = "Confirmar Exclusão";
    confirmBody.innerHTML = `
      <p>Tem certeza que deseja excluir este registro?</p>
      <p style="color: var(--danger); font-weight: bold; margin-top: 10px;">Esta ação não pode ser desfeita!</p>
    `;

    const novoBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(novoBtn, confirmBtn);

    novoBtn.onclick = async function () {
      console.log("✅ Usuário confirmou exclusão");
      await excluirRegistro(registroId);
      fecharModalConfirmacao();
    };

    modal.classList.add("active");
  } else {
    if (confirm("Tem certeza que deseja excluir este registro?")) {
      excluirRegistro(registroId);
    }
  }
};

window.fecharModalConfirmacao = function () {
  console.log("❌ Fechando modal de confirmação");
  document.getElementById("modalConfirmacao").classList.remove("active");
};

async function excluirRegistro(registroId) {
  console.log("🗑️ Excluindo registro:", registroId);
  mostrarLoaderExclusao(true);

  try {
    const idString = registroId.toString();

    const index = state.registros.findIndex((r) => r.id == idString || r.id == registroId);
    if (index !== -1) {
      state.registros.splice(index, 1);
      salvarEstado();
      console.log("✅ Removido do state");
    }

    try {
      const db = FirebaseConfig.firestore;
      await db.collection("registros").doc(idString).delete();
      console.log("✅ Removido do Firebase");
    } catch (e) {
      console.warn("⚠️ Erro no Firebase:", e);
    }

    const elementos = document.querySelectorAll(".registro-item-card");
    let elementoRemovido = false;

    elementos.forEach((el) => {
      if (el.innerHTML.includes(`excluirRegistro(${registroId})`) || el.innerHTML.includes(`excluirRegistro(${idString})`)) {
        el.remove();
        elementoRemovido = true;
        console.log("✅ Elemento removido da tela");
      }
    });

    if (!elementoRemovido) {
      console.log("⚠️ Não encontrou pelo ID, recriando lista...");
      const container = document.getElementById("registrosRealizadosContainer");
      if (container) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Atualizando...</div>';
        await new Promise((resolve) => setTimeout(resolve, 100));
        await carregarRegistrosRealizados();
      }
    }

    document.querySelectorAll(".eletiva-card.registros-card").forEach((card) => {
      const eletivaId = card.dataset.eletivaId;
      if (eletivaId) {
        const count = state.registros.filter((r) => r.eletivaId == eletivaId).length;
        const badge = card.querySelector(".badge");
        if (badge) {
          badge.textContent = `${count} registros`;
        }
      }
    });

    showToast("✅ Registro excluído com sucesso!", "success");
  } catch (error) {
    console.error("❌ Erro:", error);
    showToast("Erro ao excluir registro", "error");
  } finally {
    mostrarLoaderExclusao(false);
    registroParaExcluir = null;
  }
}

window.excluirRegistro = excluirRegistro;

function forcarRecarregamentoRegistros() {
  console.log("🔄 Forçando recarregamento da interface...");
  const container = document.getElementById("registrosRealizadosContainer");
  if (container) {
    container.innerHTML = "";
    carregarRegistrosRealizados();
    carregarEletivasProfessor();
  }
}

window.limparTelaRegistros = function () {
  console.log("🧹 Forçando limpeza da tela...");
  document.querySelectorAll(".registro-item-card").forEach((el) => el.remove());
  document.querySelectorAll(".eletiva-card.registros-card").forEach((card) => {
    const badge = card.querySelector(".badge");
    if (badge) {
      badge.textContent = "0 registros";
    }
  });
};

window.fazerLogout = function () {
  localStorage.removeItem("professor_atual");
  window.location.href = "index.html";
};

window.fecharModal = function () {
  document.getElementById("modalDetalhes").classList.remove("active");
};
