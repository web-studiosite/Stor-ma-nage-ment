/* ============================================
   GESTÃO DE LOJA - SPA do Caixa / Vendedor
   ============================================ */

class AppCaixa {
  constructor() {
    this.bombaAtual = null;
    this.turnoAtual = 'manha';
    this.vendaAtual = 1;
    this.vendaPagamento = 'dinheiro';
  }

  async init() {
    const ok = await auth.verificarSessao();
    if (!ok || !auth.isCaixa) {
      window.location.href = 'index.html';
      return;
    }

    this.setupUI();
    this.setupEventos();
    await this.carregarDadosIniciais();
    U.showSection('#sec-vender');
    await this.carregarVender();
    syncManager.iniciar();
    U.el('#data-atual').textContent = new Date().toLocaleDateString('pt-MZ');
  }

  setupUI() {
    U.el('#user-name').textContent = auth.nome;
    U.el('#user-role').textContent = 'Caixa';
    U.el('#user-avatar').textContent = auth.nome.charAt(0).toUpperCase();
  }

  setupEventos() {
    U.els('.nav-item').forEach(nav => {
      U.on(nav, 'click', () => {
        const sec = nav.dataset.section;
        if (sec) {
          U.showSection(sec);
          this.carregarSecao(sec);
        }
      });
    });

    U.on(U.el('#btn-logout'), 'click', () => auth.logout());
    U.on(U.el('#btn-historico'), 'click', () => historicoManager.mostrar());
    U.on(U.el('#select-posto'), 'change', (e) => {
      this.bombaAtual = e.target.value || null;
      this.carregarSecao(U.el('.section.active')?.id);
    });
    U.on(U.el('#select-turno'), 'change', (e) => {
      this.turnoAtual = e.target.value;
    });
  }

  async carregarDadosIniciais() {
    try {
      const bombas = await db.getBombas();
      const select = U.el('#select-posto');
      select.innerHTML = '<option value="">Selecionar posto...</option>' +
        bombas.map(b => `<option value="${b.id}">${b.nome}</option>`).join('');
      if (bombas.length > 0) {
        this.bombaAtual = bombas[0].id;
        select.value = this.bombaAtual;
      }
      await syncManager.sincronizarDados();
    } catch (e) {
      console.error('Erro:', e);
    }
  }

  async carregarSecao(secId) {
    switch (secId) {
      case '#sec-vender': await this.carregarVender(); break;
      case '#sec-abastecer': await this.carregarAbastecer(); break;
      case '#sec-stock': await this.carregarStock(); break;
      case '#sec-movimentos': await this.carregarMovimentos(); break;
      case '#sec-turno': await this.carregarTurno(); break;
      case '#sec-historico': await this.carregarHistorico(); break;
    }
  }

