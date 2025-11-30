# 🚀 Plano Concreto de Melhorias - TrueNorth API

**Data**: 2025-11-29
**Versão**: 1.0
**Baseado em**: Análise de Outsider com invoices reais

---

## 🎯 Objetivo Geral

**Aumentar accuracy de 66.7% → 80%+ em invoices reais**

Foco em 3 pilares:
1. **Tradução mais inteligente** (fix termos técnicos)
2. **Melhor UX para baixa confiança** (alertas + feedback)
3. **Dados mais ricos** (anuentes + validação)

---

## 📅 SPRINT 1: Fixes Críticos (1 semana)

### ✅ TAREFA 1.1: Lista "DO NOT TRANSLATE" (4h)

**Problema**: "Luer Lock" → "fechadura" (errado!)

**Solução**:
```typescript
// src/services/translatorService.ts

const TECHNICAL_TERMS_DO_NOT_TRANSLATE = [
  // Médico/Farmacêutico
  'Luer Lock', 'Luer', 'IV', 'IM', 'SC', 'Syringe',

  // Eletrônicos
  'TWS', 'USB-C', 'USB', 'HDMI', 'Bluetooth', 'Wi-Fi',
  'LED', 'OLED', 'LCD', 'AMOLED', 'IPS',
  'mAh', 'Ah', 'kW', 'MHz', 'GHz',

  // Certificações/Denominações
  'DOP', 'IGP', 'PDO', 'PGI', 'AOC', 'DOC',
  'ISO', 'CE', 'FDA', 'INMETRO', 'ANATEL',

  // Industrial
  'CNC', 'CAD', 'CAM', 'PLC', 'SCADA',
  'SRAM', 'DRAM', 'SSD', 'HDD',

  // Automotivo
  'ABS', 'EBD', 'ESP', 'TCS', 'OBD',

  // Químico
  'pH', 'ppm', 'CAS', 'IUPAC',
];

// Nova função
function preserveTechnicalTerms(text: string): {
  cleaned: string,
  placeholders: Map<string, string>
} {
  const placeholders = new Map<string, string>();
  let cleaned = text;

  TECHNICAL_TERMS_DO_NOT_TRANSLATE.forEach((term, index) => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    if (regex.test(cleaned)) {
      const placeholder = `__TECH_${index}__`;
      placeholders.set(placeholder, term);
      cleaned = cleaned.replace(regex, placeholder);
    }
  });

  return { cleaned, placeholders };
}

// Atualizar translateForComex()
export async function translateForComex(...) {
  // 1. Extrair termos técnicos
  const { cleaned, placeholders } = preserveTechnicalTerms(text);

  // 2. Traduzir texto sem termos técnicos
  const translated = await translateWithDictOrGemini(cleaned, sourceLang);

  // 3. Restaurar termos técnicos
  let final = translated;
  placeholders.forEach((original, placeholder) => {
    final = final.replace(placeholder, original);
  });

  return {
    original: text,
    translated: final,
    confidence: ...,
    technicalTermsPreserved: Array.from(placeholders.values())
  };
}
```

**Testes**:
```typescript
// tests/unit/translator-technical-terms.test.ts
test('Preserva termos médicos', () => {
  const result = translateForComex('Medical Syringes 10ml Luer Lock', 'en');
  expect(result.translated).toContain('Luer Lock'); // Não traduzido
  expect(result.translated).toContain('médico'); // Traduzido
});
```

**Impacto Esperado**: +10pp accuracy (elimina ~30% dos erros)

---

### ✅ TAREFA 1.2: Alert de Baixa Confiança no Frontend (2h)

**Problema**: Score 4.03 mas usuário não sabe que é baixo

**Solução Backend**:
```typescript
// src/services/ncmService.ts
export interface NcmSearchResult {
  ncm: string;
  descricao: string;
  setor: string;
  score: number;
  confidence: 'high' | 'medium' | 'low'; // NOVO
}

function calculateConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 10.0) return 'high';
  if (score >= 5.0) return 'medium';
  return 'low';
}

// Adicionar ao retorno
return results.map(r => ({
  ...r,
  confidence: calculateConfidence(r.score)
}));
```

