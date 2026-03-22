// js/utils.js - Funções utilitárias e configurações
console.log("🔧 utils.js carregado");

// ========== FUNÇÕES DE TOAST ==========
function showToast(message, type = "success", duration = 3000) {
  let toast = document.getElementById("toast");
  
  // Criar toast se não existir
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  
  // Limpar classes anteriores
  toast.className = `toast ${type}`;
  
  // Adicionar conteúdo com botão de fechar para erros
  toast.innerHTML = `
    <span>${message}</span>
    ${type === "error" ? '<button class="toast-close" onclick="fecharToast(this)">&times;</button>' : ""}
  `;
  
  toast.classList.add("show");
  
  // Auto-fechar para tipos não-error
  if (type !== "error") {
    setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
  }
  
  // Registrar no log do sistema
  logSistema(type === "error" ? "ERROR" : "INFO", "UI", message);
}

function fecharToast(btn) {
  const toast = btn.closest(".toast");
  if (toast) toast.classList.remove("show");
}

// ========== FUNÇÕES DE LOGGING ESTRUTURADO ==========
function logSistema(nivel, modulo, mensagem, dados = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    nivel: nivel, // INFO, WARN, ERROR, DEBUG
    modulo: modulo,
    mensagem: mensagem,
    dados: dados,
  };
  
  // Console log para debug
  const prefix = `[${nivel}] [${modulo}]`;
  if (nivel === "ERROR") console.error(prefix, mensagem, dados);
  else if (nivel === "WARN") console.warn(prefix, mensagem, dados);
  else console.log(prefix, mensagem, dados);
  
  // Armazenar no localStorage
  try {
    let logs = JSON.parse(localStorage.getItem("sage_logs") || "[]");
    logs.unshift(logEntry);
    // Manter apenas os últimos 100 logs
    if (logs.length > 100) logs = logs.slice(0, 100);
    localStorage.setItem("sage_logs", JSON.stringify(logs));
  } catch (e) {
    console.warn("Erro ao salvar log:", e);
  }
}

function exportarLogs() {
  try {
    const logs = JSON.parse(localStorage.getItem("sage_logs") || "[]");
    const logText = logs.map(l => `[${l.timestamp}] [${l.nivel}] [${l.modulo}] ${l.mensagem}`).join("\n");
    
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sage-logs-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast("Logs exportados com sucesso!", "success");
  } catch (e) {
    showToast("Erro ao exportar logs", "error");
  }
}

// ========== FUNÇÕES DE DATA E FORMATAÇÃO ==========
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

// ========== FUNÇÕES DE ID E UUID ==========
function gerarUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function garantirIdConsistente(objeto, colecao = null) {
  if (!objeto) return objeto;
  
  // Se não tem ID, gerar um
  if (!objeto.id) {
    objeto.id = gerarUUID();
    if (colecao) logSistema("INFO", "ID", `ID gerado para ${colecao}: ${objeto.id}`);
    return objeto;
  }
  
  // Se o ID é numérico ou parece número curto, converter para UUID
  if (typeof objeto.id === "number" || (/^\d+$/.test(String(objeto.id)) && String(objeto.id).length < 20)) {
    const idAntigo = objeto.id;
    objeto.id = gerarUUID();
    objeto._idAntigo = idAntigo;
    objeto._idMigrado = true;
    logSistema("INFO", "ID", `ID migrado: ${colecao || "objeto"} - ${idAntigo} -> ${objeto.id}`);
  }
  
  return objeto;
}

function gerarIdUnico() {
  return gerarUUID();
}

function gerarIdUnicoMelhorado() {
  return gerarUUID();
}

// ========== FUNÇÕES DE MIGRAÇÃO E INTEGRIDADE ==========
function migrarIdsParaUuid(colecao) {
  if (!Array.isArray(colecao)) return colecao;
  
  const mapeamento = {};
  
  return colecao.map(item => {
    const itemOriginal = { ...item };
    garantirIdConsistente(item, "colecao");
    
    if (item._idAntigo) {
      mapeamento[item._idAntigo] = item.id;
    }
    
    return item;
  });
}

async function migrarTodosIds() {
  logSistema("INFO", "Migration", "Iniciando migração de IDs para UUID...");
  
  let migracoes = 0;
  const mapeamentos = {};
  
  // Migrar professores
  if (state.professores) {
    state.professores = state.professores.map(p => {
      const antes = p.id;
      garantirIdConsistente(p, "professores");
      if (antes !== p.id) {
        migracoes++;
        mapeamentos[antes] = p.id;
      }
      return p;
    });
  }
  
  // Migrar alunos
  if (state.alunos) {
    state.alunos = state.alunos.map(a => {
      const antes = a.id;
      garantirIdConsistente(a, "alunos");
      if (antes !== a.id) {
        migracoes++;
        mapeamentos[antes] = a.id;
      }
      return a;
    });
  }
  
  // Migrar eletivas
  if (state.eletivas) {
    state.eletivas = state.eletivas.map(e => {
      const antes = e.id;
      garantirIdConsistente(e, "eletivas");
      if (antes !== e.id) {
        migracoes++;
        mapeamentos[antes] = e.id;
      }
      return e;
    });
  }
  
  // Migrar matrículas (atualizar referências)
  if (state.matriculas) {
    state.matriculas = state.matriculas.map(m => {
      garantirIdConsistente(m, "matriculas");
      
      // Atualizar referências usando mapeamentos
      if (m.alunoId && mapeamentos[m.alunoId]) {
        m.alunoId = mapeamentos[m.alunoId];
      }
      if (m.eletivaId && mapeamentos[m.eletivaId]) {
        m.eletivaId = mapeamentos[m.eletivaId];
      }
      
      return m;
    });
  }
  
  // Migrar registros
  if (state.registros) {
    state.registros = state.registros.map(r => {
      garantirIdConsistente(r, "registros");
      
      if (r.eletivaId && mapeamentos[r.eletivaId]) {
        r.eletivaId = mapeamentos[r.eletivaId];
      }
      
      return r;
    });
  }
  
  // Migrar notas
  if (state.notas) {
    state.notas = state.notas.map(n => {
      garantirIdConsistente(n, "notas");
      
      if (n.eletivaId && mapeamentos[n.eletivaId]) {
        n.eletivaId = mapeamentos[n.eletivaId];
      }
      
      if (n.notas) {
        n.notas = n.notas.map(nota => {
          if (nota.alunoId && mapeamentos[nota.alunoId]) {
            nota.alunoId = mapeamentos[nota.alunoId];
          }
          return nota;
        });
      }
      
      return n;
    });
  }
  
  logSistema("INFO", "Migration", `Migração concluída: ${migracoes} IDs convertidos para UUID`);
  return { migracoes, mapeamentos };
}

