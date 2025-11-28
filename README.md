# TrueNorth API

> Copiloto de Importacao - Backend para validacao e classificacao automatica de documentos de comercio exterior brasileiro

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748.svg)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Sobre

TrueNorth API e um backend inteligente que automatiza a analise de documentos de importacao (invoices, DIs, XMLs) usando IA em duas etapas:

1. **Scraping** (Groq/Llama 3) - Extracao rapida e economica de dados brutos
2. **Analise** (GPT-4o) - Classificacao NCM com contexto do banco de dados brasileiro

### Principais Funcionalidades

- Upload e processamento de PDF, XML e imagens (PNG, JPG, WEBP, HEIC)
- Extracao automatica de dados com OCR para PDFs escaneados
- Classificacao NCM inteligente baseada em banco de dados de 266+ codigos
- Identificacao automatica de orgaos anuentes (ANVISA, ANATEL, INMETRO, etc.)
- Calculo de custos potenciais de erros e multas
- Autenticacao JWT para historico de operacoes por usuario

### Stack Tecnologico

- **Runtime**: Node.js 18+
- **Framework**: Express 5
- **Linguagem**: TypeScript
- **Banco de Dados**: PostgreSQL + Prisma ORM
- **IA Scraping**: Groq (Llama 3.3 70B)
- **IA Analise**: OpenAI GPT-4o
- **OCR**: GPT-4o Vision / pdf-to-png-converter

## Inicio Rapido

### Pre-requisitos

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Conta Groq (gratuita) ou OpenAI

### Instalacao

```bash
# Clone o repositorio
git clone https://github.com/estevaoantuness/truenorth-api.git
cd truenorth-api

# Instale dependencias
npm install

# Configure variaveis de ambiente
cp .env.example .env
```

### Variaveis de Ambiente

| Variavel | Descricao | Obrigatorio |
|----------|-----------|-------------|
| `DATABASE_URL` | Connection string PostgreSQL | Sim |
| `OPENAI_API_KEY` | Chave da API OpenAI (analista) | Sim |
| `GROQ_API_KEY` | Chave da API Groq (scraper) | Nao* |
| `SCRAPER_PROVIDER` | Provedor de scraping: `groq` ou `openai` | Nao |
| `JWT_SECRET` | Segredo para tokens JWT | Sim |
| `PORT` | Porta do servidor (padrao: 3001) | Nao |

*Se GROQ_API_KEY nao estiver configurada, usa OpenAI como fallback

### Configurar Banco de Dados

```bash
# Gerar cliente Prisma
npm run prisma:generate

# Rodar migracoes
npm run prisma:migrate

# Popular com NCMs e Anuentes
npm run prisma:seed
```

### Executar

```bash
# Desenvolvimento
npm run dev

# Producao
npm run build
npm start
```

## Endpoints da API

### Autenticacao

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Usuario atual |

### Upload e Processamento

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/upload` | Upload de documento (requer auth) |
| GET | `/api/upload/:id` | Status do upload |

### Validacao

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/validate/:id` | Validar operacao |
| GET | `/api/validate/anuentes` | Listar anuentes |
| GET | `/api/validate/tipos-erro` | Listar tipos de erro |

### Operacoes

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/operations` | Listar operacoes do usuario |
| GET | `/api/operations/:id` | Detalhes da operacao |
| GET | `/api/operations/stats/summary` | Estatisticas |
| DELETE | `/api/operations/:id` | Excluir operacao |

### NCM

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/ncm/:codigo` | Buscar NCM por codigo |
| GET | `/api/ncm/search?q=termo` | Pesquisar NCMs |

## Estrutura do Projeto

```
truenorth-api/
├── src/
│   ├── index.ts              # Entry point
│   ├── middleware/
│   │   └── auth.ts           # JWT middleware
│   ├── routes/
│   │   ├── auth.ts           # Autenticacao
│   │   ├── upload.ts         # Upload de arquivos
│   │   ├── validate.ts       # Validacao
│   │   ├── operations.ts     # CRUD operacoes
│   │   ├── ncm.ts            # Consulta NCM
│   │   └── process.ts        # Processamento
│   ├── services/
│   │   ├── scrapers/         # Provedores de scraping
│   │   │   ├── types.ts      # Interfaces
│   │   │   ├── groq.ts       # Groq Llama 3
│   │   │   ├── openai.ts     # OpenAI fallback
│   │   │   └── index.ts      # Factory
│   │   ├── analyst.ts        # GPT-4o + DB context
│   │   ├── extractionPipeline.ts  # Orquestrador
│   │   ├── validationService.ts   # Regras de validacao
│   │   └── geminiService.ts  # Legacy (deprecated)
│   └── utils/
│       ├── pdfParser.ts      # Extracao de texto PDF
│       └── xmlParser.ts      # Parser XML
├── prisma/
│   ├── schema.prisma         # Schema do banco
│   └── seed.ts               # Dados iniciais
└── package.json
```

## Pipeline de Extracao

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Documento  │────>│  Stage 1        │────>│  Stage 2        │
│  PDF/IMG/XML│     │  Groq (Llama 3) │     │  GPT-4o + DB    │
└─────────────┘     │  Scraping       │     │  Classificacao  │
                    └─────────────────┘     └─────────────────┘
                           │                       │
                           v                       v
                    ┌─────────────┐         ┌─────────────┐
                    │ Dados Brutos│         │ NCM + Setor │
                    │ JSON simples│         │ + Anuentes  │
                    └─────────────┘         └─────────────┘
```

## Banco de Dados

### NCMs Incluidos (266+)

- Eletronicos (smartphones, laptops, TVs)
- Autopecas (freios, embreagens, filtros)
- Cosmeticos (cremes, perfumes, maquiagem)
- Alimentos (chocolates, vinhos, azeites)
- Maquinas industriais
- Texteis e vestuario
- Quimicos
- Equipamentos medicos
- Brinquedos
- Materiais de construcao

### Anuentes Configurados (16)

ANVISA, ANATEL, INMETRO, IBAMA, MAPA, DECEX, ANP, CNEN, Exercito, ANCINE, DNPM, Policia Federal, SUFRAMA, MDIC, Banco Central, CITES

## Desenvolvimento

```bash
# Rodar testes
npm test

# Verificar tipos
npm run build

# Abrir Prisma Studio
npm run prisma:studio
```

## Deploy

O projeto esta configurado para deploy automatico no Railway:

1. Conecte o repositorio ao Railway
2. Configure as variaveis de ambiente
3. O deploy acontece automaticamente a cada push

## Licenca

MIT License - veja [LICENSE](LICENSE) para detalhes.

## Contato

- **Autor**: Estevao Antunes
- **Repositorio**: [github.com/estevaoantuness/truenorth-api](https://github.com/estevaoantuness/truenorth-api)
