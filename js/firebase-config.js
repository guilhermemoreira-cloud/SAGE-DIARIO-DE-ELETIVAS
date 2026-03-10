// js/firebase-config.js
console.log("🔥 Inicializando Firebase...");

const firebaseConfig = {
  apiKey: "AIzaSyDF_GVhXrBhqtsj7oodEZ84zhV9xkr3daY",
  authDomain: "diario-sage.firebaseapp.com",
  projectId: "diario-sage",
  storageBucket: "diario-sage.firebasestorage.app",
  messagingSenderId: "87729638767",
  appId: "1:87729638767:web:2b90ce5e1bd3d59ed42c9a",
  measurementId: "G-EX5L4S48QB",
};

let firebaseApp = null;
let db = null;
let firebaseInitialized = false;

function initFirebase() {
  // Se já inicializado, retorna true
  if (firebaseInitialized) {
    console.log("✅ Firebase já estava inicializado");
    return true;
  }

  try {
    if (typeof firebase === "undefined") {
      console.warn("⚠️ Firebase SDK não carregado");
      return false;
    }

    // Verificar se já existe uma instância com o nome 'DEFAULT'
    try {
      // Tenta obter a instância existente
      firebaseApp = firebase.app();
      console.log("✅ Usando instância Firebase existente");
    } catch (e) {
      // Se não existir, cria uma nova
      console.log("🆕 Criando nova instância Firebase");
      firebaseApp = firebase.initializeApp(firebaseConfig);
    }

    // Obter o Firestore
    db = firebase.firestore();

    // CORREÇÃO: Não usar synchronizeTabs e experimentalForceOwningTab juntos
    // Opção 1: Usar apenas synchronizeTabs (recomendado)
    db.enablePersistence({
      synchronizeTabs: true,
    })
      .then(() => {
        console.log("✅ Persistência offline habilitada (multi-tab)");
      })
      .catch((err) => {
        if (err.code === "failed-precondition") {
          console.warn(
            "⚠️ Múltiplas abas abertas - persistência apenas em uma aba",
          );
        } else if (err.code === "unimplemented") {
          console.warn("⚠️ Navegador não suporta persistência offline");
        } else {
          console.warn("⚠️ Erro na persistência:", err.message);
        }
      });

    firebaseInitialized = true;
    console.log("✅ Firebase inicializado com sucesso!");
    return true;
  } catch (error) {
    console.error("❌ Erro ao inicializar Firebase:", error);
    return false;
  }
}

async function verificarConexaoFirebase() {
  // Garantir que Firebase está inicializado
  if (!firebaseInitialized) {
    const initResult = initFirebase();
    if (!initResult) {
      return false;
    }
  }

  try {
    // Verificar conectividade com uma operação simples
    const testRef = db.collection("_health").doc("connection");
    await testRef.set(
      {
        timestamp: new Date().toISOString(),
        online: true,
      },
      { merge: true },
    );

    console.log("📡 Conexão com Firebase OK");
    return true;
  } catch (error) {
    console.warn("📡 Offline:", error.message);
    return false;
  }
}

// Não inicializar automaticamente - deixar para quando necessário
// initFirebase();

window.FirebaseConfig = {
  initFirebase,
  verificarConexaoFirebase,
  get firestore() {
    // Garantir que db está disponível
    if (!db && !initFirebase()) {
      return null;
    }
    return db;
  },
  get isInitialized() {
    return firebaseInitialized;
  },
  get config() {
    return firebaseConfig;
  },
};
