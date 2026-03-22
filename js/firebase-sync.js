// js/firebase-sync.js - Versão CORRIGIDA (SEM MIGRAÇÃO DE IDs)
console.log("🔄 firebase-sync.js carregado");

// ========== VARIÁVEIS GLOBAIS ==========
let pendingQueue = [];
let syncInProgress = false;
let lastSyncTime = null;
const SYNC_QUEUE_KEY = "sage_sync_queue";
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 30000;

// ========== INICIALIZAÇÃO ==========
function initSyncQueue() {
  try {
    const savedQueue = localStorage.getItem(SYNC_QUEUE_KEY);
    if (savedQueue) {
      pendingQueue = JSON.parse(savedQueue);
      console.log(`📦 Fila de sincronização carregada: ${pendingQueue.length} operações pendentes`);
    }
  } catch (e) {
    console.warn("Erro ao carregar fila de sincronização:", e);
    pendingQueue = [];
  }
  lastSyncTime = localStorage.getItem("sage_last_sync");
  setTimeout(() => { processarFilaPendente(); }, 2000);
}

function salvarFilaPendente() {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(pendingQueue));
  } catch (e) {
    console.warn("Erro ao salvar fila de sincronização:", e);
  }
}

function adicionarOperacaoFila(tipo, colecao, dados, documentoId = null) {
  const operacao = {
    id: window.gerarUUID ? window.gerarUUID() : Date.now().toString(),
    tipo: tipo,
    colecao: colecao,
    documentoId: documentoId,
    dados: dados,
    timestamp: new Date().toISOString(),
    tentativas: 0,
  };
  pendingQueue.push(operacao);
  salvarFilaPendente();
  console.log(`📝 Operação adicionada à fila: ${tipo} - ${colecao} (${pendingQueue.length} pendentes)`);
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

async function processarFilaPendente() {
  if (syncInProgress || pendingQueue.length === 0) return;
  if (!window.FirebaseConfig) {
    console.warn("⚠️ FirebaseConfig não disponível");
    return;
  }
  if (!window.FirebaseConfig.isInitialized) {
    try {
      await window.FirebaseConfig.aguardarInicializacaoFirebase(5000);
    } catch (e) {
      console.warn("⚠️ Firebase não pôde ser inicializado:", e.message);
      return;
    }
  }
  const online = await window.FirebaseConfig.verificarConexaoFirebase();
  if (!online) {
    console.log(`📡 Offline: ${pendingQueue.length} operações aguardando`);
    window.atualizarStatusSincronizacaoGlobal?.();
    return;
  }
  syncInProgress = true;
  console.log(`🔄 Processando fila: ${pendingQueue.length} operações...`);
  const novasPendentes = [];
  for (const op of pendingQueue) {
    try {
      op.tentativas++;
      const db = window.FirebaseConfig.firestore;
      if (!db) throw new Error("Firestore não disponível");
      const collectionRef = db.collection(op.colecao);
      let docRef;
      if (op.documentoId) {
        docRef = collectionRef.doc(String(op.documentoId));
      } else if (op.tipo === "salvar" && op.dados && op.dados.id) {
        docRef = collectionRef.doc(String(op.dados.id));
      } else {
        docRef = collectionRef.doc();
      }
      if (op.tipo === "salvar" && op.dados) {
        const dadosParaSalvar = {
          ...op.dados,
          id: op.documentoId || docRef.id,
          _syncTimestamp: new Date().toISOString(),
          _syncVersion: "2026.1",
        };
        await docRef.set(dadosParaSalvar, { merge: true });
        console.log(`✅ Operação concluída: ${op.tipo} - ${op.colecao} (ID: ${docRef.id})`);
      } else if (op.tipo === "deletar") {
        await docRef.delete();
        console.log(`✅ Operação concluída: ${op.tipo} - ${op.colecao} (ID: ${op.documentoId})`);
      }
    } catch (error) {
      console.warn(`⚠️ Falha na operação (tentativa ${op.tentativas}):`, error);
      if (op.tentativas < MAX_RETRY_ATTEMPTS) {
        novasPendentes.push(op);
      } else {
        console.error(`❌ Operação descartada após ${MAX_RETRY_ATTEMPTS} tentativas:`, op);
        if (typeof window.showToast === "function") window.showToast?.("Falha na sincronização de alguns dados", "error");
      }
    }
  }
  pendingQueue = novasPendentes;
  salvarFilaPendente();
  syncInProgress = false;
  window.atualizarStatusSincronizacaoGlobal?.();
  if (pendingQueue.length > 0) {
    console.log(`⏳ ${pendingQueue.length} operações ainda pendentes`);
    setTimeout(processarFilaPendente, RETRY_DELAY);
  } else {
    console.log("✅ Todas as operações sincronizadas!");
    lastSyncTime = new Date().toISOString();
    localStorage.setItem("sage_last_sync", lastSyncTime);
  }
}

async function salvarDadosFirebase(colecao, dados, documentoId = null) {
  if (!navigator.onLine) {
    adicionarOperacaoFila("salvar", colecao, dados, documentoId);
    window.atualizarStatusSincronizacaoGlobal?.();
    return { offline: true, queueId: pendingQueue[pendingQueue.length - 1]?.id };
  }
  try {
    if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
      await window.FirebaseConfig?.aguardarInicializacaoFirebase(5000);
    }
    const db = window.FirebaseConfig.firestore;
    if (!db) throw new Error("Firestore não disponível");
    const collectionRef = db.collection(colecao);
    let docRef;
    if (documentoId) {
      docRef = collectionRef.doc(String(documentoId));
    } else if (dados.id) {
      docRef = collectionRef.doc(String(dados.id));
    } else {
      docRef = collectionRef.doc();
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
    if (window.atualizarVersao) window.atualizarVersao(colecao, dadosComMeta._syncTimestamp);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error(`❌ Erro ao salvar no Firebase: ${colecao}`, error);
    adicionarOperacaoFila("salvar", colecao, dados, documentoId);
    return { offline: true, error: error.message };
  }
}

async function deletarDadosFirebase(colecao, documentoId) {
  if (!documentoId) return { error: "documentoId obrigatório", success: false };
  console.log(`🗑️ Tentando deletar ${colecao}/${documentoId}`);
  if (!navigator.onLine) {
    adicionarOperacaoFila("deletar", colecao, null, documentoId);
    window.atualizarStatusSincronizacaoGlobal?.();
    return { offline: true, success: true };
  }
  try {
    if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
      await window.FirebaseConfig?.aguardarInicializacaoFirebase(5000);
    }
    const db = window.FirebaseConfig.firestore;
    if (!db) throw new Error("Firestore não disponível");
    const docRef = db.collection(colecao).doc(String(documentoId));
    const doc = await docRef.get();
    if (!doc.exists) {
      console.log(`ℹ️ Documento ${documentoId} não existe no Firebase`);
      return { success: true, notFound: true };
    }
    await docRef.delete();
    console.log(`✅ Documento DELETADO do Firebase: ${colecao}/${documentoId}`);
    const indexNaFila = pendingQueue.findIndex(
      (op) => String(op.documentoId) === String(documentoId) && op.colecao === colecao && op.tipo === "deletar"
    );
    if (indexNaFila !== -1) {
      pendingQueue.splice(indexNaFila, 1);
      salvarFilaPendente();
    }
    return { success: true };
  } catch (error) {
    console.error(`❌ Erro ao deletar no Firebase: ${colecao}/${documentoId}`, error);
    if (error.code === "permission-denied") {
      if (typeof window.showToast === "function") window.showToast?.("Erro de permissão ao excluir do Firebase", "error");
      return { success: false, error: "permission-denied" };
    }
    adicionarOperacaoFila("deletar", colecao, null, documentoId);
    return { offline: true, error: error.message, success: false };
  }
}

