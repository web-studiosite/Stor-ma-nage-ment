/* ============================================
   GESTÃO DE LOJA - Utilitários
   ============================================ */

const U = {
  // DOM helpers
  el: (sel, ctx = document) => ctx.querySelector(sel),
  els: (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel)),
  on: (el, ev, fn) => el?.addEventListener(ev, fn),
  off: (el, ev, fn) => el?.removeEventListener(ev, fn),

  // Criar elemento
  create: (tag, attrs = {}, text = '') => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v);
    });
    if (text) el.textContent = text;
    return el;
  },

  // Mostrar/esconder
  show: (el) => { if (el) { el.classList.remove('d-none'); el.style.display = ''; } },
  hide: (el) => { if (el) { el.classList.add('d-none'); } },
  toggle: (el, show) => show ? U.show(el) : U.hide(el),

  // Mostrar seção SPA
  showSection: (id) => {
    U.els('.section').forEach(s => s.classList.remove('active'));
    const sec = U.el(id);
    if (sec) sec.classList.add('active');
    // Atualizar nav
    U.els('.nav-item').forEach(n => n.classList.remove('active'));
    const nav = U.el(`.nav-item[data-section="${id}"]`);
    if (nav) nav.classList.add('active');
    // Atualizar título
    const title = nav?.querySelector('.nav-label')?.textContent || '';
    const topbarTitle = U.el('#topbar-title');
    if (topbarTitle && title) topbarTitle.textContent = title;
  },

  // Alerta
  alert: (msg, type = 'info', container = null) => {
    const box = container || U.el('#alert-container') || document.body;
    const div = U.create('div', { className: `alert alert-${type}` }, msg);
    const icon = type === 'success' ? '✓' : type === 'danger' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
    div.prepend(U.create('span', {}, icon + ' '));
    box.insertBefore(div, box.firstChild);
    setTimeout(() => div.remove(), 5000);
  },

  // Confirmar
  confirm: (msg) => window.confirm(msg),

  // Prompt
  prompt: (msg, def = '') => window.prompt(msg, def),

  // Modal
  modal: (opts = {}) => {
    const { title, body, footer, large = false, onClose } = opts;
    const overlay = U.create('div', { className: 'modal-overlay' });
    const modal = U.create('div', { className: large ? 'modal modal-lg' : 'modal' });
    const header = U.create('div', { className: 'modal-header' });
    header.innerHTML = `<h3>${title || ''}</h3><button class="modal-close">&times;</button>`;
    const bodyEl = U.create('div', { className: 'modal-body' });
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body) bodyEl.appendChild(body);
    modal.appendChild(header);
    modal.appendChild(bodyEl);
    if (footer) {
      const foot = U.create('div', { className: 'modal-footer' });
      if (typeof footer === 'string') foot.innerHTML = footer;
      else if (footer) foot.appendChild(footer);
      modal.appendChild(foot);
    }
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const close = () => {
      overlay.remove();
      if (onClose) onClose();
    };
    U.on(U.el('.modal-close', overlay), 'click', close);
    U.on(overlay, 'click', (e) => { if (e.target === overlay) close(); });
    return { overlay, close };
  },

  // Loading
  loading: (show = true) => {
    let el = U.el('#global-loading');
    if (!el) {
      el = U.create('div', {
        id: 'global-loading',
        className: 'd-none',
        style: 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:9999;display:flex;align-items:center;justify-content:center;'
      });
      el.innerHTML = '<div style="background:#fff;padding:1.5rem 2rem;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,0.2);display:flex;align-items:center;gap:0.75rem;font-weight:600;"><div class="loading-spinner"></div>Carregando...</div>';
      document.body.appendChild(el);
    }
    el.style.display = show ? 'flex' : 'none';
  },

  // Debounce
  debounce: (fn, ms = 300) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  // Throttle
  throttle: (fn, ms = 300) => {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= ms) { last = now; fn(...args); }
    };
  },

  // Formatters
  formatMZN: (v) => Formulas.formatarMZN(v),
  formatDate: (d) => Formulas.formatarData(d),
  formatDateTime: (d) => Formulas.formatarDataHora(d),
  formatNum: (v, d = 2) => Formulas.formatarNumero(v, d),
  formatLitros: (v) => Formulas.formatarLitros(v),

  // Hoje
  hoje: () => new Date().toISOString().split('T')[0],
  agora: () => new Date().toISOString(),

  // Exportar CSV
  exportCSV: (dados, nome) => {
    if (!dados || dados.length === 0) return U.alert('Sem dados para exportar', 'warning');
    const cols = Object.keys(dados[0]);
    const csv = [
      cols.join(';'),
      ...dados.map(r => cols.map(c => {
        const v = r[c];
        if (v === null || v === undefined) return '';
        const s = String(v).replace(/"/g, '""');
        return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
      }).join(';'))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = U.create('a', { href: URL.createObjectURL(blob), download: `${nome}_${U.hoje()}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  },

  // Imprimir
  print: () => window.print(),

  // Online status
  isOnline: () => navigator.onLine,

  // Aguardar
  sleep: (ms) => new Promise(r => setTimeout(r, ms)),

  // Grupo por
  groupBy: (arr, key) => arr.reduce((g, i) => { (g[i[key]] = g[i[key]] || []).push(i); return g; }, {}),

  // Somar por
  sumBy: (arr, key) => arr.reduce((s, i) => s + (Number(i[key]) || 0), 0),

  // Único por
  uniqueBy: (arr, key) => [...new Map(arr.map(i => [i[key], i])).values()],

  // Ordenar por
  sortBy: (arr, key, desc = false) => [...arr].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  }),

  // Render template string
  tpl: (str, data) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] ?? ''),

  // Safe HTML
  esc: (str) => {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
};
