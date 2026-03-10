// js/init-data.js - Carregar dados iniciais
(function () {
  console.log("📦 Verificando dados iniciais...");

  function inicializar() {
    const professoresExistentes = localStorage.getItem(
      CONFIG.storageKeys.professores,
    );

    if (professoresExistentes) {
      const quantidade = JSON.parse(professoresExistentes).length;
      console.log(`✅ Professores já existem: ${quantidade} registros`);
      return;
    }

    console.log("📦 Carregando dados iniciais dos professores...");

    const professoresIniciais = [
      {
        id: 1,
        nome: "ANA CRISTINA DE SOUZA LIMA",
        email: "ana.lima41@prof.ce.gov.br",
        cpf: "00854826335",
        perfil: "PROFESSOR",
      },
      {
        id: 2,
        nome: "ANDREIA FELIZARDO LIMA",
        email: "andreia.lima11@prof.ce.gov.br",
        cpf: "05574766310",
        perfil: "PROFESSOR",
      },
      {
        id: 3,
        nome: "ANDREZA MARTINS DE SOUZA",
        email: "andreza.martins@prof.ce.gov.br",
        cpf: "04988266354",
        perfil: "SECRETARIA",
      },
      {
        id: 4,
        nome: "BRENDA SILVA MARQUES VIEIRA",
        email: "brenda.vieira@prof.ce.gov.br",
        cpf: "07400137344",
        perfil: "PROFESSOR",
      },
      {
        id: 5,
        nome: "DANIEL DE ARAUJO NUNES",
        email: "daniel.nunes@prof.ce.gov.br",
        cpf: "04579533305",
        perfil: "GESTOR_PROFESSOR",
      },
      {
        id: 6,
        nome: "ERIK WILLER ALVES RODRIGUES",
        email: "erik.rodrigues@prof.ce.gov.br",
        cpf: "05340154335",
        perfil: "PROFESSOR",
      },
      {
        id: 7,
        nome: "FRANCISCA TEIXEIRA RODRIGUES",
        email: "francisca.rodrigues10@prof.ce.gov.br",
        cpf: "02222911338",
        perfil: "PROFESSOR",
      },
      {
        id: 8,
        nome: "FRANCISCO ALFREDO NICOLAU FILHO",
        email: "francisco.filho3@prof.ce.gov.br",
        cpf: "36943266349",
        perfil: "PROFESSOR",
      },
      {
        id: 9,
        nome: "GUILHERME LUIS DOS SANTOS MOREIRA",
        email: "guilherme.moreira@prof.ce.gov.br",
        cpf: "10711634424",
        perfil: "GESTOR_PROFESSOR",
      },
      {
        id: 10,
        nome: "HELIO GOMES E SILVA",
        email: "helio.silva1@prof.ce.gov.br",
        cpf: "01434096386",
        perfil: "PROFESSOR",
      },
      {
        id: 11,
        nome: "ITAERCIO PEREIRA DE LIMA",
        email: "itaercio.lima@prof.ce.gov.br",
        cpf: "06477265303",
        perfil: "PROFESSOR",
      },
      {
        id: 12,
        nome: "IVANEIDE ALVES DE ARAUJO",
        email: "ivaneide.araujo@prof.ce.gov.br",
        cpf: "02154318398",
        perfil: "PROFESSOR",
      },
      {
        id: 13,
        nome: "JOÃO IGOR GOMES DE SOUZA",
        email: "joao.souza9@prof.ce.gov.br",
        cpf: "06293116330",
        perfil: "PROFESSOR",
      },
      {
        id: 14,
        nome: "LUIZ GOMES DE OLIVEIRA NETO",
        email: "luiz.neto3@prof.ce.gov.br",
        cpf: "03753451320",
        perfil: "PROFESSOR",
      },
      {
        id: 15,
        nome: "MARCOS JOSE BENTO",
        email: "marcos.bento@prof.ce.gov.br",
        cpf: "47943130391",
        perfil: "PROFESSOR",
      },
      {
        id: 16,
        nome: "MARIA JACKELINE PEREIRA DE LIMA",
        email: "maria.lima200@prof.ce.gov.br",
        cpf: "07791052300",
        perfil: "PROFESSOR",
      },
      {
        id: 17,
        nome: "PAULO VICTOR ARAUJO RICARTE",
        email: "paulo.araujo5@prof.ce.gov.br",
        cpf: "03235436340",
        perfil: "PROFESSOR",
      },
      {
        id: 18,
        nome: "RENATO SIQUEIRA",
        email: "renato.siqueira@prof.ce.gov.br",
        cpf: "01402593333",
        perfil: "PROFESSOR",
      },
      {
        id: 19,
        nome: "ROGERIO GOMES DA SILVA",
        email: "rogerio.rgsilva@prof.ce.gov.br",
        cpf: "02281397327",
        perfil: "GESTOR_PROFESSOR",
      },
      {
        id: 20,
        nome: "SILAS MICAEL DO NASCIMENTO GOMES",
        email: "silas.gomes@prof.ce.gov.br",
        cpf: "03544953307",
        perfil: "PROFESSOR",
      },
      {
        id: 21,
        nome: "TAIS NUNES LEMOS",
        email: "tais.lemos@prof.ce.gov.br",
        cpf: "61091234396",
        perfil: "PROFESSOR",
      },
      {
        id: 22,
        nome: "TAMIRES SANTIAGO DOS SANTOS FERNANDES",
        email: "tamires.fernandes@prof.ce.gov.br",
        cpf: "04618702311",
        perfil: "PROFESSOR",
      },
    ];

    localStorage.setItem(
      CONFIG.storageKeys.professores,
      JSON.stringify(professoresIniciais),
    );

    localStorage.setItem(CONFIG.storageKeys.alunos, JSON.stringify([]));
    localStorage.setItem(CONFIG.storageKeys.eletivas, JSON.stringify([]));
    localStorage.setItem(CONFIG.storageKeys.matriculas, JSON.stringify([]));
    localStorage.setItem(CONFIG.storageKeys.registros, JSON.stringify([]));
    localStorage.setItem(CONFIG.storageKeys.remocoes, JSON.stringify([]));

    const semestres = [
      {
        id: "2026-1",
        nome: "1º Semestre 2026",
        ano: 2026,
        periodo: 1,
        ativo: true,
      },
      {
        id: "2026-2",
        nome: "2º Semestre 2026",
        ano: 2026,
        periodo: 2,
        ativo: false,
      },
    ];
    localStorage.setItem(
      CONFIG.storageKeys.semestres,
      JSON.stringify(semestres),
    );

    localStorage.setItem(
      "sage_nextId_2026",
      JSON.stringify({
        aluno: 1,
        professor: 23,
        eletiva: 1,
        matricula: 1,
        registro: 1,
      }),
    );

    console.log(
      `✅ Dados iniciais carregados! ${professoresIniciais.length} professores`,
    );
  }

  if (window.CONFIG) {
    inicializar();
  } else {
    setTimeout(() => {
      if (window.CONFIG) inicializar();
    }, 100);
  }
})();
