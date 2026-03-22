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
    id: window.gerarUUID ? window.gerarUUID() : Date.now().toString(),
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
  
  window.logSistema?.("INFO", "Sync", `Operação adicionada à fila: ${tipo} - ${colecao}`);

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
      if (!db) {
        throw new Error("Firestore não disponível");
      }

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
        window.showToast?.("Falha na sincronização de alguns dados", "error");
        window.logSistema?.("ERROR", "Sync", `Operação descartada: ${op.colecao}`, error);
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
    
    window.showToast?.("Todos os dados sincronizados com a nuvem!", "success");
  }
}

// ========== FUNÇÕES DE SALVAMENTO ==========
async function salvarDadosFirebase(colecao, dados, documentoId = null) {
  // Se estiver offline, adicionar à fila
  if (!navigator.onLine) {
    adicionarOperacaoFila("salvar", colecao, dados, documentoId);
    window.atualizarStatusSincronizacaoGlobal?.();
    return {
      offline: true,
      queueId: pendingQueue[pendingQueue.length - 1]?.id,
    };
  }

  // Se estiver online, tentar salvar imediatamente
  try {
    if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
      await window.FirebaseConfig?.aguardarInicializacaoFirebase(5000);
    }

    const db = window.FirebaseConfig.firestore;
    if (!db) {
      throw new Error("Firestore não disponível");
    }

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
    
    // Atualizar versão no state
    if (window.atualizarVersao) {
      window.atualizarVersao(colecao, dadosComMeta._syncTimestamp);
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error(`❌ Erro ao salvar no Firebase: ${colecao}`, error);
    window.logSistema?.("ERROR", "Sync", `Erro ao salvar ${colecao}`, error);

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
    window.atualizarStatusSincronizacaoGlobal?.();
    return { offline: true, success: true };
  }

  try {
    if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
      await window.FirebaseConfig?.aguardarInicializacaoFirebase(5000);
    }

    const db = window.FirebaseConfig.firestore;
    if (!db) {
      throw new Error("Firestore não disponível");
    }

    const docRef = db.collection(colecao).doc(String(documentoId));

    // Verificar se o documento existe
    const doc = await docRef.get();
    if (!doc.exists) {
      console.log(`ℹ️ Documento ${documentoId} não existe no Firebase`);
      return { success: true, notFound: true };
    }

    await docRef.delete();
    console.log(`✅ Documento DELETADO do Firebase: ${colecao}/${documentoId}`);

    // Remover da fila se estiver lá
    const indexNaFila = pendingQueue.findIndex(
      (op) =>
        String(op.documentoId) === String(documentoId) &&
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
    window.logSistema?.("ERROR", "Sync", `Erro ao deletar ${colecao}/${documentoId}`, error);

    // Em caso de erro de permissão, mostrar mensagem clara
    if (error.code === "permission-denied") {
      console.error("🚫 Erro de permissão! Verifique as regras do Firestore");
      window.showToast?.("Erro de permissão ao excluir do Firebase", "error");
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
      await window.FirebaseConfig?.aguardarInicializacaoFirebase(5000);
    }

    const db = window.FirebaseConfig.firestore;
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
      const data = doc.data();
      // Garantir ID consistente
      if (data && window.garantirIdConsistente) {
        window.garantirIdConsistente(data, colecao);
      }
      resultados.push({
        id: doc.id,
        ...data,
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
      filtros.eletivaId = String(eletivaId);
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
      filtros.eletivaId = String(eletivaId);
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
  return await salvarDadosFirebase("registros", registro, registro.id);
}

// ========== FUNÇÕES AUXILIARES ==========
function normalizarDataParaComparacao(dataString) {
  if (!dataString) return "";
  if (dataString.includes("/")) {
    const [dia, mes, ano] = dataString.split("/");
    return `${ano}-${mes}-${dia}`;
  }
  return dataString;
}

// ========== SINCRONIZACAO DE COLECOES DO GESTOR ==========
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

  function isDocValido(data) {
    if (!data) return false;
    const temDados = !!(data.nome || data.alunoId || data.eletivaId || data.codigo || data.codigoSige || data.professorId);
    if (!temDados) return false;
    
    // Verificar formato do ID
    if (data.id && window.garantirIdConsistente) {
      window.garantirIdConsistente(data);
    }
    return true;
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
      window.logSistema?.("WARN", "Sync", `Erro ao carregar ${colecao}`, err);
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
          if (window.garantirIdConsistente) window.garantirIdConsistente(data, "notas");
          const idx = state.notas.findIndex((n) => String(n.id) === String(doc.id));
          if (idx !== -1) {
            state.notas[idx] = { ...data, id: doc.id };
          } else {
            state.notas.push({ ...data, id: doc.id });
          }
          algumDadoCarregado = true;
        }
      });
      localStorage.setItem("sage_notas_2026", JSON.stringify(state.notas));
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

// ========== LISTENERS EM TEMPO REAL ==========
function escutarColecoesGestor(onAtualizado) {
  if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized) {
    console.warn('⚠️ Firebase não disponível para listener em tempo real');
    return null;
  }
  const db = window.FirebaseConfig.firestore;
  if (!db) return null;

  const unsubscribers = [];
  const storageKeyMap = { eletivas: 'eletivas', alunos: 'alunos', matriculas: 'matriculas' };
  let ultimosTimestamps = {};

  function isDocValido(data) {
    if (!data) return false;
    const temDados = !!(data.nome || data.alunoId || data.eletivaId || data.codigo || data.codigoSige || data.professorId);
    if (!temDados) return false;
    if (data.id && window.garantirIdConsistente) window.garantirIdConsistente(data);
    return true;
  }

  function criarListener(colecao, storageKey = colecao) {
    let primeiraExecucao = true;
    
    try {
      const unsub = db.collection(colecao).onSnapshot((snap) => {
        if (primeiraExecucao) { 
          primeiraExecucao = false; 
          return; 
        }
        if (!state[colecao]) state[colecao] = [];
        let mudou = false;
        
        snap.docChanges().forEach((change) => {
          const data = { ...change.doc.data(), id: change.doc.id };
          const novoTimestamp = data._syncTimestamp || data._lastSync || data.dataCriacao || new Date().toISOString();
          
          // Versionamento: só atualizar se o dado for mais recente
          const ultimoTimestamp = ultimosTimestamps[`${colecao}_${data.id}`];
          if (ultimoTimestamp && novoTimestamp <= ultimoTimestamp) return;
          ultimosTimestamps[`${colecao}_${data.id}`] = novoTimestamp;
          
          if (change.type === 'added' || change.type === 'modified') {
            if (isDocValido(data)) {
              const idx = state[colecao].findIndex((item) => String(item.id) === String(data.id));
              if (idx !== -1) {
                state[colecao][idx] = data;
              } else {
                state[colecao].push(data);
              }
              mudou = true;
            }
          } else if (change.type === 'removed') {
            state[colecao] = state[colecao].filter((item) => String(item.id) !== String(data.id));
            mudou = true;
          }
        });
        
        if (mudou) {
          const chaveStorage = storageKeyMap[colecao] || storageKey;
          if (chaveStorage && typeof CONFIG !== 'undefined' && CONFIG.storageKeys && CONFIG.storageKeys[chaveStorage]) {
            localStorage.setItem(CONFIG.storageKeys[chaveStorage], JSON.stringify(state[colecao]));
          }
          if (typeof window.salvarEstado === 'function') window.salvarEstado();
          
          console.log(`🔄 Atualização em tempo real: ${colecao} (${snap.docChanges().length} mudanças)`);
          window.logSistema?.("INFO", "Sync", `Atualização em tempo real: ${colecao}`);
          if (typeof onAtualizado === 'function') onAtualizado(colecao);
        }
      }, (err) => { 
        console.warn(`⚠️ Erro no listener de ${colecao}:`, err.message);
        window.logSistema?.("WARN", "Sync", `Erro no listener de ${colecao}`, err);
        setTimeout(() => {
          console.log(`🔄 Tentando reconectar listener de ${colecao}...`);
        }, 5000);
      });
      
      unsubscribers.push(unsub);
    } catch (err) {
      console.warn(`⚠️ Erro ao configurar listener de ${colecao}:`, err.message);
    }
  }

  // Criar listeners para todas as coleções - EXPANDIDO para notas e registros
  criarListener('eletivas', 'eletivas');
  criarListener('alunos', 'alunos');
  criarListener('matriculas', 'matriculas');
  criarListener('notas', 'notas');
  criarListener('registros', 'registros');
  
  // Listener para liberação de notas
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
        window.logSistema?.("INFO", "Sync", "Liberação de notas atualizada");
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

// ========== STATUS DE SINCRONIZAÇÃO GLOBAL ==========
let ultimoStatusAtualizado = null;

function atualizarStatusSincronizacaoGlobal() {
  const connectionStatus = document.getElementById("connectionStatus");
  const syncBtn = document.getElementById("syncButton");
  const syncBadge = document.getElementById("syncBadge");
  
  if (!connectionStatus) return;
  
  const online = navigator.onLine && window.FirebaseConfig?.isInitialized;
  const pendentes = getPendingCount();
  
  let statusClass = "";
  let statusIcon = "";
  let statusText = "";
  
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
      if (syncBadge) {
        syncBadge.textContent = pendentes;
        syncBadge.style.display = "inline-block";
      }
    }
  }
  
  if (ultimoStatusAtualizado !== statusClass) {
    window.logSistema?.("INFO", "Sync", `Status alterado: ${statusClass} (pendentes=${pendentes})`);
    ultimoStatusAtualizado = statusClass;
  }
}

