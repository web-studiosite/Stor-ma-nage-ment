/* ============================================
   GESTÃO DE LOJA - SPA do Gestor Principal
   ============================================ */

class AppGestor {
  constructor() {
    this.bombaAtual = null;
    this.turnoAtual = 'manha';
    this.carrinho = [];
    this.vendaAtual = 1;
    this.produtoEditando = null;
    this.tanqueEditando = null;
    this.inventarioAtual = null;
    this.abastecimentoForm = {};
    this.dadosDashboard = {};
  }

  async init() {
    // Verificar sessão
    const ok = await auth.verificarSessao();
    if (!ok || !auth.isGestor) {
      window.location.href = 'index.html';
      return;
    }

    // Setup UI
    this.setupUI();
    this.setupEventos();

    // Carregar dados iniciais
    await this.carregarDadosIniciais();

    // Mostrar dashboard
    U.showSection('#sec-dashboard');
    await this.carregarDashboard();

    // Iniciar sync
    syncManager.iniciar();

    // Atualizar data
    U.el('#data-atual').textContent = new Date().toLocaleDateString('pt-MZ');
  }

  setupUI() {
    U.el('#user-name').textContent = auth.nome;
    U.el('#user-role').textContent = 'Gestor Principal';
    U.el('#user-avatar').textContent = auth.nome.charAt(0).toUpperCase();
  }

  setupEventos() {
    // Navegação
    U.els('.nav-item').forEach(nav => {
      U.on(nav, 'click', () => {
        const sec = nav.dataset.section;
        if (sec) {
          U.showSection(sec);
          this.carregarSecao(sec);
        }
      });
    });

    // Logout
    U.on(U.el('#btn-logout'), 'click', () => auth.logout());

    // Histórico flutuante
    U.on(U.el('#btn-historico'), 'click', () => historicoManager.mostrar());

    // Seletor de posto
    U.on(U.el('#select-posto'), 'change', (e) => {
      this.bombaAtual = e.target.value || null;
      this.carregarSecao(U.el('.section.active')?.id);
    });

    // Seletor de turno
    U.on(U.el('#select-turno'), 'change', (e) => {
      this.turnoAtual = e.target.value;
    });
  }

  async carregarDadosIniciais() {
    try {
      // Carregar bombas
      const bombas = await db.getBombas();
      const select = U.el('#select-posto');
      select.innerHTML = '<option value="">Selecionar posto...</option>' +
        bombas.map(b => `<option value="${b.id}">${b.nome}</option>`).join('');

      if (bombas.length > 0) {
        this.bombaAtual = bombas[0].id;
        select.value = this.bombaAtual;
      }

      // Sync silencioso
      await syncManager.sincronizarDados();
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    }
  }

  async carregarSecao(secId) {
    switch (secId) {
      case '#sec-dashboard': await this.carregarDashboard(); break;
      case '#sec-combustivel': await this.carregarCombustivel(); break;
      case '#sec-loja': await this.carregarLoja(); break;
      case '#sec-armazem': await this.carregarArmazem(); break;
      case '#sec-movimentos': await this.carregarMovimentos(); break;
      case '#sec-inventario': await this.carregarInventario(); break;
      case '#sec-turno': await this.carregarTurno(); break;
      case '#sec-relatorios': await this.carregarRelatorios(); break;
      case '#sec-config': await this.carregarConfig(); break;
    }
  }

  // ===== DASHBOARD =====
  async carregarDashboard() {
    if (!this.bombaAtual) {
      U.el('#dash-stats').innerHTML = '<div class="alert alert-info">Selecione um posto para ver o dashboard.</div>';
      return;
    }

    try {
      const hoje = new Date().toISOString().split('T')[0];
      const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // Vendas de hoje
      const vendas = await db.getVendas({ bombaId: this.bombaAtual, de: hoje, ate: amanha });
      const totalVendas = U.sumBy(vendas, 'valor_total');
      const lucroVendas = U.sumBy(vendas, 'lucro_total');

      // Abastecimentos de hoje
      const abastecimentos = await db.getAbastecimentos({ bombaId: this.bombaAtual, de: hoje, ate: amanha });
      const totalAbast = U.sumBy(abastecimentos, 'valor_total');
      const litrosAbast = U.sumBy(abastecimentos, 'litros');
      const lucroAbast = U.sumBy(abastecimentos, 'lucro_total');

      // Produtos com stock baixo
      const produtos = await db.getProdutos(this.bombaAtual);
      const stockBaixo = produtos.filter(p => (p.stock_loja || 0) <= (p.stock_minimo || 5));

      // Tanques
      const tanques = await db.getTanques(this.bombaAtual);
      const tanquesBaixo = tanques.filter(t => (t.stock_atual_litros || 0) <= (t.nivel_minimo_alerta || 500));

      // Total do dia
      const totalDia = totalVendas + totalAbast;
      const lucroDia = lucroVendas + lucroAbast;

      this.dadosDashboard = { vendas, abastecimentos, totalVendas, totalAbast, lucroDia, totalDia };

      // Render stats
      U.el('#dash-stats').innerHTML = `
        <div class="stat-card success">
          <span class="stat-icon">💰</span>
          <div class="stat-label">Vendas Hoje</div>
          <div class="stat-value"><span class="stat-prefix">MZN</span> ${Formulas.formatarNumero(totalDia)}</div>
          <div class="stat-change positive">+${vendas.length + abastecimentos.length} transações</div>
        </div>
        <div class="stat-card info">
          <span class="stat-icon">📈</span>
          <div class="stat-label">Lucro Estimado</div>
          <div class="stat-value"><span class="stat-prefix">MZN</span> ${Formulas.formatarNumero(lucroDia)}</div>
          <div class="stat-change positive">Margem ativa</div>
        </div>
        <div class="stat-card warning">
          <span class="stat-icon">⛽</span>
          <div class="stat-label">Litros Vendidos</div>
          <div class="stat-value">${Formulas.formatarNumero(litrosAbast)} <small>L</small></div>
          <div class="stat-change">${abastecimentos.length} abastecimentos</div>
        </div>
        <div class="stat-card danger">
          <span class="stat-icon">⚠️</span>
          <div class="stat-label">Alertas Stock</div>
          <div class="stat-value">${stockBaixo.length + tanquesBaixo.length}</div>
          <div class="stat-change negative">${stockBaixo.length} produtos · ${tanquesBaixo.length} tanques</div>
        </div>
      `;

      // Gráfico de vendas por hora
      this.renderChartVendasHora(vendas, abastecimentos);

      // Tabela de últimas vendas
      this.renderUltimasVendas(vendas.slice(0, 5));

      // Alertas
      this.renderAlertas(stockBaixo, tanquesBaixo);

      // Previsão (gestor only)
      const historicoLucros = await this.getHistoricoLucros(7);
      const previsao = Formulas.previsaoGanhos(historicoLucros);
      U.el('#dash-previsao').innerHTML = `
        <div class="stat-card" style="margin-top:1rem;">
          <span class="stat-icon">🔮</span>
          <div class="stat-label">Previsão de Ganhos (próximos 7 dias)</div>
          <div class="stat-value"><span class="stat-prefix">MZN</span> ${Formulas.formatarNumero(previsao)} <small style="font-size:0.875rem;font-weight:400;color:var(--text-light)">/dia</small></div>
          <div class="stat-change positive">Média baseada nos últimos 7 dias</div>
        </div>
      `;
    } catch (e) {
      console.error('Dashboard error:', e);
      U.el('#dash-stats').innerHTML = '<div class="alert alert-danger">Erro ao carregar dashboard.</div>';
    }
  }

