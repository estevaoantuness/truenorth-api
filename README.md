# TrueNorth API

> Copiloto de Importacao com IA - Backend para automacao e validacao de documentos de comercio exterior brasileiro

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Gemini](https://img.shields.io/badge/Gemini_AI-2.0_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Sobre

O **TrueNorth API** e o backend de um copiloto de importacao que utiliza IA (Google Gemini 2.0 Flash) para automatizar a extracao, classificacao e validacao de documentos de comercio exterior brasileiro.

### Funcionalidades Principais

- **Extracao Inteligente de Documentos**: Processa PDFs e XMLs de invoices comerciais
- **Classificacao NCM Automatica**: Sugere codigos NCM baseado em banco de dados real com 500+ codigos
- **Validacao de Compliance**: Identifica anuentes necessarios (ANVISA, MAPA, IBAMA, ANATEL, etc.)
- **Estimativa de Impostos**: Calcula II, IPI e PIS/COFINS automaticamente baseado nas aliquotas do NCM
- **Deteccao de Subfaturamento**: Analise inteligente de valor/peso por setor
- **Geracao de Descricao para DI**: Texto tecnico formatado para Portal Unico
- **Feedback de Especialista**: Dicas autoritativas de consultor de comercio exterior via IA

### Stack Tecnologico

- **Runtime**: Node.js 18+
- **Framework**: Express 5
- **Linguagem**: TypeScript
- **Banco de Dados**: PostgreSQL + Prisma ORM
- **IA**: Google Gemini 2.0 Flash (100%)
- **Autenticacao**: JWT + bcrypt

## Estrutura do Projeto

```
truenorth-api/
├── src/
│   ├── index.ts                 # Entry point
│   ├── middleware/
│   │   └── auth.ts              # JWT authentication
│   ├── routes/
│   │   ├── auth.ts              # Login/Register
│   │   ├── upload.ts            # File upload
│   │   ├── process.ts           # Document processing
│   │   ├── validate.ts          # Validation endpoints
│   │   ├── operations.ts        # Operations history
│   │   └── ncm.ts               # NCM lookup
│   ├── services/
│   │   ├── analyst.ts           # Gemini analyst (classification + feedback)
│   │   ├── extractionPipeline.ts
│   │   ├── validationService.ts # Business rules validation
│   │   └── scrapers/            # Multi-provider extraction
│   │       ├── gemini.ts        # Primary provider
│   │       ├── groq.ts          # Legacy fallback
│   │       ├── openai.ts        # Legacy fallback
│   │       └── types.ts
│   └── utils/
│       ├── pdfParser.ts
│       └── xmlParser.ts
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── seed.ts                  # NCM & anuentes seed data
└── package.json
```

## Getting Started

### Pre-requisitos

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Conta Google AI Studio (para API key do Gemini)

### Instalacao

```bash
# Clone o repositorio
git clone https://github.com/estevaoantuness/truenorth-api.git
cd truenorth-api

# Instale as dependencias
npm install

# Configure as variaveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configuracoes

# Execute as migrations e seed
npx prisma migrate dev
npm run prisma:seed

# Inicie o servidor
npm run dev
```

### Variaveis de Ambiente

| Variavel | Descricao | Obrigatorio |
|----------|-----------|-------------|
| `DATABASE_URL` | Connection string PostgreSQL | Sim |
| `GEMINI_API_KEY` | API key do Google AI Studio | Sim |
| `JWT_SECRET` | Secret para tokens JWT | Sim |
| `PORT` | Porta do servidor (default: 3001) | Nao |
| `GEMINI_MODEL` | Modelo Gemini (default: gemini-2.0-flash) | Nao |

## API Endpoints

### Autenticacao

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Login e obtencao de token JWT |
| GET | `/api/auth/me` | Usuario atual (requer auth) |

### Upload e Processamento

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/upload` | Upload de documento PDF/XML (requer auth) |
| POST | `/api/process/:id` | Reprocessar documento |

**Response do Upload**:
```json
{
  "operationId": "uuid",
  "status": "processed",
  "dadosExtraidos": {
    "invoice_number": "INV-2024-001",
    "supplier": { "name": "...", "country": "CN" },
    "items": [{
      "description": "Notebook Dell Latitude 5540",
      "ncm_sugerido": "84713012",
      "ncm_confianca": "ALTA",
      "anuentes_necessarios": ["ANATEL"]
    }],
    "impostos_estimados": {
      "ii": 1500.00,
      "ipi": 500.00,
      "pis_cofins": 1165.00,
      "total_impostos": 3165.00,
      "base_calculo": 10000.00
    },
    "descricao_di": "Computador portatil...",
    "alerta_subfaturamento": null,
    "feedback_especialista": "Operacoes com NCM 8471 originarias da China..."
  }
}
```

### Validacao

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/validate/:id` | Validar operacao e calcular riscos |
| GET | `/api/validate/anuentes` | Listar anuentes disponiveis |
| GET | `/api/validate/tipos-erro` | Listar tipos de erro com custos |

### NCM

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/ncm/:codigo` | Buscar NCM por codigo |
| GET | `/api/ncm/search?q=termo` | Pesquisar NCMs por descricao |

### Operacoes

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/operations` | Listar operacoes do usuario |
| GET | `/api/operations/:id` | Detalhes de uma operacao |
| GET | `/api/operations/stats/summary` | Estatisticas do usuario |
| DELETE | `/api/operations/:id` | Excluir operacao |

## Pipeline de Processamento

O sistema utiliza um pipeline de 2 estagios com Gemini:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Documento  │ ──▶ │   Scraper    │ ──▶ │    Analyst      │
│  (PDF/XML)  │     │ Gemini Flash │     │ Gemini + DB     │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │                     │
                           ▼                     ▼
                    Raw Extraction        Classified Result
                    - invoice_number      - NCM sugerido
                    - items (desc)        - Anuentes
                    - values              - Impostos estimados
                                          - Descricao DI
                                          - Alerta subfaturamento
                                          - Feedback especialista
```

1. **Scraper**: Extrai dados brutos do documento (Gemini Flash)
2. **Analyst**: Classifica NCMs com contexto do banco de dados + gera outputs adicionais

## Banco de Dados

### Modelos

- **NcmDatabase**: 500+ NCMs com aliquotas (II, IPI) e anuentes
- **Anuente**: 16 orgaos fiscalizadores com custos de multa
- **TipoErro**: Tipos de erro com custos variaveis por setor
- **User**: Usuarios do sistema
- **Operacao**: Historico de operacoes com dados JSONB

### NCMs por Capitulo

| Capitulo | Setor | Quantidade |
|----------|-------|------------|
| 29-30 | Quimicos/Farmaceuticos | ~50 |
| 33 | Cosmeticos | ~30 |
| 39 | Plasticos | ~40 |
| 82 | Ferramentas/Cutelaria | ~40 |
| 84-85 | Maquinas/Eletronicos | ~150 |
| 87 | Autopecas | ~50 |
| Outros | Diversos | ~140 |

### Seed

```bash
npm run prisma:seed
```

## Scripts

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Inicia servidor em desenvolvimento |
| `npm run build` | Compila TypeScript |
| `npm start` | Inicia servidor em producao |
| `npm run prisma:generate` | Gera Prisma Client |
| `npm run prisma:migrate` | Executa migrations |
| `npm run prisma:seed` | Popula banco com dados iniciais |
| `npm run prisma:studio` | Abre Prisma Studio |

## Custos de API

Usando **Gemini 2.0 Flash** (~5.800 tokens input + ~2.400 tokens output por request):

| Volume | Custo/mes |
|--------|-----------|
| 100 req/dia | ~$4.62 (GRATIS no tier gratuito) |
| 500 req/dia | ~$23 |
| 1000 req/dia | ~$46 |

**Nota**: Gemini oferece 1.500 requests/dia gratuitos, entao ate ~1.500 req/dia e gratis.

## Deploy

O projeto esta configurado para deploy no Railway:

1. Conecte o repositorio ao Railway
2. Configure as variaveis de ambiente
3. O deploy acontece automaticamente a cada push

## Licenca

Este projeto esta licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## Links

- **Frontend**: [truenorthsite](https://github.com/estevaoantuness/truenorthsite)
- **Autor**: Estevao Antunes
