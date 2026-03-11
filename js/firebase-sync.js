// js/firebase-sync.js - Sistema completo de sincronização com Firebase
console.log("🔄 firebase-sync.js carregado");

// ========== VARIÁVEIS GLOBAIS ==========
let pendingQueue = [];
let syncInProgress = false;
let lastSyncTime = null;
const SYNC_QUEUE_KEY = "sage_sync_queue";
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 30000; // 30 segundos

// ========== INICIALIZAÇÃO ==========
function initSyncQueue() {
  try {
    const savedQueue = localStorage.getItem(SYNC_QUEUE_KEY);
    if (savedQueue) {
      pendingQueue = JSON.parse(savedQueue);
      console.log(
        `📦 Fila de sincronização carregada: ${pendingQueue.length} operações pendentes`,
      );
    }
  } catch (e) {
    console.warn("Erro ao carregar fila de sincronização:", e);
    pendingQueue = [];
  }

  lastSyncTime = localStorage.getItem("sage_last_sync");

  // Processar fila pendente após inicialização
  setTimeout(() => {
    processarFilaPendente();
  }, 2000);
}

// ========== GERENCIAMENTO DA FILA ==========
function salvarFilaPendente() {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(pendingQueue));
  } catch (e) {
    console.warn("Erro ao salvar fila de sincronização:", e);
  }
}

function adicionarOperacaoFila(tipo, colecao, dados, documentoId = null) {
  const operacao = {
    id: gerarUUID(),
    tipo: tipo, // 'salvar' ou 'deletar'
    colecao: colecao,
    documentoId: documentoId,
    dados: dados,
    timestamp: new Date().toISOString(),
    tentativas: 0,
  };

  pendingQueue.push(operacao);
  salvarFilaPendente();

  console.log(
    `📝 Operação adicionada à fila: ${tipo} - ${colecao} (${pendingQueue.length} pendentes)`,
  );

  // Tentar processar imediatamente se estiver online
  if (navigator.onLine && !syncInProgress) {
    setTimeout(processarFilaPendente, 100);
  }

  return operacao.id;
}

function removerOperacaoFila(operacaoId) {
  pendingQueue = pendingQueue.filter((op) => op.id !== operacaoId);
  salvarFilaPendente();
}

function getPendingCount() {
  return pendingQueue.length;
}

// ========== FUNÇÕES DE SINCRONIZAÇÃO PRINCIPAIS ==========
async function processarFilaPendente() {
  if (syncInProgress || pendingQueue.length === 0) return;

  // Verificar se FirebaseConfig está disponível
  if (!window.FirebaseConfig) {
    console.warn("⚠️ FirebaseConfig não disponível");
    return;
  }

  // Garantir que Firebase está inicializado
  if (!window.FirebaseConfig.isInitialized) {
    const initResult = window.FirebaseConfig.initFirebase();
    if (!initResult) {
      console.warn("⚠️ Firebase não pôde ser inicializado");
      return;
    }
  }

  const online = await FirebaseConfig.verificarConexaoFirebase();
  if (!online) {
    console.log(`📡 Offline: ${pendingQueue.length} operações aguardando`);
    atualizarStatusSincronizacaoGlobal();
    return;
  }

  syncInProgress = true;
  console.log(`🔄 Processando fila: ${pendingQueue.length} operações...`);

  const novasPendentes = [];

  for (const op of pendingQueue) {
    try {
      op.tentativas++;

      const db = FirebaseConfig.firestore;
      if (!db) {
        throw new Error("Firestore não disponível");
      }

      const collectionRef = db.collection(op.colecao);

      // Usar o documentoId se fornecido, caso contrário criar um novo ID
      let docRef;
      if (op.documentoId) {
        docRef = collectionRef.doc(op.documentoId.toString());
      } else {
        docRef = collectionRef.doc(); // Firebase gera ID automático
      }

      if (op.tipo === "salvar" && op.dados) {
        // Garantir que o documento tenha um ID
        const dadosParaSalvar = {
          ...op.dados,
          id: op.documentoId || docRef.id,
          _syncTimestamp: new Date().toISOString(),
          _syncVersion: "2026.1",
        };

        await docRef.set(dadosParaSalvar, { merge: true });
        console.log(
          `✅ Operação concluída: ${op.tipo} - ${op.colecao} (ID: ${docRef.id})`,
        );
      } else if (op.tipo === "deletar") {
        await docRef.delete();
        console.log(
          `✅ Operação concluída: ${op.tipo} - ${op.colecao} (ID: ${op.documentoId})`,
        );
      } else {
        console.warn(`⚠️ Operação ignorada: tipo inválido ou dados ausentes`);
      }
    } catch (error) {
      console.warn(`⚠️ Falha na operação (tentativa ${op.tentativas}):`, error);

      if (op.tentativas < MAX_RETRY_ATTEMPTS) {
        novasPendentes.push(op);
      } else {
        console.error(
          `❌ Operação descartada após ${MAX_RETRY_ATTEMPTS} tentativas:`,
          op,
        );
        if (typeof window.showToast === "function") {
          window.showToast("Falha na sincronização de alguns dados", "error");
        }
      }
    }
  }

  pendingQueue = novasPendentes;
  salvarFilaPendente();
  syncInProgress = false;

  if (pendingQueue.length > 0) {
    console.log(`⏳ ${pendingQueue.length} operações ainda pendentes`);
    setTimeout(processarFilaPendente, RETRY_DELAY);
  } else {
    console.log("✅ Todas as operações sincronizadas!");
    lastSyncTime = new Date().toISOString();
    localStorage.setItem("sage_last_sync", lastSyncTime);
    atualizarStatusSincronizacaoGlobal();

    if (typeof window.showToast === "function") {
      window.showToast("Todos os dados sincronizados com a nuvem!", "success");
    }
  }
}

