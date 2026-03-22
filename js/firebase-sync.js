// 1. LIMPAR LOCALSTORAGE
console.log("=== LIMPANDO LOCALSTORAGE ===");
Object.keys(localStorage).forEach(key => {
  if (!key.includes('gestor_atual') && !key.includes('professor_atual') && !key.includes('sage_theme')) {
    localStorage.removeItem(key);
    console.log("Removido:", key);
  }
});

// 2. RESETAR STATE
state.alunos = [];
state.professores = [];
state.eletivas = [];
state.matriculas = [];
state.registros = [];
state.notas = [];

// 3. RECARREGAR DO FIREBASE
if (window.FirebaseSync?.carregarColecoesGestor) {
  await window.FirebaseSync.carregarColecoesGestor();
}

// 4. VERIFICAR VÍNCULOS
console.log("\n=== VERIFICANDO VÍNCULOS ===");
console.log("Eletivas:", state.eletivas?.length);
console.log("Alunos:", state.alunos?.length);
console.log("Professores:", state.professores?.length);
console.log("Matrículas:", state.matriculas?.length);

// Verificar se as eletivas têm professorId correto
const eletivaComProfessor = state.eletivas?.filter(e => e.professorId);
console.log("Eletivas com professor vinculado:", eletivaComProfessor?.length);

// Verificar se as matrículas têm alunoId e eletivaId corretos
const matriculaValida = state.matriculas?.filter(m => m.alunoId && m.eletivaId);
console.log("Matrículas válidas:", matriculaValida?.length);

// 5. RECARREGAR PÁGINA
location.reload();
