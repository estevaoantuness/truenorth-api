# 🔍 Análise de Outsider - TrueNorth API (NCM Search)

**Data**: 2025-11-29
**Testador**: Claude (perspectiva externa)
**Objetivo**: Testar pipeline completo com invoices reais e identificar gaps

---

## 📊 Resultados dos Testes E2E

### Estatísticas Gerais
- **Total de itens testados**: 18 (7 invoices de diferentes países)
- **Itens com NCM esperado**: 9
- **NCMs encontrados corretamente**: 6/9
- **Taxa de acerto real**: **66.7%** ⚠️ (vs 84.6% nos testes unitários)

### Distribuição de Rankings (quando encontrado)
- ✅ **Rank 1**: 3 itens (33%)
- ⚠️  **Rank 2-3**: 1 item (11%)
- ⚠️  **Rank 4-5**: 1 item (11%)
- ❌ **Rank 6-10**: 1 item (11%)
- ❌ **Não encontrado**: 3 itens (33%)

---

## 🚨 Problemas Críticos Identificados

### 1. **Tradução de Termos Técnicos é Inconsistente**

#### Problema:
```
Input:  "Power Bank" (EN)
Output: "bateria externa" (PT) ✅

Input:  "Brake Pads" (EN)
Output: "pastilhas de freio" (PT) ✅

Input:  "Luer Lock" (EN - termo médico técnico)
Output: "fechadura" (PT) ❌ ERRADO!
```

**Impacto**:
- "Lock" traduzido como "fechadura" em vez de manter "Luer Lock" (termo técnico universal)
- Resultado: **0 NCMs encontrados** para seringas médicas

#### Root Cause:
- Dicionário COMEX_DICT tem cobertura limitada (~200 termos)
- Gemini fallback traduz literalmente sem contexto médico/técnico
- Não há detecção de "technical terms that should not be translated"

---

### 2. **Queries em Inglês Sem Tradução Completam Falham**

#### Problema:
```
Query: "medical syringes 10ml sterile disposable luer fechadura"
        ^^^^^^^ ^^^^^^^^ ^^^ ^^^^^^^ ^^^^^^^^^^ ^^^^ (6 palavras em inglês + 1 errada)

FTS: Nenhum resultado encontrado (mesmo com fallback ILIKE)
```

**Impacto**:
- 3 itens (17%) retornaram **0 NCMs**
- Usuário fica sem sugestão nenhuma

#### Exemplos Afetados:
- ❌ "Eau de Parfum Luxury Fragrance for Women 100ml"
- ❌ "Organic Argan Oil Hair Treatment Serum"
- ❌ "Medical Syringes 10ml Sterile Disposable Luer Lock"

---

### 3. **Traduções Redundantes ("sem fio sem fio")**

#### Problema:
```
Input:  "Wireless Bluetooth Earbuds"
Output: "sem fio sem fio fones de ouvido"
         ^^^^^^^  ^^^^^^^ (duplicado!)
```

**Root Cause**:
- "Wireless" → "sem fio" (dicionário)
- "Bluetooth" → "sem fio" (dicionário)
- Não há deduplicação pós-tradução

**Impacto Atual**: Baixo (FTS ainda encontra)
**Impacto Potencial**: Pode confundir ranking em casos edge

---

### 4. **Produtos sem NCM Esperado Definido Não São Validados**

#### Problema:
- 9 itens (50%) não tinham `expectedNCM` definido
- Impossível saber se a classificação está correta
- Exemplos críticos:
  - "USB-C Cable" → Score 4.03 (baixíssimo)
  - "Balsamic Vinegar" → Score 4.03
  - "CNC Milling Machine" → Score 4.53

**Risco**: Esses podem estar completamente errados e não sabemos

---

### 5. **Score Baixo (<5.0) Indica Baixa Confiança - Mas Não Há Fallback Humano**