  // ===== VENDER (Sequencial) =====
  async carregarVender() {
    if (!this.bombaAtual) {
      U.el('#vender-conteudo').innerHTML = '<div class="alert alert-info">Selecione um posto.</div>';
      return;
    }

    const produtos = await db.getProdutos(this.bombaAtual);
    const vendasHoje = await db.getVendas({
      bombaId: this.bombaAtual,
      de: U.hoje(),
      ate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
    });

    const totalHoje = U.sumBy(vendasHoje, 'valor_total');

    U.el('#vender-conteudo').innerHTML = `
      <div class="venda-sequencial">
        <div class="card" style="margin-bottom:1rem;background:var(--secondary-light);border-color:var(--secondary);">
          <div class="card-body" style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;">
            <span style="font-size:0.875rem;color:var(--secondary);font-weight:600;">💰 Total Hoje: ${U.formatMZN(totalHoje)}</span>
            <span style="font-size:0.875rem;color:var(--text-secondary);">${vendasHoje.length} vendas</span>
          </div>
        </div>

        <div class="venda-card" id="venda-card-ativa">
          <div class="venda-card-header">
            <h3>🛒 VENDA #${this.vendaAtual}</h3>
            <span id="venda-total-display" style="font-size:1.25rem;font-weight:800;color:var(--primary);">MZN 0,00</span>
          </div>

          <div class="form-group">
            <label>Produto *</label>
            <select id="cv-produto" class="w-100" onchange="appCaixa.onProdutoChange()">
              <option value="">Selecionar produto...</option>
              ${produtos.filter(p => (p.stock_loja || 0) > 0).map(p =>
                `<option value="${p.id}" data-preco="${p.preco_venda}" data-custo="${p.preco_custo || 0}" data-stock="${p.stock_loja}">${U.esc(p.nome)} - ${U.formatMZN(p.preco_venda)}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Quantidade *</label>
              <input type="number" id="cv-qtd" min="1" value="1" oninput="appCaixa.calcularTotal()">
            </div>
            <div class="form-group">
              <label>Preço Unit.</label>
              <input type="number" id="cv-preco" step="0.01" readonly>
            </div>
          </div>

          <div class="form-group">
            <label>Tipo Pagamento *</label>
            <div class="pagamento-grid">
              <div class="pagamento-btn active" data-value="dinheiro" onclick="appCaixa.selecionarPagamento(this)">💵 Dinheiro</div>
              <div class="pagamento-btn" data-value="mpesa" onclick="appCaixa.selecionarPagamento(this)">📱 M-Pesa</div>
              <div class="pagamento-btn" data-value="emola" onclick="appCaixa.selecionarPagamento(this)">📱 E-Mola</div>
              <div class="pagamento-btn" data-value="cartao" onclick="appCaixa.selecionarPagamento(this)">💳 Cartão</div>
              <div class="pagamento-btn" data-value="divida" onclick="appCaixa.selecionarPagamento(this)">📋 Dívida</div>
            </div>
          </div>

          <div style="display:flex;gap:0.75rem;margin-top:1.5rem;">
            <button class="btn btn-success btn-lg w-100" onclick="appCaixa.guardarEContinuar()" style="font-size:1.125rem;padding:1rem;">
              ✓ GUARDAR E CONTINUAR
            </button>
          </div>
        </div>

        <div id="venda-sucesso-msg"></div>

        <div class="card" style="margin-top:1.5rem;">
          <div class="card-header"><h3>🕐 Vendas Recentes</h3></div>
          <div class="card-body" style="padding:0;max-height:250px;overflow-y:auto;">
            ${vendasHoje.slice(0, 10).length ? `
              <table style="font-size:0.8125rem;">
                <thead><tr><th>Hora</th><th>Produto</th><th>Qtd</th><th>Total</th></tr></thead>
                <tbody>
                  ${vendasHoje.slice(0, 10).map(v => `
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
    `;

    this.vendaPagamento = 'dinheiro';
    setTimeout(() => U.el('#cv-produto')?.focus(), 100);
  }

  onProdutoChange() {
    const opt = U.el('#cv-produto')?.selectedOptions[0];
    if (!opt?.value) {
      U.el('#cv-preco').value = '';
      this.calcularTotal();
      return;
    }
    U.el('#cv-preco').value = opt.dataset.preco;
    this.calcularTotal();
  }

  selecionarPagamento(el) {
    U.els('.pagamento-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    this.vendaPagamento = el.dataset.value;
  }

  calcularTotal() {
    const preco = parseFloat(U.el('#cv-preco')?.value) || 0;
    const qtd = parseInt(U.el('#cv-qtd')?.value) || 0;
    const total = preco * qtd;
    const display = U.el('#venda-total-display');
    if (display) display.textContent = U.formatMZN(total);
    return total;
  }

  async guardarEContinuar() {
    const produtoId = U.el('#cv-produto').value;
    const qtd = parseInt(U.el('#cv-qtd').value);
    const preco = parseFloat(U.el('#cv-preco').value);

    if (!produtoId) { U.alert('Selecione um produto', 'warning'); U.el('#cv-produto').focus(); return; }
    if (!qtd || qtd <= 0) { U.alert('Quantidade inválida', 'warning'); return; }

    try {
      const opt = U.el('#cv-produto').selectedOptions[0];
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

      // Mostrar sucesso
      this.vendaAtual++;
      U.el('#venda-sucesso-msg').innerHTML = `
        <div class="venda-sucesso">
          <div class="venda-sucesso-icon">✅</div>
          <div class="venda-sucesso-text">Venda guardada!</div>
          <div class="venda-sucesso-sub">Total: ${U.formatMZN(venda.valor_total || preco * qtd)} | Próxima venda...</div>
        </div>
      `;

      // Reset para próxima venda
      setTimeout(() => {
        this.carregarVender();
      }, 800);

    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    }
  }

  // ===== ABASTECER =====
  async carregarAbastecer() {
    if (!this.bombaAtual) {
      U.el('#abastecer-conteudo').innerHTML = '<div class="alert alert-info">Selecione um posto.</div>';
      return;
    }

    const tanques = await db.getTanques(this.bombaAtual);
    const abastecimentos = await db.getAbastecimentos({ bombaId: this.bombaAtual });

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
              <div style="font-size:0.75rem;color:var(--text-light);">${U.formatMZN(t.preco_litro)}/L</div>
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
          <button class="btn btn-primary btn-sm w-100" style="margin-top:0.75rem;" onclick="appCaixa.abrirAbastecimento('${t.id}')">🚗 Abastecer</button>
        </div>
      `;
    });
    html += '</div>';

