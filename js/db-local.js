/* ============================================
   GESTÃO DE LOJA - IndexedDB (Offline)
   ============================================ */

class LocalDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        TABELAS.forEach(tabela => {
          if (!db.objectStoreNames.contains(tabela)) {
            db.createObjectStore(tabela, { keyPath: 'id' });
          }
        });
        // Store para fila de sync
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
        // Store para sessão
        if (!db.objectStoreNames.contains('sessao')) {
          db.createObjectStore('sessao', { keyPath: 'chave' });
        }
      };
    });
  }

  // CRUD genérico
  async getAll(tabela) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(tabela, 'readonly');
      const store = tx.objectStore(tabela);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async get(tabela, id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(tabela, 'readonly');
      const store = tx.objectStore(tabela);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(tabela, dados) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(tabela, 'readwrite');
      const store = tx.objectStore(tabela);
      const req = store.put(dados);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(tabela, id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(tabela, 'readwrite');
      const store = tx.objectStore(tabela);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clear(tabela) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(tabela, 'readwrite');
      const store = tx.objectStore(tabela);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Bulk put
  async putAll(tabela, dados) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(tabela, 'readwrite');
      const store = tx.objectStore(tabela);
      dados.forEach(d => store.put(d));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Fila de sincronização
  async addSyncQueue(tabela, operacao, dados) {
    const item = {
      tabela,
      operacao,
      dados,
      criado_em: new Date().toISOString(),
      tentativas: 0
    };
    return this.put('sync_queue', item);
  }

  async getSyncQueue() {
    return this.getAll('sync_queue');
  }

  async removeSyncQueue(id) {
    return this.delete('sync_queue', id);
  }

  // Sessão
  async setSessao(dados) {
    return this.put('sessao', { chave: 'atual', ...dados });
  }

  async getSessao() {
    return this.get('sessao', 'atual');
  }

  async clearSessao() {
    return this.delete('sessao', 'atual');
  }

  // Cache de tabela
  async cacheTabela(tabela, dados) {
    await this.clear(tabela);
    await this.putAll(tabela, dados);
  }
}

const localDB = new LocalDB();