async function carregarDadosFirebase(colecao, filtros = {}) {
  try {
    if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
      await window.FirebaseConfig?.aguardarInicializacaoFirebase(5000);
    }
    const db = window.FirebaseConfig.firestore;
    if (!db) throw new Error("Firestore não disponível");
    let query = db.collection(colecao);
    Object.entries(filtros).forEach(([campo, valor]) => {
      if (valor !== undefined && valor !== null) query = query.where(campo, "==", valor);
    });
    const snapshot = await query.get();
    const resultados = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // NÃO MIGRAR IDs - manter como estão
      resultados.push({ id: doc.id, ...data });
    });
    console.log(`📥 Carregados ${resultados.length} registros de ${colecao}`);
    return resultados;
  } catch (error) {
    console.error(`❌ Erro ao carregar dados do Firebase: ${colecao}`, error);
    return [];
  }
}

async function carregarRegistrosFirebase(eletivaId = null, dataInicio = null, dataFim = null) {
  try {
    const filtros = {};
    if (eletivaId) filtros.eletivaId = String(eletivaId);
    let registros = await carregarDadosFirebase("registros", filtros);
    if (dataInicio) {
      const inicio = normalizarDataParaComparacao(dataInicio);
      registros = registros.filter((r) => normalizarDataParaComparacao(r.data) >= inicio);
    }
    if (dataFim) {
      const fim = normalizarDataParaComparacao(dataFim);
      registros = registros.filter((r) => normalizarDataParaComparacao(r.data) <= fim);
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
    if (eletivaId) filtros.eletivaId = String(eletivaId);
    if (semestre) filtros.semestre = semestre;
    return await carregarDadosFirebase("notas", filtros);
  } catch (error) {
    console.error("❌ Erro ao carregar notas do Firebase:", error);
    return [];
  }
}

async function salvarRegistroAulaOffline(registro) {
  return await salvarDadosFirebase("registros", registro, registro.id);
}

function normalizarDataParaComparacao(dataString) {
  if (!dataString) return "";
  if (dataString.includes("/")) {
    const [dia, mes, ano] = dataString.split("/");
    return `${ano}-${mes}-${dia}`;
  }
  return dataString;
}

// ========== FUNÇÃO CORRIGIDA: NÃO MIGRAR IDs ==========
async function carregarColecoesGestor() {
  console.log('🔄 Sincronizando coleções do gestor a partir do Firebase...');

  if (!window.FirebaseConfig) {
    console.warn('⚠️ FirebaseConfig não disponível');
    return false;
  }

  if (!window.FirebaseConfig.isInitialized) {
    try {
      await window.FirebaseConfig.aguardarInicializacaoFirebase(10000);
    } catch (e) {
      console.warn('⚠️ Firebase não inicializado para sincronização:', e.message);
      return false;
    }
  }

  const db = window.FirebaseConfig.firestore;
  if (!db) return false;

  let algumDadoCarregado = false;

  async function carregarColecao(colecao, chaveState, chaveStorage) {
    try {
      const snap = await db.collection(colecao).get();
      const docsFirebase = [];
      snap.forEach((doc) => {
        const data = doc.data();
        // NÃO modificar os IDs - manter como estão no Firebase
        docsFirebase.push({ ...data, id: data.id || doc.id });
      });
      console.log(`📥 Carregando ${docsFirebase.length} registros de ${colecao}`);
      state[chaveState] = docsFirebase;
      if (chaveStorage && typeof CONFIG !== 'undefined' && CONFIG.storageKeys && CONFIG.storageKeys[chaveStorage]) {
        localStorage.setItem(CONFIG.storageKeys[chaveStorage], JSON.stringify(state[chaveState]));
      }
      console.log(`✅ ${docsFirebase.length} registros de ${colecao} carregados`);
      return docsFirebase.length > 0;
    } catch (err) {
      console.warn('⚠️ Erro ao carregar ' + colecao + ':', err.message);
      return false;
    }
  }

  // Carregar TODAS as coleções
  const eletivasCarregadas = await carregarColecao('eletivas', 'eletivas', 'eletivas');
  const alunosCarregados = await carregarColecao('alunos', 'alunos', 'alunos');
  const professoresCarregados = await carregarColecao('professores', 'professores', 'professores');
  const matriculasCarregadas = await carregarColecao('matriculas', 'matriculas', 'matriculas');
  
  algumDadoCarregado = eletivasCarregadas || alunosCarregados || professoresCarregados || matriculasCarregadas;

  // Notas
  try {
    const snapNotas = await db.collection('notas').get();
    if (!snapNotas.empty) {
      const notasFirebase = [];
      snapNotas.forEach((doc) => {
        const data = doc.data();
        notasFirebase.push({ ...data, id: doc.id });
      });
      state.notas = notasFirebase;
      localStorage.setItem("sage_notas_2026", JSON.stringify(state.notas));
      console.log(`✅ ${notasFirebase.length} notas sincronizadas`);
      algumDadoCarregado = true;
    }
  } catch (err) {
    console.warn('⚠️ Erro ao carregar notas:', err.message);
  }

  // Registros
  try {
    const snapRegistros = await db.collection('registros').get();
    if (!snapRegistros.empty) {
      const registrosFirebase = [];
      snapRegistros.forEach((doc) => {
        const data = doc.data();
        registrosFirebase.push({ ...data, id: doc.id });
      });
      state.registros = registrosFirebase;
      if (CONFIG.storageKeys.registros) {
        localStorage.setItem(CONFIG.storageKeys.registros, JSON.stringify(state.registros));
      }
      console.log(`✅ ${registrosFirebase.length} registros sincronizados`);
      algumDadoCarregado = true;
    }
  } catch (err) {
    console.warn('⚠️ Erro ao carregar registros:', err.message);
  }

  // Liberação de notas
  try {
    const snapLib = await db.collection('liberacao_notas').get();
    if (!snapLib.empty) {
      let liberacao = null;
      snapLib.forEach((doc) => { liberacao = { id: doc.id, ...doc.data() }; });
      if (liberacao) {
        state.liberacaoNotas = liberacao;
        localStorage.setItem('sage_liberacao_notas', JSON.stringify(liberacao));
        console.log('✅ Liberação de notas sincronizada');
        algumDadoCarregado = true;
      }
    }
  } catch (err) {
    console.warn('⚠️ Erro ao carregar liberacao_notas:', err.message);
  }

  // Configuração de tempos
  try {
    const snapConfig = await db.collection('config_tempos').get();
    if (!snapConfig.empty) {
      let config = null;
      snapConfig.forEach((doc) => { config = { id: doc.id, ...doc.data() }; });
      if (config) {
        state.configTempos = config;
        localStorage.setItem('sage_config_tempos', JSON.stringify(config));
        console.log('✅ Configuração de tempos sincronizada');
      }
    }
  } catch (err) {
    console.warn('⚠️ Erro ao carregar config_tempos:', err.message);
  }

  if (algumDadoCarregado && typeof window.salvarEstado === 'function') {
    window.salvarEstado();
  }

  console.log('✅ Sincronização com Firebase concluída');
  console.log('📊 Estado atual:', {
    eletivas: state.eletivas?.length || 0,
    alunos: state.alunos?.length || 0,
    professores: state.professores?.length || 0,
    matriculas: state.matriculas?.length || 0
  });
  
  return algumDadoCarregado;
}

// ========== LISTENERS EM TEMPO REAL ==========
function escutarColecoesGestor(onAtualizado) {
  if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
    console.warn('⚠️ Firebase não disponível para listener em tempo real');
    return null;
  }
  const db = window.FirebaseConfig.firestore;
  if (!db) return null;

  const unsubscribers = [];
  const storageKeyMap = { eletivas: 'eletivas', alunos: 'alunos', matriculas: 'matriculas', professores: 'professores' };
  let ultimosTimestamps = {};

  function criarListener(colecao, chaveState) {
    let primeiraExecucao = true;
    try {
      const unsub = db.collection(colecao).onSnapshot((snap) => {
        if (primeiraExecucao) { primeiraExecucao = false; return; }
        if (!state[chaveState]) state[chaveState] = [];
        let mudou = false;
        snap.docChanges().forEach((change) => {
          const data = { ...change.doc.data(), id: change.doc.id };
          const novoTimestamp = data._syncTimestamp || data._lastSync || data.dataCriacao || new Date().toISOString();
          const ultimoTimestamp = ultimosTimestamps[`${colecao}_${data.id}`];
          if (ultimoTimestamp && novoTimestamp <= ultimoTimestamp) return;
          ultimosTimestamps[`${colecao}_${data.id}`] = novoTimestamp;
          if (change.type === 'added' || change.type === 'modified') {
            const idx = state[chaveState].findIndex((item) => String(item.id) === String(data.id));
            if (idx !== -1) { state[chaveState][idx] = data; } else { state[chaveState].push(data); }
            mudou = true;
          } else if (change.type === 'removed') {
            state[chaveState] = state[chaveState].filter((item) => String(item.id) !== String(data.id));
            mudou = true;
          }
        });
        if (mudou) {
          const chaveStorage = storageKeyMap[colecao];
          if (chaveStorage && typeof CONFIG !== 'undefined' && CONFIG.storageKeys && CONFIG.storageKeys[chaveStorage]) {
            localStorage.setItem(CONFIG.storageKeys[chaveStorage], JSON.stringify(state[chaveState]));
          }
          if (typeof window.salvarEstado === 'function') window.salvarEstado();
          console.log(`🔄 Atualização em tempo real: ${colecao} (${snap.docChanges().length} mudanças)`);
          if (typeof onAtualizado === 'function') onAtualizado(colecao);
        }
      }, (err) => { 
        console.warn(`⚠️ Erro no listener de ${colecao}:`, err.message);
        setTimeout(() => { console.log(`🔄 Tentando reconectar listener de ${colecao}...`); }, 5000);
      });
      unsubscribers.push(unsub);
    } catch (err) {
      console.warn(`⚠️ Erro ao configurar listener de ${colecao}:`, err.message);
    }
  }

  criarListener('eletivas', 'eletivas');
  criarListener('alunos', 'alunos');
  criarListener('professores', 'professores');
  criarListener('matriculas', 'matriculas');
  criarListener('notas', 'notas');
  criarListener('registros', 'registros');
  
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

  console.log(`👂 ${unsubscribers.length} listeners em tempo real ativos`);
  return () => unsubscribers.forEach(fn => fn());
}