**Solução Frontend** (assumindo React/Next.js):
```tsx
// components/NcmSearchResults.tsx
function NcmResultCard({ result }: { result: NcmSearchResult }) {
  return (
    <div className="ncm-card">
      <div className="ncm-header">
        <span className="ncm-code">{result.ncm}</span>
        {result.confidence === 'low' && (
          <Badge variant="warning">
            ⚠️ Baixa Confiança
          </Badge>
        )}
      </div>

      <p className="ncm-description">{result.descricao}</p>

      {result.confidence === 'low' && (
        <Alert type="warning">
          <p>Este NCM pode não ser o ideal. Considere:</p>
          <ul>
            <li>Refinar a descrição do produto</li>
            <li>Verificar o setor selecionado</li>
            <li>Consultar um especialista</li>
          </ul>
          <Button onClick={() => requestExpertHelp(result)}>
            📞 Solicitar Ajuda
          </Button>
        </Alert>
      )}
    </div>
  );
}
```

**Impacto Esperado**: +5pp user confidence (não accuracy, mas UX melhor)

---

### ✅ TAREFA 1.3: Re-tradução Automática para Queries com 0 Resultados (6h)

**Problema**: "Eau de Parfum" → 0 resultados

**Solução**:
```typescript
// src/services/ncmService.ts

async function searchWithAutoRetry(
  query: string,
  sector?: string,
  language?: string
): Promise<NcmSearchResult[]> {

  // Tentativa 1: Busca direta
  let results = await searchNcmByDescription(query, sector);

  // Se encontrou resultados OU query já está em português, retornar
  if (results.length > 0 || language === 'pt') {
    return results;
  }

  console.log('[NCM AutoRetry] Zero results, detecting untranslated terms...');

  // Tentativa 2: Detectar termos em inglês/francês/espanhol
  const detectedLang = detectLanguage(query);

  if (detectedLang !== 'pt') {
    console.log(`[NCM AutoRetry] Detected ${detectedLang}, re-translating...`);

    try {
      const translationResult = await translateForComex(query, detectedLang);
      console.log(`[NCM AutoRetry] Re-translated: "${translationResult.translated}"`);

      // Retry com query traduzida
      results = await searchNcmByDescription(translationResult.translated, sector);

      if (results.length > 0) {
        console.log(`[NCM AutoRetry] SUCCESS! Found ${results.length} results after translation`);

        // Adicionar flag indicando que foi retranslated
        results = results.map(r => ({
          ...r,
          wasRetranslated: true,
          originalQuery: query
        }));
      }
    } catch (error) {
      console.error('[NCM AutoRetry] Translation failed:', error);
    }
  }

  // Tentativa 3: Busca relaxada (sem setor)
  if (results.length === 0 && sector) {
    console.log('[NCM AutoRetry] Trying without sector filter...');
    results = await searchNcmByDescription(query, undefined);

    if (results.length > 0) {
      console.log(`[NCM AutoRetry] Found ${results.length} results without sector`);
      results = results.map(r => ({ ...r, relaxedSearch: true }));
    }
  }

  return results;
}

// Expor nova função
export { searchWithAutoRetry };
```

**Atualizar API**:
```typescript
// src/routes/ncm.ts
app.get('/api/ncm/search', async (req, res) => {
  const { query, sector, language } = req.query;

  const results = await searchWithAutoRetry(
    query as string,
    sector as string,
    language as string // Novo parâmetro
  );

  res.json({
    results,
    meta: {
      wasRetranslated: results[0]?.wasRetranslated || false,
      relaxedSearch: results[0]?.relaxedSearch || false,
      originalQuery: results[0]?.originalQuery
    }
  });
});
```

**Impacto Esperado**: +15pp accuracy (elimina casos de 0 resultados)

---

## 📅 SPRINT 2: Enriquecimento de Dados (1 semana)

### ✅ TAREFA 2.1: Enriquecimento de Anuentes nos Top 1000 NCMs (8h)

**Problema**: NCM 15092000 (azeite) não indica MAPA necessário

