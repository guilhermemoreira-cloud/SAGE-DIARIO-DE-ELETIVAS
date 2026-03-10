// js/frequencias.js - Módulo de visualização de frequências
(function () {
  console.log("📊 Inicializando módulo de frequências...");

  function criarAbaFrequenciasProfessor() {
    if (document.getElementById("tab-frequencias")) return;

    const professorTabs = document.querySelector(".professor-tabs");
    if (professorTabs) {
      const btnFrequencias = document.createElement("button");
      btnFrequencias.className = "tab-btn";
      btnFrequencias.setAttribute("onclick", "mudarTab('frequencias')");
      btnFrequencias.innerHTML =
        '<i class="fas fa-clipboard-list"></i> Frequências';
      professorTabs.appendChild(btnFrequencias);

      const dashboard = document.querySelector(".professor-dashboard");
      const tabPane = document.createElement("div");
      tabPane.id = "tab-frequencias";
      tabPane.className = "tab-pane";
      tabPane.innerHTML = `
        <h3>Frequências Registradas</h3>
        
        <div class="frequencias-filtros" style="margin: 1rem 0; display: flex; gap: 1rem; flex-wrap: wrap;">
          <select id="filtroEletivaFrequencia" style="flex: 2; padding: 0.5rem; border-radius: 8px; border: 2px solid var(--bg-gray);">
            <option value="">Todas as eletivas</option>
          </select>
          
          <input type="date" id="filtroDataInicio" style="flex: 1; padding: 0.5rem; border-radius: 8px; border: 2px solid var(--bg-gray);" placeholder="Data inicial">
          
          <input type="date" id="filtroDataFim" style="flex: 1; padding: 0.5rem; border-radius: 8px; border: 2px solid var(--bg-gray);" placeholder="Data final">
          
          <button class="btn-primary" onclick="Frequencias.filtrarFrequencias()">
            <i class="fas fa-search"></i> Filtrar
          </button>
          
          <button class="btn-secondary" onclick="Frequencias.limparFiltros()">
            <i class="fas fa-eraser"></i> Limpar
          </button>
        </div>
        
        <div class="sync-status" style="margin: 1rem 0; padding: 0.5rem; background: var(--bg-light); border-radius: 8px;">
          <i class="fas fa-cloud"></i> Status de sincronização
        </div>
        
        <div id="frequenciasContainer" class="frequencias-container">
          <p class="empty-state">Selecione uma eletiva para ver as frequências</p>
        </div>
      `;

      dashboard.appendChild(tabPane);
    }
  }

  async function carregarFrequenciasProfessor(filtros = {}) {
    const container = document.getElementById("frequenciasContainer");
    if (!container) return;

    const professorId = window.professorAtual?.id;
    if (!professorId) return;

    let registros = [];

    if (window.FirebaseSync) {
      registros = await window.FirebaseSync.carregarRegistrosFirebase(
        filtros.eletivaId,
        filtros.dataInicio,
        filtros.dataFim,
      );
    }

    if (!registros || registros.length === 0) {
      registros = (window.state?.registros || []).filter(
        (r) => r.professorId === professorId,
      );
    }

    if (filtros.eletivaId) {
      registros = registros.filter(
        (r) => r.eletivaId === parseInt(filtros.eletivaId),
      );
    }

    if (filtros.dataInicio) {
      registros = registros.filter((r) => r.data >= filtros.dataInicio);
    }
    if (filtros.dataFim) {
      registros = registros.filter((r) => r.data <= filtros.dataFim);
    }

    if (registros.length === 0) {
      container.innerHTML =
        '<p class="empty-state">Nenhuma frequência encontrada</p>';
      return;
    }

    const registrosPorEletiva = {};
    registros.forEach((r) => {
      if (!registrosPorEletiva[r.eletivaId]) {
        registrosPorEletiva[r.eletivaId] = [];
      }
      registrosPorEletiva[r.eletivaId].push(r);
    });

    container.innerHTML = "";

    for (const [eletivaId, registrosEletiva] of Object.entries(
      registrosPorEletiva,
    )) {
      const eletiva = window.state?.eletivas?.find(
        (e) => e.id === parseInt(eletivaId),
      );
      if (!eletiva) continue;

      registrosEletiva.sort((a, b) => new Date(b.data) - new Date(a.data));

      const card = document.createElement("div");
      card.className = "eletiva-card";
      card.style.marginBottom = "2rem";

      const header = document.createElement("div");
      header.style.marginBottom = "1rem";
      header.innerHTML = `
        <h3 style="display: flex; justify-content: space-between; align-items: center;">
          ${eletiva.codigo} - ${eletiva.nome}
          <span class="badge" style="background: var(--primary); color: white; padding: 0.2rem 1rem; border-radius: 20px;">
            ${registrosEletiva.length} aulas
          </span>
        </h3>
      `;
      card.appendChild(header);

      const table = document.createElement("table");
      table.className = "alunos-table";
      table.style.fontSize = "0.9rem";
      table.innerHTML = `
        <thead>
          <tr>
            <th>Data</th>
            <th>Conteúdo</th>
            <th>Presentes</th>
            <th>Ausentes</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="registros-${eletivaId}">
        </tbody>
      `;

      const tbody = table.querySelector("tbody");

      registrosEletiva.forEach((reg) => {
        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        row.innerHTML = `
          <td>${window.formatarData ? window.formatarData(reg.data) : reg.data}</td>
          <td>${reg.conteudo.substring(0, 50)}${reg.conteudo.length > 50 ? "..." : ""}</td>
          <td style="color: var(--success); font-weight: bold;">${reg.frequencia?.presentes?.length || 0}</td>
          <td style="color: var(--danger); font-weight: bold;">${reg.frequencia?.ausentes?.length || 0}</td>
          <td>
            <button class="btn-small btn-primary" onclick="event.stopPropagation(); Frequencias.verDetalhesRegistro(${reg.id})">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        `;
        row.addEventListener("click", (e) => {
          if (e.target.tagName !== "BUTTON" && !e.target.closest("button")) {
            Frequencias.verDetalhesRegistro(reg.id);
          }
        });
        tbody.appendChild(row);
      });

      card.appendChild(table);
      container.appendChild(card);
    }
  }

  function criarAbaFrequenciasGestor() {
    if (document.getElementById("tab-frequencias-gestor")) return;

    const gestorTabs = document.querySelector(".gestor-tabs");
    if (gestorTabs) {
      const btnFrequencias = document.createElement("button");
      btnFrequencias.className = "tab-btn";
      btnFrequencias.setAttribute("onclick", "mudarTab('frequencias-gestor')");
      btnFrequencias.innerHTML =
        '<i class="fas fa-clipboard-list"></i> Frequências';
      gestorTabs.appendChild(btnFrequencias);

      const tabContent = document.querySelector(".tab-content");
      const tabPane = document.createElement("div");
      tabPane.id = "tab-frequencias-gestor";
      tabPane.className = "tab-pane";
      tabPane.innerHTML = `
        <h3>Frequências de Todas as Eletivas</h3>
        
        <div class="frequencias-filtros" style="margin: 1rem 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <select id="gestorFiltroEletiva" style="padding: 0.5rem; border-radius: 8px; border: 2px solid var(--bg-gray);">
            <option value="">Todas as eletivas</option>
          </select>
          
          <select id="gestorFiltroProfessor" style="padding: 0.5rem; border-radius: 8px; border: 2px solid var(--bg-gray);">
            <option value="">Todos os professores</option>
          </select>
          
          <input type="date" id="gestorFiltroDataInicio" style="padding: 0.5rem; border-radius: 8px; border: 2px solid var(--bg-gray);" placeholder="Data inicial">
          
          <input type="date" id="gestorFiltroDataFim" style="padding: 0.5rem; border-radius: 8px; border: 2px solid var(--bg-gray);" placeholder="Data final">
          
          <button class="btn-primary" onclick="Frequencias.filtrarFrequenciasGestor()">
            <i class="fas fa-search"></i> Filtrar
          </button>
        </div>
        
        <div class="sync-status" style="margin: 1rem 0; padding: 0.5rem; background: var(--bg-light); border-radius: 8px;">
          <i class="fas fa-cloud"></i> Status de sincronização
        </div>
        
        <div id="gestorFrequenciasContainer" class="frequencias-container">
          <p class="empty-state">Selecione os filtros para ver as frequências</p>
        </div>
      `;

      tabContent.appendChild(tabPane);
    }
  }

  async function carregarFrequenciasGestor(filtros = {}) {
    const container = document.getElementById("gestorFrequenciasContainer");
    if (!container) return;

    let registros = [];

    if (window.FirebaseSync) {
      registros = await window.FirebaseSync.carregarRegistrosFirebase(
        filtros.eletivaId,
        filtros.dataInicio,
        filtros.dataFim,
      );
    }

    if (!registros || registros.length === 0) {
      registros = window.state?.registros || [];
    }

    if (filtros.professorId) {
      registros = registros.filter(
        (r) => r.professorId === parseInt(filtros.professorId),
      );
    }

    if (registros.length === 0) {
      container.innerHTML =
        '<p class="empty-state">Nenhuma frequência encontrada</p>';
      return;
    }

    const totalAulas = registros.length;
    const totalPresencas = registros.reduce(
      (acc, r) => acc + (r.frequencia?.presentes?.length || 0),
      0,
    );
    const totalAusencias = registros.reduce(
      (acc, r) => acc + (r.frequencia?.ausentes?.length || 0),
      0,
    );

    const statsHtml = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
        <div style="background: var(--bg-white); padding: 1rem; border-radius: 8px; text-align: center; box-shadow: var(--shadow);">
          <h4 style="color: var(--primary); font-size: 2rem; margin: 0;">${totalAulas}</h4>
          <p style="margin: 0.5rem 0 0 0;">Total de Aulas</p>
        </div>
        <div style="background: var(--bg-white); padding: 1rem; border-radius: 8px; text-align: center; box-shadow: var(--shadow);">
          <h4 style="color: var(--success); font-size: 2rem; margin: 0;">${totalPresencas}</h4>
          <p style="margin: 0.5rem 0 0 0;">Presenças</p>
        </div>
        <div style="background: var(--bg-white); padding: 1rem; border-radius: 8px; text-align: center; box-shadow: var(--shadow);">
          <h4 style="color: var(--danger); font-size: 2rem; margin: 0;">${totalAusencias}</h4>
          <p style="margin: 0.5rem 0 0 0;">Ausências</p>
        </div>
      </div>
    `;

    registros.sort((a, b) => new Date(b.data) - new Date(a.data));

    let tableHtml = `
      <table class="alunos-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Eletiva</th>
            <th>Professor</th>
            <th>Conteúdo</th>
            <th>Presentes</th>
            <th>Ausentes</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const reg of registros) {
      const eletiva = window.state?.eletivas?.find(
        (e) => e.id === reg.eletivaId,
      );
      const professor = window.state?.professores?.find(
        (p) => p.id === reg.professorId,
      );

      tableHtml += `
        <tr style="cursor: pointer;" onclick="Frequencias.verDetalhesRegistro(${reg.id})">
          <td>${window.formatarData ? window.formatarData(reg.data) : reg.data}</td>
          <td>${eletiva?.codigo || "N/A"}</td>
          <td>${professor?.nome || "N/A"}</td>
          <td>${reg.conteudo?.substring(0, 50) || ""}${reg.conteudo?.length > 50 ? "..." : ""}</td>
          <td style="color: var(--success); font-weight: bold;">${reg.frequencia?.presentes?.length || 0}</td>
          <td style="color: var(--danger); font-weight: bold;">${reg.frequencia?.ausentes?.length || 0}</td>
          <td>
            <button class="btn-small btn-primary" onclick="event.stopPropagation(); Frequencias.verDetalhesRegistro(${reg.id})">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }

    tableHtml += "</tbody></table>";

    container.innerHTML = statsHtml + tableHtml;
  }

  function verDetalhesRegistro(registroId) {
    const registro = window.state?.registros?.find((r) => r.id === registroId);
    if (!registro) return;

    const eletiva = window.state?.eletivas?.find(
      (e) => e.id === registro.eletivaId,
    );
    const professor = window.state?.professores?.find(
      (p) => p.id === registro.professorId,
    );

    const presentesNomes = (registro.frequencia?.presentes || [])
      .map((codigo) => {
        const aluno = window.state?.alunos?.find(
          (a) => a.codigoSige === codigo,
        );
        return aluno ? `${aluno.nome} (${aluno.turmaOrigem})` : codigo;
      })
      .join("<br>");

    const ausentesNomes = (registro.frequencia?.ausentes || [])
      .map((codigo) => {
        const aluno = window.state?.alunos?.find(
          (a) => a.codigoSige === codigo,
        );
        const justificativa = registro.frequencia?.justificativas?.[codigo];
        return aluno
          ? `${aluno.nome} (${aluno.turmaOrigem})${justificativa ? ` - <span style="color: var(--warning);">Just: ${justificativa}</span>` : ""}`
          : codigo;
      })
      .join("<br>");

    const modalBody = document.getElementById("modalBody");
    const modalTitle = document.getElementById("modalTitle");

    if (modalBody && modalTitle) {
      modalTitle.textContent = `Detalhes da Frequência - ${window.formatarData ? window.formatarData(registro.data) : registro.data}`;
      modalBody.innerHTML = `
        <p><strong>Eletiva:</strong> ${eletiva?.codigo || ""} - ${eletiva?.nome || ""}</p>
        <p><strong>Professor:</strong> ${professor?.nome || ""}</p>
        <p><strong>Data:</strong> ${window.formatarData ? window.formatarData(registro.data) : registro.data}</p>
        <p><strong>Conteúdo:</strong> ${registro.conteudo}</p>
        ${registro.observacoes ? `<p><strong>Observações:</strong> ${registro.observacoes}</p>` : ""}
        
        <div style="margin-top: 1rem; background: var(--bg-light); padding: 1rem; border-radius: 8px;">
          <p style="color: var(--success);"><strong>Presentes (${registro.frequencia?.presentes?.length || 0}):</strong></p>
          <p>${presentesNomes || "Nenhum"}</p>
        </div>
        
        <div style="margin-top: 1rem; background: var(--bg-light); padding: 1rem; border-radius: 8px;">
          <p style="color: var(--danger);"><strong>Ausentes (${registro.frequencia?.ausentes?.length || 0}):</strong></p>
          <p>${ausentesNomes || "Nenhum"}</p>
        </div>
      `;

      document.getElementById("modalDetalhes")?.classList.add("active");
    }
  }

  function preencherSelects() {
    const selectProf = document.getElementById("filtroEletivaFrequencia");
    if (selectProf && window.state?.eletivas && window.professorAtual) {
      const eletivasProf = window.state.eletivas.filter(
        (e) => e.professorId === window.professorAtual.id,
      );

      selectProf.innerHTML = '<option value="">Todas as eletivas</option>';
      eletivasProf.forEach((e) => {
        selectProf.innerHTML += `<option value="${e.id}">${e.codigo} - ${e.nome}</option>`;
      });
    }

    const selectEletivaGestor = document.getElementById("gestorFiltroEletiva");
    if (selectEletivaGestor && window.state?.eletivas) {
      selectEletivaGestor.innerHTML =
        '<option value="">Todas as eletivas</option>';
      window.state.eletivas.forEach((e) => {
        selectEletivaGestor.innerHTML += `<option value="${e.id}">${e.codigo} - ${e.nome}</option>`;
      });
    }

    const selectProfGestor = document.getElementById("gestorFiltroProfessor");
    if (selectProfGestor && window.state?.professores) {
      selectProfGestor.innerHTML =
        '<option value="">Todos os professores</option>';
      window.state.professores.forEach((p) => {
        selectProfGestor.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
      });
    }
  }

  window.Frequencias = {
    filtrarFrequencias: async function () {
      const eletivaId = document.getElementById(
        "filtroEletivaFrequencia",
      )?.value;
      const dataInicio = document.getElementById("filtroDataInicio")?.value;
      const dataFim = document.getElementById("filtroDataFim")?.value;

      await carregarFrequenciasProfessor({
        eletivaId: eletivaId || null,
        dataInicio: dataInicio || null,
        dataFim: dataFim || null,
      });
    },

    filtrarFrequenciasGestor: async function () {
      const eletivaId = document.getElementById("gestorFiltroEletiva")?.value;
      const professorId = document.getElementById(
        "gestorFiltroProfessor",
      )?.value;
      const dataInicio = document.getElementById(
        "gestorFiltroDataInicio",
      )?.value;
      const dataFim = document.getElementById("gestorFiltroDataFim")?.value;

      await carregarFrequenciasGestor({
        eletivaId: eletivaId || null,
        professorId: professorId || null,
        dataInicio: dataInicio || null,
        dataFim: dataFim || null,
      });
    },

    limparFiltros: function () {
      const select = document.getElementById("filtroEletivaFrequencia");
      const dataInicio = document.getElementById("filtroDataInicio");
      const dataFim = document.getElementById("filtroDataFim");

      if (select) select.value = "";
      if (dataInicio) dataInicio.value = "";
      if (dataFim) dataFim.value = "";

      carregarFrequenciasProfessor();
    },

    verDetalhesRegistro: verDetalhesRegistro,

    atualizarSelects: preencherSelects,
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (window.location.pathname.includes("professor.html")) {
      criarAbaFrequenciasProfessor();
      setTimeout(() => preencherSelects(), 1000);
    }

    if (window.location.pathname.includes("gestor.html")) {
      criarAbaFrequenciasGestor();
      setTimeout(() => preencherSelects(), 1000);
    }
  });
})();