function atualizarStatusSincronizacaoGlobal() {
  const connectionStatus = document.getElementById("connectionStatus");
  const syncBtn = document.getElementById("syncButton");
  const syncBadge = document.getElementById("syncBadge");
  if (!connectionStatus) return;
  const online = navigator.onLine && window.FirebaseConfig?.isInitialized;
  const pendentes = getPendingCount();
  let statusClass = "", statusIcon = "", statusText = "";
  if (!online) {
    statusClass = "offline";
    statusIcon = '<i class="fas fa-wifi-slash"></i>';
    statusText = " Offline";
  } else if (pendentes > 0) {
    statusClass = "pending";
    statusIcon = '<i class="fas fa-clock"></i>';
    statusText = ` Sincronizando (${pendentes} pendente${pendentes !== 1 ? "s" : ""})`;
  } else {
    statusClass = "online";
    statusIcon = '<i class="fas fa-check-circle"></i>';
    statusText = " Sincronizado";
  }
  connectionStatus.className = `connection-status ${statusClass}`;
  connectionStatus.innerHTML = `${statusIcon}${statusText}`;
  if (syncBtn) {
    if (!online || pendentes === 0) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<i class="fas fa-check"></i> Sincronizado';
      if (syncBadge) syncBadge.style.display = "none";
    } else {
      syncBtn.disabled = false;
      syncBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Sincronizar${pendentes > 0 ? ` (${pendentes})` : ""}`;
      if (syncBadge) { syncBadge.textContent = pendentes; syncBadge.style.display = "inline-block"; }
    }
  }
}

async function executarComRetry(fn, maxTentativas = 3, delayInicial = 1000) {
  let ultimoErro;
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try { return await fn(); } catch (erro) {
      ultimoErro = erro;
      console.warn(`⚠️ Tentativa ${tentativa}/${maxTentativas} falhou:`, erro.message);
      if (tentativa < maxTentativas) await new Promise(resolve => setTimeout(resolve, delayInicial * Math.pow(2, tentativa - 1)));
    }
  }
  throw ultimoErro;
}

async function excluirEletivaCompleta(eletivaId) {
  console.log(`🗑️ Iniciando exclusão atômica da eletiva ID: ${eletivaId}`);
  const idString = String(eletivaId);
  const matriculasVinculadas = (state.matriculas || []).filter(m => String(m.eletivaId) === idString);
  const registrosVinculados = (state.registros || []).filter(r => String(r.eletivaId) === idString);
  const notasVinculadas = (state.notas || []).filter(n => String(n.eletivaId) === idString);
  if (window.FirebaseConfig?.firestore) {
    await executarComRetry(async () => {
      const db = window.FirebaseConfig.firestore;
      const batch = db.batch();
      batch.delete(db.collection('eletivas').doc(idString));
      matriculasVinculadas.forEach(mat => batch.delete(db.collection('matriculas').doc(String(mat.id))));
      registrosVinculados.forEach(reg => batch.delete(db.collection('registros').doc(String(reg.id))));
      notasVinculadas.forEach(nota => batch.delete(db.collection('notas').doc(String(nota.id))));
      await batch.commit();
      console.log(`✅ Batch commit realizado com sucesso. ${batch._ops.length} operações.`);
      return true;
    });
  }
  return { matriculas: matriculasVinculadas, registros: registrosVinculados, notas: notasVinculadas };
}

window.addEventListener("online", () => {
  console.log("📡 Conexão restabelecida. Processando fila pendente...");
  setTimeout(processarFilaPendente, 2000);
  atualizarStatusSincronizacaoGlobal();
});

window.addEventListener("offline", () => {
  console.log("📡 Conexão perdida. Operações serão armazenadas localmente.");
  atualizarStatusSincronizacaoGlobal();
});

window.FirebaseSync = {
  processarFilaPendente,
  getPendingCount,
  salvarDadosFirebase,
  deletarDadosFirebase,
  salvarRegistroAulaOffline,
  carregarDadosFirebase,
  carregarRegistrosFirebase,
  carregarNotasFirebase,
  carregarColecoesGestor,
  escutarColecoesGestor,
  adicionarOperacaoFila,
  removerOperacaoFila,
  atualizarStatusSincronizacaoGlobal,
  executarComRetry,
  excluirEletivaCompleta,
};

initSyncQueue();
setInterval(atualizarStatusSincronizacaoGlobal, 5000);
