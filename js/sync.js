/* ============================================
   GESTÃO DE LOJA - Sincronização Offline/Online
   ============================================ */

class SyncManager {
  constructor() {
    this.sincronizando = false;
    this.ultimoSync = null;
    this.intervalo = null;
  }

  // Iniciar monitoramento
  iniciar() {
    // Escutar mudanças de conectividade
    window.addEventListener('online', () => this.onOnline());
    window.addEventListener('offline', () => this.onOffline());

    // Sync periódico a cada 30 segundos
    this.intervalo = setInterval(() => this.verificarSync(), 30000);

    // Status inicial
    this.atualizarIndicador(navigator.onLine);
  }

  onOnline() {
    console.log('[SYNC] Conexão restaurada');
    this.atualizarIndicador(true);
    U.alert('Conexão restaurada! Sincronizando...', 'success');
    this.processarFila();
    this.sincronizarDados();
  }

  onOffline() {
    console.log('[SYNC] Modo offline');
    this.atualizarIndicador(false);
    U.alert('Modo offline ativado. Dados serão salvos localmente.', 'warning');
  }

  atualizarIndicador(online) {
    const el = U.el('#sync-indicator');
    if (!el) return;
    if (online) {
      el.className = 'sync-indicator';
      el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--secondary);display:inline-block;"></span>Online';
    } else {
      el.className = 'sync-indicator offline';
      el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--danger);display:inline-block;"></span>Offline';
    }
  }

  // Verificar e sincronizar
  async verificarSync() {
    if (!navigator.onLine || this.sincronizando) return;
    await this.processarFila();
  }

  // Processar fila de sync
  async processarFila() {
    if (this.sincronizando) return;
    this.sincronizando = true;

    const indicador = U.el('#sync-indicator');
    if (indicador) {
      indicador.className = 'sync-indicator syncing';
      indicador.innerHTML = '<span class="spin" style="font-size:0.875rem;">↻</span> Sincronizando...';
    }

    try {
      const fila = await localDB.getSyncQueue();
      if (fila.length === 0) {
        this.atualizarIndicador(true);
        this.sincronizando = false;
        return;
      }

      console.log(`[SYNC] Processando ${fila.length} itens...`);

      for (const item of fila) {
        try {
          if (item.tentativas >= 5) {
            await localDB.removeSyncQueue(item.id);
            continue;
          }

          const dados = item.dados;

          switch (item.operacao) {
            case 'insert':
              await supabaseClient.from(item.tabela).insert(dados);
              break;
            case 'upsert':
              await supabaseClient.from(item.tabela).upsert(dados);
              break;
            case 'update':
              await supabaseClient.from(item.tabela).update(dados).eq('id', dados.id);
              break;
            case 'delete':
              await supabaseClient.from(item.tabela).delete().eq('id', dados.id);
              break;
          }

          await localDB.removeSyncQueue(item.id);
        } catch (e) {
          console.error(`[SYNC] Erro no item ${item.id}:`, e);
          item.tentativas = (item.tentativas || 0) + 1;
          await localDB.put('sync_queue', item);
        }
      }

      this.ultimoSync = new Date();
      console.log('[SYNC] Concluído');
    } catch (e) {
      console.error('[SYNC] Erro:', e);
    } finally {
      this.sincronizando = false;
      this.atualizarIndicador(navigator.onLine);
    }
  }

  // Sincronizar todos os dados do servidor
  async sincronizarDados() {
    if (!navigator.onLine) return;
    try {
      await db.sincronizarTudo();
      console.log('[SYNC] Dados sincronizados do servidor');
    } catch (e) {
      console.error('[SYNC] Erro ao sincronizar dados:', e);
    }
  }

  // Parar
  parar() {
    if (this.intervalo) clearInterval(this.intervalo);
  }
}

const syncManager = new SyncManager();