**Solução - Fase 1: Script de Enriquecimento**:
```typescript
// src/scripts/enrichNcmAnuentes.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeamento NCM → Anuentes (baseado em regulamentação)
const NCM_ANUENTES_MAP: Record<string, string[]> = {
  // Alimentos (MAPA)
  '15091000': ['MAPA'], // Azeite virgem
  '15092000': ['MAPA'], // Azeite extra virgem
  '04061000': ['MAPA', 'ANVISA'], // Queijos frescos

  // Farmacêutico/Médico (ANVISA)
  '30021':   ['ANVISA'], // Vacinas (todo capítulo 3002.1)
  '30041':   ['ANVISA'], // Medicamentos (todo capítulo 3004.1)
  '90181':   ['ANVISA'], // Equipamentos médicos (todo 9018.1)

  // Eletrônicos (ANATEL)
  '85171':   ['ANATEL'], // Telefones celulares
  '85176':   ['ANATEL'], // Equipamentos de comunicação

  // Químicos controlados (Polícia Federal + ANVISA)
  '29333':   ['PF', 'ANVISA'], // Precursores químicos

  // Agrotóxicos (IBAMA + MAPA + ANVISA)
  '38081':   ['IBAMA', 'MAPA', 'ANVISA'], // Inseticidas

  // Armas e munições (Exército)
  '93':      ['EXERCITO'], // Todo capítulo 93
};

async function enrichAnuentes() {
  console.log('🚀 Starting anuentes enrichment...\n');

  let updated = 0;

  for (const [ncmPrefix, anuentes] of Object.entries(NCM_ANUENTES_MAP)) {
    // Atualizar todos NCMs que começam com o prefix
    const result = await prisma.ncmDatabase.updateMany({
      where: {
        ncm: { startsWith: ncmPrefix },
        anuentes: { isEmpty: true } // Só atualizar se vazio
      },
      data: {
        anuentes,
        requerLpco: anuentes.length > 0,
        updatedAt: new Date()
      }
    });

    if (result.count > 0) {
      console.log(`✅ Updated ${result.count} NCMs starting with ${ncmPrefix}`);
      console.log(`   Anuentes: ${anuentes.join(', ')}\n`);
      updated += result.count;
    }
  }

  console.log(`\n🎉 Total updated: ${updated} NCMs`);

  // Estatísticas pós-enriquecimento
  const stats = await prisma.ncmDatabase.groupBy({
    by: ['anuentes'],
    _count: { ncm: true },
    where: {
      NOT: { anuentes: { isEmpty: true } }
    }
  });

  console.log('\n📊 Anuentes Distribution:');
  stats.forEach(s => {
    console.log(`   ${s.anuentes.join(', ')}: ${s._count.ncm} NCMs`);
  });
}

enrichAnuentes();
```

**Executar**:
```bash
npx ts-node src/scripts/enrichNcmAnuentes.ts
```

**Validação**:
```typescript
// Após rodar script
const azeite = await prisma.ncmDatabase.findUnique({
  where: { ncm: '15092000' }
});

console.log(azeite.anuentes); // ['MAPA'] ✅
console.log(azeite.requerLpco); // true ✅
```

**Impacto Esperado**: 80%+ dos top NCMs com anuentes corretos

---

### ✅ TAREFA 2.2: Exibir Anuentes no Frontend (3h)

**Backend** - já retorna anuentes:
```typescript
// src/routes/ncm.ts (já existe)
app.get('/api/ncm/info/:code', async (req, res) => {
  const info = await getNcmInfo(req.params.code);

  res.json({
    ...info,
    anuentes: info.anuentes, // Já existe
    requerLpco: info.requerLpco // Já existe
  });
});
```

**Frontend**:
```tsx
// components/NcmDetailCard.tsx
function NcmDetailCard({ ncm }: { ncm: NcmInfo }) {
  return (
    <Card>
      <h3>NCM {ncm.ncm}</h3>
      <p>{ncm.descricao}</p>

      {/* NOVO: Alerta de anuentes */}
      {ncm.anuentes && ncm.anuentes.length > 0 && (
        <Alert type="warning">
          <h4>⚠️ Anuentes Necessários</h4>
          <p>Esta mercadoria requer licença/autorização de:</p>
          <ul>
            {ncm.anuentes.map(anuente => (
              <li key={anuente}>
                <strong>{anuente}</strong>
                <Button size="sm" onClick={() => openAnuenteGuide(anuente)}>
                  ℹ️ Como obter
                </Button>
              </li>
            ))}
          </ul>
          {ncm.requerLpco && (
            <p className="text-sm text-gray-600">
              📋 Requer LPCO (Licença Prévia de Importação) no Portal Único
            </p>
          )}
        </Alert>
      )}

      {/* Impostos, etc */}
    </Card>
  );
}
```

**Impacto Esperado**: Evita 100% de importações sem licença necessária

---

## 📅 SPRINT 3: Feedback Loop (2 semanas)

### ✅ TAREFA 3.1: Backend - Endpoint de Feedback (4h)

