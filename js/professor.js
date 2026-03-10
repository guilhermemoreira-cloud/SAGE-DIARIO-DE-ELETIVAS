// js/professor.js - Lógica do professor
console.log("👨‍🏫 professor.js carregado");

let professorAtual = null;
let registroEmEdicao = null;
let registroNotasEmEdicao = null;
let eletivaSelecionadaRegistro = null;
let registroParaExcluir = null;
let operacoesPendentes = 0;

// Mock temporário para controle de liberação de notas
// FUTURO: substituir por integração com Firebase/painel do gestor
const NOTAS_LIBERADAS = {
  // Formato: "eletivaId_semestre": true/false
  // Exemplo: "1001_1/2026": true
};

// Função para verificar se notas estão liberadas para uma eletiva
function verificarNotasLiberadas(eletivaId, semestre = "1/2026") {
  const chave = `${eletivaId}_${semestre}`;
  return NOTAS_LIBERADAS[chave] === true;
}

// Função para liberar notas (temporário para testes)
function liberarNotasParaTeste(eletivaId, semestre = "1/2026") {
  const chave = `${eletivaId}_${semestre}`;
  NOTAS_LIBERADAS[chave] = true;
  console.log(`🔓 Notas liberadas para eletiva ${eletivaId} - ${semestre}`);

  // Recarregar cards se necessário
  if (document.getElementById("tab-registros")?.classList.contains("active")) {
    carregarRegistrosRealizados();
  } else {
    carregarEletivasProfessor();
  }
}

// Inicializar jsPDF
const { jsPDF } = window.jspdf;

// Função utilitária para formatar data com fuso horário corrigido
function formatarDataCorrigida(dataString) {
  if (!dataString) return "";

  // Se for string ISO (YYYY-MM-DD)
  if (typeof dataString === "string" && dataString.includes("-")) {
    const [ano, mes, dia] = dataString.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  // Se for objeto Date
  if (dataString instanceof Date) {
    const dia = dataString.getDate().toString().padStart(2, "0");
    const mes = (dataString.getMonth() + 1).toString().padStart(2, "0");
    const ano = dataString.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  return dataString;
}

// Função para garantir que a data seja salva no formato correto
function normalizarDataParaSalvar(data) {
  if (!data) return "";

  // Se for string no formato YYYY-MM-DD, manter
  if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return data;
  }

  // Tentar criar objeto Date e converter
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

// Função para calcular número de linhas por página
function calcularLinhasPorPagina(
  pageHeight,
  marginTop,
  marginBottom,
  headerHeight,
  footerHeight,
) {
  const espacoDisponivel =
    pageHeight - marginTop - marginBottom - headerHeight - footerHeight;
  // Altura por linha: aproximadamente 5mm
  return Math.floor(espacoDisponivel / 5);
}

// Função para verificar status da conexão
function verificarConexao() {
  return navigator.onLine;
}

// Função para atualizar interface de sincronização
function atualizarStatusSincronizacao() {
  const syncBtn = document.getElementById("syncButton");
  const syncBadge = document.getElementById("syncBadge");
  const connectionStatus = document.getElementById("connectionStatus");

  if (!syncBtn) return;

  const online = verificarConexao();
  const pendentes = window.FirebaseSync?.getPendingCount?.() || 0;
  operacoesPendentes = pendentes;

  // Atualizar status de conexão
  if (connectionStatus) {
    if (!online) {
      connectionStatus.innerHTML =
        '<i class="fas fa-wifi-slash"></i> Modo sem internet';
      connectionStatus.className = "connection-status offline";
    } else if (pendentes > 0) {
      connectionStatus.innerHTML = `<i class="fas fa-clock"></i> Você tem ${pendentes} registro(s) para enviar`;
      connectionStatus.className = "connection-status pending";
    } else {
      connectionStatus.innerHTML =
        '<i class="fas fa-check-circle"></i> Conectado';
      connectionStatus.className = "connection-status online";
    }
  }

  // Atualizar botão de sincronização
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

// Função para sincronizar manualmente
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

// Função para carregar imagem da logo como base64
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

// Função para adicionar cabeçalho padronizado aos PDFs
async function adicionarCabecalhoPadronizado(
  doc,
  eletiva,
  dataFormatada = null,
  semestre = null,
) {
  const marginTop = 15;
  const marginSides = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = marginTop;

  // Carregar logo (30% maior)
  try {
    const logoBase64 = await carregarLogoBase64();
    if (logoBase64) {
      // Logo 30% maior: antes 40mm, agora 52mm
      doc.addImage(logoBase64, "PNG", pageWidth / 2 - 26, y - 5, 52, 19.5);
      y += 24;
    } else {
      y += 5;
    }
  } catch (e) {
    console.warn("Erro ao adicionar logo:", e);
    y += 5;
  }

  // Título (sem ícone)
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("DIÁRIO DOS COMPONENTES CURRICULARES ELETIVAS", pageWidth / 2, y, {
    align: "center",
  });
  y += 8;

  // Nome da escola
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("EEMTI Filgueiras Lima - Inep: 23142804", pageWidth / 2, y, {
    align: "center",
  });
  y += 8;

  // Linha de informações
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

  // Linha divisória
  doc.setDrawColor(0, 0, 0);
  doc.line(marginSides, y, pageWidth - marginSides, y);
  y += 6;

  return { y, marginTop, marginSides };
}

// Função para adicionar cabeçalho da tabela
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
      doc.text(
        "Observações",
        x + larguras[0] + larguras[1] + larguras[2] + larguras[3],
        y,
      );
    } else {
      doc.text(
        "Tempo Eletivo",
        x + larguras[0] + larguras[1] + larguras[2] + larguras[3],
        y,
      );
    }
  }

  return y + 4;
}

