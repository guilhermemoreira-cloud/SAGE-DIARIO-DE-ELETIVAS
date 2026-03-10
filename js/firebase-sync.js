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
    atualizarStatusSincronizacao();
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
      const docRef = op.documentoId
        ? collectionRef.doc(op.documentoId.toString())
        : collectionRef.doc();

      if (op.tipo === "salvar" && op.dados) {
        await docRef.set(
          {
            ...op.dados,
            _syncTimestamp: new Date().toISOString(),
            _syncVersion: "2026.1",
          },
          { merge: true },
        );
      } else if (op.tipo === "deletar" || (op.tipo === "salvar" && !op.dados)) {
        await docRef.delete();
      }

      console.log(`✅ Operação concluída: ${op.tipo} - ${op.colecao}`);
    } catch (error) {
      console.warn(`⚠️ Falha na operação (tentativa ${op.tentativas}):`, error);

      if (op.tentativas < 5) {
        novasPendentes.push(op);
      } else {
        console.error(`❌ Operação descartada após 5 tentativas:`, op);
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
    setTimeout(processarFilaPendente, 30000);
  } else {
    console.log("✅ Todas as operações sincronizadas!");
    lastSyncTime = new Date().toISOString();
    localStorage.setItem("sage_last_sync", lastSyncTime);
    atualizarStatusSincronizacao();
  }
}