```typescript
// src/routes/feedback.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

app.post('/api/ncm/feedback', async (req, res) => {
  const {
    query,
    selectedNcm,
    suggestedNcm,
    helpful, // true/false
    userId, // opcional
    comments
  } = req.body;

  // 1. Salvar feedback
  const feedback = await prisma.ncmFeedback.create({
    data: {
      query,
      selectedNcm,
      suggestedNcm,
      helpful,
      userId,
      comments,
      detectedSector: await detectSector([{ description: query }]),
      timestamp: new Date()
    }
  });

  // 2. Se usuário sugeriu NCM diferente, analisar
  if (suggestedNcm && suggestedNcm !== selectedNcm) {
    // Verificar se NCM sugerido existe
    const suggestedExists = await prisma.ncmDatabase.findUnique({
      where: { ncm: suggestedNcm }
    });

    if (suggestedExists) {
      // Incrementar contador de "este deveria ser o correto"
      await prisma.ncmCorrection.upsert({
        where: {
          query_suggestedNcm: {
            query,
            suggestedNcm
          }
        },
        update: {
          count: { increment: 1 },
          lastSeen: new Date()
        },
        create: {
          query,
          suggestedNcm,
          count: 1,
          originalNcm: selectedNcm
        }
      });
    }
  }

  res.json({ success: true, feedbackId: feedback.id });
});

// Endpoint para dashboard interno
app.get('/api/admin/feedback/stats', async (req, res) => {
  const totalFeedback = await prisma.ncmFeedback.count();
  const helpful = await prisma.ncmFeedback.count({
    where: { helpful: true }
  });

  const topCorrections = await prisma.ncmCorrection.findMany({
    where: { count: { gte: 3 } }, // 3+ usuários sugeriram
    orderBy: { count: 'desc' },
    take: 20
  });

  res.json({
    totalFeedback,
    helpfulRate: (helpful / totalFeedback * 100).toFixed(1),
    topCorrections
  });
});
```

**Schema Prisma**:
```prisma
// prisma/schema.prisma

model NcmFeedback {
  id             Int      @id @default(autoincrement())
  query          String
  selectedNcm    String
  suggestedNcm   String?
  helpful        Boolean
  userId         String?
  comments       String?
  detectedSector String?
  timestamp      DateTime @default(now())

  @@map("ncm_feedback")
}

model NcmCorrection {
  id            Int      @id @default(autoincrement())
  query         String
  suggestedNcm  String
  originalNcm   String
  count         Int      @default(1)
  lastSeen      DateTime @default(now())

  @@unique([query, suggestedNcm])
  @@map("ncm_corrections")
}
```

---

### ✅ TAREFA 3.2: Frontend - Botões de Feedback (3h)

```tsx
// components/NcmFeedbackButtons.tsx

function NcmFeedbackButtons({
  query,
  selectedNcm
}: {
  query: string;
  selectedNcm: string;
}) {
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);

  const sendFeedback = async (helpful: boolean) => {
    await fetch('/api/ncm/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        selectedNcm,
        helpful
      })
    });

    setFeedbackSent(true);
    toast.success('Obrigado pelo feedback!');
  };

  if (feedbackSent) {
    return <p className="text-sm text-gray-600">✅ Feedback enviado</p>;
  }

  return (
    <div className="feedback-buttons">
      <p className="text-sm font-medium">Este NCM está correto?</p>
      <div className="flex gap-2 mt-2">
        <Button
          variant="success"
          size="sm"
          onClick={() => sendFeedback(true)}
        >
          👍 Sim, correto
        </Button>

        <Button
          variant="warning"
          size="sm"
          onClick={() => setShowSuggestModal(true)}
        >
          👎 Não, outro NCM
        </Button>
      </div>

      {showSuggestModal && (
        <SuggestNcmModal
          query={query}
          selectedNcm={selectedNcm}
          onClose={() => setShowSuggestModal(false)}
          onSubmit={(suggestedNcm, comments) => {
            sendFeedback(false);
            // Submit suggestion...
          }}
        />
      )}
    </div>
  );
}
```

**Impacto Esperado**:
- 20%+ dos usuários dão feedback
- Identificar top 10 queries problemáticas
- Melhorar dicionário baseado em sugestões reais

---

## 📅 SPRINT 4: Otimizações Finas (1 semana)

### ✅ TAREFA 4.1: Deduplicação de Traduções (2h)

```typescript
// src/services/translatorService.ts

function deduplicateWords(text: string): string {
  const words = text.toLowerCase().split(/\s+/);
  const seen = new Set<string>();
  const unique: string[] = [];

  words.forEach(word => {
    if (!seen.has(word) && word.length > 0) {
      seen.add(word);
      unique.push(word);
    }
  });

  return unique.join(' ');
}

// Adicionar ao translateForComex()
export async function translateForComex(...) {
  // ... tradução existente

  // Deduplicate antes de retornar
  const deduplicated = deduplicateWords(translated);

  return {
    original: text,
    translated: deduplicated,
    ...
  };
}
```

**Impacto Esperado**: Elimina "sem fio sem fio" → "sem fio"

---

### ✅ TAREFA 4.2: Logging e Métricas (4h)