// ========== FUNÇÕES DE SALVAMENTO ==========
async function salvarDadosFirebase(colecao, dados, documentoId = null) {
  // Se estiver offline, adicionar à fila
  if (!navigator.onLine) {
    adicionarOperacaoFila("salvar", colecao, dados, documentoId);
    atualizarStatusSincronizacaoGlobal();
    return {
      offline: true,
      queueId: pendingQueue[pendingQueue.length - 1]?.id,
    };
  }

  // Se estiver online, tentar salvar imediatamente
  try {
    if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
      const initResult = window.FirebaseConfig?.initFirebase();
      if (!initResult) {
        // Se não conseguir inicializar, adicionar à fila
        adicionarOperacaoFila("salvar", colecao, dados, documentoId);
        return { offline: true };
      }
    }

    const db = FirebaseConfig.firestore;
    if (!db) {
      throw new Error("Firestore não disponível");
    }

    const collectionRef = db.collection(colecao);
    let docRef;

    if (documentoId) {
      docRef = collectionRef.doc(documentoId.toString());
    } else {
      docRef = collectionRef.doc(); // Firebase gera ID automático
      // Se não tinha ID, atualizar o ID gerado nos dados
      dados.id = docRef.id;
    }

    const dadosComMeta = {
      ...dados,
      id: docRef.id,
      _lastSync: new Date().toISOString(),
      _syncVersion: "2026.1",
    };

    await docRef.set(dadosComMeta, { merge: true });
    console.log(`✅ Dados salvos no Firebase: ${colecao} (ID: ${docRef.id})`);

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error(`❌ Erro ao salvar no Firebase: ${colecao}`, error);

    // Em caso de erro, adicionar à fila para tentar depois
    adicionarOperacaoFila("salvar", colecao, dados, documentoId);
    return { offline: true, error: error.message };
  }
}

async function deletarDadosFirebase(colecao, documentoId) {
  if (!documentoId) {
    console.warn("⚠️ Tentativa de deletar sem documentoId");
    return { error: "documentoId obrigatório" };
  }

  // Se estiver offline, adicionar à fila
  if (!navigator.onLine) {
    adicionarOperacaoFila("deletar", colecao, null, documentoId);
    atualizarStatusSincronizacaoGlobal();
    return { offline: true };
  }

  try {
    if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
      const initResult = window.FirebaseConfig?.initFirebase();
      if (!initResult) {
        adicionarOperacaoFila("deletar", colecao, null, documentoId);
        return { offline: true };
      }
    }

    const db = FirebaseConfig.firestore;
    if (!db) {
      throw new Error("Firestore não disponível");
    }

    const docRef = db.collection(colecao).doc(documentoId.toString());
    await docRef.delete();

    console.log(
      `✅ Dados deletados do Firebase: ${colecao} (ID: ${documentoId})`,
    );
    return { success: true };
  } catch (error) {
    console.error(`❌ Erro ao deletar no Firebase: ${colecao}`, error);
    adicionarOperacaoFila("deletar", colecao, null, documentoId);
    return { offline: true, error: error.message };
  }
}