#### Padrão Observado:
| Item | Score | Encontrou? | Insight |
|------|-------|------------|---------|
| Earbuds | 14.24 | ✅ Rank 1 | Alta confiança |
| Brake Pads | 14.24 | ✅ Rank 1 | Alta confiança |
| Olive Oil | 16.69 | ✅ Rank 1 | Alta confiança |
| USB Cable | 4.03 | ❓ Desconhecido | **Baixa confiança** |
| Balsamic Vinegar | 4.03 | ❓ Desconhecido | **Baixa confiança** |
| Laptop | 4.03 | ❓ Desconhecido | **Baixa confiança** |

**Problema**: Sistema não alerta usuário quando score < 5.0

---

### 6. **Anuentes Não São Detectados Corretamente**

#### Problema:
```
Item: "Extra Virgin Olive Oil DOP Toscana"
Nota: "Requer registro MAPA, rastreabilidade DOP"
NCM Encontrado: 15092000
Anuentes no NCM: [ ]

❌ Sistema não indicou necessidade de MAPA
```

**Impacto**: Risco de importação sem licença correta

**Casos Afetados**:
- Azeite de oliva (MAPA)
- Creme facial (ANVISA)
- Ácido hialurônico farmacêutico (ANVISA + possível MAPA)
- Seringas médicas (ANVISA)

---

## 💡 Insights de Outsider (Perspectiva Externa)

### ✅ **Pontos Fortes** (O que funciona bem)

1. **Tradução de termos comuns é excelente**
   - "Wireless" → "sem fio"
   - "Brake Pads" → "pastilhas de freio"
   - "Power Bank" → "bateria externa"
   - "Earbuds" → "fones de ouvido"

2. **FTS com setor funciona muito bem**
   - Quando setor está correto, ranking é preciso
   - Bonus de 3.0x para setor correto faz diferença

3. **Produtos populares de importação têm ótimo desempenho**
   - Eletrônicos chineses: 85183000 (fones) - Rank 1 ✅
   - Autopeças alemãs: 87083010 (pastilhas) - Rank 1 ✅
   - Alimentos italianos: 15092000 (azeite) - Rank 1 ✅

### ❌ **Gaps Críticos** (O que está faltando)

#### GAP 1: **Termos Técnicos Não Traduzíveis**
```
Problema:
  "Luer Lock" (termo médico universal) → "fechadura" ❌

Solução Necessária:
  Lista de "DO NOT TRANSLATE" terms:
  - Luer Lock, TWS, USB-C, DOP, IGP, CNC, SRAM, etc.
```

#### GAP 2: **Fallback para Queries em Inglês**
```
Problema:
  "medical syringes sterile" (50% inglês) → 0 resultados

Solução Necessária:
  - Detectar idioma misto
  - Re-traduzir termos faltantes
  - OU buscar em múltiplos idiomas (PT + EN)
```

#### GAP 3: **Validação de Anuentes**
```
Problema:
  NCM 15092000 (azeite) não indica MAPA, mas deveria

Solução Necessária:
  - Enriquecer banco de dados NCM com anuentes
  - Cross-reference com tabela de anuentes
  - Alerta visual quando anuente é necessário
```

#### GAP 4: **Feedback Loop Ausente**
```
Problema:
  Não há como usuário corrigir NCM incorreto e sistema aprender

Solução Necessária:
  - Botão "Este NCM está errado"
  - Permitir usuário sugerir NCM correto
  - Sistema aprende com feedback (ML ou dicionário)
```

#### GAP 5: **Descrições Genéricas Matam Precisão**
```
Problema:
  "Laptop Dell Inspiron 15 Intel Core i7" → Score 4.03 (muito baixo)

  Motivo: Descrição é genérica demais (não especifica uso/tipo)

Solução Necessária:
  - Prompt engenharia para extrair descrição técnica
  - "Laptop para uso empresarial" vs "Laptop para jogos"
  - NCM diferente dependendo do uso
```

---

## 📋 Análise por Cenário de Invoice

### 🇨🇳 **CENÁRIO 1: E-commerce Chinês (AliExpress/Alibaba)**
**Taxa de Acerto**: 33% (1/3)