    // Abastecimentos recentes
    html += `
      <div class="card">
        <div class="card-header"><h3>🕐 Meus Abastecimentos</h3></div>
        <div class="card-body" style="padding:0;">
          <div class="table-container">
            <table>
              <thead><tr><th>Data</th><th>Combustível</th><th>Litros</th><th>Total</th><th>Pagamento</th></tr></thead>
              <tbody>
                ${abastecimentos.filter(a => a.perfil_id === auth.perfilId).slice(0, 15).map(a => {
                  const t = tanques.find(tan => tan.id === a.tanque_id);
                  return `<tr>
                    <td>${Formulas.formatarDataHora(a.data_hora)}</td>
                    <td>${U.esc(t?.tipo_combustivel || 'N/A').toUpperCase()}</td>
                    <td>${Formulas.formatarNumero(a.litros)} L</td>
                    <td style="font-weight:700;">${U.formatMZN(a.valor_total)}</td>
                    <td><span class="badge badge-${a.tipo_pagamento === 'dinheiro' ? 'success' : 'primary'}">${a.tipo_pagamento}</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    U.el('#abastecer-conteudo').innerHTML = html;
  }

  abrirAbastecimento(tanqueId) {
    const modal = U.modal({
      title: '⛽ Novo Abastecimento',
      body: `
        <form id="form-abast" class="form-row">
          <input type="hidden" id="cab-tanque-id" value="${tanqueId}">
          <div class="form-group">
            <label>Litros *</label>
            <input type="number" id="cab-litros" step="0.01" min="0.1" required placeholder="Ex: 25.5">
          </div>
          <div class="form-group">
            <label>Preço/Litro (MZN)</label>
            <input type="number" id="cab-preco" step="0.01" min="0" placeholder="Auto">
          </div>
          <div class="form-group">
            <label>Pagamento *</label>
            <select id="cab-pagamento" required>
              <option value="dinheiro">💵 Dinheiro</option>
              <option value="mpesa">📱 M-Pesa</option>
              <option value="emola">📱 E-Mola</option>
              <option value="cartao">💳 Cartão</option>
              <option value="divida">📋 Dívida</option>
            </select>
          </div>
          <div class="form-group">
            <label>Cliente</label>
            <input type="text" id="cab-cliente" placeholder="Nome (opcional)">
          </div>
          <div class="form-group">
            <label>Matrícula</label>
            <input type="text" id="cab-matricula" placeholder="ABC-123-MZ">
          </div>
          <div class="form-group">
            <label>Turno</label>
            <select id="cab-turno">
              <option value="manha" ${this.turnoAtual === 'manha' ? 'selected' : ''}>Manhã</option>
              <option value="tarde" ${this.turnoAtual === 'tarde' ? 'selected' : ''}>Tarde</option>
              <option value="noite" ${this.turnoAtual === 'noite' ? 'selected' : ''}>Noite</option>
            </select>
          </div>
        </form>
        <div id="cab-total" style="margin-top:1rem;padding:1rem;background:var(--primary-light);border-radius:var(--radius);text-align:center;font-size:1.25rem;font-weight:700;color:var(--primary);">Total: MZN 0,00</div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').querySelector('.modal-close').click()">Cancelar</button>
        <button class="btn btn-primary" onclick="appCaixa.salvarAbastecimento(this)">💾 Guardar</button>
      `
    });

    const calc = () => {
      const l = parseFloat(U.el('#cab-litros').value) || 0;
      const p = parseFloat(U.el('#cab-preco').value) || 0;
      U.el('#cab-total').textContent = `Total: ${U.formatMZN(l * p)}`;
    };
    U.on(U.el('#cab-litros'), 'input', calc);
    U.on(U.el('#cab-preco'), 'input', calc);
  }

  async salvarAbastecimento(btn) {
    const litros = parseFloat(U.el('#cab-litros').value);
    if (!litros) { U.alert('Informe os litros', 'warning'); return; }

    btn.disabled = true;
    try {
      const tanqueId = U.el('#cab-tanque-id').value;
      const tanque = await db.getTanque(tanqueId);
      const preco = parseFloat(U.el('#cab-preco').value) || tanque?.preco_litro || 0;

      const ab = {
        bomba_id: this.bombaAtual,
        tanque_id: tanqueId,
        perfil_id: auth.perfilId,
        litros,
        preco_litro: preco,
        tipo_pagamento: U.el('#cab-pagamento').value,
        cliente_nome: U.el('#cab-cliente').value || null,
        matricula: U.el('#cab-matricula').value || null,
        turno: U.el('#cab-turno').value,
        data_hora: new Date().toISOString()
      };

      await db.saveAbastecimento(ab);
      await historicoManager.registrar('abastecimento', 'abastecimentos', ab.id, null, ab);
      U.alert('Abastecimento registado!', 'success');
      U.el('.modal-close').click();
      this.carregarAbastecer();
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    } finally {
      btn.disabled = false;
    }
  }

  // ===== STOCK / ARMAZÉM =====
  async carregarStock() {
    if (!this.bombaAtual) {
      U.el('#stock-conteudo').innerHTML = '<div class="alert alert-info">Selecione um posto.</div>';
      return;
    }

    const produtos = await db.getProdutos(this.bombaAtual);

    U.el('#stock-conteudo').innerHTML = `
      <div class="tabs">
        <button class="tab active" onclick="appCaixa.mostrarTabStock(this, 'st-ver')">👁️ Ver Stock</button>
        <button class="tab" onclick="appCaixa.mostrarTabStock(this, 'st-trans')">↔️ Transferir</button>
        <button class="tab" onclick="appCaixa.mostrarTabStock(this, 'st-inv')">📋 Inventariar</button>
      </div>

      <div id="st-ver" class="tab-panel active">
        <div class="filter-bar">
          <div class="search-box" style="flex:1;">
            <span class="search-icon">🔍</span>
            <input type="text" id="st-search" placeholder="Pesquisar..." oninput="appCaixa.filtrarStock()">
          </div>
          <select id="st-filtro" onchange="appCaixa.filtrarStock()">
            <option value="">Todos</option>
            <option value="loja">Loja</option>
            <option value="armazem">Armazém</option>
          </select>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Produto</th><th>Loja</th><th>Armazém</th><th>Total</th><th>Status</th></tr></thead>
            <tbody id="st-tbody">
              ${produtos.map(p => {
                const total = (p.stock_loja || 0) + (p.stock_armazem || 0);
                const status = Formulas.stockStatus(total, p.stock_minimo || 5);
                return `<tr data-nome="${U.esc(p.nome).toLowerCase()}" data-local="${p.localizacao || 'ambos'}">
                  <td><strong>${U.esc(p.nome)}</strong></td>
                  <td style="text-align:center;font-weight:700;">${p.stock_loja || 0}</td>
                  <td style="text-align:center;font-weight:700;">${p.stock_armazem || 0}</td>
                  <td style="text-align:center;font-weight:800;">${total}</td>
                  <td><span class="stock-status ${status}"><span class="dot"></span>${status === 'ok' ? 'OK' : status === 'baixo' ? 'Baixo' : 'Crítico'}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div id="st-trans" class="tab-panel">
        <div class="card" style="max-width:500px;">
          <div class="card-body">
            <div class="form-group">
              <label>Produto *</label>
              <select id="st-trans-produto" required onchange="appCaixa.mostrarStockTrans()">
                <option value="">Selecionar...</option>
                ${produtos.filter(p => (p.stock_armazem || 0) > 0 || (p.stock_loja || 0) > 0).map(p =>
                  `<option value="${p.id}" data-loja="${p.stock_loja || 0}" data-armazem="${p.stock_armazem || 0}">${U.esc(p.nome)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Direção *</label>
              <select id="st-trans-dir" required>
                <option value="armazem-loja">Armazém → Loja</option>
                <option value="loja-armazem">Loja → Armazém</option>
              </select>
            </div>
            <div class="form-group">
              <label>Quantidade *</label>
              <input type="number" id="st-trans-qtd" min="1" required placeholder="Unidades">
            </div>
            <div id="st-trans-info" style="padding:0.75rem;background:var(--info-light);border-radius:var(--radius);font-size:0.875rem;display:none;margin-bottom:1rem;"></div>
            <button class="btn btn-primary w-100" onclick="appCaixa.salvarTransferenciaStock()">↔️ Transferir</button>
          </div>
        </div>
      </div>

      <div id="st-inv" class="tab-panel">
        <div class="card" style="max-width:500px;">
          <div class="card-body">
            <div class="form-group">
              <label>Tipo de Inventário *</label>
              <select id="st-inv-tipo">
                <option value="loja">🛒 Loja</option>
                <option value="armazem">📦 Armazém</option>
              </select>
            </div>
            <p style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:1rem;">Será criado um inventário para contagem dos produtos.</p>
            <button class="btn btn-primary w-100" onclick="appCaixa.iniciarInventario()">📋 Iniciar Inventário</button>
          </div>
        </div>
      </div>
    `;
  }

  mostrarTabStock(tab, panelId) {
    tab.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    U.els('.tab-panel').forEach(p => p.classList.remove('active'));
    U.el(`#${panelId}`)?.classList.add('active');
  }

  filtrarStock() {
    const termo = U.el('#st-search')?.value.toLowerCase() || '';
    const local = U.el('#st-filtro')?.value || '';
    U.els('#st-tbody tr').forEach(tr => {
      const matchTermo = !termo || tr.dataset.nome.includes(termo);
      const matchLocal = !local || tr.dataset.local === local || tr.dataset.local === 'ambos';
      tr.style.display = matchTermo && matchLocal ? '' : 'none';
    });
  }

  mostrarStockTrans() {
    const opt = U.el('#st-trans-produto')?.selectedOptions[0];
    const info = U.el('#st-trans-info');
    if (!opt?.value) { info.style.display = 'none'; return; }
    info.innerHTML = `Loja: <strong>${opt.dataset.loja}</strong> | Armazém: <strong>${opt.dataset.armazem}</strong>`;
    info.style.display = 'block';
  }

  async salvarTransferenciaStock() {
    const produtoId = U.el('#st-trans-produto').value;
    const qtd = parseInt(U.el('#st-trans-qtd').value);
    const dir = U.el('#st-trans-dir').value;
    if (!produtoId || !qtd) { U.alert('Preencha todos os campos', 'warning'); return; }

    try {
      const [origem, destino] = dir.split('-');
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
      this.carregarStock();
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    }
  }

  async iniciarInventario() {
    try {
      const tipo = U.el('#st-inv-tipo').value;
      const inv = {
        bomba_id: this.bombaAtual,
        perfil_id: auth.perfilId,
        tipo,
        status: 'em_andamento',
        data_inventario: new Date().toISOString()
      };
      await db.saveInventario(inv);
      await historicoManager.registrar('inventariar', 'inventarios', inv.id, null, inv);
      U.alert('Inventário iniciado! Pode começar a contagem.', 'success');
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    }
  }

  // ===== MOVIMENTOS =====
  async carregarMovimentos() {
    if (!this.bombaAtual) {
      U.el('#mov-caixa-conteudo').innerHTML = '<div class="alert alert-info">Selecione um posto.</div>';
      return;
    }

    const movimentos = await db.getMovimentos({ bombaId: this.bombaAtual });
    const produtos = await db.getProdutos(this.bombaAtual);

    U.el('#mov-caixa-conteudo').innerHTML = `
      <div class="filter-bar">
        <div class="search-box" style="flex:1;">
          <span class="search-icon">🔍</span>
          <input type="text" id="mc-search" placeholder="Pesquisar..." oninput="appCaixa.filtrarMov()">
        </div>
        <select id="mc-filtro" onchange="appCaixa.filtrarMov()">
          <option value="">Todos</option>
          <option value="entrada">📥 Entrada</option>
          <option value="transferencia">↔️ Transferência</option>
        </select>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Qtd</th><th>Origem → Destino</th><th>Motivo</th></tr></thead>
          <tbody id="mc-tbody">
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
                <td style="font-weight:700;">${m.quantidade_unidades || '-'}</td>
                <td>${m.origem || '-'} → ${m.destino || '-'}</td>
                <td>${U.esc(m.motivo || '-')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  filtrarMov() {
    const termo = U.el('#mc-search')?.value.toLowerCase() || '';
    const tipo = U.el('#mc-filtro')?.value || '';
    U.els('#mc-tbody tr').forEach(tr => {
      const matchTermo = !termo || tr.dataset.search.includes(termo);
      const matchTipo = !tipo || tr.dataset.tipo === tipo;
      tr.style.display = matchTermo && matchTipo ? '' : 'none';
    });
  }

  // ===== TURNO =====
  async carregarTurno() {
    if (!this.bombaAtual) {
      U.el('#turno-caixa-conteudo').innerHTML = '<div class="alert alert-info">Selecione um posto.</div>';
      return;
    }

    const hoje = U.hoje();
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const vendas = await db.getVendas({ bombaId: this.bombaAtual, de: hoje, ate: amanha });
    const abast = await db.getAbastecimentos({ bombaId: this.bombaAtual, de: hoje, ate: amanha });

    const meusVendas = vendas.filter(v => v.perfil_id === auth.perfilId);
    const meusAbast = abast.filter(a => a.perfil_id === auth.perfilId);

    const porPagamento = {};
    TIPOS_PAGAMENTO.forEach(t => porPagamento[t] = 0);
    meusVendas.forEach(v => { porPagamento[v.tipo_pagamento] = (porPagamento[v.tipo_pagamento] || 0) + (v.valor_total || 0); });
    meusAbast.forEach(a => { porPagamento[a.tipo_pagamento] = (porPagamento[a.tipo_pagamento] || 0) + (a.valor_total || 0); });

    U.el('#turno-caixa-conteudo').innerHTML = `
      <div class="card" style="max-width:700px;margin:0 auto;">
        <div class="card-header"><h3>💰 Fechar Meu Turno</h3><span class="turno-badge">${this.turnoAtual.toUpperCase()}</span></div>
        <div class="card-body">
          <div class="turno-resumo" style="margin-bottom:1.5rem;">
            <div class="turno-card"><div class="turno-card-label">Minhas Vendas</div><div class="turno-card-value" style="color:var(--primary);">${U.formatMZN(U.sumBy(meusVendas, 'valor_total'))}</div></div>
            <div class="turno-card"><div class="turno-card-label">Meus Abast.</div><div class="turno-card-value" style="color:var(--warning);">${U.formatMZN(U.formatMZN(U.sumBy(meusAbast, 'valor_total')))}</div></div>
            <div class="turno-card"><div class="turno-card-label">Transações</div><div class="turno-card-value">${meusVendas.length + meusAbast.length}</div></div>
          </div>
          <h4 style="margin-bottom:0.75rem;font-size:0.9375rem;">Por Pagamento</h4>
          ${TIPOS_PAGAMENTO.map(tp => `
            <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);">
              <span style="text-transform:capitalize;">${tp}</span>
              <strong>${U.formatMZN(porPagamento[tp] || 0)}</strong>
            </div>
          `).join('')}
          <div class="form-group" style="margin-top:1.5rem;">
            <label>Observações</label>
            <textarea id="tc-obs" rows="2" placeholder="Notas sobre o turno..."></textarea>
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-success btn-lg w-100" onclick="appCaixa.fecharTurno()">🔒 Fechar Turno</button>
        </div>
      </div>
    `;
  }

  async fecharTurno() {
    try {
      const hoje = U.hoje();
      const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const vendas = await db.getVendas({ bombaId: this.bombaAtual, de: hoje, ate: amanha });
      const abast = await db.getAbastecimentos({ bombaId: this.bombaAtual, de: hoje, ate: amanha });
      const meusVendas = vendas.filter(v => v.perfil_id === auth.perfilId);
      const meusAbast = abast.filter(a => a.perfil_id === auth.perfilId);

      const fech = {
        bomba_id: this.bombaAtual,
        perfil_id: auth.perfilId,
        turno: this.turnoAtual,
        valor_total_loja: U.sumBy(meusVendas, 'valor_total'),
        valor_total_combustivel: U.sumBy(meusAbast, 'valor_total'),
        observacoes: U.el('#tc-obs')?.value || null,
        data_fechamento: new Date().toISOString()
      };

      await db.saveFechamento(fech);
      await historicoManager.registrar('fechar_turno', 'fechamentos_turno', fech.id, null, fech);
      U.alert('Turno fechado com sucesso!', 'success');
    } catch (e) {
      U.alert('Erro: ' + e.message, 'danger');
    }
  }

  // ===== HISTÓRICO =====
  async carregarHistorico() {
    // Reutiliza o historicoManager
    U.el('#hist-caixa-conteudo').innerHTML = `
      <div class="card">
        <div class="card-body" style="text-align:center;padding:2rem;">
          <div style="font-size:3rem;margin-bottom:0.75rem;">📋</div>
          <h3 style="margin-bottom:0.5rem;">Histórico de Operações</h3>
          <p style="color:var(--text-secondary);margin-bottom:1rem;">Ver todas as suas operações registadas no sistema.</p>
          <button class="btn btn-primary" onclick="historicoManager.mostrar()">📋 Ver Meu Histórico</button>
        </div>
      </div>
    `;
  }
}

const appCaixa = new AppCaixa();
