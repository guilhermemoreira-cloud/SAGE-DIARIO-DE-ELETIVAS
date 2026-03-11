// js/utils.js - Funções utilitárias e configurações
console.log("🔧 utils.js carregado");

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function formatarData(data) {
  if (!data) return "";
  return new Date(data).toLocaleDateString("pt-BR");
}

function formatarDataHora(data) {
  if (!data) return "";
  return new Date(data).toLocaleString("pt-BR");
}

function getSerieFromTurma(turma) {
  if (!turma) return "1ª";
  if (turma.includes("ª")) {
    return turma.substring(0, turma.indexOf("ª") + 1);
  }
  return turma.substring(0, turma.indexOf(" ")) + "ª";
}

function normalizarTurma(turma) {
  if (!turma) return turma;
  if (!turma.includes("ª") && turma.includes(" SÉRIE ")) {
    const partes = turma.split(" SÉRIE ");
    const numero = partes[0].trim();
    const letra = partes[1].trim();
    return `${numero}ª SÉRIE ${letra}`;
  }
  return turma;
}

function gerarIdUnico() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function abrirModalConfirmacao(titulo, mensagem, callback) {
  const modal = document.getElementById("modalConfirmacao");
  if (!modal) {
    if (confirm(`${titulo}\n\n${mensagem}`)) {
      callback();
    }
    return;
  }

  document.getElementById("confirmTitle").textContent = titulo;
  document.getElementById("confirmBody").innerHTML = mensagem;

  const confirmBtn = document.getElementById("confirmActionBtn");
  confirmBtn.onclick = () => {
    callback();
    fecharModalConfirmacao();
  };

  modal.classList.add("active");
}

function fecharModalConfirmacao() {
  const modal = document.getElementById("modalConfirmacao");
  if (modal) {
    modal.classList.remove("active");
  }
}

function fecharModal() {
  const modal = document.getElementById("modalDetalhes");
  if (modal) {
    modal.classList.remove("active");
  }
}

function validarFormatoTurma(turma) {
  const regexComAcento = /^[1-3]ª SÉRIE [A-C]$/;
  const regexSemAcento = /^[1-3] SÉRIE [A-C]$/;
  return regexComAcento.test(turma) || regexSemAcento.test(turma);
}

function validarCPF(cpf) {
  return /^\d{11}$/.test(cpf);
}

function validarCodigoTempo(codigo) {
  return ["T1", "T2", "T3", "T4", "T5"].includes(codigo);
}

function validarSeriePermitida(serie, tempo) {
  const horario = CONFIG.mapeamentoTempos[tempo];
  return horario && horario.seriesPermitidas.includes(serie);
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", newTheme);

  const icon = document.querySelector("#themeToggle i");
  if (icon) {
    icon.className = newTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
  }

  localStorage.setItem("sage_theme", newTheme);
}