// Função para adicionar rodapé com assinaturas
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

// Função para adicionar numeração de página
function adicionarNumeracaoPagina(doc, paginaAtual, totalPaginas) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginBottom = 10;
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Página ${paginaAtual} de ${totalPaginas}`,
    pageWidth / 2,
    pageHeight - marginBottom,
    { align: "center" },
  );
}

// Função para ordenar eletivas por dia da semana
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

    // Se mesmo dia, ordenar por horário (código T1, T2, etc)
    const tempoA = parseInt(a.horario?.codigoTempo?.replace("T", "") || 0);
    const tempoB = parseInt(b.horario?.codigoTempo?.replace("T", "") || 0);
    return tempoA - tempoB;
  });
}

// Função para agrupar eletivas por dia
function agruparEletivasPorDia(eletivas) {
  const grupos = {};
  const dias = [
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
    "domingo",
  ];

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

// Função para formatar nome do dia
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

document.addEventListener("DOMContentLoaded", function () {
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

    // Inicializar estrutura de notas se não existir
    if (!state.notas) {
      state.notas = [];
    }
  }

  document.getElementById("userName").textContent = professorAtual.nome;
  document.getElementById("userRole").textContent = "Professor";
  document.getElementById("professorInfoHeader").innerHTML =
    `<span>${professorAtual.nome}</span>`;

  // Atualizar status de conexão periodicamente
  setInterval(atualizarStatusSincronizacao, 5000);
  window.addEventListener("online", atualizarStatusSincronizacao);
  window.addEventListener("offline", atualizarStatusSincronizacao);

  // Atualizar status inicial
  setTimeout(atualizarStatusSincronizacao, 1000);

  carregarEletivasProfessor();
  carregarSelectEletivasRegistros();

  const hoje = new Date().toISOString().split("T")[0];
  if (document.getElementById("dataAula")) {
    document.getElementById("dataAula").value = hoje;
  }
});

// Função para mostrar/ocultar loader
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

// Função para mostrar/ocultar loader de exclusão
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

// Função para imprimir lista de frequência
window.imprimirListaFrequencia = async function (eletivaId) {
  mostrarLoaderPDF(true);

  try {
    const eletiva = state.eletivas.find((e) => e.id === eletivaId);
    if (!eletiva) {
      showToast("Eletiva não encontrada", "error");
      return;
    }

    const matriculas = state.matriculas.filter(
      (m) => m.eletivaId === eletivaId,
    );
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

        adicionarNumeracaoPagina(
          doc,
          paginaAtual,
          Math.ceil(alunos.length / linhasPorPagina),
        );

        doc.addPage();
        paginaAtual++;
        linhasUsadas = 0;

        const novoCabecalho = await adicionarCabecalhoPadronizado(doc, eletiva);
        y = novoCabecalho.y;
        y = adicionarCabecalhoTabela(
          doc,
          marginSides,
          y,
          larguras,
          "frequencia",
        );
        y += 2;
        doc.line(marginSides, y, pageWidth - marginSides, y);
        y += 4;
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      doc.text(aluno.nome.substring(0, 30), marginSides, y);
      doc.text(aluno.turmaOrigem, marginSides + larguras[0], y);
      doc.text(aluno.codigoSige, marginSides + larguras[0] + larguras[1], y);
      doc.text(
        "______",
        marginSides + larguras[0] + larguras[1] + larguras[2],
        y,
      );
      doc.text(
        "________________",
        marginSides + larguras[0] + larguras[1] + larguras[2] + larguras[3],
        y,
      );

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
    adicionarNumeracaoPagina(
      doc,
      paginaAtual,
      Math.ceil(alunos.length / linhasPorPagina),
    );

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

// Função para imprimir registros por data
window.imprimirRegistrosPorData = async function (eletivaId, dataISO) {
  mostrarLoaderPDF(true);

  try {
    const eletiva = state.eletivas.find((e) => e.id === eletivaId);
    if (!eletiva) {
      showToast("Eletiva não encontrada", "error");
      return;
    }

    let registros = [];
    let registroEncontrado = null;

    if (window.FirebaseSync) {
      try {
        registros =
          await window.FirebaseSync.carregarRegistrosFirebase(eletivaId);
      } catch (e) {
        console.warn("Erro ao carregar do Firebase:", e);
      }
    }

    if (!registros || registros.length === 0) {
      registros = (window.state?.registros || []).filter(
        (r) => r.eletivaId === eletivaId,
      );
    }

    const dataNormalizada = normalizarDataParaSalvar(dataISO);
    registroEncontrado = registros.find((r) => {
      const rDataNormalizada = normalizarDataParaSalvar(r.data);
      return rDataNormalizada === dataNormalizada;
    });

    if (!registroEncontrado) {
      showToast("Nenhum registro encontrado para esta data", "warning");
      return;
    }

    const matriculas = state.matriculas.filter(
      (m) => m.eletivaId === eletivaId,
    );
    const alunos = state.alunos
      .filter((a) => matriculas.some((m) => m.alunoId === a.id))
      .sort((a, b) => a.nome.localeCompare(b.nome));

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

    const dataFormatada = formatarDataCorrigida(registroEncontrado.data);

    const cabecalho = await adicionarCabecalhoPadronizado(
      doc,
      eletiva,
      dataFormatada,
    );
    let y = cabecalho.y;
    let paginaAtual = 1;
    let linhasUsadas = 0;

    y = adicionarCabecalhoTabela(doc, marginSides, y, larguras, "registro");
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

        adicionarNumeracaoPagina(
          doc,
          paginaAtual,
          Math.ceil(alunos.length / linhasPorPagina),
        );

        doc.addPage();
        paginaAtual++;
        linhasUsadas = 0;

        const novoCabecalho = await adicionarCabecalhoPadronizado(
          doc,
          eletiva,
          dataFormatada,
        );
        y = novoCabecalho.y;
        y = adicionarCabecalhoTabela(doc, marginSides, y, larguras, "registro");
        y += 2;
        doc.line(marginSides, y, pageWidth - marginSides, y);
        y += 4;
      }

      const isPresente = registroEncontrado.frequencia?.presentes?.includes(
        aluno.codigoSige,
      );
      const status = isPresente ? "Presente" : "Ausente";
      const tempoEletivo = eletiva.horario?.codigoTempo || "T1";

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      doc.text(aluno.nome.substring(0, 30), marginSides, y);
      doc.text(aluno.turmaOrigem, marginSides + larguras[0], y);
      doc.text(aluno.codigoSige, marginSides + larguras[0] + larguras[1], y);
      doc.text(
        status,
        marginSides + larguras[0] + larguras[1] + larguras[2],
        y,
      );
      doc.text(
        tempoEletivo,
        marginSides + larguras[0] + larguras[1] + larguras[2] + larguras[3],
        y,
      );

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

    const linhasConteudo = doc.splitTextToSize(
      registroEncontrado.conteudo,
      contentWidth,
    );
    for (let i = 0; i < Math.min(3, linhasConteudo.length); i++) {
      doc.text(linhasConteudo[i], marginSides, y);
      y += 5;
    }

    for (let i = linhasConteudo.length; i < 3; i++) {
      doc.text("_".repeat(140), marginSides, y);
      y += 5;
    }

    y += 8;
    adicionarRodape(doc, y);
    adicionarNumeracaoPagina(
      doc,
      paginaAtual,
      Math.ceil(alunos.length / linhasPorPagina),
    );

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");

    showToast("PDF gerado com sucesso!", "success");
  } catch (error) {
    console.error("❌ Erro ao gerar PDF:", error);
    showToast("Erro ao gerar PDF: " + error.message, "error");
  } finally {
    mostrarLoaderPDF(false);
  }
};

// Função para imprimir PDF de notas
window.imprimirPDFNotas = async function (eletivaId, semestre = "1/2026") {
  mostrarLoaderPDF(true);

  try {
    const eletiva = state.eletivas.find((e) => e.id === eletivaId);
    if (!eletiva) {
      showToast("Eletiva não encontrada", "error");
      return;
    }

    const registroNotas = state.notas?.find(
      (n) => n.eletivaId === eletivaId && n.semestre === semestre,
    );

    const matriculas = state.matriculas.filter(
      (m) => m.eletivaId === eletivaId,
    );
    const alunos = state.alunos
      .filter((a) => matriculas.some((m) => m.alunoId === a.id))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    if (alunos.length === 0) {
      showToast("Nenhum aluno matriculado nesta eletiva", "warning");
      return;
    }

    const alunosComNotas = alunos.map((aluno) => {
      const notaEncontrada = registroNotas?.notas?.find(
        (n) => n.alunoId === aluno.id,
      );
      return {
        ...aluno,
        nota: notaEncontrada ? notaEncontrada.nota : 6.0,
      };
    });

    const somaNotas = alunosComNotas.reduce(
      (acc, aluno) => acc + parseFloat(aluno.nota || 0),
      0,
    );
    const mediaTurma =
      alunosComNotas.length > 0
        ? (somaNotas / alunosComNotas.length).toFixed(1)
        : "0.0";

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
      contentWidth * 0.4,
      contentWidth * 0.15,
      contentWidth * 0.2,
      contentWidth * 0.25,
    ];

    const alturaCabecalho = 65;
    const alturaRodape = 25;
    const linhasPorPagina = calcularLinhasPorPagina(
      pageHeight,
      marginTop,
      marginBottom,
      alturaCabecalho,
      alturaRodape,
    );

    const cabecalho = await adicionarCabecalhoPadronizado(
      doc,
      eletiva,
      null,
      semestre,
    );
    let y = cabecalho.y;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("BOLETIM DE NOTAS", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    doc.text("Nome do Aluno", marginSides, y);
    doc.text("Turma", marginSides + larguras[0], y);
    doc.text("SIGE", marginSides + larguras[0] + larguras[1], y);
    doc.text(
      "Nota (0-10)",
      marginSides + larguras[0] + larguras[1] + larguras[2],
      y,
    );

    y += 4;
    doc.line(marginSides, y, pageWidth - marginSides, y);
    y += 4;

    let paginaAtual = 1;
    let linhasUsadas = 0;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    for (let i = 0; i < alunosComNotas.length; i++) {
      const aluno = alunosComNotas[i];

      if (linhasUsadas >= linhasPorPagina) {
        doc.addPage();
        paginaAtual++;
        linhasUsadas = 0;

        const novoCabecalho = await adicionarCabecalhoPadronizado(
          doc,
          eletiva,
          null,
          semestre,
        );
        y = novoCabecalho.y;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("BOLETIM DE NOTAS", pageWidth / 2, y, { align: "center" });
        y += 10;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Nome do Aluno", marginSides, y);
        doc.text("Turma", marginSides + larguras[0], y);
        doc.text("SIGE", marginSides + larguras[0] + larguras[1], y);
        doc.text(
          "Nota (0-10)",
          marginSides + larguras[0] + larguras[1] + larguras[2],
          y,
        );

        y += 4;
        doc.line(marginSides, y, pageWidth - marginSides, y);
        y += 4;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
      }

      const notaFormatada = aluno.nota
        ? parseFloat(aluno.nota).toFixed(1)
        : "6.0";

      doc.text(aluno.nome.substring(0, 35), marginSides, y);
      doc.text(aluno.turmaOrigem, marginSides + larguras[0], y);
      doc.text(aluno.codigoSige, marginSides + larguras[0] + larguras[1], y);

      const larguraNota = doc.getTextWidth(notaFormatada);
      doc.text(
        notaFormatada,
        marginSides +
          larguras[0] +
          larguras[1] +
          larguras[2] +
          (larguras[3] - larguraNota),
        y,
      );

      y += 5;
      linhasUsadas++;
    }

    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total de Alunos: ${alunosComNotas.length}`, marginSides, y);
    y += 5;
    doc.text(`Média da Turma: ${mediaTurma}`, marginSides, y);
    y += 8;

    doc.line(marginSides, y, pageWidth - marginSides, y);
    y += 8;

    adicionarRodape(doc, y, true);
    adicionarNumeracaoPagina(
      doc,
      paginaAtual,
      Math.ceil(alunosComNotas.length / linhasPorPagina),
    );

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");

    showToast("PDF gerado com sucesso!", "success");
  } catch (error) {
    console.error("❌ Erro ao gerar PDF de notas:", error);
    showToast("Erro ao gerar PDF: " + error.message, "error");
  } finally {
    mostrarLoaderPDF(false);
  }
};

