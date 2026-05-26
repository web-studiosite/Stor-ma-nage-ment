/* ============================================
   GESTÃO DE LOJA - Autenticação PIN
   ============================================ */

class Auth {
  constructor() {
    this.perfil = null;
    this.token = null;
  }

  // Verificar PIN
  async verificarPIN(pin) {
    // Verificar PINs fixos primeiro
    if (pin === PIN_GESTOR) {
      return {
        id: 'gestor-principal',
        pin: PIN_GESTOR,
        nome: 'Gestor Principal',
        role: 'gestor_principal',
        ativo: true
      };
    }
    if (pin === PIN_CAIXA) {
      return {
        id: 'caixa-padrao',
        pin: PIN_CAIXA,
        nome: 'Caixa',
        role: 'gestor_caixa',
        ativo: true
      };
    }

    // Tentar buscar no Supabase
    try {
      const { data, error } = await supabaseClient
        .from('perfis')
        .select('*')
        .eq('pin', pin)
        .eq('ativo', true)
        .single();

      if (error || !data) return null;
      return data;
    } catch (e) {
      // Offline: tentar IndexedDB
      const perfis = await localDB.getAll('perfis');
      return perfis.find(p => p.pin === pin && p.ativo) || null;
    }
  }

  // Login
  async login(pin) {
    const perfil = await this.verificarPIN(pin);
    if (!perfil) return { sucesso: false, erro: 'PIN inválido' };

    this.perfil = perfil;
    this.token = btoa(pin + Date.now());

    // Guardar sessão
    const sessao = {
      perfil_id: perfil.id,
      nome: perfil.nome,
      role: perfil.role,
      token: this.token,
      login_em: new Date().toISOString()
    };

    try {
      localStorage.setItem('sessao', JSON.stringify(sessao));
      await localDB.setSessao(sessao);
    } catch (e) {
      // Private mode
    }

    // Atualizar último login no Supabase
    try {
      await supabaseClient
        .from('perfis')
        .update({ ultimo_login: new Date().toISOString() })
        .eq('id', perfil.id);
    } catch (e) {
      // offline
    }

    return { sucesso: true, perfil };
  }

  // Logout
  async logout() {
    this.perfil = null;
    this.token = null;
    localStorage.removeItem('sessao');
    await localDB.clearSessao();
    window.location.reload();
  }

  // Verificar sessão
  async verificarSessao() {
    try {
      const json = localStorage.getItem('sessao');
      if (!json) {
        const local = await localDB.getSessao();
        if (!local) return false;
        this.perfil = { id: local.perfil_id, nome: local.nome, role: local.role };
        this.token = local.token;
        return true;
      }
      const sessao = JSON.parse(json);
      if (!sessao.token) return false;

      // Verificar se perfil ainda existe
      const { data } = await supabaseClient
        .from('perfis')
        .select('*')
        .eq('id', sessao.perfil_id)
        .eq('ativo', true)
        .single();

      if (data) {
        this.perfil = data;
      } else {
        this.perfil = { id: sessao.perfil_id, nome: sessao.nome, role: sessao.role };
      }
      this.token = sessao.token;
      return true;
    } catch (e) {
      // Tentar local
      try {
        const local = await localDB.getSessao();
        if (local) {
          this.perfil = { id: local.perfil_id, nome: local.nome, role: local.role };
          this.token = local.token;
          return true;
        }
      } catch (e2) {}
      return false;
    }
  }

  // Getters
  get isGestor() { return this.perfil?.role === 'gestor_principal'; }
  get isCaixa() { return this.perfil?.role === 'gestor_caixa'; }
  get nome() { return this.perfil?.nome || ''; }
  get role() { return this.perfil?.role || ''; }
  get perfilId() { return this.perfil?.id || ''; }
  get estaLogado() { return !!this.token && !!this.perfil; }

  // Permissões
  podeVerLucros() { return this.isGestor; }
  podeVerCustos() { return this.isGestor; }
  podeAjustarStock() { return this.isGestor; }
  podeAprovarDivergencia(pct) { return this.isGestor || pct <= 5; }
  podeDefinirPrecos() { return this.isGestor; }
  podeVerRelatoriosFinanceiros() { return this.isGestor; }
  podeGerirUsuarios() { return this.isGestor; }
  podeVerPrevisoes() { return this.isGestor; }
}

const auth = new Auth();