| Item | Resultado | Problema |
|------|-----------|----------|
| Fones Bluetooth | ✅ Rank 1 | - |
| Power Bank | ❌ Não encontrado | "lithium polymer" não mapeia para "íon de lítio" |
| Cabo USB-C | ❓ Score 4.03 | Descrição muito genérica |

**Insight**: Eletrônicos de consumo funcionam, mas baterias específicas precisam melhor mapeamento

---

### 🇩🇪 **CENÁRIO 2: Autopeças Premium (Alemanha)**
**Taxa de Acerto**: 66% (2/3)

| Item | Resultado | Problema |
|------|-----------|----------|
| Pastilhas cerâmica | ✅ Rank 1 | - |
| Filtro de óleo | ❌ Não no top 5 | Precisa melhor contexto "motor/automotivo" |
| Disco de freio | ✅ Rank 3 | OK mas poderia ser rank 1 |

**Insight**: Peças automotivas funcionam bem, mas filtros precisam contexto específico

---

### 🇮🇹 **CENÁRIO 3: Alimentos Gourmet (Itália)**
**Taxa de Acerto**: 33% (1/3)

| Item | Resultado | Problema |
|------|-----------|----------|
| Azeite DOP | ✅ Rank 1 | ⚠️  Não indica MAPA necessário |
| Vinagre balsâmico IGP | ❓ Score 4.03 | Sem validação |
| Queijo Parmigiano DOP | ❓ Score 11.08 | Sem validação |

**Insight**: Produtos com denominação de origem (DOP/IGP) precisam tag especial

---

### 🇫🇷 **CENÁRIO 4: Cosméticos Luxo (França)**
**Taxa de Acerto**: 50% (1/2 validados)

| Item | Resultado | Problema |
|------|-----------|----------|
| Creme anti-idade | ✅ Rank 2 | ⚠️  Não indica ANVISA |
| Perfume | ❌ 0 resultados | Query 50% em francês ("Eau de") |
| Óleo Argan | ❌ 0 resultados | "Organic Argan Oil" não traduzido |

**Insight**: Produtos de luxo + idioma misto = falha crítica

---

### 🇺🇸 **CENÁRIO 5: Equipamentos Industriais (EUA)**
**Taxa de Acerto**: 0% (0/2 validados)

| Item | Resultado | Problema |
|------|-----------|----------|
| CNC Milling Machine | ❓ Score 4.53 | Descrição genérica, sem contexto de uso |
| Compressor Industrial | ❓ Score 4.03 | idem |

**Insight**: Máquinas industriais precisam contexto de aplicação

---

### 🇨🇭 **CENÁRIO 7: Farmacêuticos (Suíça)**
**Taxa de Acerto**: 0% (0/2 validados)

| Item | Resultado | Problema |
|------|-----------|----------|
| Ácido Hialurônico farmacêutico | ❓ Sem NCM esperado | NCM top não indica AN VISA |
| Seringas médicas | ❌ 0 resultados | "Luer Lock" traduzido errado |

**Insight**: Produtos médicos/farmacêuticos têm ZERO suporte adequado

---

## 🎯 Priorização de Problemas (Matriz de Impacto vs Esforço)

### **CRÍTICO (Alta Prioridade)**

| # | Problema | Impacto | Esforço | Prioridade |
|---|----------|---------|---------|------------|
| 1 | Tradução de termos técnicos | 🔴 ALTO | 🟢 BAIXO | ⭐⭐⭐⭐⭐ |
| 2 | Queries mistas EN/PT = 0 resultados | 🔴 ALTO | 🟡 MÉDIO | ⭐⭐⭐⭐ |
| 3 | Score < 5.0 sem alerta ao usuário | 🔴 ALTO | 🟢 BAIXO | ⭐⭐⭐⭐ |
| 4 | Anuentes não detectados | 🔴 ALTO | 🟡 MÉDIO | ⭐⭐⭐⭐ |

### **IMPORTANTE (Média Prioridade)**