// Função para mudar de aba
window.mudarTab = function (tab) {
  document
    .querySelectorAll(".professor-tabs .tab-btn")
    .forEach((btn) => btn.classList.remove("active"));

  document.querySelectorAll(".professor-tabs .tab-btn").forEach((btn) => {
    if (btn.getAttribute("onclick")?.includes(`'${tab}'`)) {
      btn.classList.add("active");
    }
  });

  document
    .querySelectorAll(".tab-pane")
    .forEach((pane) => pane.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");

  if (tab === "registros") {
    carregarRegistrosRealizados();
  } else if (tab === "dashboard") {
    carregarEletivasProfessor();
  }
};

function carregarEletivasProfessor() {
  const container = document.getElementById("professorEletivasCards");
  if (!container) return;

  const eletivas = state.eletivas.filter(
    (e) => e.professorId === professorAtual.id,
  );

  if (eletivas.length === 0) {
    container.innerHTML =
      '<p class="empty-state">Nenhuma eletiva encontrada para este professor</p>';
    return;
  }

  // Ordenar eletivas por dia da semana e horário
  const eletivasOrdenadas = ordenarEletivasPorDia(eletivas);
  const eletivasPorDia = agruparEletivasPorDia(eletivasOrdenadas);

  container.innerHTML = "";

  // Para cada dia, criar seção
  Object.keys(eletivasPorDia).forEach((dia) => {
    const eletivasDoDia = eletivasPorDia[dia];
    if (eletivasDoDia.length === 0) return;

    // Título do dia
    const diaTitulo = document.createElement("h4");
    diaTitulo.className = "dia-titulo";
    diaTitulo.textContent = formatarNomeDia(dia);
    diaTitulo.style.margin = "1.5rem 0 1rem 0";
    diaTitulo.style.color = "var(--primary)";
    diaTitulo.style.borderBottom = "2px solid var(--primary-light)";
    diaTitulo.style.paddingBottom = "0.5rem";
    container.appendChild(diaTitulo);

    // Cards do dia
    eletivasDoDia.forEach((eletiva) => {
      const matriculas = state.matriculas.filter(
        (m) => m.eletivaId === eletiva.id,
      ).length;

      // Buscar últimos registros
      const registrosEletiva =
        state.registros
          ?.filter((r) => r.eletivaId === eletiva.id)
          .sort((a, b) => new Date(b.data) - new Date(a.data))
          .slice(0, 3) || [];

      const ultimosRegistros = registrosEletiva
        .map((r) => formatarDataCorrigida(r.data).substring(0, 5))
        .join(", ");

      // Verificar status das notas
      const semestreAtual = "1/2026";
      const notasLiberadas = verificarNotasLiberadas(eletiva.id, semestreAtual);
      const notaExistente = state.notas?.find(
        (n) => n.eletivaId === eletiva.id && n.semestre === semestreAtual,
      );

      const iconeNotas = notasLiberadas ? "fa-pen" : "fa-lock";
      const tooltipNotas = notasLiberadas
        ? "Registrar notas do semestre"
        : "Aguardando liberação do gestor";
      const classeBotaoNotas = notasLiberadas
        ? "btn-primary"
        : "btn-secondary btn-bloqueado";
      const textoNotas = notasLiberadas
        ? notaExistente
          ? "Editar Notas"
          : "Registrar Notas"
        : "Notas (bloqueado)";

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
        
        <div style="display: flex; gap: 1rem; margin: 1rem 0;">
          <button class="btn-primary btn-small" onclick="abrirRegistroAula(${eletiva.id})" title="Registrar frequência da aula">
            <i class="fas fa-pen"></i> Registrar Frequência
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

// Função para abrir modal de notas
window.abrirModalNotas = function (eletivaId, semestre = "1/2026") {
  // Verificar se notas estão liberadas
  if (!verificarNotasLiberadas(eletivaId, semestre)) {
    showToast("⛔ Registro de notas liberado apenas pelo gestor", "warning");
    return;
  }

  const eletiva = state.eletivas.find((e) => e.id === eletivaId);
  if (!eletiva) {
    showToast("Eletiva não encontrada", "error");
    return;
  }

  // Carregar notas existentes
  const registroExistente = state.notas?.find(
    (n) => n.eletivaId === eletivaId && n.semestre === semestre,
  );

  registroNotasEmEdicao = {
    id: registroExistente?.id,
    eletivaId: eletivaId,
    semestre: semestre,
    notas: registroExistente ? [...registroExistente.notas] : [],
  };

  // Preencher título do modal
  document.getElementById("modalNotasTitle").textContent =
    `Registro de Notas - ${eletiva.codigo} - ${eletiva.nome}`;
  document.getElementById("modalNotasSubtitulo").textContent = `${semestre}`;

  // Carregar alunos
  carregarAlunosParaNotas(eletivaId, semestre);

  // Abrir modal
  document.getElementById("modalRegistroNotas").classList.add("active");
};

// Carregar alunos para notas
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

// Marcar nota como alterada
window.marcarNotaAlterada = function (input) {
  const valorOriginal = parseFloat(
    input.closest(".aluno-nota-item")?.dataset.notaOriginal || 6.0,
  );
  const valorAtual = parseFloat(input.value);

  if (Math.abs(valorAtual - valorOriginal) > 0.01) {
    input.classList.add("nota-alterada");
  } else {
    input.classList.remove("nota-alterada");
  }

  atualizarResumoNotas();
};

// Atualizar resumo das notas
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

  const media =
    notasValidas > 0 ? (totalNotas / notasValidas).toFixed(1) : "0.0";

  const resumo = document.getElementById("notasResumo");
  if (resumo) {
    resumo.innerHTML = `Total: ${totalAlunos} alunos | Média: ${media}`;
  }
}

// Salvar notas
window.salvarNotas = async function () {
  if (!registroNotasEmEdicao) {
    showToast("Erro: dados não identificados", "error");
    return;
  }

  const notas = [];
  const inputs = document.querySelectorAll(
    "#listaAlunosNotas .aluno-nota-item",
  );

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
    id:
      registroNotasEmEdicao.id || Date.now() + Math.floor(Math.random() * 1000),
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
    (n) =>
      n.eletivaId === registroNotas.eletivaId &&
      n.semestre === registroNotas.semestre,
  );

  if (index !== -1) {
    state.notas[index] = registroNotas;
  } else {
    state.notas.push(registroNotas);
  }

  salvarEstado();

  if (window.FirebaseSync) {
    try {
      await window.FirebaseSync.salvarDadosFirebase(
        "notas",
        registroNotas,
        registroNotas.id,
      );
    } catch (e) {
      console.warn("Erro ao salvar no Firebase:", e);
    }
  }

  showToast("✅ Notas registradas com sucesso!", "success");
  fecharModalNotas();

  // Atualizar ambas as abas
  carregarRegistrosRealizados();
  carregarEletivasProfessor();
};

// Fechar modal de notas
window.fecharModalNotas = function () {
  document.getElementById("modalRegistroNotas").classList.remove("active");
  registroNotasEmEdicao = null;
};

// Abrir registro de aula
window.abrirRegistroAula = function (eletivaId) {
  eletivaSelecionadaRegistro = eletivaId;
  document.getElementById("modalRegistroAula").classList.add("active");
  carregarAlunosParaChamada(eletivaId);
};

// Carregar alunos para chamada
function carregarAlunosParaChamada(eletivaId) {
  const matriculas = state.matriculas.filter((m) => m.eletivaId === eletivaId);
  const alunos = state.alunos.filter((a) =>
    matriculas.some((m) => m.alunoId === a.id),
  );

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

// Atualizar resumo da chamada
window.atualizarResumoChamada = function () {
  const checkboxes = document.querySelectorAll(
    '#listaAlunosChamada input[type="checkbox"]',
  );
  const presentes = Array.from(checkboxes).filter((cb) => cb.checked).length;
  const ausentes = checkboxes.length - presentes;

  document.getElementById("presentesCount").textContent = presentes;
  document.getElementById("ausentesCount").textContent = ausentes;
  document.getElementById("totalAlunosCount").textContent = checkboxes.length;
};

// Marcar todos como presentes
window.marcarTodosPresentes = function () {
  document
    .querySelectorAll('#listaAlunosChamada input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = true;
    });
  atualizarResumoChamada();
};

// Marcar todos como ausentes
window.marcarTodosAusentes = function () {
  document
    .querySelectorAll('#listaAlunosChamada input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = false;
    });
  atualizarResumoChamada();
};

// Salvar registro de aula
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

  document
    .querySelectorAll('#listaAlunosChamada input[type="checkbox"]')
    .forEach((cb) => {
      if (cb.checked) {
        presentes.push(cb.value);
      } else {
        ausentes.push(cb.value);
      }
    });

  const registroExistente = state.registros?.find(
    (r) =>
      r.eletivaId === eletivaSelecionadaRegistro &&
      normalizarDataParaSalvar(r.data) === dataNormalizada,
  );

  if (registroExistente) {
    if (
      !confirm("Já existe um registro para esta data. Deseja substituí-lo?")
    ) {
      return;
    }
    state.registros = state.registros.filter(
      (r) => r.id !== registroExistente.id,
    );
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
    _offline: !verificarConexao(), // Marcar como offline se sem internet
  };

  if (!state.registros) state.registros = [];
  state.registros.push(registro);
  salvarEstado();

  if (window.FirebaseSync) {
    window.FirebaseSync.salvarRegistroAulaOffline(registro).then(() => {
      atualizarStatusSincronizacao();
      showToast(
        verificarConexao()
          ? "Registro salvo com sucesso!"
          : "Registro salvo no dispositivo",
        "success",
      );
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

// Fechar modal de registro
window.fecharModalRegistro = function () {
  document.getElementById("modalRegistroAula").classList.remove("active");
  eletivaSelecionadaRegistro = null;
};

// Ver registros de uma eletiva específica
window.verRegistrosEletiva = function (eletivaId) {
  document.getElementById("filtroEletivaRegistros").value = eletivaId;
  mudarTab("registros");
};

// Carregar select de eletivas para registros
function carregarSelectEletivasRegistros() {
  const select = document.getElementById("filtroEletivaRegistros");
  if (!select) return;

  const eletivas = state.eletivas.filter(
    (e) => e.professorId === professorAtual.id,
  );

  select.innerHTML = '<option value="">Todas as eletivas</option>';
  eletivas.forEach((e) => {
    select.innerHTML += `<option value="${e.id}">${e.codigo} - ${e.nome}</option>`;
  });
}

// Função principal para carregar registros realizados
window.carregarRegistrosRealizados = async function () {
  const container = document.getElementById("registrosRealizadosContainer");
  if (!container) return;

  const filtroEletiva = document.getElementById(
    "filtroEletivaRegistros",
  )?.value;
  const dataInicio = document.getElementById("filtroDataInicio")?.value;
  const dataFim = document.getElementById("filtroDataFim")?.value;

  let registros = [];

  if (window.FirebaseSync && window.FirebaseSync.carregarRegistrosFirebase) {
    try {
      registros = await window.FirebaseSync.carregarRegistrosFirebase(
        filtroEletiva || null,
        dataInicio || null,
        dataFim || null,
      );
    } catch (e) {
      console.warn("Erro ao carregar do Firebase (usando fallback):", e);
    }
  }

  if (!registros || registros.length === 0) {
    registros = (window.state?.registros || []).filter(
      (r) => r.professorId === professorAtual.id,
    );
  }

  if (filtroEletiva) {
    registros = registros.filter(
      (r) => r.eletivaId === parseInt(filtroEletiva),
    );
  }

  if (dataInicio) {
    const dataInicioNormalizada = normalizarDataParaSalvar(dataInicio);
    registros = registros.filter(
      (r) => normalizarDataParaSalvar(r.data) >= dataInicioNormalizada,
    );
  }
  if (dataFim) {
    const dataFimNormalizada = normalizarDataParaSalvar(dataFim);
    registros = registros.filter(
      (r) => normalizarDataParaSalvar(r.data) <= dataFimNormalizada,
    );
  }

  const registrosUnicos = [];
  const mapaRegistros = new Map();

  registros.forEach((reg) => {
    const chave = `${reg.eletivaId}_${normalizarDataParaSalvar(reg.data)}`;
    const existente = mapaRegistros.get(chave);

    if (
      !existente ||
      (reg.createdAt &&
        existente.createdAt &&
        reg.createdAt > existente.createdAt)
    ) {
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

  const eletivasProfessor =
    state.eletivas?.filter((e) => e.professorId === professorAtual?.id) || [];

  if (eletivasProfessor.length === 0) {
    container.innerHTML =
      '<p class="empty-state">Nenhuma eletiva encontrada para este professor</p>';
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
        const temOffline = reg._offline
          ? ' <i class="fas fa-mobile-alt" style="color: var(--warning);" title="Registro salvo no dispositivo"></i>'
          : "";
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
      const notaExistente = notasEletiva.find(
        (n) => n.semestre === semestreAtual,
      );

      if (notaExistente) {
        const media =
          notaExistente.notas?.length > 0
            ? (
                notaExistente.notas.reduce((acc, n) => acc + n.nota, 0) /
                notaExistente.notas.length
              ).toFixed(1)
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
              ${
                notasLiberadas
                  ? `
              <button class="btn-imprimir" onclick="event.stopPropagation(); imprimirPDFNotas(${eletiva.id}, '${semestreAtual}')">
                <i class="fas fa-print"></i> Prévia
              </button>
              `
                  : ""
              }
            </div>
          </div>
          <div class="registro-conteudo">${notasLiberadas ? "Clique para registrar as notas do semestre" : "⛔ Função bloqueada pelo gestor"}</div>
        `;
        registrosLista.appendChild(registroItem);
      }

      card.appendChild(registrosLista);

      card.addEventListener("click", function (e) {
        if (
          e.target.closest(".btn-editar") ||
          e.target.closest(".btn-excluir") ||
          e.target.closest(".btn-imprimir") ||
          e.target.closest(".btn-success")
        )
          return;

        const lista = this.querySelector(".registros-lista");
        const isExpanded = this.classList.contains("expanded");

        document
          .querySelectorAll(".eletiva-card.registros-card.expanded")
          .forEach((c) => {
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

// Limpar filtros de registros
window.limparFiltrosRegistros = function () {
  document.getElementById("filtroEletivaRegistros").value = "";
  document.getElementById("filtroDataInicio").value = "";
  document.getElementById("filtroDataFim").value = "";
  carregarRegistrosRealizados();
};

// Confirmar exclusão de registro
window.confirmarExclusaoRegistro = function (registroId) {
  registroParaExcluir = registroId;

  const confirmBody = document.getElementById("confirmBody");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmBtn = document.getElementById("confirmActionBtn");

  if (confirmBody && confirmTitle && confirmBtn) {
    confirmTitle.textContent = "Confirmar Exclusão";
    confirmBody.innerHTML =
      "<p>Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</p>";

    const originalOnClick = confirmBtn.onclick;
    confirmBtn.onclick = function () {
      excluirRegistro(registroId);
      fecharModalConfirmacao();
      setTimeout(() => {
        confirmBtn.onclick = originalOnClick;
      }, 100);
    };

    document.getElementById("modalConfirmacao").classList.add("active");
  } else {
    if (
      confirm(
        "Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.",
      )
    ) {
      excluirRegistro(registroId);
    }
  }
};

// Função para excluir registro
async function excluirRegistro(registroId) {
  mostrarLoaderExclusao(true);

  try {
    const registro = state.registros?.find((r) => r.id === registroId);

    if (!registro) {
      showToast("Registro não encontrado", "error");
      return;
    }

    state.registros = state.registros.filter((r) => r.id !== registroId);
    salvarEstado();

    if (window.FirebaseSync) {
      try {
        await window.FirebaseSync.salvarDadosFirebase(
          "registros",
          null,
          registroId,
        );
      } catch (e) {
        console.warn("Erro ao remover do Firebase:", e);
      }
    }

    await carregarRegistrosRealizados();
    carregarEletivasProfessor();

    showToast("Registro excluído com sucesso!", "success");
  } catch (error) {
    console.error("❌ Erro ao excluir registro:", error);
    showToast("Erro ao excluir registro: " + error.message, "error");
  } finally {
    mostrarLoaderExclusao(false);
    registroParaExcluir = null;
  }
}

// Abrir modal de edição de registro
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

  document.getElementById("editarDataAula").value = normalizarDataParaSalvar(
    registro.data,
  );
  document.getElementById("editarConteudoAula").value = registro.conteudo;
  document.getElementById("editarObservacoesAula").value =
    registro.observacoes || "";

  carregarAlunosParaEdicao(registro);

  document.getElementById("modalEditarRegistro").classList.add("active");
};

// Carregar alunos para edição
async function carregarAlunosParaEdicao(registro) {
  const eletivaId = registro.eletivaId;

  const matriculas = state.matriculas.filter((m) => m.eletivaId === eletivaId);

  const alunos = state.alunos.filter((a) =>
    matriculas.some((m) => m.alunoId === a.id),
  );

  const container = document.getElementById("editarListaAlunosChamada");
  container.innerHTML = "";

  alunos.forEach((aluno) => {
    const isPresente = registro.frequencia?.presentes?.includes(
      aluno.codigoSige,
    );
    const justificativa =
      registro.frequencia?.justificativas?.[aluno.codigoSige] || "";

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

// Atualizar resumo da chamada em edição
window.atualizarResumoChamadaEdicao = function () {
  const checkboxes = document.querySelectorAll(
    '#editarListaAlunosChamada input[type="checkbox"]',
  );
  const presentes = Array.from(checkboxes).filter((cb) => cb.checked).length;
  const ausentes = checkboxes.length - presentes;

  document.getElementById("editarPresentesCount").textContent = presentes;
  document.getElementById("editarAusentesCount").textContent = ausentes;
  document.getElementById("editarTotalAlunosCount").textContent =
    checkboxes.length;
};

// Marcar todos como presentes na edição
window.marcarTodosPresentesEdicao = function () {
  document
    .querySelectorAll('#editarListaAlunosChamada input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = true;
      const event = new Event("change", { bubbles: true });
      cb.dispatchEvent(event);
    });
};

// Marcar todos como ausentes na edição
window.marcarTodosAusentesEdicao = function () {
  document
    .querySelectorAll('#editarListaAlunosChamada input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = false;
      const event = new Event("change", { bubbles: true });
      cb.dispatchEvent(event);
    });
};

// Salvar edição do registro
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

  document
    .querySelectorAll("#editarListaAlunosChamada .aluno-chamada-item")
    .forEach((item) => {
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
      normalizarDataParaSalvar(r.data) === dataNormalizada,
  );

  if (registroConflitante) {
    if (
      !confirm("Já existe outro registro para esta data. Deseja substituí-lo?")
    ) {
      return;
    }
    state.registros = state.registros.filter(
      (r) => r.id !== registroConflitante.id,
    );
  }

  const index = state.registros.findIndex((r) => r.id === registroEmEdicao.id);
  if (index !== -1) {
    state.registros[index] = registroAtualizado;
    salvarEstado();
  }

  if (window.FirebaseSync) {
    await window.FirebaseSync.salvarDadosFirebase(
      "registros",
      registroAtualizado,
      registroAtualizado.id,
    );
    atualizarStatusSincronizacao();
  }

  showToast(
    verificarConexao()
      ? "Registro atualizado com sucesso!"
      : "Registro atualizado no dispositivo",
    "success",
  );

  fecharModalEditar();
  carregarRegistrosRealizados();
  carregarEletivasProfessor();
};

// Fechar modal de edição
window.fecharModalEditar = function () {
  document.getElementById("modalEditarRegistro").classList.remove("active");
  registroEmEdicao = null;
};

// Fazer logout
window.fazerLogout = function () {
  localStorage.removeItem("professor_atual");
  window.location.href = "index.html";
};

// Fechar modal de detalhes
window.fecharModal = function () {
  document.getElementById("modalDetalhes").classList.remove("active");
};

// Fechar modal de confirmação
window.fecharModalConfirmacao = function () {
  document.getElementById("modalConfirmacao").classList.remove("active");
};

// Função temporária para testes - liberar notas de uma eletiva
window.liberarNotasParaTeste = liberarNotasParaTeste;