```typescript
// src/services/ncmService.ts

// Log todas as buscas para análise
async function searchNcmByDescription(...) {
  const start = Date.now();

  // ... busca existente

  const duration = Date.now() - start;

  // Log para análise
  await prisma.searchLog.create({
    data: {
      query,
      sector,
      language,
      resultsCount: results.length,
      topScore: results[0]?.score || 0,
      topNCM: results[0]?.ncm,
      method: usedHybrid ? 'hybrid' : 'fts',
      durationMs: duration,
      timestamp: new Date()
    }
  });

  return results;
}
```

**Dashboard de Métricas**:
```typescript
// src/routes/admin.ts

app.get('/api/admin/metrics', async (req, res) => {
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const stats = {
    totalSearches: await prisma.searchLog.count({
      where: { timestamp: { gte: last30Days } }
    }),

    avgDuration: await prisma.searchLog.aggregate({
      _avg: { durationMs: true },
      where: { timestamp: { gte: last30Days } }
    }),

    zeroResults: await prisma.searchLog.count({
      where: {
        timestamp: { gte: last30Days },
        resultsCount: 0
      }
    }),

    topQueries: await prisma.searchLog.groupBy({
      by: ['query'],
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 10
    })
  };

  res.json(stats);
});
```

---

## 📊 Roadmap Completo (Priorizado)

| Sprint | Tarefas | Esforço | Impacto | Status |
|--------|---------|---------|---------|--------|
| **Sprint 1** | Fixes Críticos | **12h** | **🔴 Alto** | 📅 Próxima |
| 1.1 | DO NOT TRANSLATE list | 4h | +10pp | ⏳ |
| 1.2 | Alert baixa confiança | 2h | UX | ⏳ |
| 1.3 | Auto-retry tradução | 6h | +15pp | ⏳ |
| **Sprint 2** | Enriquecimento | **11h** | **🟡 Médio** | 📅 Semana 2 |
| 2.1 | Anuentes top 1000 NCMs | 8h | Compliance | ⏳ |
| 2.2 | UI anuentes | 3h | UX | ⏳ |
| **Sprint 3** | Feedback Loop | **7h** | **🟡 Médio** | 📅 Semana 3-4 |
| 3.1 | Backend feedback | 4h | Melhoria contínua | ⏳ |
| 3.2 | Frontend feedback | 3h | UX | ⏳ |
| **Sprint 4** | Otimizações | **6h** | **🟢 Baixo** | 📅 Semana 5 |
| 4.1 | Deduplicação | 2h | Clean | ⏳ |
| 4.2 | Logging/métricas | 4h | Monitoring | ⏳ |

**Total Esforço**: ~36 horas (1 mês com 1 dev)

---

## 🎯 Métricas de Sucesso (Before/After)

| Métrica | Antes | Meta | Como Medir |
|---------|-------|------|------------|
| **Accuracy (Invoices Reais)** | 66.7% | **80%+** | Re-run e2e tests |
| **Rank 1** | 33% | **60%+** | Análise logs |
| **Zero Resultados** | 17% | **<5%** | Count searches with 0 results |
| **Anuentes Detectados** | ~0% | **80%+** | Top 1000 NCMs com anuentes |
| **Feedback Rate** | 0% | **20%+** | Feedbacks / Total searches |
| **Avg Search Time** | 50ms | **<100ms** | Monitoring |
| **User Confidence (NPS)** | ? | **8+/10** | Survey pós-classificação |

---

## 🚀 Quick Wins (Pode fazer hoje - <4h)

Se quiser resultado rápido:

1. **DO NOT TRANSLATE** (4h) → +10pp accuracy imediatamente
2. **Alert baixa confiança** (2h) → Melhor UX, evita erros críticos
3. **Deduplicação** (2h) → Elimina traduções estranhas

---

## 📝 Próximos Passos Imediatos

1. ✅ **Validar este plano com stakeholders**
   - Product Manager
   - Tech Lead
   - Usuário beta tester

2. ✅ **Priorizar sprints**
   - Sprint 1 é crítico → começar ASAP
   - Sprint 2-4 podem ser ajustados

3. ✅ **Criar issues/tickets**
   - Quebrar cada tarefa em sub-tasks
   - Estimar com time
   - Definir DoD (Definition of Done)

4. ✅ **Configurar CI/CD para testes E2E**
   - Rodar `real-invoice-tests.ts` a cada PR
   - Block merge se accuracy < 75%
   - Dashboard com trend histórico

---

**Pronto para implementar!** 🚀

Qual sprint você quer que eu comece a implementar primeiro?