function carregarTheme() {
  const savedTheme = localStorage.getItem("sage_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  const icon = document.querySelector("#themeToggle i");
  if (icon) {
    icon.className = savedTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
  }
}

// ========== FUNÇÕES ADICIONADAS PARA GERENCIAMENTO DE IDS ==========

// Gerar UUID v4 para identificadores únicos
function gerarUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Versão melhorada de gerarIdUnico que usa UUID
function gerarIdUnicoMelhorado() {
  // Tentar usar gerarUUID se disponível
  if (typeof gerarUUID === "function") {
    return gerarUUID();
  }
  // Fallback para o método antigo
  return Date.now() + Math.floor(Math.random() * 1000);
}

// Garantir que objetos tenham IDs únicos
function garantirIdUnico(objeto, prefixo = "") {
  if (!objeto.id) {
    objeto.id = prefixo ? `${prefixo}_${gerarUUID()}` : gerarUUID();
  }
  return objeto;
}

// Migrar IDs numéricos para UUID (para uso futuro)
function migrarIdsParaUuid(colecao) {
  if (!Array.isArray(colecao)) return colecao;

  return colecao.map((item) => {
    if (!item.id || typeof item.id === "number") {
      // Guardar o ID antigo como referência
      const idAntigo = item.id;
      item.id = gerarUUID();
      item._idAntigo = idAntigo;
      item._idMigrado = true;
    }
    return item;
  });
}

// ========== FUNÇÕES PARA TRATAMENTO DE ERROS ==========

// Wrapper para funções assíncronas com tratamento de erro e loader
async function executarComLoader(
  funcao,
  mostrarLoader = true,
  mensagemErro = "Ocorreu um erro",
) {
  if (mostrarLoader) {
    const loader =
      document.getElementById("gestorLoader") ||
      document.getElementById("pdfLoader");
    if (loader) {
      loader.classList.add("active");
    }
  }

  try {
    const resultado = await funcao();
    return resultado;
  } catch (error) {
    console.error("❌ Erro na execução:", error);
    if (typeof window.showToast === "function") {
      window.showToast(`${mensagemErro}: ${error.message}`, "error");
    }
    throw error;
  } finally {
    if (mostrarLoader) {
      // Tentar esconder todos os loaders possíveis
      const loaders = ["gestorLoader", "pdfLoader"];
      loaders.forEach((id) => {
        const loader = document.getElementById(id);
        if (loader) {
          loader.classList.remove("active");
        }
      });
    }
  }
}

// Garantir que o loader seja removido em caso de erro
window.addEventListener("error", function () {
  const loaders = ["gestorLoader", "pdfLoader"];
  loaders.forEach((id) => {
    const loader = document.getElementById(id);
    if (loader) {
      loader.classList.remove("active");
    }
  });
});

// ========== FUNÇÃO PARA VERIFICAR INTEGRIDADE DOS DADOS ==========

function verificarIntegridadeDados(dados) {
  const problemas = [];

  // Verificar alunos
  if (dados.alunos) {
    const alunosSemId = dados.alunos.filter((a) => !a.id);
    if (alunosSemId.length > 0) {
      problemas.push(`${alunosSemId.length} alunos sem ID`);
    }

    const idsDuplicados = dados.alunos
      .map((a) => a.id)
      .filter((id, index, self) => self.indexOf(id) !== index);
    if (idsDuplicados.length > 0) {
      problemas.push(`IDs duplicados em alunos: ${idsDuplicados.join(", ")}`);
    }
  }

  // Verificar professores
  if (dados.professores) {
    const professoresSemId = dados.professores.filter((p) => !p.id);
    if (professoresSemId.length > 0) {
      problemas.push(`${professoresSemId.length} professores sem ID`);
    }
  }

  // Verificar eletivas
  if (dados.eletivas) {
    const eletivasSemId = dados.eletivas.filter((e) => !e.id);
    if (eletivasSemId.length > 0) {
      problemas.push(`${eletivasSemId.length} eletivas sem ID`);
    }
  }

  return {
    valido: problemas.length === 0,
    problemas,
  };
}

// Exportar funções
window.showToast = showToast;
window.formatarData = formatarData;
window.formatarDataHora = formatarDataHora;
window.getSerieFromTurma = getSerieFromTurma;
window.normalizarTurma = normalizarTurma;
window.gerarIdUnico = gerarIdUnico;
window.abrirModalConfirmacao = abrirModalConfirmacao;
window.fecharModalConfirmacao = fecharModalConfirmacao;
window.fecharModal = fecharModal;
window.validarFormatoTurma = validarFormatoTurma;
window.validarCPF = validarCPF;
window.validarCodigoTempo = validarCodigoTempo;
window.validarSeriePermitida = validarSeriePermitida;
window.toggleTheme = toggleTheme;
window.carregarTheme = carregarTheme;

// Novas funções exportadas
window.gerarUUID = gerarUUID;
window.gerarIdUnicoMelhorado = gerarIdUnicoMelhorado;
window.garantirIdUnico = garantirIdUnico;
window.migrarIdsParaUuid = migrarIdsParaUuid;
window.executarComLoader = executarComLoader;
window.verificarIntegridadeDados = verificarIntegridadeDados;
