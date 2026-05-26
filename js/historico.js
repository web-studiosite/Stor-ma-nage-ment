/* ============================================
   GESTÃO DE LOJA - Histórico / Audit Trail
   ============================================ */

class HistoricoManager {
  constructor() {
    this.aberto = false;
  }

  // Registrar ação
  async registrar(acao, tabela, registroId, dadosAnteriores = null, dadosNovos = null) {
    try {
      await db.addHistorico(acao, tabela, registroId, dadosAnteriores, dadosNovos);
    } catch (e) {
      console.error('[HISTORICO] Erro ao registrar:', e);
    }
  }

  // Mostrar histórico
  async mostrar(tabela = null, registroId = null) {
    const filtros = { limit: 200 };
    if (tabela) filtros.tabela = tabela;

    const historico = await db.getHistorico(filtros);

    // Se for caixa, mostrar só operações próprias
    let dados = historico;
    if (auth.isCaixa) {
      dados = historico.filter(h => h.perfil_id === auth.perfilId);
    }

    if (registroId) {
      dados = dados.filter(h => h.registro_id === registroId);
    }

    const body = U.create('div');

    // Filtros
    const filterBar = U.create('div', { className: 'filter-bar' });
    filterBar.innerHTML = `
      <div class="search-box" style="flex:1;min-width:200px;">
        <span class="search-icon">🔍</span>
        <input type="text" id="hist-search" placeholder="Pesquisar..." style="width:100%;">
      </div>
      <select id="hist-filtro-tabela" style="width:auto;min-width:150px;">
        <option value="">Todas as tabelas</option>
        ${TABELAS.map(t => `<option value="${t}">${this.nomeTabela(t)}</option>`).join('')}
      </select>
    `;
    body.appendChild(filterBar);

    // Timeline
    const timeline = U.create('div', { className: 'timeline' });

    if (dados.length === 0) {
      timeline.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">Sem registros</div>
          <div class="empty-state-desc">Nenhuma ação registada ainda.</div>
        </div>
      `;
    } else {
      dados.forEach(h => {
        const item = U.create('div', { className: 'timeline-item' });
        const acaoIcon = this.iconeAcao(h.acao);
        const tabelaNome = this.nomeTabela(h.tabela);
        item.innerHTML = `
          <div class="timeline-time">${Formulas.formatarDataHora(h.data_hora)}</div>
          <div class="timeline-content">
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
              <span style="font-size:1rem;">${acaoIcon}</span>
              <span style="font-weight:600;">${h.acao}</span>
              <span style="color:var(--text-light);">em</span>
              <span class="badge badge-info" style="font-size:0.625rem;">${tabelaNome}</span>
            </div>
            <div class="timeline-user">${h.perfil_nome || 'Sistema'} ${h.perfil_role ? `(${h.perfil_role})` : ''}</div>
            ${h.dados_novos ? `<div style="margin-top:0.375rem;font-size:0.75rem;color:var(--text-secondary);font-family:monospace;background:#f3f4f6;padding:0.375rem;border-radius:4px;overflow-x:auto;">${JSON.stringify(h.dados_novos).substring(0, 200)}${JSON.stringify(h.dados_novos).length > 200 ? '...' : ''}</div>` : ''}
          </div>
        `;
        timeline.appendChild(item);
      });
    }

    body.appendChild(timeline);

    // Modal
    const modal = U.modal({
      title: '📋 Histórico de Operações',
      body: body,
      large: true,
      onClose: () => { this.aberto = false; }
    });

    this.aberto = true;

    // Filtros
    const searchInput = U.el('#hist-search', body);
    const tabelaSelect = U.el('#hist-filtro-tabela', body);

    const filtrar = () => {
      const termo = searchInput.value.toLowerCase();
      const tab = tabelaSelect.value;
      U.els('.timeline-item', timeline).forEach(item => {
        const texto = item.textContent.toLowerCase();
        const matchTermo = !termo || texto.includes(termo);
        const matchTabela = !tab || texto.includes(this.nomeTabela(tab).toLowerCase());
        item.style.display = matchTermo && matchTabela ? '' : 'none';
      });
    };

    U.on(searchInput, 'input', U.debounce(filtrar, 200));
    U.on(tabelaSelect, 'change', filtrar);
  }

  iconeAcao(acao) {
    const map = {
      'criar': '➕', 'inserir': '➕', 'insert': '➕',
      'atualizar': '✏️', 'update': '✏️', 'editar': '✏️',
      'excluir': '🗑️', 'delete': '🗑️', 'apagar': '🗑️',
      'vender': '🛒', 'venda': '🛒',
      'abastecer': '⛽', 'abastecimento': '⛽',
      'entrada': '📥', 'transferir': '↔️', 'inventariar': '📋',
      'fechar_turno': '💰', 'login': '🔐', 'logout': '🚪'
    };
    return map[acao] || '📝';
  }

  nomeTabela(tabela) {
    const map = {
      'perfis': 'Perfis', 'bombas': 'Bombas', 'tanques': 'Tanques',
      'entradas_combustivel': 'Entradas', 'custo_medio_tanque': 'Custo Médio',
      'abastecimentos': 'Abastecimentos', 'produtos': 'Produtos',
      'vendas_loja': 'Vendas', 'movimentos_stock': 'Movimentos',
      'fechamentos_turno': 'Turnos', 'inventarios': 'Inventários',
      'inventario_itens': 'Itens Inventário', 'historico': 'Histórico',
      'configuracoes': 'Configurações'
    };
    return map[tabela] || tabela;
  }
}

const historicoManager = new HistoricoManager();
