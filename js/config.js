// js/config.js - Configurações do sistema
const CONFIG = {
  // Firebase
  firebaseConfig: {
    apiKey: "AIzaSyDF_GVhXrBhqtsj7oodEZ84zhV9xkr3daY",
    authDomain: "diario-sage.firebaseapp.com",
    projectId: "diario-sage",
    storageBucket: "diario-sage.firebasestorage.app",
    messagingSenderId: "87729638767",
    appId: "1:87729638767:web:2b90ce5e1bd3d59ed42c9a",
    measurementId: "G-EX5L4S48QB",
  },

  // URL da planilha Google Sheets (via Apps Script)
  planilhaURL:
    "https://script.google.com/a/macros/prof.ce.gov.br/s/AKfycbzPTTma4CvqGvZTcL38-ZhqwgthWCZGyvN9cVAVSz0jwQWp8vp-QyKgOsZ6EXWArKeL/exec",

  // Nomes das abas na planilha
  abas: {
    alunos: "Estudantes",
    professores: "Professores",
    fixas: "Eletivas Fixas",
    mistas: "Eletivas Mistas",
  },

  storageKeys: {
    alunos: "sage_alunos_2026",
    professores: "sage_professores_2026",
    eletivas: "sage_eletivas_2026",
    matriculas: "sage_matriculas_2026",
    registros: "sage_registros_2026",
    semestres: "sage_semestres_2026",
    remocoes: "sage_remocoes_2026",
    ultimaSincronizacao: "sage_ultima_sincronizacao",
  },

  turmas: [
    "1ª SÉRIE A",
    "1ª SÉRIE B",
    "1ª SÉRIE C",
    "2ª SÉRIE A",
    "2ª SÉRIE B",
    "2ª SÉRIE C",
    "3ª SÉRIE A",
    "3ª SÉRIE B",
    "3ª SÉRIE C",
  ],

  series: ["1ª", "2ª", "3ª"],
  diasSemana: ["segunda", "terca", "quarta", "quinta", "sexta"],

  mapeamentoTempos: {
    T1: {
      diaSemana: "segunda",
      tempo: 1,
      seriesPermitidas: ["1ª", "2ª", "3ª"],
    },
    T2: { diaSemana: "quinta", tempo: 2, seriesPermitidas: ["1ª", "3ª"] },
    T3: { diaSemana: "terca", tempo: 3, seriesPermitidas: ["1ª"] },
    T4: { diaSemana: "sexta", tempo: 4, seriesPermitidas: ["1ª"] },
    T5: { diaSemana: "quarta", tempo: 5, seriesPermitidas: ["1ª"] },
  },

  horarios: [
    { tempo: 1, codigo: "T1", descricao: "1º Tempo (07:00 - 08:40)" },
    { tempo: 2, codigo: "T2", descricao: "2º Tempo (08:55 - 10:35)" },
    { tempo: 3, codigo: "T3", descricao: "3º Tempo (10:50 - 12:30)" },
    { tempo: 4, codigo: "T4", descricao: "4º Tempo (13:30 - 15:10)" },
    { tempo: 5, codigo: "T5", descricao: "5º Tempo (15:25 - 17:05)" },
  ],

  dadosPath: "data/dados-planilha.json",
};

window.CONFIG = CONFIG;
