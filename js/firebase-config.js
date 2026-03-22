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
let pendingInitializationResolvers = [];

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

    // Usar synchronizeTabs para multi-tab
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
    
    // Resolver todas as promessas pendentes
    pendingInitializationResolvers.forEach(resolve => resolve(true));
    pendingInitializationResolvers = [];
    
    return true;
  } catch (error) {
    console.error("❌ Erro ao inicializar Firebase:", error);
    return false;
  }
}

// NOVA FUNÇÃO: Aguardar inicialização com timeout
async function aguardarInicializacaoFirebase(timeout = 10000) {
  if (firebaseInitialized) return true;
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    // Se ainda não inicializado, adicionar à fila
    pendingInitializationResolvers.push(resolve);
    
    // Configurar timeout
    setTimeout(() => {
      const index = pendingInitializationResolvers.indexOf(resolve);
      if (index !== -1) {
        pendingInitializationResolvers.splice(index, 1);
        reject(new Error(`Timeout de ${timeout}ms ao aguardar inicialização do Firebase`));
      }
    }, timeout);
    
    // Tentar inicializar agora
    initFirebase();
  });
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

window.FirebaseConfig = {
  initFirebase,
  aguardarInicializacaoFirebase,
  verificarConexaoFirebase,
  get firestore() {
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