| # | Problema | Impacto | Esforço | Prioridade |
|---|----------|---------|---------|------------|
| 5 | Traduções redundantes ("sem fio sem fio") | 🟡 MÉDIO | 🟢 BAIXO | ⭐⭐⭐ |
| 6 | Feedback loop ausente | 🟡 MÉDIO | 🔴 ALTO | ⭐⭐⭐ |
| 7 | Descrições genéricas → score baixo | 🟡 MÉDIO | 🟡 MÉDIO | ⭐⭐ |

### **NICE-TO-HAVE (Baixa Prioridade)**

| # | Problema | Impacto | Esforço | Prioridade |
|---|----------|---------|---------|------------|
| 8 | DOP/IGP não identificados | 🟢 BAIXO | 🟡 MÉDIO | ⭐ |
| 9 | Contexto de uso (máquinas industriais) | 🟢 BAIXO | 🔴 ALTO | ⭐ |

---

## 📈 Taxa de Acerto Realista vs Otimista

### Comparação:

| Métrica | Testes Unitários | Invoices Reais | Delta |
|---------|------------------|----------------|-------|
| **Accuracy** | 84.6% | 66.7% | **-17.9pp** ⚠️ |
| **Rank 1** | 69% (9/13) | 33% (3/9) | **-36pp** ⚠️ |
| **Zero resultados** | 0% (0/13) | 17% (3/18) | **+17pp** ❌ |

### Por que a discrepância?

1. **Testes unitários usam queries ideais**:
   - "pastilhas de freio" (já em PT, termo exato)
   - Setor sempre fornecido
   - NCMs que existem no banco

2. **Invoices reais têm**:
   - Idiomas mistos (50% EN, 25% PT, 25% FR)
   - Descrições genéricas ("Laptop Dell Inspiron")
   - Termos técnicos ("Luer Lock", "DOP", "IGP")
   - Especificações irrelevantes ("15 Intel Core i7 16GB")

---

## 🚀 Conclusão: O que precisa ser feito URGENTEMENTE

### Top 3 Ações Imediatas (Próxima Sprint)

1. **🔧 Fix Crítico: Lista de "DO NOT TRANSLATE"** (4h)
   - Criar `TECHNICAL_TERMS` dictionary
   - ~100 termos médicos, industriais, certificações
   - Exemplo: Luer Lock, TWS, USB-C, DOP, IGP, CNC, SRAM, EAN

2. **🔧 Fix Crítico: Alerta de Baixa Confiança** (2h)
   - IF score < 5.0 → Badge "⚠️ Baixa Confiança"
   - Sugestão: "Refine a descrição ou escolha manualmente"
   - Botão: "Solicitar ajuda de especialista"

3. **🔧 Fix Crítico: Re-tradução de Queries Falhadas** (6h)
   - IF results.length === 0 → detectar termos em inglês
   - Re-traduzir automaticamente
   - Retry busca com query corrigida
   - Log para análise posterior

### Médio Prazo (Próximo Mês)

4. **Enriquecimento de Anuentes** (8h)
   - Cross-reference NCM database com tabela anuentes
   - Popular campo `anuentes` para top 1000 NCMs mais usados
   - Validação manual por especialista

5. **Feedback Loop MVP** (12h)
   - Endpoint `/api/ncm/feedback`
   - Botões: 👍 Correto | 👎 Incorreto | ✏️ Sugerir outro NCM
   - Dashboard de análise para time interno

6. **Deduplicação pós-tradução** (3h)
   - "sem fio sem fio" → "sem fio"
   - Evitar redundâncias

---

## 📊 Métricas de Sucesso (KPIs)

**Antes (Atual)**:
- ✅ Accuracy testes unitários: 84.6%
- ⚠️  Accuracy invoices reais: 66.7%
- ❌ Zero resultados: 17%
- ❌ Anuentes detectados: ~0%

**Meta (Pós-Melhorias)**:
- 🎯 Accuracy invoices reais: **80%+**
- 🎯 Zero resultados: **<5%**
- 🎯 Rank 1: **60%+**
- 🎯 Anuentes detectados: **80%+** (para top NCMs)
- 🎯 Feedback rate: **20%+** usuários dão feedback

---

**Próximos Passos**: Elaborar plano de implementação detalhado com tasks específicas