// ========== FUNÇÃO DE RETRY COM BACKOFF ==========
async function executarComRetry(fn, maxTentativas = 3, delayInicial = 1000) {
  let ultimoErro;
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      return await fn();
    } catch (erro) {
      ultimoErro = erro;
      console.warn(`⚠️ Tentativa ${tentativa}/${maxTentativas} falhou:`, erro.message);
      window.logSistema?.("WARN", "Sync", `Tentativa ${tentativa} falhou: ${erro.message}`);
      if (tentativa < maxTentativas) {
        const delay = delayInicial * Math.pow(2, tentativa - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw ultimoErro;
}

// ========== FUNÇÃO DE EXCLUSÃO ATÔMICA DE ELETIVA ==========
async function excluirEletivaCompleta(eletivaId) {
  console.log(`🗑️ Iniciando exclusão atômica da eletiva ID: ${eletivaId}`);
  
  const idString = String(eletivaId);
  
  // 1. Buscar dados relacionados ANTES de iniciar o batch
  const matriculasVinculadas = (state.matriculas || []).filter(
    m => String(m.eletivaId) === idString
  );
  const registrosVinculados = (state.registros || []).filter(
    r => String(r.eletivaId) === idString
  );
  const notasVinculadas = (state.notas || []).filter(
    n => String(n.eletivaId) === idString
  );
  
  console.log(`📊 Dados relacionados encontrados:`, {
    matriculas: matriculasVinculadas.length,
    registros: registrosVinculados.length,
    notas: notasVinculadas.length
  });
  
  // 2. Executar exclusão atômica no Firebase (com retry)
  if (window.FirebaseConfig?.firestore) {
    await executarComRetry(async () => {
      const db = window.FirebaseConfig.firestore;
      const batch = db.batch();
      
      // Adicionar exclusão da eletiva
      const eletivaRef = db.collection('eletivas').doc(idString);
      batch.delete(eletivaRef);
      
      // Adicionar exclusões de matrículas
      matriculasVinculadas.forEach(mat => {
        const matRef = db.collection('matriculas').doc(String(mat.id));
        batch.delete(matRef);
      });
      
      // Adicionar exclusões de registros
      registrosVinculados.forEach(reg => {
        const regRef = db.collection('registros').doc(String(reg.id));
        batch.delete(regRef);
      });
      
      // Adicionar exclusões de notas
      notasVinculadas.forEach(nota => {
        const notaRef = db.collection('notas').doc(String(nota.id));
        batch.delete(notaRef);
      });
      
      await batch.commit();
      console.log(`✅ Batch commit realizado com sucesso. ${batch._ops.length} operações.`);
      return true;
    });
  }
  
  return {
    matriculas: matriculasVinculadas,
    registros: registrosVinculados,
    notas: notasVinculadas
  };
}

// ========== EVENT LISTENERS ==========
window.addEventListener("online", () => {
  console.log("📡 Conexão restabelecida. Processando fila pendente...");
  window.logSistema?.("INFO", "Sync", "Conexão restabelecida");
  setTimeout(processarFilaPendente, 2000);
  atualizarStatusSincronizacaoGlobal();
});

window.addEventListener("offline", () => {
  console.log("📡 Conexão perdida. Operações serão armazenadas localmente.");
  window.logSistema?.("INFO", "Sync", "Conexão perdida");
  atualizarStatusSincronizacaoGlobal();
});

// ========== EXPORTAÇÃO ==========
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

// Inicializar
initSyncQueue();
setInterval(atualizarStatusSincronizacaoGlobal, 5000);
