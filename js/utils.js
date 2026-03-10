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
