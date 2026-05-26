/* ============================================
   GESTÃO DE LOJA - CRUD Supabase + IndexedDB
   ============================================ */

class Database {
  constructor() {
    this.offlineMode = false;
  }

  // Verificar conexão
  async checkConnection() {
    try {
      const { error } = await supabaseClient.from('bombas').select('count', { count: 'exact', head: true });
      this.offlineMode = !!error;
      return !error;
    } catch (e) {
      this.offlineMode = true;
      return false;
    }
  }

  // ===== BOMBAS =====
  async getBombas() {
    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('bombas').select('*').eq('ativo', true).order('nome');
      if (!error && data) { await localDB.cacheTabela('bombas', data); return data; }
    }
    return localDB.getAll('bombas');
  }

  async saveBomba(bomba) {
    if (!bomba.id) bomba.id = Formulas.uuid();
    bomba.created_at = bomba.created_at || new Date().toISOString();
    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('bombas').upsert(bomba).select().single();
      if (!error && data) return data;
    }
    await localDB.put('bombas', bomba);
    await localDB.addSyncQueue('bombas', 'upsert', bomba);
    return bomba;
  }

  // ===== PERFIS =====
  async getPerfis() {
    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('perfis').select('*').order('nome');
      if (!error && data) { await localDB.cacheTabela('perfis', data); return data; }
    }
    return localDB.getAll('perfis');
  }

  async savePerfil(perfil) {
    if (!perfil.id) perfil.id = Formulas.uuid();
    perfil.created_at = perfil.created_at || new Date().toISOString();
    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('perfis').upsert(perfil).select().single();
      if (!error && data) return data;
    }
    await localDB.put('perfis', perfil);
    await localDB.addSyncQueue('perfis', 'upsert', perfil);
    return perfil;
  }

  // ===== TANQUES =====
  async getTanques(bombaId = null) {
    let query = supabaseClient.from('tanques').select('*').eq('ativo', true);
    if (bombaId) query = query.eq('bomba_id', bombaId);
    if (!this.offlineMode) {
      const { data, error } = await query.order('tipo_combustivel');
      if (!error && data) { await localDB.cacheTabela('tanques', data); return data; }
    }
    const todos = await localDB.getAll('tanques');
    return bombaId ? todos.filter(t => t.bomba_id === bombaId) : todos;
  }

  async saveTanque(tanque) {
    if (!tanque.id) tanque.id = Formulas.uuid();
    tanque.created_at = tanque.created_at || new Date().toISOString();
    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('tanques').upsert(tanque).select().single();
      if (!error && data) return data;
    }
    await localDB.put('tanques', tanque);
    await localDB.addSyncQueue('tanques', 'upsert', tanque);
    return tanque;
  }

  // ===== PRODUTOS =====
  async getProdutos(bombaId = null) {
    let query = supabaseClient.from('produtos').select('*').eq('ativo', true);
    if (bombaId) query = query.eq('bomba_id', bombaId);
    if (!this.offlineMode) {
      const { data, error } = await query.order('nome');
      if (!error && data) { await localDB.cacheTabela('produtos', data); return data; }
    }
    const todos = await localDB.getAll('produtos');
    return bombaId ? todos.filter(p => p.bomba_id === bombaId) : todos;
  }

  async getProdutoByCodigo(codigo) {
    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('produtos').select('*').eq('codigo', codigo).single();
      if (!error && data) return data;
    }
    const todos = await localDB.getAll('produtos');
    return todos.find(p => p.codigo === codigo) || null;
  }

  async saveProduto(produto) {
    if (!produto.id) produto.id = Formulas.uuid();
    produto.created_at = produto.created_at || new Date().toISOString();

    // Verificar código único
    if (produto.codigo) {
      const existente = await this.getProdutoByCodigo(produto.codigo);
      if (existente && existente.id !== produto.id) {
        throw new Error('Já existe um produto com este código');
      }
    }

    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('produtos').upsert(produto).select().single();
      if (!error && data) return data;
    }
    await localDB.put('produtos', produto);
    await localDB.addSyncQueue('produtos', 'upsert', produto);
    return produto;
  }

  // ===== ABASTECIMENTOS =====
  async getAbastecimentos(filtros = {}) {
    let query = supabaseClient.from('abastecimentos').select('*');
    if (filtros.bombaId) query = query.eq('bomba_id', filtros.bombaId);
    if (filtros.tanqueId) query = query.eq('tanque_id', filtros.tanqueId);
    if (filtros.de) query = query.gte('data_hora', filtros.de);
    if (filtros.ate) query = query.lte('data_hora', filtros.ate);
    if (!this.offlineMode) {
      const { data, error } = await query.order('data_hora', { ascending: false });
      if (!error && data) { await localDB.cacheTabela('abastecimentos', data); return data; }
    }
    let todos = await localDB.getAll('abastecimentos');
    if (filtros.bombaId) todos = todos.filter(a => a.bomba_id === filtros.bombaId);
    return todos;
  }

  async saveAbastecimento(ab) {
    if (!ab.id) ab.id = Formulas.uuid();
    ab.created_at = ab.created_at || new Date().toISOString();
    ab.sync_status = this.offlineMode ? 'pending' : 'synced';

    // Atualizar stock do tanque
    const tanque = await this.getTanque(ab.tanque_id);
    if (tanque) {
      tanque.stock_atual_litros = Math.max(0, (tanque.stock_atual_litros || 0) - ab.litros);
      await this.saveTanque(tanque);
    }

    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('abastecimentos').insert(ab).select().single();
      if (!error && data) return data;
    }
    await localDB.put('abastecimentos', ab);
    await localDB.addSyncQueue('abastecimentos', 'insert', ab);
    return ab;
  }

  async getTanque(id) {
    if (!id) return null;
    if (!this.offlineMode) {
      const { data } = await supabaseClient.from('tanques').select('*').eq('id', id).single();
      if (data) return data;
    }
    return localDB.get('tanques', id);
  }

  // ===== VENDAS LOJA =====
  async getVendas(filtros = {}) {
    let query = supabaseClient.from('vendas_loja').select('*');
    if (filtros.bombaId) query = query.eq('bomba_id', filtros.bombaId);
    if (filtros.de) query = query.gte('data_hora', filtros.de);
    if (filtros.ate) query = query.lte('data_hora', filtros.ate);
    if (!this.offlineMode) {
      const { data, error } = await query.order('data_hora', { ascending: false });
      if (!error && data) { await localDB.cacheTabela('vendas_loja', data); return data; }
    }
    let todos = await localDB.getAll('vendas_loja');
    if (filtros.bombaId) todos = todos.filter(v => v.bomba_id === filtros.bombaId);
    return todos;
  }

  async saveVenda(venda) {
    if (!venda.id) venda.id = Formulas.uuid();
    venda.created_at = venda.created_at || new Date().toISOString();
    venda.sync_status = this.offlineMode ? 'pending' : 'synced';

    // Atualizar stock do produto
    const produto = await this.getProduto(venda.produto_id);
    if (produto) {
      produto.stock_loja = Math.max(0, (produto.stock_loja || 0) - venda.quantidade);
      await this.saveProduto(produto);
    }

    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('vendas_loja').insert(venda).select().single();
      if (!error && data) return data;
    }
    await localDB.put('vendas_loja', venda);
    await localDB.addSyncQueue('vendas_loja', 'insert', venda);
    return venda;
  }

  async getProduto(id) {
    if (!id) return null;
    if (!this.offlineMode) {
      const { data } = await supabaseClient.from('produtos').select('*').eq('id', id).single();
      if (data) return data;
    }
    return localDB.get('produtos', id);
  }

  // ===== ENTRADAS COMBUSTÍVEL =====
  async getEntradas(filtros = {}) {
    let query = supabaseClient.from('entradas_combustivel').select('*');
    if (filtros.bombaId) query = query.eq('bomba_id', filtros.bombaId);
    if (filtros.tanqueId) query = query.eq('tanque_id', filtros.tanqueId);
    if (!this.offlineMode) {
      const { data, error } = await query.order('data_entrada', { ascending: false });
      if (!error && data) { await localDB.cacheTabela('entradas_combustivel', data); return data; }
    }
    let todos = await localDB.getAll('entradas_combustivel');
    if (filtros.bombaId) todos = todos.filter(e => e.bomba_id === filtros.bombaId);
    return todos;
  }

  async saveEntrada(entrada) {
    if (!entrada.id) entrada.id = Formulas.uuid();
    entrada.created_at = entrada.created_at || new Date().toISOString();
    entrada.data_entrada = entrada.data_entrada || new Date().toISOString();
    entrada.sync_status = this.offlineMode ? 'pending' : 'synced';

    // Atualizar stock do tanque e CMP
    const tanque = await this.getTanque(entrada.tanque_id);
    if (tanque) {
      const cmp = await this.getCMP(entrada.tanque_id);
      const resultado = Formulas.calcularCMP(
        tanque.stock_atual_litros || 0,
        cmp?.custo_medio_litro || 0,
        entrada.litros,
        entrada.preco_custo_litro
      );
      tanque.stock_atual_litros = resultado.stockTotal;
      await this.saveTanque(tanque);
      await this.saveCMP({
        tanque_id: entrada.tanque_id,
        custo_medio_litro: resultado.cmpNovo,
        stock_atual_litros: resultado.stockTotal,
        ultima_atualizacao: new Date().toISOString()
      });
    }

    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('entradas_combustivel').insert(entrada).select().single();
      if (!error && data) return data;
    }
    await localDB.put('entradas_combustivel', entrada);
    await localDB.addSyncQueue('entradas_combustivel', 'insert', entrada);
    return entrada;
  }

  async getCMP(tanqueId) {
    if (!this.offlineMode) {
      const { data } = await supabaseClient.from('custo_medio_tanque').select('*').eq('tanque_id', tanqueId).single();
      if (data) return data;
    }
    const todos = await localDB.getAll('custo_medio_tanque');
    return todos.find(c => c.tanque_id === tanqueId) || null;
  }

  async saveCMP(cmp) {
    if (!cmp.id) {
      const existente = await this.getCMP(cmp.tanque_id);
      if (existente) cmp.id = existente.id;
      else cmp.id = Formulas.uuid();
    }
    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('custo_medio_tanque').upsert(cmp).select().single();
      if (!error && data) return data;
    }
    await localDB.put('custo_medio_tanque', cmp);
    await localDB.addSyncQueue('custo_medio_tanque', 'upsert', cmp);
    return cmp;
  }

  // ===== MOVIMENTOS STOCK =====
  async getMovimentos(filtros = {}) {
    let query = supabaseClient.from('movimentos_stock').select('*');
    if (filtros.bombaId) query = query.eq('bomba_id', filtros.bombaId);
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
    if (!this.offlineMode) {
      const { data, error } = await query.order('data_hora', { ascending: false });
      if (!error && data) { await localDB.cacheTabela('movimentos_stock', data); return data; }
    }
    let todos = await localDB.getAll('movimentos_stock');
    if (filtros.bombaId) todos = todos.filter(m => m.bomba_id === filtros.bombaId);
    if (filtros.tipo) todos = todos.filter(m => m.tipo === filtros.tipo);
    return todos;
  }

  async saveMovimento(mov) {
    if (!mov.id) mov.id = Formulas.uuid();
    mov.created_at = mov.created_at || new Date().toISOString();
    mov.data_hora = mov.data_hora || new Date().toISOString();
    mov.sync_status = this.offlineMode ? 'pending' : 'synced';

    // Atualizar stock
    if (mov.produto_id) {
      const produto = await this.getProduto(mov.produto_id);
      if (produto) {
        if (mov.tipo === 'entrada') {
          if (mov.destino === 'loja') produto.stock_loja = (produto.stock_loja || 0) + (mov.quantidade_unidades || 0);
          else if (mov.destino === 'armazem') produto.stock_armazem = (produto.stock_armazem || 0) + (mov.quantidade_unidades || 0);
        } else if (mov.tipo === 'saida') {
          if (mov.origem === 'loja') produto.stock_loja = Math.max(0, (produto.stock_loja || 0) - (mov.quantidade_unidades || 0));
          else if (mov.origem === 'armazem') produto.stock_armazem = Math.max(0, (produto.stock_armazem || 0) - (mov.quantidade_unidades || 0));
        } else if (mov.tipo === 'transferencia') {
          if (mov.origem === 'armazem' && mov.destino === 'loja') {
            produto.stock_armazem = Math.max(0, (produto.stock_armazem || 0) - (mov.quantidade_unidades || 0));
            produto.stock_loja = (produto.stock_loja || 0) + (mov.quantidade_unidades || 0);
          } else if (mov.origem === 'loja' && mov.destino === 'armazem') {
            produto.stock_loja = Math.max(0, (produto.stock_loja || 0) - (mov.quantidade_unidades || 0));
            produto.stock_armazem = (produto.stock_armazem || 0) + (mov.quantidade_unidades || 0);
          }
        }
        await this.saveProduto(produto);
      }
    }

    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('movimentos_stock').insert(mov).select().single();
      if (!error && data) return data;
    }
    await localDB.put('movimentos_stock', mov);
    await localDB.addSyncQueue('movimentos_stock', 'insert', mov);
    return mov;
  }

  // ===== FECHAMENTOS TURNO =====
  async getFechamentos(filtros = {}) {
    let query = supabaseClient.from('fechamentos_turno').select('*');
    if (filtros.bombaId) query = query.eq('bomba_id', filtros.bombaId);
    if (filtros.perfilId) query = query.eq('perfil_id', filtros.perfilId);
    if (!this.offlineMode) {
      const { data, error } = await query.order('data_fechamento', { ascending: false });
      if (!error && data) { await localDB.cacheTabela('fechamentos_turno', data); return data; }
    }
    let todos = await localDB.getAll('fechamentos_turno');
    if (filtros.bombaId) todos = todos.filter(f => f.bomba_id === filtros.bombaId);
    return todos;
  }

  async saveFechamento(fech) {
    if (!fech.id) fech.id = Formulas.uuid();
    fech.created_at = fech.created_at || new Date().toISOString();
    fech.sync_status = this.offlineMode ? 'pending' : 'synced';
    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('fechamentos_turno').insert(fech).select().single();
      if (!error && data) return data;
    }
    await localDB.put('fechamentos_turno', fech);
    await localDB.addSyncQueue('fechamentos_turno', 'insert', fech);
    return fech;
  }

  // ===== INVENTÁRIOS =====
  async getInventarios(filtros = {}) {
    let query = supabaseClient.from('inventarios').select('*');
    if (filtros.bombaId) query = query.eq('bomba_id', filtros.bombaId);
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
    if (!this.offlineMode) {
      const { data, error } = await query.order('data_inventario', { ascending: false });
      if (!error && data) { await localDB.cacheTabela('inventarios', data); return data; }
    }
    let todos = await localDB.getAll('inventarios');
    if (filtros.bombaId) todos = todos.filter(i => i.bomba_id === filtros.bombaId);
    return todos;
  }

  async saveInventario(inv) {
    if (!inv.id) inv.id = Formulas.uuid();
    inv.created_at = inv.created_at || new Date().toISOString();
    inv.sync_status = this.offlineMode ? 'pending' : 'synced';
    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('inventarios').upsert(inv).select().single();
      if (!error && data) return data;
    }
    await localDB.put('inventarios', inv);
    await localDB.addSyncQueue('inventarios', 'upsert', inv);
    return inv;
  }

  async getInventarioItens(inventarioId) {
    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('inventario_itens').select('*').eq('inventario_id', inventarioId);
      if (!error && data) return data;
    }
    const todos = await localDB.getAll('inventario_itens');
    return todos.filter(i => i.inventario_id === inventarioId);
  }

  async saveInventarioItem(item) {
    if (!item.id) item.id = Formulas.uuid();
    item.created_at = item.created_at || new Date().toISOString();
    if (!this.offlineMode) {
      const { data, error } = await supabaseClient.from('inventario_itens').upsert(item).select().single();
      if (!error && data) return data;
    }
    await localDB.put('inventario_itens', item);
    await localDB.addSyncQueue('inventario_itens', 'upsert', item);
    return item;
  }

  // ===== HISTÓRICO =====
  async getHistorico(filtros = {}) {
    let query = supabaseClient.from('historico').select('*');
    if (filtros.perfilId) query = query.eq('perfil_id', filtros.perfilId);
    if (filtros.tabela) query = query.eq('tabela', filtros.tabela);
    if (filtros.limit) query = query.limit(filtros.limit);
    if (!this.offlineMode) {
      const { data, error } = await query.order('data_hora', { ascending: false });
      if (!error && data) { await localDB.cacheTabela('historico', data); return data; }
    }
    let todos = await localDB.getAll('historico');
    if (filtros.perfilId) todos = todos.filter(h => h.perfil_id === filtros.perfilId);
    if (filtros.tabela) todos = todos.filter(h => h.tabela === filtros.tabela);
    return todos;
  }

  async addHistorico(acao, tabela, registroId, dadosAnteriores = null, dadosNovos = null) {
    const hist = {
      id: Formulas.uuid(),
      perfil_id: auth.perfilId,
      perfil_nome: auth.nome,
      perfil_role: auth.role,
      acao,
      tabela,
      registro_id: registroId,
      dados_anteriores: dadosAnteriores,
      dados_novos: dadosNovos,
      data_hora: new Date().toISOString()
    };
    if (!this.offlineMode) {
      await supabaseClient.from('historico').insert(hist);
    }
    await localDB.put('historico', hist);
    return hist;
  }

  // ===== CONFIGURAÇÕES =====
  async getConfig(chave) {
    if (!this.offlineMode) {
      const { data } = await supabaseClient.from('configuracoes').select('*').eq('chave', chave).single();
      if (data) return data.valor;
    }
    const todos = await localDB.getAll('configuracoes');
    const cfg = todos.find(c => c.chave === chave);
    return cfg ? cfg.valor : null;
  }

  async setConfig(chave, valor, descricao = '') {
    const cfg = { chave, valor: String(valor), descricao, updated_at: new Date().toISOString() };
    if (!this.offlineMode) {
      await supabaseClient.from('configuracoes').upsert(cfg);
    }
    await localDB.put('configuracoes', cfg);
    return cfg;
  }

  // ===== SINCRONIZAÇÃO =====
  async sincronizarTabela(tabela) {
    if (this.offlineMode) return false;
    try {
      const { data, error } = await supabaseClient.from(tabela).select('*');
      if (error) throw error;
      if (data) await localDB.cacheTabela(tabela, data);
      return true;
    } catch (e) {
      return false;
    }
  }

  async sincronizarTudo() {
    const resultados = {};
    for (const tabela of TABELAS) {
      resultados[tabela] = await this.sincronizarTabela(tabela);
    }
    return resultados;
  }
}

const db = new Database();
