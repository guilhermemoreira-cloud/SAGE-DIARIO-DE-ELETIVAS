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
    return { error: "documentoId obrigatório", success: false };
  }

  console.log(`🗑️ Tentando deletar ${colecao}/${documentoId}`);

  // Se estiver offline, adicionar à fila
  if (!navigator.onLine) {
    console.log("📡 Offline - adicionando à fila");
    adicionarOperacaoFila("deletar", colecao, null, documentoId);
    atualizarStatusSincronizacaoGlobal();
    return { offline: true, success: true };
  }

  try {
    // Garantir que Firebase está inicializado
    if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
      const initResult = window.FirebaseConfig?.initFirebase();
      if (!initResult) {
        console.warn("⚠️ Firebase não inicializado, adicionando à fila");
        adicionarOperacaoFila("deletar", colecao, null, documentoId);
        return { offline: true, success: true };
      }
    }

    const db = FirebaseConfig.firestore;
    if (!db) {
      throw new Error("Firestore não disponível");
    }

    // IMPORTANTE: Converter para string para garantir
    const docRef = db.collection(colecao).doc(documentoId.toString());

    // Verificar se o documento existe
    const doc = await docRef.get();
    if (!doc.exists) {
      console.log(`ℹ️ Documento ${documentoId} não existe no Firebase`);
      return { success: true, notFound: true };
    }

    // EXCLUIR O DOCUMENTO
    await docRef.delete();
    console.log(`✅ Documento DELETADO do Firebase: ${colecao}/${documentoId}`);

    // Também remover da fila se estiver lá
    const indexNaFila = pendingQueue.findIndex(
      (op) =>
        op.documentoId === documentoId &&
        op.colecao === colecao &&
        op.tipo === "deletar",
    );
    if (indexNaFila !== -1) {
      pendingQueue.splice(indexNaFila, 1);
      salvarFilaPendente();
      console.log(`✅ Removido da fila de pendentes`);
    }

    return { success: true };
  } catch (error) {
    console.error(
      `❌ Erro ao deletar no Firebase: ${colecao}/${documentoId}`,
      error,
    );

    // Em caso de erro de permissão, mostrar mensagem clara
    if (error.code === "permission-denied") {
      console.error("🚫 Erro de permissão! Verifique as regras do Firestore");
      showToast("Erro de permissão ao excluir do Firebase", "error");
      return { success: false, error: "permission-denied" };
    }

    // Adicionar à fila para tentar depois
    adicionarOperacaoFila("deletar", colecao, null, documentoId);
    return { offline: true, error: error.message, success: false };
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


// ========== SINCRONIZACAO DE COLECOES DO GESTOR ==========

async function carregarColecoesGestor() {
  console.log('🔄 Sincronizando coleções do gestor a partir do Firebase...');

  if (!window.FirebaseConfig) {
    console.warn('⚠️ FirebaseConfig não disponível');
    return false;
  }

  if (!window.FirebaseConfig.isInitialized) {
    const initResult = window.FirebaseConfig.initFirebase();
    if (!initResult) {
      console.warn('⚠️ Firebase não pôde ser inicializado para sincronização');
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const db = window.FirebaseConfig.firestore;
  if (!db) return false;

  let algumDadoCarregado = false;

  function isDocValido(data) {
    if (!data) return false;
    return !!(data.nome || data.alunoId || data.eletivaId || data.codigo || data.codigoSige || data.professorId);
  }

  async function mesclarColecao(colecao, chaveState, chaveStorage) {
    try {
      const snap = await db.collection(colecao).get();
      if (snap.empty) return;
      const docsFirebase = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (isDocValido(data)) {
          docsFirebase.push({ ...data, id: data.id || doc.id });
        }
      });
      if (docsFirebase.length === 0) return;
      if (!state[chaveState]) state[chaveState] = [];
      docsFirebase.forEach((docFb) => {
        const idx = state[chaveState].findIndex((item) => String(item.id) === String(docFb.id));
        if (idx !== -1) {
          state[chaveState][idx] = docFb;
        } else {
          state[chaveState].push(docFb);
        }
      });
      if (chaveStorage && typeof CONFIG !== 'undefined' && CONFIG.storageKeys[chaveStorage]) {
        localStorage.setItem(CONFIG.storageKeys[chaveStorage], JSON.stringify(state[chaveState]));
      }
      console.log('✅ ' + docsFirebase.length + ' registros de ' + colecao + ' sincronizados');
      algumDadoCarregado = true;
    } catch (err) {
      console.warn('⚠️ Erro ao carregar ' + colecao + ':', err.message);
    }
  }

  await mesclarColecao('eletivas', 'eletivas', 'eletivas');
  await mesclarColecao('alunos', 'alunos', 'alunos');
  await mesclarColecao('matriculas', 'matriculas', 'matriculas');

  try {
    const snapNotas = await db.collection('notas').get();
    if (!snapNotas.empty) {
      if (!state.notas) state.notas = [];
      snapNotas.forEach((doc) => {
        const data = doc.data();
        if (data) {
          const idx = state.notas.findIndex((n) => String(n.id) === String(doc.id));
          if (idx !== -1) {
            state.notas[idx] = { ...data, id: doc.id };
          } else {
            state.notas.push({ ...data, id: doc.id });
          }
          algumDadoCarregado = true;
        }
      });
      console.log('✅ Notas sincronizadas do Firebase');
    }
  } catch (err) {
    console.warn('⚠️ Erro ao carregar notas:', err.message);
  }

  try {
    const snapLib = await db.collection('liberacao_notas').get();
    if (!snapLib.empty) {
      let liberacao = null;
      snapLib.forEach((doc) => { liberacao = { id: doc.id, ...doc.data() }; });
      if (liberacao) {
        state.liberacaoNotas = liberacao;
        localStorage.setItem('sage_liberacao_notas', JSON.stringify(liberacao));
        console.log('✅ Liberação de notas sincronizada do Firebase');
        algumDadoCarregado = true;
      }
    }
  } catch (err) {
    console.warn('⚠️ Erro ao carregar liberacao_notas:', err.message);
  }

  if (algumDadoCarregado && typeof window.salvarEstado === 'function') {
    window.salvarEstado();
  }

  console.log('✅ Sincronização com Firebase concluída');
  return algumDadoCarregado;
}

function escutarColecoesGestor(onAtualizado) {
  if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
    console.warn('⚠️ Firebase não disponível para listener em tempo real');
    return null;
  }
  const db = window.FirebaseConfig.firestore;
  if (!db) return null;

  const unsubscribers = [];
  const storageKeyMap = { eletivas: 'eletivas', alunos: 'alunos', matriculas: 'matriculas' };

  function isDocValido(data) {
    if (!data) return false;
    return !!(data.nome || data.alunoId || data.eletivaId || data.codigo || data.codigoSige || data.professorId);
  }

  ['eletivas', 'alunos', 'matriculas'].forEach((colecao) => {
    let primeiraExecucao = true;
    try {
      const unsub = db.collection(colecao).onSnapshot((snap) => {
        if (primeiraExecucao) { primeiraExecucao = false; return; }
        if (!state[colecao]) state[colecao] = [];
        let mudou = false;
        snap.docChanges().forEach((change) => {
          const data = { ...change.doc.data(), id: change.doc.id };
          if (change.type === 'added' || change.type === 'modified') {
            if (isDocValido(data)) {
              const idx = state[colecao].findIndex((item) => String(item.id) === String(data.id));
              if (idx !== -1) { state[colecao][idx] = data; } else { state[colecao].push(data); }
              mudou = true;
            }
          } else if (change.type === 'removed') {
            state[colecao] = state[colecao].filter((item) => String(item.id) !== String(data.id));
            mudou = true;
          }
        });
        if (mudou) {
          const chaveStorage = storageKeyMap[colecao];
          if (chaveStorage && typeof CONFIG !== 'undefined' && CONFIG.storageKeys[chaveStorage]) {
            localStorage.setItem(CONFIG.storageKeys[chaveStorage], JSON.stringify(state[colecao]));
          }
          if (typeof window.salvarEstado === 'function') window.salvarEstado();
          console.log('🔄 Atualização em tempo real: ' + colecao);
          if (typeof onAtualizado === 'function') onAtualizado(colecao);
        }
      }, (err) => { console.warn('⚠️ Erro no listener de ' + colecao + ':', err.message); });
      unsubscribers.push(unsub);
    } catch (err) {
      console.warn('⚠️ Erro ao configurar listener de ' + colecao + ':', err.message);
    }
  });

  try {
    let primeiraLiber = true;
    const unsubLib = db.collection('liberacao_notas').onSnapshot((snap) => {
      if (primeiraLiber) { primeiraLiber = false; return; }
      if (snap.empty) return;
      let liberacao = null;
      snap.forEach((doc) => { liberacao = { id: doc.id, ...doc.data() }; });
      if (liberacao) {
        state.liberacaoNotas = liberacao;
        localStorage.setItem('sage_liberacao_notas', JSON.stringify(liberacao));
        console.log('🔄 Liberação de notas atualizada em tempo real');
        if (typeof onAtualizado === 'function') onAtualizado('liberacao_notas');
      }
    }, (err) => { console.warn('⚠️ Erro no listener de liberacao_notas:', err.message); });
    unsubscribers.push(unsubLib);
  } catch (err) {
    console.warn('⚠️ Erro ao configurar listener de liberacao_notas:', err.message);
  }

  console.log('👂 Listeners em tempo real ativos');
  return () => unsubscribers.forEach((fn) => fn());
}


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

  // Sincronizacao completa (gestor -> professor)
  carregarColecoesGestor,
  escutarColecoesGestor,

  // Utilitários
  adicionarOperacaoFila,
  removerOperacaoFila,
};

// Inicializar
initSyncQueue();
