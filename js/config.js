/* ============================================
   GESTÃO DE LOJA - Configuração Supabase
   ============================================ */

const SUPABASE_URL = 'https://wyesnptpaobrfepszrdk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5ZXNucHRwYW9icmZlcHN6cmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTg4NjgsImV4cCI6MjA5NDA3NDg2OH0.X4oWiiSP66Wz2-ZI-fU-h9yodTp-LxlrZicEBd__pCQ';

// PINs fixos
const PIN_GESTOR = '7777777770';
const PIN_CAIXA = '0000000007';

// Nome do sistema
const APP_NAME = 'Gestão de Loja';

// Versão
const APP_VERSION = '1.0.0';

// Config IndexedDB
const IDB_NAME = 'GestaoLojaDB';
const IDB_VERSION = 1;

// Tabelas do sistema
const TABELAS = [
  'perfis',
  'bombas',
  'tanques',
  'entradas_combustivel',
  'custo_medio_tanque',
  'abastecimentos',
  'produtos',
  'vendas_loja',
  'movimentos_stock',
  'fechamentos_turno',
  'inventarios',
  'inventario_itens',
  'historico',
  'configuracoes'
];

// Tipos de combustível
const TIPOS_COMBUSTIVEL = ['gasolina', 'gasoleo', 'petroleo'];

// Tipos de pagamento
const TIPOS_PAGAMENTO = ['dinheiro', 'mpesa', 'emola', 'cartao', 'divida'];

// Turnos
const TURNOS = ['manha', 'tarde', 'noite'];

// Formas de tanque
const FORMAS_TANQUE = ['cilindrico_horizontal', 'cilindrico_vertical', 'retangular'];

// Tipos de movimento
const TIPOS_MOVIMENTO = ['entrada', 'saida', 'transferencia', 'ajuste'];

// Tipos de inventário
const TIPOS_INVENTARIO = ['tanques', 'loja', 'armazem', 'completo'];

// Exportar config
if (typeof module !== 'undefined') {
  module.exports = { SUPABASE_URL, SUPABASE_ANON_KEY, PIN_GESTOR, PIN_CAIXA };
}
