# Gestão de Loja

ERP web para gestão de Bombas de Combustível e Loja de Conveniência em Moçambique.

## Funcionalidades

- **Autenticação por PIN** (Gestor: 7777777770, Caixa: 0000000007)
- **Dashboard** com estatísticas, gráficos e previsões
- **Combustível** - Abastecimentos e entradas de cisterna
- **Loja** - Vendas com checkout sequencial
- **Armazém** - Gestão de stock, transferências, entrada de produtos
- **Movimentos** - Entradas, saídas, transferências
- **Inventário** - Contagem de tanques e produtos
- **Turno** - Fechamento com resumo financeiro
- **Relatórios** - Análise de vendas, lucros e combustível
- **Offline-first** - IndexedDB com sync automático para Supabase
- **Controle de permissões** - Gestor vê tudo, caixa vê apenas o necessário

## Stack

- HTML5 + CSS3 Puro + JavaScript Vanilla ES6+
- Supabase (PostgreSQL + PostgREST)
- IndexedDB para cache offline
- GitHub Pages para deploy

## Deploy

1. Configure o Supabase (execute o SQL do modelo de dados)
2. Faça upload dos ficheiros para um repositório GitHub
3. Ative GitHub Pages
4. Acesse: `https://seu-user.github.io/gestao-de-loja/`

## Credenciais

- **Gestor:** PIN `7777777770` - Acesso total
- **Caixa:** PIN `0000000007` - Vendas, stock, movimentos

## Estrutura

```
gestao-de-loja/
├── index.html          # Login PIN
├── gestor.html         # Página do Gestor (SPA)
├── caixa.html          # Página do Caixa (SPA)
├── css/
│   └── style.css       # CSS puro
├── js/
│   ├── config.js       # Config Supabase
│   ├── formulas.js     # Fórmulas matemáticas
│   ├── utils.js        # Utilitários
│   ├── db-local.js     # IndexedDB
│   ├── auth.js         # Autenticação PIN
│   ├── db.js           # CRUD Supabase
│   ├── sync.js         # Sincronização
│   ├── historico.js    # Audit trail
│   ├── app-gestor.js   # SPA Gestor
│   └── app-caixa.js    # SPA Caixa
└── README.md
```