// ========== FUNÇÕES DE CARREGAMENTO ==========
async function carregarDadosFirebase(colecao, filtros = {}) {
  try {
    if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
      const initResult = window.FirebaseConfig?.initFirebase();
      if (!initResult) {
        console.warn("⚠️ Firebase não disponível para leitura");
        return [];
      }
    }

    const db = FirebaseConfig.firestore;
    if (!db) {
      throw new Error("Firestore não disponível");
    }

    let query = db.collection(colecao);

    // Aplicar filtros (ex: { campo: valor })
    Object.entries(filtros).forEach(([campo, valor]) => {
      if (valor !== undefined && valor !== null) {
        query = query.where(campo, "==", valor);
      }
    });

    const snapshot = await query.get();
    const resultados = [];

    snapshot.forEach((doc) => {
      resultados.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(`📥 Carregados ${resultados.length} registros de ${colecao}`);
    return resultados;
  } catch (error) {
    console.error(`❌ Erro ao carregar dados do Firebase: ${colecao}`, error);
    return [];
  }
}

async function carregarRegistrosFirebase(
  eletivaId = null,
  dataInicio = null,
  dataFim = null,
) {
  try {
    const filtros = {};
    if (eletivaId) {
      filtros.eletivaId = parseInt(eletivaId);
    }

    let registros = await carregarDadosFirebase("registros", filtros);

    // Filtrar por data (cliente-side para simplicidade)
    if (dataInicio) {
      const inicio = normalizarDataParaComparacao(dataInicio);
      registros = registros.filter((r) => {
        const rData = normalizarDataParaComparacao(r.data);
        return rData >= inicio;
      });
    }

    if (dataFim) {
      const fim = normalizarDataParaComparacao(dataFim);
      registros = registros.filter((r) => {
        const rData = normalizarDataParaComparacao(r.data);
        return rData <= fim;
      });
    }

    return registros;
  } catch (error) {
    console.error("❌ Erro ao carregar registros do Firebase:", error);
    return [];
  }
}

async function carregarNotasFirebase(eletivaId = null, semestre = null) {
  try {
    const filtros = {};
    if (eletivaId) {
      filtros.eletivaId = parseInt(eletivaId);
    }
    if (semestre) {
      filtros.semestre = semestre;
    }

    return await carregarDadosFirebase("notas", filtros);
  } catch (error) {
    console.error("❌ Erro ao carregar notas do Firebase:", error);
    return [];
  }
}

// ========== FUNÇÕES ESPECÍFICAS PARA REGISTRO DE AULA (OFFLINE) ==========
async function salvarRegistroAulaOffline(registro) {
  // Salvar no state já é feito pelo professor.js
  // Esta função adiciona à fila do Firebase
  return await salvarDadosFirebase("registros", registro, registro.id);
}

// ========== FUNÇÕES AUXILIARES ==========
function normalizarDataParaComparacao(dataString) {
  if (!dataString) return "";
  // Garantir formato YYYY-MM-DD para comparação
  if (dataString.includes("/")) {
    const [dia, mes, ano] = dataString.split("/");
    return `${ano}-${mes}-${dia}`;
  }
  return dataString;
}

function gerarUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function atualizarStatusSincronizacaoGlobal() {
  if (typeof window.atualizarStatusSincronizacao === "function") {
    window.atualizarStatusSincronizacao();
  }
}

// ========== EVENT LISTENERS ==========
window.addEventListener("online", () => {
  console.log("📡 Conexão restabelecida. Processando fila pendente...");
  setTimeout(processarFilaPendente, 2000);
});

window.addEventListener("offline", () => {
  console.log("📡 Conexão perdida. Operações serão armazenadas localmente.");
  atualizarStatusSincronizacaoGlobal();
});

// ========== EXPORTAÇÃO ==========
window.FirebaseSync = {
  // Fila
  processarFilaPendente,
  getPendingCount,

  // Salvamento
  salvarDadosFirebase,
  deletarDadosFirebase,
  salvarRegistroAulaOffline,

  // Carregamento
  carregarDadosFirebase,
  carregarRegistrosFirebase,
  carregarNotasFirebase,

  // Utilitários
  adicionarOperacaoFila,
  removerOperacaoFila,
};

// Inicializar
initSyncQueue();