  renderChartVendasHora(vendas, abastecimentos) {
    // Agrupar por hora
    const horas = {};
    for (let i = 6; i <= 22; i++) horas[i] = { hora: i, vendas: 0, abast: 0 };

    vendas.forEach(v => {
      const h = new Date(v.data_hora).getHours();
      if (horas[h]) horas[h].vendas += v.valor_total || 0;
    });
    abastecimentos.forEach(a => {
      const h = new Date(a.data_hora).getHours();
      if (horas[h]) horas[h].abast += a.valor_total || 0;
    });

    const dados = Object.values(horas);
    const maxVal = Math.max(...dados.map(d => d.vendas + d.abast), 1);

    U.el('#dash-chart-vendas').innerHTML = `
      <div class="chart-header">
        <span class="chart-title">📊 Vendas por Hora</span>
        <span style="font-size:0.75rem;color:var(--text-light);">Hoje</span>
      </div>
      <div class="css-chart" style="height:220px;">
        ${dados.map(d => {
          const pctV = (d.vendas / maxVal * 100);
          const pctA = (d.abast / maxVal * 100);
          return `
            <div class="css-chart-bar">
              <div style="display:flex;flex-direction:column;align-items:center;width:100%;gap:1px;">
                <div style="width:100%;max-width:24px;background:var(--primary);border-radius:3px 3px 0 0;transition:height 0.5s;" title="Loja: MZN ${Formulas.formatarNumero(d.vendas)}"
                  onmouseenter="this.style.opacity='0.8'" onmouseleave="this.style.opacity='1'"
                  style="height:${Math.max(pctV * 2, 4)}px;background:var(--primary);"></div>
                <div style="width:100%;max-width:24px;background:var(--warning);border-radius:0;transition:height 0.5s;" title="Combustível: MZN ${Formulas.formatarNumero(d.abast)}"
                  style="height:${Math.max(pctA * 2, 4)}px;background:var(--warning);"></div>
              </div>
              <span class="css-chart-bar-label">${d.hora}h</span>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:1rem;justify-content:center;margin-top:0.75rem;font-size:0.75rem;">
        <span style="display:flex;align-items:center;gap:0.375rem;"><span style="width:12px;height:12px;background:var(--primary);border-radius:2px;display:inline-block;"></span> Loja</span>
        <span style="display:flex;align-items:center;gap:0.375rem;"><span style="width:12px;height:12px;background:var(--warning);border-radius:2px;display:inline-block;"></span> Combustível</span>
      </div>
    `;
  }

  renderUltimasVendas(vendas) {
    if (vendas.length === 0) {
      U.el('#dash-ultimas-vendas').innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Nenhuma venda hoje.</p>';
      return;
    }
    U.el('#dash-ultimas-vendas').innerHTML = `
      <table>
        <thead><tr><th>Hora</th><th>Produto</th><th>Qtd</th><th>Total</th><th>Pagamento</th></tr></thead>
        <tbody>
          ${vendas.map(v => `
            <tr>
              <td>${new Date(v.data_hora).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>${U.esc(v.produto_nome || 'Produto')}</td>
              <td>${v.quantidade}</td>
              <td style="font-weight:700;">${U.formatMZN(v.valor_total)}</td>
              <td><span class="badge badge-${v.tipo_pagamento === 'dinheiro' ? 'success' : v.tipo_pagamento === 'mpesa' ? 'primary' : 'info'}">${v.tipo_pagamento}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  renderAlertas(stockBaixo, tanquesBaixo) {
    let html = '';
    stockBaixo.slice(0, 5).forEach(p => {
      html += `<div class="alert alert-warning" style="padding:0.625rem 1rem;font-size:0.8125rem;margin-bottom:0.5rem;">
        ⚠️ <strong>${U.esc(p.nome)}</strong> - Stock loja: ${p.stock_loja || 0} (mín: ${p.stock_minimo || 5})
      </div>`;
    });
    tanquesBaixo.slice(0, 3).forEach(t => {
      html += `<div class="alert alert-danger" style="padding:0.625rem 1rem;font-size:0.8125rem;margin-bottom:0.5rem;">
        ⛽ <strong>${U.esc(t.tipo_combustivel)}</strong> - ${Formulas.formatarLitros(t.stock_atual_litros || 0)} restantes (alerta: ${Formulas.formatarLitros(t.nivel_minimo_alerta || 500)})
      </div>`;
    });
    U.el('#dash-alertas').innerHTML = html || '<p style="color:var(--text-light);text-align:center;">Nenhum alerta. Tudo em ordem!</p>';
  }

  async getHistoricoLucros(dias) {
    const lucros = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const de = d.toISOString().split('T')[0];
      const ate = new Date(d.getTime() + 86400000).toISOString().split('T')[0];
      const vendas = await db.getVendas({ bombaId: this.bombaAtual, de, ate });
      const abast = await db.getAbastecimentos({ bombaId: this.bombaAtual, de, ate });
      lucros.push(U.sumBy(vendas, 'lucro_total') + U.sumBy(abast, 'lucro_total'));
    }
    return lucros;
  }

  // ===== COMBUSTÍVEL =====
  async carregarCombustivel() {
    if (!this.bombaAtual) {
      U.el('#comb-conteudo').innerHTML = '<div class="alert alert-info">Selecione um posto.</div>';
      return;
    }

    const tanques = await db.getTanques(this.bombaAtual);
    const abastecimentos = await db.getAbastecimentos({ bombaId: this.bombaAtual });

    // Cards de tanques
    let html = '<div class="bomba-grid" style="margin-bottom:1.5rem;">';
    tanques.forEach(t => {
      const pct = Math.min(100, ((t.stock_atual_litros || 0) / (t.capacidade_litros || 1)) * 100);
      const status = pct <= 15 ? 'danger' : pct <= 30 ? 'warning' : 'ok';
      const cor = t.tipo_combustivel === 'gasolina' ? 'var(--gasolina)' : t.tipo_combustivel === 'gasoleo' ? 'var(--gasoleo)' : 'var(--petroleo)';

      html += `
        <div class="bomba-card">
          <div class="bomba-card-header">
            <span class="bomba-icon" style="color:${cor};">⛽</span>
            <div>
              <div class="bomba-name">${U.esc(t.tipo_combustivel).toUpperCase()}</div>
              <div style="font-size:0.75rem;color:var(--text-light);">Cap: ${Formulas.formatarLitros(t.capacidade_litros)}</div>
            </div>
          </div>
          <div class="tanque-visual">
            <div class="tanque-tubo">
              <div class="tanque-tubo-fill" style="height:${pct}%;background:${cor};"></div>
              <div class="tanque-tubo-label">${Math.round(pct)}%</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem;">
            <span style="font-size:0.875rem;">${Formulas.formatarLitros(t.stock_atual_litros || 0)}</span>
            <span class="stock-status ${status}"><span class="dot"></span>${status === 'ok' ? 'OK' : status === 'warning' ? 'Baixo' : 'Crítico'}</span>
          </div>
          <div class="bomba-preco">${U.formatMZN(t.preco_litro)}<small style="font-size:0.75rem;font-weight:400;">/L</small></div>
          <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
            <button class="btn btn-primary btn-sm w-100" onclick="app.abrirAbastecimento('${t.id}')">🚗 Abastecer</button>
            <button class="btn btn-secondary btn-sm" onclick="app.abrirEntradaCisterna('${t.id}')">📥 Entrada</button>
          </div>
        </div>
      `;
    });
    html += '</div>';

    // Tabela de abastecimentos recentes
    html += `
      <div class="card">
        <div class="card-header">
          <h3>🕐 Abastecimentos Recentes</h3>
          <button class="btn btn-sm btn-secondary" onclick="historicoManager.mostrar('abastecimentos')">📋 Histórico</button>
        </div>
        <div class="card-body" style="padding:0;">
          <div class="table-container">
            <table>
              <thead><tr><th>Data</th><th>Combustível</th><th>Litros</th><th>Preço/L</th><th>Total</th><th>Pagamento</th><th>Cliente</th></tr></thead>
              <tbody>
                ${abastecimentos.slice(0, 20).map(a => {
                  const t = tanques.find(tan => tan.id === a.tanque_id);
                  return `<tr>
                    <td>${Formulas.formatarDataHora(a.data_hora)}</td>
                    <td><span style="color:${t?.tipo_combustivel === 'gasolina' ? 'var(--gasolina)' : t?.tipo_combustivel === 'gasoleo' ? 'var(--gasoleo)' : 'var(--petroleo)'};font-weight:700;">${U.esc(t?.tipo_combustivel || 'N/A').toUpperCase()}</span></td>
                    <td>${Formulas.formatarNumero(a.litros)} L</td>
                    <td>${U.formatMZN(a.preco_litro)}</td>
                    <td style="font-weight:700;">${U.formatMZN(a.valor_total)}</td>
                    <td><span class="badge badge-${a.tipo_pagamento === 'dinheiro' ? 'success' : a.tipo_pagamento === 'mpesa' ? 'primary' : a.tipo_pagamento === 'divida' ? 'danger' : 'info'}">${a.tipo_pagamento}</span></td>
                    <td>${U.esc(a.cliente_nome || 'N/D')}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    U.el('#comb-conteudo').innerHTML = html;
  }

  abrirAbastecimento(tanqueId) {
    const tanque = db.getTanque(tanqueId);
    const modal = U.modal({
      title: '⛽ Novo Abastecimento',
      body: `
        <form id="form-abastecimento" class="form-row">
          <input type="hidden" id="ab-tanque-id" value="${tanqueId}">
          <div class="form-group">
            <label>Litros *</label>
            <input type="number" id="ab-litros" step="0.01" min="0.1" required placeholder="Ex: 25.5">
          </div>
          <div class="form-group">
            <label>Preço/Litro (MZN)</label>
            <input type="number" id="ab-preco" step="0.01" min="0" placeholder="Preço atual" ${auth.podeVerCustos() ? '' : 'readonly'}>
          </div>
          <div class="form-group">
            <label>Tipo de Pagamento *</label>
            <select id="ab-pagamento" required>
              <option value="dinheiro">💵 Dinheiro</option>
              <option value="mpesa">📱 M-Pesa</option>
              <option value="emola">📱 E-Mola</option>
              <option value="cartao">💳 Cartão</option>
              <option value="divida">📋 Dívida</option>
            </select>
          </div>
          <div class="form-group">
            <label>Cliente (opcional)</label>
            <input type="text" id="ab-cliente" placeholder="Nome do cliente">
          </div>
          <div class="form-group">
            <label>Contacto</label>
            <input type="text" id="ab-contacto" placeholder="+258..."></div>
          <div class="form-group">
            <label>Matrícula</label>
            <input type="text" id="ab-matricula" placeholder="ABC-123-MZ">
          </div>
          <div class="form-group">
            <label>KM Atual</label>
            <input type="number" id="ab-km" placeholder="KM do carro">
          </div>
          <div class="form-group">
            <label>Turno</label>
            <select id="ab-turno">
              <option value="manha" ${this.turnoAtual === 'manha' ? 'selected' : ''}>Manhã</option>
              <option value="tarde" ${this.turnoAtual === 'tarde' ? 'selected' : ''}>Tarde</option>
              <option value="noite" ${this.turnoAtual === 'noite' ? 'selected' : ''}>Noite</option>
            </select>
          </div>
        </form>
        <div id="ab-total-preview" style="margin-top:1rem;padding:1rem;background:var(--primary-light);border-radius:var(--radius);text-align:center;font-size:1.25rem;font-weight:700;color:var(--primary);">
          Total: MZN 0,00
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').querySelector('.modal-close').click()">Cancelar</button>
        <button class="btn btn-primary" onclick="app.salvarAbastecimento(this)">💾 Guardar</button>
      `
    });

    // Auto-calcular total
    const calcTotal = () => {
      const l = parseFloat(U.el('#ab-litros').value) || 0;
      const p = parseFloat(U.el('#ab-preco').value) || 0;
      U.el('#ab-total-preview').textContent = `Total: ${U.formatMZN(l * p)}`;
    };
    U.on(U.el('#ab-litros'), 'input', calcTotal);
    U.on(U.el('#ab-preco'), 'input', calcTotal);
  }

  async salvarAbastecimento(btn) {
    const litros = parseFloat(U.el('#ab-litros').value);
    if (!litros || litros <= 0) { U.alert('Informe os litros', 'warning'); return; }

    btn.disabled = true;
    try {
      const tanqueId = U.el('#ab-tanque-id').value;
      const tanque = await db.getTanque(tanqueId);
      const preco = parseFloat(U.el('#ab-preco').value) || tanque?.preco_litro || 0;

      const ab = {
        bomba_id: this.bombaAtual,
        tanque_id: tanqueId,
        perfil_id: auth.perfilId,
        litros,
        preco_litro: preco,
        preco_custo_litro: auth.podeVerCustos() ? (await db.getCMP(tanqueId))?.custo_medio_litro : null,
        tipo_pagamento: U.el('#ab-pagamento').value,
        cliente_nome: U.el('#ab-cliente').value || null,
        cliente_contacto: U.el('#ab-contacto').value || null,
        matricula: U.el('#ab-matricula').value || null,
        km_atual: U.el('#ab-km').value ? parseFloat(U.el('#ab-km').value) : null,
        turno: U.el('#ab-turno').value,
        data_hora: new Date().toISOString()
      };

      await db.saveAbastecimento(ab);
      await historicoManager.registrar('abastecimento', 'abastecimentos', ab.id, null, ab);
      U.alert('Abastecimento registado com sucesso!', 'success');
      U.el('.modal-close').click();
      this.carregarCombustivel();
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    } finally {
      btn.disabled = false;
    }
  }

  abrirEntradaCisterna(tanqueId) {
    U.modal({
      title: '📥 Entrada de Cisterna',
      body: `
        <form id="form-entrada" class="form-row">
          <input type="hidden" id="ent-tanque-id" value="${tanqueId}">
          <div class="form-group">
            <label>Fornecedor *</label>
            <input type="text" id="ent-fornecedor" required placeholder="Nome do fornecedor">
          </div>
          <div class="form-group">
            <label>Nota Fiscal</label>
            <input type="text" id="ent-nota" placeholder="Nº da nota">
          </div>
          <div class="form-group">
            <label>Litros *</label>
            <input type="number" id="ent-litros" step="0.01" min="0.1" required placeholder="Quantidade em litros">
          </div>
          <div class="form-group">
            <label>Preço Custo/Litro (MZN) *</label>
            <input type="number" id="ent-custo" step="0.01" min="0" required placeholder="Preço de compra">
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').querySelector('.modal-close').click()">Cancelar</button>
        <button class="btn btn-primary" onclick="app.salvarEntrada(this)">📥 Registar Entrada</button>
      `
    });
  }

  async salvarEntrada(btn) {
    const litros = parseFloat(U.el('#ent-litros').value);
    const custo = parseFloat(U.el('#ent-custo').value);
    if (!litros || !custo) { U.alert('Preencha todos os campos obrigatórios', 'warning'); return; }

    btn.disabled = true;
    try {
      const entrada = {
        bomba_id: this.bombaAtual,
        tanque_id: U.el('#ent-tanque-id').value,
        perfil_id: auth.perfilId,
        fornecedor: U.el('#ent-fornecedor').value,
        nota_fiscal: U.el('#ent-nota').value || null,
        litros,
        preco_custo_litro: custo,
        data_entrada: new Date().toISOString()
      };

      await db.saveEntrada(entrada);
      await historicoManager.registrar('entrada', 'entradas_combustivel', entrada.id, null, entrada);
      U.alert('Entrada registada! Custo médio actualizado.', 'success');
      U.el('.modal-close').click();
      this.carregarCombustivel();
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    } finally {
      btn.disabled = false;
    }
  }

  // ===== LOJA (Vendas) =====
  async carregarLoja() {
    if (!this.bombaAtual) {
      U.el('#loja-conteudo').innerHTML = '<div class="alert alert-info">Selecione um posto.</div>';
      return;
    }

    const produtos = await db.getProdutos(this.bombaAtual);
    const vendasHoje = await db.getVendas({ bombaId: this.bombaAtual, de: U.hoje(), ate: new Date(Date.now() + 86400000).toISOString().split('T')[0] });

    // Stats
    const totalHoje = U.sumBy(vendasHoje, 'valor_total');
    const lucroHoje = U.sumBy(vendasHoje, 'lucro_total');

    let html = `
      <div class="grid-2" style="margin-bottom:1.5rem;">
        <div class="card">
          <div class="card-header"><h3>🛒 Nova Venda #${this.vendaAtual}</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label>Produto *</label>
              <select id="venda-produto" class="w-100" onchange="app.onProdutoChange(this)">
                <option value="">Selecionar produto...</option>
                ${produtos.filter(p => (p.stock_loja || 0) > 0).map(p =>
                  `<option value="${p.id}" data-preco="${p.preco_venda}" data-stock="${p.stock_loja}" data-custo="${p.preco_custo || 0}">${U.esc(p.nome)} - ${U.formatMZN(p.preco_venda)} (stock: ${p.stock_loja})</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Quantidade *</label>
                <input type="number" id="venda-qtd" min="1" value="1" oninput="app.atualizarTotalVenda()">
              </div>
              <div class="form-group">
                <label>Preço Unitário (MZN)</label>
                <input type="number" id="venda-preco" step="0.01" readonly>
              </div>
            </div>
            <div class="form-group">
              <label>Tipo de Pagamento *</label>
              <div class="pagamento-grid">
                <div class="pagamento-btn active" data-value="dinheiro" onclick="app.selecionarPagamento(this)">💵 Dinheiro</div>
                <div class="pagamento-btn" data-value="mpesa" onclick="app.selecionarPagamento(this)">📱 M-Pesa</div>
                <div class="pagamento-btn" data-value="emola" onclick="app.selecionarPagamento(this)">📱 E-Mola</div>
                <div class="pagamento-btn" data-value="cartao" onclick="app.selecionarPagamento(this)">💳 Cartão</div>
                <div class="pagamento-btn" data-value="divida" onclick="app.selecionarPagamento(this)">📋 Dívida</div>
              </div>
            </div>
            <div style="margin-top:1rem;padding:1rem;background:var(--primary-light);border-radius:var(--radius);display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:1rem;font-weight:700;color:var(--primary);">Total:</span>
              <span id="venda-total" style="font-size:1.5rem;font-weight:800;color:var(--primary);">MZN 0,00</span>
            </div>
            <div style="display:flex;gap:0.75rem;margin-top:1rem;">
              <button class="btn btn-success btn-lg w-100" onclick="app.guardarContinuar()">✓ Guardar e Continuar</button>
            </div>
          </div>
        </div>

        <div>
          <div class="card" style="margin-bottom:1rem;">
            <div class="card-body" style="display:flex;gap:1rem;flex-wrap:wrap;">
              <div style="flex:1;min-width:120px;text-align:center;">
                <div style="font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;font-weight:600;">Vendas Hoje</div>
                <div style="font-size:1.5rem;font-weight:800;">${vendasHoje.length}</div>
              </div>
              <div style="flex:1;min-width:120px;text-align:center;">
                <div style="font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;font-weight:600;">Total Hoje</div>
                <div style="font-size:1.5rem;font-weight:800;color:var(--primary);">${U.formatMZN(totalHoje)}</div>
              </div>
              ${auth.podeVerLucros() ? `
              <div style="flex:1;min-width:120px;text-align:center;">
                <div style="font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;font-weight:600;">Lucro Hoje</div>
                <div style="font-size:1.5rem;font-weight:800;color:var(--secondary);">${U.formatMZN(lucroHoje)}</div>
              </div>` : ''}
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>🕐 Vendas Recentes</h3></div>
            <div class="card-body" style="padding:0;max-height:350px;overflow-y:auto;">
              ${vendasHoje.slice(0, 15).length ? `
                <table style="font-size:0.8125rem;">
                  <thead><tr><th>Hora</th><th>Produto</th><th>Qtd</th><th>Total</th></tr></thead>
                  <tbody>
                    ${vendasHoje.slice(0, 15).map(v => `
                      <tr>
                        <td>${new Date(v.data_hora).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>${U.esc(v.produto_nome || 'Produto')}</td>
                        <td>${v.quantidade}</td>
                        <td style="font-weight:700;">${U.formatMZN(v.valor_total)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<p style="padding:1rem;text-align:center;color:var(--text-light);">Nenhuma venda hoje.</p>'}
            </div>
          </div>
        </div>
      </div>
    `;

    U.el('#loja-conteudo').innerHTML = html;
    this.vendaPagamento = 'dinheiro';
  }

  onProdutoChange(select) {
    const opt = select.selectedOptions[0];
    if (!opt || !opt.value) {
      U.el('#venda-preco').value = '';
      U.el('#venda-total').textContent = 'MZN 0,00';
      return;
    }
    const preco = parseFloat(opt.dataset.preco) || 0;
    U.el('#venda-preco').value = preco;
    this.atualizarTotalVenda();
  }

  selecionarPagamento(el) {
    U.els('.pagamento-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    this.vendaPagamento = el.dataset.value;
  }

  atualizarTotalVenda() {
    const preco = parseFloat(U.el('#venda-preco')?.value) || 0;
    const qtd = parseInt(U.el('#venda-qtd')?.value) || 0;
    U.el('#venda-total').textContent = U.formatMZN(preco * qtd);
  }

  async guardarContinuar() {
    const produtoId = U.el('#venda-produto').value;
    const qtd = parseInt(U.el('#venda-qtd').value);
    const preco = parseFloat(U.el('#venda-preco').value);

    if (!produtoId) { U.alert('Selecione um produto', 'warning'); return; }
    if (!qtd || qtd <= 0) { U.alert('Quantidade inválida', 'warning'); return; }

    try {
      const opt = U.el('#venda-produto').selectedOptions[0];
      const custo = parseFloat(opt.dataset.custo) || 0;
      const nome = opt.text.split(' - ')[0];

      const venda = {
        bomba_id: this.bombaAtual,
        perfil_id: auth.perfilId,
        produto_id: produtoId,
        quantidade: qtd,
        preco_unitario: preco,
        preco_custo_unitario: custo,
        tipo_pagamento: this.vendaPagamento,
        data_hora: new Date().toISOString(),
        produto_nome: nome
      };

      await db.saveVenda(venda);
      await historicoManager.registrar('venda', 'vendas_loja', venda.id, null, venda);

      // Mostrar sucesso e reset
      this.vendaAtual++;
      U.alert(`Venda #${this.vendaAtual - 1} guardada com sucesso!`, 'success');

      // Recarregar seção
      this.carregarLoja();

      // Focar no produto
      setTimeout(() => U.el('#venda-produto')?.focus(), 100);
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    }
  }

  // ===== ARMAZÉM =====
  async carregarArmazem() {
    if (!this.bombaAtual) {
      U.el('#arm-conteudo').innerHTML = '<div class="alert alert-info">Selecione um posto.</div>';
      return;
    }

    const produtos = await db.getProdutos(this.bombaAtual);

    let html = `
      <div class="tabs">
        <button class="tab active" onclick="app.mostrarTabArmazem(this, 'arm-stock')">📦 Stock</button>
        <button class="tab" onclick="app.mostrarTabArmazem(this, 'arm-entrada')">📥 Entrada</button>
        <button class="tab" onclick="app.mostrarTabArmazem(this, 'arm-transfer')">↔️ Transferir</button>
        <button class="tab" onclick="app.mostrarTabArmazem(this, 'arm-novo')">➕ Novo Produto</button>
      </div>

      <!-- Stock -->
      <div id="arm-stock" class="tab-panel active">
        <div class="filter-bar">
          <div class="search-box" style="flex:1;">
            <span class="search-icon">🔍</span>
            <input type="text" id="arm-search" placeholder="Pesquisar produto..." oninput="app.filtrarArmazem()">
          </div>
          <select id="arm-filtro-local" onchange="app.filtrarArmazem()">
            <option value="">Todas localizações</option>
            <option value="loja">Loja</option>
            <option value="armazem">Armazém</option>
          </select>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Código</th><th>Nome</th><th>Categoria</th><th>Stock Loja</th><th>Stock Armazém</th><th>Stock Total</th><th>Status</th><th>Preço Venda</th></tr></thead>
            <tbody id="arm-tbody">
              ${produtos.map(p => {
                const status = Formulas.stockStatus(p.stock_loja + p.stock_armazem, p.stock_minimo || 5);
                return `<tr data-nome="${U.esc(p.nome).toLowerCase()}" data-local="${p.localizacao || 'ambos'}">
                  <td><code>${U.esc(p.codigo || '-')}</code></td>
                  <td><strong>${U.esc(p.nome)}</strong></td>
                  <td>${U.esc(p.categoria || '-')}</td>
                  <td style="text-align:center;font-weight:700;">${p.stock_loja || 0}</td>
                  <td style="text-align:center;font-weight:700;">${p.stock_armazem || 0}</td>
                  <td style="text-align:center;font-weight:800;">${(p.stock_loja || 0) + (p.stock_armazem || 0)}</td>
                  <td><span class="stock-status ${status}"><span class="dot"></span>${status === 'ok' ? 'OK' : status === 'baixo' ? 'Baixo' : 'Crítico'}</span></td>
                  <td style="font-weight:700;">${U.formatMZN(p.preco_venda)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Entrada -->
      <div id="arm-entrada" class="tab-panel">
        <div class="card" style="max-width:600px;">
          <div class="card-body">
            <form id="form-entrada-stock" class="form-row">
              <div class="form-group">
                <label>Produto *</label>
                <select id="ent-stock-produto" required>
                  <option value="">Selecionar...</option>
                  ${produtos.map(p => `<option value="${p.id}">${U.esc(p.nome)} (loja:${p.stock_loja || 0} arm:${p.stock_armazem || 0})</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Quantidade *</label>
                <input type="number" id="ent-stock-qtd" min="1" required placeholder="Unidades">
              </div>
              <div class="form-group">
                <label>Preço Custo Unitário (MZN)</label>
                <input type="number" id="ent-stock-custo" step="0.01" min="0" placeholder="Preço de compra">
              </div>
              <div class="form-group">
                <label>Destino *</label>
                <select id="ent-stock-destino" required>
                  <option value="armazem">Armazém</option>
                  <option value="loja">Loja (direto)</option>
                </select>
              </div>
              <div class="form-group" style="grid-column:1/-1;">
                <label>Fornecedor / Motivo</label>
                <input type="text" id="ent-stock-fornecedor" placeholder="Nome do fornecedor ou motivo">
              </div>
            </form>
            <button class="btn btn-primary w-100" style="margin-top:1rem;" onclick="app.salvarEntradaStock()">📥 Registar Entrada</button>
          </div>
        </div>
      </div>

      <!-- Transferência -->
      <div id="arm-transfer" class="tab-panel">
        <div class="card" style="max-width:600px;">
          <div class="card-body">
            <form id="form-transfer" class="form-row">
              <div class="form-group">
                <label>Produto *</label>
                <select id="trans-produto" required onchange="app.mostrarStockTransfer()">
                  <option value="">Selecionar...</option>
                  ${produtos.filter(p => (p.stock_armazem || 0) > 0 || (p.stock_loja || 0) > 0).map(p =>
                    `<option value="${p.id}" data-loja="${p.stock_loja || 0}" data-armazem="${p.stock_armazem || 0}">${U.esc(p.nome)}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Direção *</label>
                <select id="trans-direcao" required>
                  <option value="armazem-loja">Armazém → Loja</option>
                  <option value="loja-armazem">Loja → Armazém</option>
                </select>
              </div>
              <div class="form-group">
                <label>Quantidade *</label>
                <input type="number" id="trans-qtd" min="1" required placeholder="Unidades">
              </div>
            </form>
            <div id="trans-stock-info" style="margin:1rem 0;padding:0.75rem;background:var(--info-light);border-radius:var(--radius);font-size:0.875rem;display:none;"></div>
            <button class="btn btn-primary w-100" onclick="app.salvarTransferencia()">↔️ Transferir</button>
          </div>
        </div>
      </div>

      <!-- Novo Produto -->
      <div id="arm-novo" class="tab-panel">
        <div class="card" style="max-width:600px;">
          <div class="card-body">
            <form id="form-novo-produto" class="form-row">
              <div class="form-group">
                <label>Código *</label>
                <input type="text" id="novo-codigo" required placeholder="Código único do produto">
              </div>
              <div class="form-group">
                <label>Nome *</label>
                <input type="text" id="novo-nome" required placeholder="Nome do produto">
              </div>
              <div class="form-group">
                <label>Categoria</label>
                <input type="text" id="novo-categoria" placeholder="Ex: Bebidas, Alimentos">
              </div>
              <div class="form-group">
                <label>Preço Custo (MZN)</label>
                <input type="number" id="novo-custo" step="0.01" min="0" placeholder="0,00">
              </div>
              <div class="form-group">
                <label>Preço Venda (MZN) *</label>
                <input type="number" id="novo-preco" step="0.01" min="0.01" required placeholder="0,00">
              </div>
              <div class="form-group">
                <label>% Lucro</label>
                <div class="input-group">
                  <input type="number" id="novo-pct" value="30" min="0" oninput="app.calcularPrecoVenda()">
                  <span class="input-addon">%</span>
                </div>
              </div>
              <div class="form-group">
                <label>Stock Inicial Loja</label>
                <input type="number" id="novo-stock-loja" min="0" value="0" placeholder="0">
              </div>
              <div class="form-group">
                <label>Stock Inicial Armazém</label>
                <input type="number" id="novo-stock-armazem" min="0" value="0" placeholder="0">
              </div>
              <div class="form-group">
                <label>Stock Mínimo</label>
                <input type="number" id="novo-minimo" min="1" value="5" placeholder="5">
              </div>
              <div class="form-group">
                <label>Localização</label>
                <select id="novo-local">
                  <option value="armazem">Armazém</option>
                  <option value="loja">Loja</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
              <div class="form-group">
                <label>Unidade</label>
                <input type="text" id="novo-unidade" value="unidade" placeholder="unidade, kg, litro...">
              </div>
            </form>
            <button class="btn btn-primary w-100" style="margin-top:1rem;" onclick="app.salvarNovoProduto()">➕ Criar Produto</button>
          </div>
        </div>
      </div>
    `;

    U.el('#arm-conteudo').innerHTML = html;
  }

  mostrarTabArmazem(tab, panelId) {
    tab.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    U.els('.tab-panel').forEach(p => p.classList.remove('active'));
    U.el(`#${panelId}`)?.classList.add('active');
  }

  filtrarArmazem() {
    const termo = U.el('#arm-search')?.value.toLowerCase() || '';
    const local = U.el('#arm-filtro-local')?.value || '';
    U.els('#arm-tbody tr').forEach(tr => {
      const matchNome = !termo || tr.dataset.nome.includes(termo);
      const matchLocal = !local || tr.dataset.local === local || tr.dataset.local === 'ambos';
      tr.style.display = matchNome && matchLocal ? '' : 'none';
    });
  }

  mostrarStockTransfer() {
    const opt = U.el('#trans-produto')?.selectedOptions[0];
    const info = U.el('#trans-stock-info');
    if (!opt || !opt.value || !info) { info.style.display = 'none'; return; }
    info.innerHTML = `📦 Stock Loja: <strong>${opt.dataset.loja}</strong> &nbsp;|&nbsp; 🏭 Stock Armazém: <strong>${opt.dataset.armazem}</strong>`;
    info.style.display = 'block';
  }

  calcularPrecoVenda() {
    const custo = parseFloat(U.el('#novo-custo')?.value) || 0;
    const pct = parseFloat(U.el('#novo-pct')?.value) || 0;
    if (custo > 0) {
      U.el('#novo-preco').value = Formulas.precoVendaPorPercentagem(custo, pct);
    }
  }

  async salvarEntradaStock() {
    const produtoId = U.el('#ent-stock-produto').value;
    const qtd = parseInt(U.el('#ent-stock-qtd').value);
    if (!produtoId || !qtd) { U.alert('Preencha todos os campos obrigatórios', 'warning'); return; }

    try {
      const mov = {
        bomba_id: this.bombaAtual,
        perfil_id: auth.perfilId,
        tipo: 'entrada',
        produto_id: produtoId,
        quantidade_unidades: qtd,
        preco_custo: parseFloat(U.el('#ent-stock-custo').value) || 0,
        valor_total: (parseFloat(U.el('#ent-stock-custo').value) || 0) * qtd,
        origem: 'fornecedor',
        destino: U.el('#ent-stock-destino').value,
        motivo: U.el('#ent-stock-fornecedor').value || 'Entrada de stock'
      };

      await db.saveMovimento(mov);
      await historicoManager.registrar('entrada', 'movimentos_stock', mov.id, null, mov);
      U.alert('Entrada registada com sucesso!', 'success');
      this.carregarArmazem();
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    }
  }

  async salvarTransferencia() {
    const produtoId = U.el('#trans-produto').value;
    const qtd = parseInt(U.el('#trans-qtd').value);
    const direcao = U.el('#trans-direcao').value;
    if (!produtoId || !qtd) { U.alert('Preencha todos os campos', 'warning'); return; }

    try {
      const [origem, destino] = direcao.split('-');
      const mov = {
        bomba_id: this.bombaAtual,
        perfil_id: auth.perfilId,
        tipo: 'transferencia',
        produto_id: produtoId,
        quantidade_unidades: qtd,
        origem,
        destino,
        motivo: `Transferência ${origem} → ${destino}`
      };

      await db.saveMovimento(mov);
      await historicoManager.registrar('transferir', 'movimentos_stock', mov.id, null, mov);
      U.alert('Transferência realizada!', 'success');
      this.carregarArmazem();
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    }
  }

  async salvarNovoProduto() {
    const codigo = U.el('#novo-codigo').value.trim();
    const nome = U.el('#novo-nome').value.trim();
    const preco = parseFloat(U.el('#novo-preco').value);

    if (!codigo || !nome || !preco) { U.alert('Preencha todos os campos obrigatórios (*)', 'warning'); return; }

    try {
      // Verificar duplicado
      const existente = await db.getProdutoByCodigo(codigo);
      if (existente) { U.alert('Já existe um produto com este código!', 'danger'); return; }

      const produto = {
        bomba_id: this.bombaAtual,
        codigo,
        nome,
        categoria: U.el('#novo-categoria').value || null,
        preco_custo: parseFloat(U.el('#novo-custo').value) || null,
        preco_venda: preco,
        percentagem_lucro: parseFloat(U.el('#novo-pct').value) || 30,
        stock_loja: parseInt(U.el('#novo-stock-loja').value) || 0,
        stock_armazem: parseInt(U.el('#novo-stock-armazem').value) || 0,
        stock_minimo: parseInt(U.el('#novo-minimo').value) || 5,
        localizacao: U.el('#novo-local').value,
        unidade: U.el('#novo-unidade').value || 'unidade'
      };

      await db.saveProduto(produto);
      await historicoManager.registrar('criar', 'produtos', produto.id, null, produto);
      U.alert('Produto criado com sucesso!', 'success');
      this.carregarArmazem();
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    }
  }

  // ===== MOVIMENTOS =====
  async carregarMovimentos() {
    if (!this.bombaAtual) {
      U.el('#mov-conteudo').innerHTML = '<div class="alert alert-info">Selecione um posto.</div>';
      return;
    }

    const movimentos = await db.getMovimentos({ bombaId: this.bombaAtual });
    const produtos = await db.getProdutos(this.bombaAtual);

    const html = `
      <div class="filter-bar">
        <div class="search-box" style="flex:1;">
          <span class="search-icon">🔍</span>
          <input type="text" id="mov-search" placeholder="Pesquisar..." oninput="app.filtrarMovimentos()">
        </div>
        <select id="mov-filtro-tipo" onchange="app.filtrarMovimentos()">
          <option value="">Todos tipos</option>
          <option value="entrada">📥 Entrada</option>
          <option value="saida">📤 Saída</option>
          <option value="transferencia">↔️ Transferência</option>
          <option value="ajuste">🔧 Ajuste</option>
        </select>
        <button class="btn btn-secondary btn-sm" onclick="U.exportCSV(app.dadosMovimentos, 'movimentos')">📥 CSV</button>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Qtd</th><th>Origem → Destino</th><th>Valor</th><th>Motivo</th></tr></thead>
          <tbody id="mov-tbody">
            ${movimentos.slice(0, 100).map(m => {
              const p = produtos.find(pr => pr.id === m.produto_id);
              const tipoBadge = {
                'entrada': '<span class="badge badge-success">📥 Entrada</span>',
                'saida': '<span class="badge badge-danger">📤 Saída</span>',
                'transferencia': '<span class="badge badge-info">↔️ Transferência</span>',
                'ajuste': '<span class="badge badge-warning">🔧 Ajuste</span>'
              };
              return `<tr data-tipo="${m.tipo}" data-search="${U.esc((p?.nome || '') + ' ' + (m.motivo || '')).toLowerCase()}">
                <td>${Formulas.formatarDataHora(m.data_hora)}</td>
                <td>${tipoBadge[m.tipo] || m.tipo}</td>
                <td>${U.esc(p?.nome || 'N/A')}</td>
                <td style="font-weight:700;">${m.quantidade_unidades || m.quantidade_litros || '-'}</td>
                <td>${m.origem || '-'} → ${m.destino || '-'}</td>
                <td>${m.valor_total ? U.formatMZN(m.valor_total) : '-'}</td>
                <td>${U.esc(m.motivo || '-')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.dadosMovimentos = movimentos;
    U.el('#mov-conteudo').innerHTML = html;
  }

  filtrarMovimentos() {
    const termo = U.el('#mov-search')?.value.toLowerCase() || '';
    const tipo = U.el('#mov-filtro-tipo')?.value || '';
    U.els('#mov-tbody tr').forEach(tr => {
      const matchTermo = !termo || tr.dataset.search.includes(termo);
      const matchTipo = !tipo || tr.dataset.tipo === tipo;
      tr.style.display = matchTermo && matchTipo ? '' : 'none';
    });
  }

  // ===== INVENTÁRIO =====
  async carregarInventario() {
    if (!this.bombaAtual) {
      U.el('#inv-conteudo').innerHTML = '<div class="alert alert-info">Selecione um posto.</div>';
      return;
    }

    const produtos = await db.getProdutos(this.bombaAtual);
    const tanques = await db.getTanques(this.bombaAtual);
    const inventarios = await db.getInventarios({ bombaId: this.bombaAtual });

    let html = `
      <div class="tabs">
        <button class="tab active" onclick="app.mostrarTabInv(this, 'inv-geral')">📋 Geral</button>
        <button class="tab" onclick="app.mostrarTabInv(this, 'inv-tanques')">⛽ Tanques</button>
        <button class="tab" onclick="app.mostrarTabInv(this, 'inv-historico')">📜 Histórico</button>
      </div>

      <!-- Inventário Geral -->
      <div id="inv-geral" class="tab-panel active">
        <div class="filter-bar">
          <div class="search-box" style="flex:1;">
            <span class="search-icon">🔍</span>
            <input type="text" id="inv-search" placeholder="Pesquisar produto..." oninput="app.filtrarInventario()">
          </div>
          <select id="inv-filtro-cat" onchange="app.filtrarInventario()">
            <option value="">Todas categorias</option>
            ${[...new Set(produtos.map(p => p.categoria).filter(Boolean))].map(c => `<option value="${U.esc(c)}">${U.esc(c)}</option>`).join('')}
          </select>
          <select id="inv-filtro-status" onchange="app.filtrarInventario()">
            <option value="">Todos status</option>
            <option value="ok">✅ OK</option>
            <option value="baixo">⚠️ Baixo</option>
            <option value="critico">🔴 Crítico</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="U.exportCSV(app.dadosInventario, 'inventario_geral')">📥 CSV</button>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Loja</th><th>Armazém</th><th>Total</th><th>Mínimo</th><th>Status</th><th>Preço Venda</th></tr></thead>
            <tbody id="inv-tbody">
              ${produtos.map(p => {
                const total = (p.stock_loja || 0) + (p.stock_armazem || 0);
                const status = Formulas.stockStatus(total, p.stock_minimo || 5);
                return `<tr data-nome="${U.esc(p.nome).toLowerCase()}" data-cat="${U.esc(p.categoria || '')}" data-status="${status}">
                  <td><code>${U.esc(p.codigo || '-')}</code></td>
                  <td><strong>${U.esc(p.nome)}</strong></td>
                  <td>${U.esc(p.categoria || '-')}</td>
                  <td style="text-align:center;font-weight:600;">${p.stock_loja || 0}</td>
                  <td style="text-align:center;font-weight:600;">${p.stock_armazem || 0}</td>
                  <td style="text-align:center;font-weight:800;">${total}</td>
                  <td style="text-align:center;">${p.stock_minimo || 5}</td>
                  <td><span class="stock-status ${status}"><span class="dot"></span>${status === 'ok' ? 'OK' : status === 'baixo' ? 'Baixo' : 'Crítico'}</span></td>
                  <td style="font-weight:700;">${U.formatMZN(p.preco_venda)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top:1rem;display:flex;gap:1rem;flex-wrap:wrap;font-size:0.8125rem;color:var(--text-secondary);">
          <span>✅ OK</span>
          <span>⚠️ Baixo</span>
          <span>🔴 Crítico</span>
          <span style="margin-left:auto;">${produtos.length} produtos</span>
        </div>
      </div>

      <!-- Inventário Tanques -->
      <div id="inv-tanques" class="tab-panel">
        <div class="bomba-grid">
          ${tanques.map(t => {
            const pct = Math.min(100, ((t.stock_atual_litros || 0) / (t.capacidade_litros || 1)) * 100);
            return `
              <div class="bomba-card">
                <div class="bomba-card-header">
                  <span class="bomba-icon">⛽</span>
                  <div>
                    <div class="bomba-name">${U.esc(t.tipo_combustivel).toUpperCase()}</div>
                    <div style="font-size:0.75rem;color:var(--text-light);">Capacidade: ${Formulas.formatarLitros(t.capacidade_litros)}</div>
                  </div>
                </div>
                <div class="tanque-visual">
                  <div class="tanque-tubo">
                    <div class="tanque-tubo-fill" style="height:${pct}%;"></div>
                    <div class="tanque-tubo-label">${Math.round(pct)}%</div>
                  </div>
                </div>
                <div style="margin-top:0.75rem;">
                  <div style="display:flex;justify-content:space-between;font-size:0.8125rem;margin-bottom:0.25rem;">
                    <span>Stock atual:</span>
                    <strong>${Formulas.formatarLitros(t.stock_atual_litros || 0)}</strong>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:0.8125rem;margin-bottom:0.25rem;">
                    <span>Preço venda:</span>
                    <strong>${U.formatMZN(t.preco_litro)}/L</strong>
                  </div>
                  ${auth.podeVerCustos() ? `
                  <div style="display:flex;justify-content:space-between;font-size:0.8125rem;color:var(--text-secondary);">
                    <span>Custo médio:</span>
                    <span>Ver relatórios</span>
                  </div>` : ''}
                </div>
                <button class="btn btn-sm btn-secondary w-100" style="margin-top:0.75rem;" onclick="app.inventariarTanque('${t.id}')">📋 Inventariar</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Histórico Inventários -->
      <div id="inv-historico" class="tab-panel">
        <div class="table-container">
          <table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Status</th><th>Valor Esperado</th><th>Valor Contado</th><th>Diferença</th><th>%</th></tr></thead>
            <tbody>
              ${inventarios.slice(0, 30).map(i => `
                <tr>
                  <td>${Formulas.formatarDataHora(i.data_inventario)}</td>
                  <td><span class="badge badge-info">${U.esc(i.tipo)}</span></td>
                  <td><span class="badge badge-${i.status === 'finalizado' ? 'success' : i.status === 'divergencia' ? 'warning' : 'primary'}">${U.esc(i.status)}</span></td>
                  <td>${U.formatMZN(i.valor_esperado)}</td>
                  <td>${U.formatMZN(i.valor_contado)}</td>
                  <td style="color:${(i.diferenca_valor || 0) < 0 ? 'var(--danger)' : (i.diferenca_valor || 0) > 0 ? 'var(--secondary)' : 'inherit'};font-weight:700;">${U.formatMZN(i.diferenca_valor)}</td>
                  <td>${Formulas.formatarNumero(i.diferenca_percentual || 0)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.dadosInventario = produtos.map(p => ({
      codigo: p.codigo, nome: p.nome, categoria: p.categoria,
      stock_loja: p.stock_loja, stock_armazem: p.stock_armazem,
      stock_total: (p.stock_loja || 0) + (p.stock_armazem || 0),
      stock_minimo: p.stock_minimo, preco_venda: p.preco_venda
    }));

    U.el('#inv-conteudo').innerHTML = html;
  }

  mostrarTabInv(tab, panelId) {
    tab.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    U.els('.tab-panel').forEach(p => p.classList.remove('active'));
    U.el(`#${panelId}`)?.classList.add('active');
  }

  filtrarInventario() {
    const termo = U.el('#inv-search')?.value.toLowerCase() || '';
    const cat = U.el('#inv-filtro-cat')?.value || '';
    const status = U.el('#inv-filtro-status')?.value || '';
    U.els('#inv-tbody tr').forEach(tr => {
      const matchTermo = !termo || tr.dataset.nome.includes(termo);
      const matchCat = !cat || tr.dataset.cat === cat;
      const matchStatus = !status || tr.dataset.status === status;
      tr.style.display = matchTermo && matchCat && matchStatus ? '' : 'none';
    });
  }

  async inventariarTanque(tanqueId) {
    const tanque = await db.getTanque(tanqueId);
    U.modal({
      title: `📋 Inventariar ${U.esc(tanque.tipo_combustivel).toUpperCase()}`,
      body: `
        <div style="margin-bottom:1rem;padding:0.75rem;background:var(--info-light);border-radius:var(--radius);font-size:0.875rem;">
          <strong>Stock esperado:</strong> ${Formulas.formatarLitros(tanque.stock_atual_litros || 0)}<br>
          <strong>Capacidade:</strong> ${Formulas.formatarLitros(tanque.capacidade_litros)}
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Altura medida (cm) *</label>
            <input type="number" id="inv-altura" step="0.1" min="0" required placeholder="Medição em cm">
          </div>
          <div class="form-group">
            <label>Litros calculados</label>
            <input type="number" id="inv-litros-calc" readonly placeholder="Auto-calculado">
          </div>
        </div>
        <div class="form-group">
          <label>Observações</label>
          <textarea id="inv-obs" rows="2" placeholder="Justificativa se houver divergência..."></textarea>
        </div>
        <div id="inv-resultado" style="margin-top:0.75rem;padding:0.75rem;border-radius:var(--radius);display:none;font-size:0.875rem;"></div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').querySelector('.modal-close').click()">Cancelar</button>
        <button class="btn btn-primary" onclick="app.salvarInventarioTanque('${tanqueId}')">📋 Guardar</button>
      `
    });

    // Auto-calcular litros
    U.on(U.el('#inv-altura'), 'input', () => {
      const h = parseFloat(U.el('#inv-altura').value) || 0;
      const litros = Formulas.cmParaLitros(tanque, h);
      U.el('#inv-litros-calc').value = litros;
      const esperado = tanque.stock_atual_litros || 0;
      const diff = litros - esperado;
      const pct = Formulas.percentagemDivergencia(esperado, litros);
      const resultado = U.el('#inv-resultado');
      resultado.style.display = 'block';
      if (Math.abs(pct) <= 2) {
        resultado.className = '';
        resultado.style.cssText = 'margin-top:0.75rem;padding:0.75rem;border-radius:var(--radius);display:block;font-size:0.875rem;background:var(--secondary-light);color:#065f46;';
        resultado.innerHTML = `✅ <strong>Dentro da margem</strong> - Diferença: ${Formulas.formatarNumero(diff)}L (${Formulas.formatarNumero(pct)}%)`;
      } else if (Math.abs(pct) <= 5) {
        resultado.className = '';
        resultado.style.cssText = 'margin-top:0.75rem;padding:0.75rem;border-radius:var(--radius);display:block;font-size:0.875rem;background:var(--warning-light);color:#92400e;';
        resultado.innerHTML = `⚠️ <strong>Atenção</strong> - Diferença: ${Formulas.formatarNumero(diff)}L (${Formulas.formatarNumero(pct)}%)`;
      } else {
        resultado.className = '';
        resultado.style.cssText = 'margin-top:0.75rem;padding:0.75rem;border-radius:var(--radius);display:block;font-size:0.875rem;background:var(--danger-light);color:#991b1b;';
        resultado.innerHTML = `🔴 <strong>Divergência!</strong> - Diferença: ${Formulas.formatarNumero(diff)}L (${Formulas.formatarNumero(pct)}%)<br><small>Requer aprovação do gestor.</small>`;
      }
    });
  }

  async salvarInventarioTanque(tanqueId) {
    const litros = parseFloat(U.el('#inv-litros-calc').value);
    if (!litros && litros !== 0) { U.alert('Medição inválida', 'warning'); return; }

    try {
      const tanque = await db.getTanque(tanqueId);
      const inv = {
        bomba_id: this.bombaAtual,
        perfil_id: auth.perfilId,
        tipo: 'tanques',
        status: 'finalizado',
        valor_esperado: tanque.stock_atual_litros || 0,
        valor_contado: litros,
        diferenca_valor: litros - (tanque.stock_atual_litros || 0),
        diferenca_percentual: Formulas.percentagemDivergencia(tanque.stock_atual_litros || 0, litros),
        observacoes: U.el('#inv-obs').value || null,
        data_inventario: new Date().toISOString()
      };

      await db.saveInventario(inv);
      await historicoManager.registrar('inventariar', 'inventarios', inv.id, null, inv);
      U.alert('Inventário registado!', 'success');
      U.el('.modal-close').click();
      this.carregarInventario();
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    }
  }

  // ===== TURNO =====
  async carregarTurno() {
    if (!this.bombaAtual) {
      U.el('#turno-conteudo').innerHTML = '<div class="alert alert-info">Selecione um posto.</div>';
      return;
    }

    const hoje = U.hoje();
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Dados do turno atual
    const vendas = await db.getVendas({ bombaId: this.bombaAtual, de: hoje, ate: amanha });
    const abastecimentos = await db.getAbastecimentos({ bombaId: this.bombaAtual, de: hoje, ate: amanha });

    const porPagamento = {};
    TIPOS_PAGAMENTO.forEach(t => porPagamento[t] = 0);
    vendas.forEach(v => { porPagamento[v.tipo_pagamento] = (porPagamento[v.tipo_pagamento] || 0) + (v.valor_total || 0); });
    abastecimentos.forEach(a => { porPagamento[a.tipo_pagamento] = (porPagamento[a.tipo_pagamento] || 0) + (a.valor_total || 0); });

    const litrosGasolina = U.sumBy(abastecimentos.filter(a => {
      // Simplified - would need to join with tanques
      return true;
    }), 'litros');

    const html = `
      <div class="card" style="max-width:700px;margin:0 auto;">
        <div class="card-header">
          <h3>💰 Fechamento de Turno</h3>
          <span class="turno-badge">${this.turnoAtual.toUpperCase()}</span>
        </div>
        <div class="card-body">
          <div class="turno-resumo" style="margin-bottom:1.5rem;">
            <div class="turno-card">
              <div class="turno-card-label">Total Vendas</div>
              <div class="turno-card-value" style="color:var(--primary);">${U.formatMZN(U.sumBy(vendas, 'valor_total') + U.sumBy(abastecimentos, 'valor_total'))}</div>
            </div>
            <div class="turno-card">
              <div class="turno-card-label">Total Loja</div>
              <div class="turno-card-value">${U.formatMZN(U.sumBy(vendas, 'valor_total'))}</div>
            </div>
            <div class="turno-card">
              <div class="turno-card-label">Total Combustível</div>
              <div class="turno-card-value" style="color:var(--warning);">${U.formatMZN(U.sumBy(abastecimentos, 'valor_total'))}</div>
            </div>
            <div class="turno-card">
              <div class="turno-card-label">Litros</div>
              <div class="turno-card-value">${Formulas.formatarLitros(U.sumBy(abastecimentos, 'litros'))}</div>
            </div>
          </div>

          <h4 style="margin-bottom:0.75rem;font-size:0.9375rem;">Por Tipo de Pagamento</h4>
          ${TIPOS_PAGAMENTO.map(tp => `
            <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);">
              <span style="text-transform:capitalize;">${tp}</span>
              <strong>${U.formatMZN(porPagamento[tp] || 0)}</strong>
            </div>
          `).join('')}

          <div class="form-group" style="margin-top:1.5rem;">
            <label>Dinheiro em Caixa (MZN)</label>
            <input type="number" id="turno-dinheiro" step="0.01" placeholder="Contagem física do dinheiro">
          </div>
          <div class="form-group">
            <label>Diferença de Caixa</label>
            <input type="number" id="turno-diferenca" step="0.01" placeholder="Auto-calculado" readonly>
          </div>
          <div class="form-group">
            <label>Observações</label>
            <textarea id="turno-obs" rows="2" placeholder="Notas sobre o turno..."></textarea>
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-success btn-lg w-100" onclick="app.fecharTurno()">🔒 Fechar Turno</button>
        </div>
      </div>
    `;

    U.el('#turno-conteudo').innerHTML = html;

    // Auto-calcular diferença
    U.on(U.el('#turno-dinheiro'), 'input', () => {
      const esperado = porPagamento['dinheiro'] || 0;
      const real = parseFloat(U.el('#turno-dinheiro').value) || 0;
      U.el('#turno-diferenca').value = (real - esperado).toFixed(2);
    });
  }

  async fecharTurno() {
    try {
      const hoje = U.hoje();
      const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const vendas = await db.getVendas({ bombaId: this.bombaAtual, de: hoje, ate: amanha });
      const abastecimentos = await db.getAbastecimentos({ bombaId: this.bombaAtual, de: hoje, ate: amanha });

      const porPagamento = {};
      TIPOS_PAGAMENTO.forEach(t => porPagamento[t] = 0);
      vendas.forEach(v => { porPagamento[v.tipo_pagamento] = (porPagamento[v.tipo_pagamento] || 0) + (v.valor_total || 0); });
      abastecimentos.forEach(a => { porPagamento[a.tipo_pagamento] = (porPagamento[a.tipo_pagamento] || 0) + (a.valor_total || 0); });

      const fech = {
        bomba_id: this.bombaAtual,
        perfil_id: auth.perfilId,
        turno: this.turnoAtual,
        data_abertura: hoje + 'T00:00:00',
        data_fechamento: new Date().toISOString(),
        litros_gasolina: U.sumBy(abastecimentos.filter(a => a.tipo_combustivel === 'gasolina'), 'litros'),
        litros_gasoleo: U.sumBy(abastecimentos.filter(a => a.tipo_combustivel === 'gasoleo'), 'litros'),
        litros_petroleo: U.sumBy(abastecimentos.filter(a => a.tipo_combustivel === 'petroleo'), 'litros'),
        valor_total_combustivel: U.sumBy(abastecimentos, 'valor_total'),
        lucro_total_combustivel: U.sumBy(abastecimentos, 'lucro_total'),
        valor_total_loja: U.sumBy(vendas, 'valor_total'),
        lucro_total_loja: U.sumBy(vendas, 'lucro_total'),
        total_dinheiro: porPagamento['dinheiro'] || 0,
        total_mpesa: porPagamento['mpesa'] || 0,
        total_emola: porPagamento['emola'] || 0,
        total_cartao: porPagamento['cartao'] || 0,
        total_divida: porPagamento['divida'] || 0,
        dinheiro_em_caixa: parseFloat(U.el('#turno-dinheiro').value) || null,
        diferenca_caixa: parseFloat(U.el('#turno-diferenca').value) || null,
        observacoes: U.el('#turno-obs').value || null
      };

      await db.saveFechamento(fech);
      await historicoManager.registrar('fechar_turno', 'fechamentos_turno', fech.id, null, fech);
      U.alert('Turno fechado com sucesso!', 'success');
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    }
  }

  // ===== RELATÓRIOS =====
  async carregarRelatorios() {
    if (!auth.podeVerRelatoriosFinanceiros()) {
      U.el('#rel-conteudo').innerHTML = '<div class="alert alert-warning">Sem permissão para aceder relatórios financeiros.</div>';
      return;
    }

    U.el('#rel-conteudo').innerHTML = `
      <div class="tabs">
        <button class="tab active" onclick="app.mostrarTabRel(this, 'rel-vendas')">🛒 Vendas</button>
        <button class="tab" onclick="app.mostrarTabRel(this, 'rel-comb')">⛽ Combustível</button>
        <button class="tab" onclick="app.mostrarTabRel(this, 'rel-lucro')">💰 Lucros</button>
      </div>

      <div id="rel-vendas" class="tab-panel active">
        <div class="filter-bar">
          <label>De:</label>
          <input type="date" id="rel-de" value="${U.hoje()}">
          <label>Até:</label>
          <input type="date" id="rel-ate" value="${new Date(Date.now() + 86400000).toISOString().split('T')[0]}">
          <button class="btn btn-primary btn-sm" onclick="app.gerarRelVendas()">📊 Gerar</button>
          <button class="btn btn-secondary btn-sm" onclick="U.print()">🖨️ Imprimir</button>
        </div>
        <div id="rel-vendas-result"></div>
      </div>

      <div id="rel-comb" class="tab-panel">
        <div class="filter-bar">
          <label>De:</label>
          <input type="date" id="rel-comb-de" value="${U.hoje()}">
          <label>Até:</label>
          <input type="date" id="rel-comb-ate" value="${new Date(Date.now() + 86400000).toISOString().split('T')[0]}">
          <button class="btn btn-primary btn-sm" onclick="app.gerarRelComb()">📊 Gerar</button>
        </div>
        <div id="rel-comb-result"></div>
      </div>

      <div id="rel-lucro" class="tab-panel">
        <div class="filter-bar">
          <label>De:</label>
          <input type="date" id="rel-luc-de" value="${new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]}">
          <label>Até:</label>
          <input type="date" id="rel-luc-ate" value="${new Date(Date.now() + 86400000).toISOString().split('T')[0]}">
          <button class="btn btn-primary btn-sm" onclick="app.gerarRelLucro()">📊 Gerar</button>
        </div>
        <div id="rel-lucro-result"></div>
      </div>
    `;
  }

  mostrarTabRel(tab, panelId) {
    tab.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    U.els('.tab-panel').forEach(p => p.classList.remove('active'));
    U.el(`#${panelId}`)?.classList.add('active');
  }

  async gerarRelVendas() {
    const de = U.el('#rel-de').value;
    const ate = U.el('#rel-ate').value;
    if (!de || !ate) { U.alert('Selecione o período', 'warning'); return; }

    const vendas = await db.getVendas({ bombaId: this.bombaAtual, de, ate });
    const produtos = await db.getProdutos(this.bombaAtual);
    const total = U.sumBy(vendas, 'valor_total');
    const lucro = U.sumBy(vendas, 'lucro_total');

    // Por produto
    const porProduto = {};
    vendas.forEach(v => {
      const nome = v.produto_nome || 'Desconhecido';
      if (!porProduto[nome]) porProduto[nome] = { nome, qtd: 0, total: 0, lucro: 0 };
      porProduto[nome].qtd += v.quantidade;
      porProduto[nome].total += v.valor_total || 0;
      porProduto[nome].lucro += v.lucro_total || 0;
    });

    U.el('#rel-vendas-result').innerHTML = `
      <div class="relatorio-print">
        <div class="relatorio-header">
          <h2>🛒 Relatório de Vendas da Loja</h2>
          <p>${Formulas.formatarData(de)} até ${Formulas.formatarData(ate)}</p>
        </div>
        <div class="relatorio-section">
          <h4>Resumo</h4>
          <div class="turno-resumo">
            <div class="turno-card"><div class="turno-card-label">Total Vendas</div><div class="turno-card-value">${U.formatMZN(total)}</div></div>
            <div class="turno-card"><div class="turno-card-label">Total Lucro</div><div class="turno-card-value" style="color:var(--secondary);">${U.formatMZN(lucro)}</div></div>
            <div class="turno-card"><div class="turno-card-label">Transações</div><div class="turno-card-value">${vendas.length}</div></div>
            <div class="turno-card"><div class="turno-card-label">Ticket Médio</div><div class="turno-card-value">${U.formatMZN(vendas.length ? total / vendas.length : 0)}</div></div>
          </div>
        </div>
        <div class="relatorio-section">
          <h4>Por Produto</h4>
          <table>
            <thead><tr><th>Produto</th><th>Qtd</th><th>Total</th><th>Lucro</th></tr></thead>
            <tbody>
              ${Object.values(porProduto).sort((a, b) => b.total - a.total).map(p => `
                <tr><td>${U.esc(p.nome)}</td><td>${p.qtd}</td><td>${U.formatMZN(p.total)}</td><td>${U.formatMZN(p.lucro)}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async gerarRelComb() {
    const de = U.el('#rel-comb-de').value;
    const ate = U.el('#rel-comb-ate').value;
    const abast = await db.getAbastecimentos({ bombaId: this.bombaAtual, de, ate });
    const total = U.sumBy(abast, 'valor_total');
    const litros = U.sumBy(abast, 'litros');

    U.el('#rel-comb-result').innerHTML = `
      <div class="relatorio-print">
        <div class="relatorio-header">
          <h2>⛽ Relatório de Combustível</h2>
          <p>${Formulas.formatarData(de)} até ${Formulas.formatarData(ate)}</p>
        </div>
        <div class="turno-resumo">
          <div class="turno-card"><div class="turno-card-label">Total</div><div class="turno-card-value">${U.formatMZN(total)}</div></div>
          <div class="turno-card"><div class="turno-card-label">Litros</div><div class="turno-card-value">${Formulas.formatarLitros(litros)}</div></div>
          <div class="turno-card"><div class="turno-card-label">Abastecimentos</div><div class="turno-card-value">${abast.length}</div></div>
        </div>
        <table style="margin-top:1rem;">
          <thead><tr><th>Data</th><th>Litros</th><th>Preço/L</th><th>Total</th><th>Pagamento</th></tr></thead>
          <tbody>
            ${abast.slice(0, 50).map(a => `
              <tr><td>${Formulas.formatarDataHora(a.data_hora)}</td><td>${Formulas.formatarNumero(a.litros)} L</td><td>${U.formatMZN(a.preco_litro)}</td><td>${U.formatMZN(a.valor_total)}</td><td>${a.tipo_pagamento}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async gerarRelLucro() {
    const de = U.el('#rel-luc-de').value;
    const ate = U.el('#rel-luc-ate').value;
    const vendas = await db.getVendas({ bombaId: this.bombaAtual, de, ate });
    const abast = await db.getAbastecimentos({ bombaId: this.bombaAtual, de, ate });
    const lucroLoja = U.sumBy(vendas, 'lucro_total');
    const lucroComb = U.sumBy(abast, 'lucro_total');

    U.el('#rel-lucro-result').innerHTML = `
      <div class="relatorio-print">
        <div class="relatorio-header">
          <h2>💰 Relatório de Lucros</h2>
          <p>${Formulas.formatarData(de)} até ${Formulas.formatarData(ate)}</p>
        </div>
        <div class="turno-resumo">
          <div class="turno-card"><div class="turno-card-label">Lucro Total</div><div class="turno-card-value" style="color:var(--secondary);">${U.formatMZN(lucroLoja + lucroComb)}</div></div>
          <div class="turno-card"><div class="turno-card-label">Lucro Loja</div><div class="turno-card-value">${U.formatMZN(lucroLoja)}</div></div>
          <div class="turno-card"><div class="turno-card-label">Lucro Combustível</div><div class="turno-card-value">${U.formatMZN(lucroComb)}</div></div>
        </div>
      </div>
    `;
  }

  // ===== CONFIGURAÇÕES =====
  async carregarConfig() {
    U.el('#cfg-conteudo').innerHTML = `
      <div class="tabs">
        <button class="tab active" onclick="app.mostrarTabCfg(this, 'cfg-precos')">💲 Preços</button>
        <button class="tab" onclick="app.mostrarTabCfg(this, 'cfg-dados')">🏢 Dados</button>
      </div>

      <div id="cfg-precos" class="tab-panel active">
        <div class="card" style="max-width:600px;">
          <div class="card-body">
            <h4 style="margin-bottom:1rem;">Ajuste de Preços</h4>
            <div id="cfg-precos-list"></div>
            <button class="btn btn-primary w-100" style="margin-top:1rem;" onclick="app.salvarPrecos()">💾 Guardar Preços</button>
          </div>
        </div>
      </div>

      <div id="cfg-dados" class="tab-panel">
        <div class="card" style="max-width:600px;">
          <div class="card-body">
            <h4 style="margin-bottom:1rem;">Gerenciar Dados</h4>
            <div style="display:flex;flex-direction:column;gap:0.75rem;">
              <button class="btn btn-secondary" onclick="app.sincronizarDados()">🔄 Sincronizar com Supabase</button>
              <button class="btn btn-secondary" onclick="app.exportarTodosDados()">📥 Exportar Todos os Dados (CSV)</button>
              <div style="margin-top:1rem;padding:0.75rem;background:var(--danger-light);border-radius:var(--radius);">
                <strong style="color:var(--danger);">⚠️ Zona de Perigo</strong>
                <p style="font-size:0.8125rem;margin-top:0.25rem;">Estas acções não podem ser desfeitas.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Carregar preços
    const tanques = await db.getTanques(this.bombaAtual);
    U.el('#cfg-precos-list').innerHTML = tanques.map(t => `
      <div class="form-row" style="margin-bottom:0.75rem;">
        <div class="form-group" style="flex:2;">
          <label>${U.esc(t.tipo_combustivel).toUpperCase()}</label>
          <input type="number" class="cfg-preco" data-tanque="${t.id}" value="${t.preco_litro}" step="0.01" min="0">
        </div>
        <div class="form-group">
          <label>% Lucro</label>
          <div class="input-group">
            <input type="number" class="cfg-pct" data-tanque="${t.id}" value="${t.percentagem_lucro || 15}" min="0">
            <span class="input-addon">%</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  mostrarTabCfg(tab, panelId) {
    tab.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    U.els('.tab-panel').forEach(p => p.classList.remove('active'));
    U.el(`#${panelId}`)?.classList.add('active');
  }

  async salvarPrecos() {
    try {
      U.els('.cfg-preco').forEach(async input => {
        const tanqueId = input.dataset.tanque;
        const preco = parseFloat(input.value) || 0;
        const pct = parseFloat(U.el(`.cfg-pct[data-tanque="${tanqueId}"]`)?.value) || 15;
        await db.saveTanque({ id: tanqueId, preco_litro: preco, percentagem_lucro: pct });
      });
      U.alert('Preços actualizados!', 'success');
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    }
  }

  async sincronizarDados() {
    U.loading(true);
    try {
      await syncManager.sincronizarDados();
      await syncManager.processarFila();
      U.alert('Dados sincronizados com sucesso!', 'success');
    } catch (e) {
      U.alert('Erro na sincronização', 'danger');
    } finally {
      U.loading(false);
    }
  }

  async exportarTodosDados() {
    for (const t of TABELAS) {
      const dados = await localDB.getAll(t);
      if (dados.length > 0) U.exportCSV(dados, t);
    }
    U.alert('Dados exportados!', 'success');
  }
}

const app = new AppGestor();