function verificarIntegridadeReferencias() {
  logSistema("INFO", "Integrity", "Verificando integridade de referências...");
  const problemas = [];
  
  // Verificar matrículas
  (state.matriculas || []).forEach(mat => {
    const eletivaExiste = state.eletivas?.some(e => String(e.id) === String(mat.eletivaId));
    const alunoExiste = state.alunos?.some(a => String(a.id) === String(mat.alunoId));
    if (!eletivaExiste) problemas.push(`Matrícula ${mat.id}: eletiva ${mat.eletivaId} não encontrada`);
    if (!alunoExiste) problemas.push(`Matrícula ${mat.id}: aluno ${mat.alunoId} não encontrado`);
  });
  
  // Verificar registros
  (state.registros || []).forEach(reg => {
    const eletivaExiste = state.eletivas?.some(e => String(e.id) === String(reg.eletivaId));
    if (!eletivaExiste) problemas.push(`Registro ${reg.id}: eletiva ${reg.eletivaId} não encontrada`);
  });
  
  // Verificar notas
  (state.notas || []).forEach(nota => {
    const eletivaExiste = state.eletivas?.some(e => String(e.id) === String(nota.eletivaId));
    if (!eletivaExiste) problemas.push(`Nota ${nota.id}: eletiva ${nota.eletivaId} não encontrada`);
    (nota.notas || []).forEach(n => {
      const alunoExiste = state.alunos?.some(a => String(a.id) === String(n.alunoId));
      if (!alunoExiste) problemas.push(`Nota ${nota.id}: aluno ${n.alunoId} não encontrado`);
    });
  });
  
  if (problemas.length === 0) {
    logSistema("INFO", "Integrity", "✅ Integridade verificada: nenhum problema encontrado");
  } else {
    logSistema("WARN", "Integrity", `⚠️ ${problemas.length} problemas de integridade encontrados`);
    console.warn(problemas);
  }
  
  return { valido: problemas.length === 0, problemas };
}

// ========== FUNÇÕES DE VALIDAÇÃO ==========
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

// ========== FUNÇÕES DE MODAIS ==========
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

// ========== FUNÇÕES DE COMPARAÇÃO ==========
function compararArraysPorId(arrayAtual, arrayNovo, getId = (item) => item.id || item) {
  const setAtual = new Set(arrayAtual.map(getId));
  const setNovo = new Set(arrayNovo.map(getId));
  
  const paraAdicionar = arrayNovo.filter(id => !setAtual.has(getId(id)));
  const paraRemover = arrayAtual.filter(id => !setNovo.has(getId(id)));
  
  return { paraAdicionar, paraRemover };
}

// ========== FUNÇÕES DE TEMA ==========
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

// ========== FUNÇÕES DE EXECUÇÃO COM LOADER ==========
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
    showToast(`${mensagemErro}: ${error.message}`, "error");
    throw error;
  } finally {
    if (mostrarLoader) {
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

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ========== EXPORTAÇÃO ==========
window.showToast = showToast;
window.fecharToast = fecharToast;
window.logSistema = logSistema;
window.exportarLogs = exportarLogs;
window.formatarData = formatarData;
window.formatarDataHora = formatarDataHora;
window.getSerieFromTurma = getSerieFromTurma;
window.normalizarTurma = normalizarTurma;
window.gerarIdUnico = gerarIdUnico;
window.gerarUUID = gerarUUID;
window.gerarIdUnicoMelhorado = gerarIdUnicoMelhorado;
window.garantirIdConsistente = garantirIdConsistente;
window.migrarIdsParaUuid = migrarIdsParaUuid;
window.migrarTodosIds = migrarTodosIds;
window.verificarIntegridadeReferencias = verificarIntegridadeReferencias;
window.abrirModalConfirmacao = abrirModalConfirmacao;
window.fecharModalConfirmacao = fecharModalConfirmacao;
window.fecharModal = fecharModal;
window.validarFormatoTurma = validarFormatoTurma;
window.validarCPF = validarCPF;
window.validarCodigoTempo = validarCodigoTempo;
window.validarSeriePermitida = validarSeriePermitida;
window.toggleTheme = toggleTheme;
window.carregarTheme = carregarTheme;
window.compararArraysPorId = compararArraysPorId;
window.executarComLoader = executarComLoader;
window.escapeHtml = escapeHtml;
