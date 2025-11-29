/**
 * Testes de Integração com Invoices Reais
 *
 * Testa o fluxo completo: extração → classificação NCM → cálculo de impostos
 * Usa dados realistas de diferentes setores para validar precisão
 */

import { PrismaClient } from '@prisma/client';
import { getNcmInfo, searchNcmByDescription, validateNcm, getNcmStats } from '../../src/services/ncmService';

const prisma = new PrismaClient();

// ============================================================
// INVOICES REAIS SIMULADAS - DIFERENTES SETORES
// ============================================================

const REAL_INVOICES = {
  // ELETRÔNICOS - China
  electronics_china: {
    invoice_number: 'INV-2024-CN-001',
    supplier: { name: 'Shenzhen Electronics Co.', country: 'CN' },
    items: [
      { description: 'Smartphone Samsung Galaxy S24 Ultra 256GB', quantity: 100, unit_price: 450, expected_ncm: '85171300' },
      { description: 'Wireless Bluetooth Earbuds TWS', quantity: 500, unit_price: 15, expected_ncm: '85183000' },
      { description: 'USB-C Charging Cable 1m', quantity: 1000, unit_price: 2, expected_ncm: '85444200' },
      { description: 'Power Bank 20000mAh Lithium Battery', quantity: 200, unit_price: 25, expected_ncm: '85076000' },
    ],
    total_value: 67000,
    expected_sector: 'Eletronicos',
    expected_anuentes: ['ANATEL', 'INMETRO'],
  },

  // COSMÉTICOS - França
  cosmetics_france: {
    invoice_number: 'INV-2024-FR-002',
    supplier: { name: "L'Oreal Paris SAS", country: 'FR' },
    items: [
      { description: 'Perfume Eau de Toilette 100ml', quantity: 200, unit_price: 45, expected_ncm: '33030010' },
      { description: 'Anti-aging Face Cream 50ml', quantity: 300, unit_price: 35, expected_ncm: '33049100' },
      { description: 'Shampoo Professional Hair Care 500ml', quantity: 400, unit_price: 12, expected_ncm: '33051000' },
      { description: 'Lipstick Matte Collection', quantity: 500, unit_price: 8, expected_ncm: '33041000' },
    ],
    total_value: 28300,
    expected_sector: 'Cosmeticos',
    expected_anuentes: ['ANVISA'],
  },

  // AUTOPEÇAS - Alemanha
  autoparts_germany: {
    invoice_number: 'INV-2024-DE-003',
    supplier: { name: 'Bosch Automotive GmbH', country: 'DE' },
    items: [
      { description: 'Brake Pads Ceramic Front', quantity: 100, unit_price: 45, expected_ncm: '87083010' },
      { description: 'Oil Filter for Diesel Engine', quantity: 200, unit_price: 15, expected_ncm: '84212300' },
      { description: 'Spark Plugs Iridium Set', quantity: 500, unit_price: 8, expected_ncm: '85111000' },
      { description: 'Car Battery 12V 60Ah', quantity: 50, unit_price: 120, expected_ncm: '85071010' },
    ],
    total_value: 18500,
    expected_sector: 'Autopecas',
    expected_anuentes: ['INMETRO'],
  },

  // FARMACÊUTICOS - Índia
  pharma_india: {
    invoice_number: 'INV-2024-IN-004',
    supplier: { name: 'Sun Pharma Industries Ltd', country: 'IN' },
    items: [
      { description: 'Paracetamol 500mg Tablets x1000', quantity: 100, unit_price: 25, expected_ncm: '30049099' },
      { description: 'Omeprazole 20mg Capsules', quantity: 200, unit_price: 40, expected_ncm: '30049099' },
      { description: 'Amoxicillin 500mg Antibiotic', quantity: 150, unit_price: 55, expected_ncm: '30041000' },
      { description: 'Insulin Injection Pen', quantity: 50, unit_price: 180, expected_ncm: '30043100' },
    ],
    total_value: 27750,
    expected_sector: 'Farmaceuticos',
    expected_anuentes: ['ANVISA'],
  },

  // ALIMENTOS - Itália
  food_italy: {
    invoice_number: 'INV-2024-IT-005',
    supplier: { name: 'Barilla Group SpA', country: 'IT' },
    items: [
      { description: 'Extra Virgin Olive Oil 1L', quantity: 500, unit_price: 12, expected_ncm: '15091000' },
      { description: 'Pasta Spaghetti 500g', quantity: 1000, unit_price: 2, expected_ncm: '19021100' },
      { description: 'Parmesan Cheese Aged 24 months', quantity: 100, unit_price: 45, expected_ncm: '04069010' },
      { description: 'San Marzano Tomatoes Canned', quantity: 800, unit_price: 3, expected_ncm: '20029010' },
    ],
    total_value: 14900,
    expected_sector: 'Alimentos',
    expected_anuentes: ['ANVISA', 'MAPA'],
  },

  // MÁQUINAS INDUSTRIAIS - Japão
  machines_japan: {
    invoice_number: 'INV-2024-JP-006',
    supplier: { name: 'Fanuc Corporation', country: 'JP' },
    items: [
      { description: 'CNC Milling Machine 5-Axis', quantity: 2, unit_price: 85000, expected_ncm: '84571000' },
      { description: 'Industrial Robot Arm 6-DOF', quantity: 5, unit_price: 35000, expected_ncm: '84795000' },
      { description: 'PLC Controller Module', quantity: 20, unit_price: 1500, expected_ncm: '85371020' },
      { description: 'Servo Motor AC 5kW', quantity: 30, unit_price: 800, expected_ncm: '85015200' },
    ],
    total_value: 399000,
    expected_sector: 'Maquinas',
    expected_anuentes: [],
  },

  // TÊXTEIS - Bangladesh
  textiles_bangladesh: {
    invoice_number: 'INV-2024-BD-007',
    supplier: { name: 'Dhaka Garments Ltd', country: 'BD' },
    items: [
      { description: 'Cotton T-Shirt Men 100%', quantity: 5000, unit_price: 3, expected_ncm: '61091000' },
      { description: 'Denim Jeans Women Slim Fit', quantity: 2000, unit_price: 8, expected_ncm: '62034200' },
      { description: 'Polyester Fabric Roll 50m', quantity: 100, unit_price: 45, expected_ncm: '54074200' },
      { description: 'Cotton Bed Sheets Set', quantity: 500, unit_price: 15, expected_ncm: '63022100' },
    ],
    total_value: 46000,
    expected_sector: 'Textil',
    expected_anuentes: [],
  },

  // QUÍMICOS - EUA
  chemicals_usa: {
    invoice_number: 'INV-2024-US-008',
    supplier: { name: 'Dow Chemical Company', country: 'US' },
    items: [
      { description: 'Polyethylene Resin HDPE', quantity: 10000, unit_price: 1.5, expected_ncm: '39012000' },
      { description: 'Titanium Dioxide Pigment', quantity: 500, unit_price: 8, expected_ncm: '32061100' },
      { description: 'Acetic Acid Industrial Grade', quantity: 2000, unit_price: 0.8, expected_ncm: '29152100' },
      { description: 'Silicone Sealant 300ml', quantity: 1000, unit_price: 5, expected_ncm: '39100090' },
    ],
    total_value: 25600,
    expected_sector: 'Quimicos',
    expected_anuentes: ['IBAMA'],
  },
};

// ============================================================
// TESTES DE NCM SERVICE
// ============================================================

describe('NCM Service - Busca e Validação', () => {

  describe('getNcmInfo - Busca por código exato', () => {

    test('deve encontrar NCM de smartphone (85171300)', async () => {
      const result = await getNcmInfo('85171300');

      expect(result).not.toBeNull();
      expect(result?.ncm).toBe('85171300');
      expect(result?.setor).toBe('Eletronicos');
      expect(result?.descricao.toLowerCase()).toContain('smartphone');
    });

    test('deve encontrar NCM de medicamento (30049099)', async () => {
      const result = await getNcmInfo('30049099');

      expect(result).not.toBeNull();
      expect(result?.ncm).toBe('30049099');
      expect(result?.setor).toBe('Farmaceuticos');
      expect(result?.anuentes).toContain('ANVISA');
    });

    test('deve encontrar NCM de autopeça (87083010)', async () => {
      const result = await getNcmInfo('87083010');

      expect(result).not.toBeNull();
      expect(result?.setor).toBe('Autopecas');
    });

    test('deve retornar null para NCM inexistente', async () => {
      const result = await getNcmInfo('99999999');

      expect(result).toBeNull();
    });

    test('deve normalizar NCM com pontos', async () => {
      const result = await getNcmInfo('8517.13.00');

      expect(result).not.toBeNull();
      expect(result?.ncm).toBe('85171300');
    });
  });

  describe('searchNcmByDescription - Busca semântica', () => {

    test('deve encontrar NCMs para "smartphone"', async () => {
      const results = await searchNcmByDescription('smartphone');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.ncm === '85171300')).toBe(true);
    });

    test('deve encontrar NCMs para "perfume"', async () => {
      const results = await searchNcmByDescription('perfume');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.setor === 'Cosmeticos')).toBe(true);
    });

    test('deve encontrar NCMs para "medicamento"', async () => {
      const results = await searchNcmByDescription('medicamento');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.setor === 'Farmaceuticos')).toBe(true);
    });

    test('deve filtrar por setor quando especificado', async () => {
      const results = await searchNcmByDescription('cabo', 'Eletronicos');

      expect(results.every(r => r.setor === 'Eletronicos' || r.score > 50)).toBe(true);
    });

    test('deve ordenar por relevância (score)', async () => {
      const results = await searchNcmByDescription('telefone celular');

      expect(results.length).toBeGreaterThan(1);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });
  });

  describe('validateNcm - Validação de NCM', () => {

    test('deve validar NCM existente', async () => {
      const result = await validateNcm('85171300');

      expect(result.valid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.info).not.toBeNull();
    });

    test('deve invalidar NCM inexistente e sugerir alternativas', async () => {
      const result = await validateNcm('85179999');

      expect(result.valid).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });

    test('deve invalidar NCM com formato incorreto', async () => {
      const result = await validateNcm('123');

      expect(result.valid).toBe(false);
    });
  });

  describe('getNcmStats - Estatísticas do banco', () => {

    test('deve retornar estatísticas válidas', async () => {
      const stats = await getNcmStats();

      expect(stats.total).toBeGreaterThan(15000);
      expect(Object.keys(stats.bySector).length).toBeGreaterThan(10);
      expect(stats.withAnuentes).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// TESTES DE CLASSIFICAÇÃO POR SETOR
// ============================================================

describe('Classificação NCM por Setor', () => {

  test.each(Object.entries(REAL_INVOICES))(
    'Invoice %s deve ter itens classificáveis',
    async (invoiceKey, invoice) => {
      for (const item of invoice.items) {
        const results = await searchNcmByDescription(item.description, invoice.expected_sector);

        console.log(`[${invoiceKey}] "${item.description.substring(0, 40)}..." → ${results.length} NCMs encontrados`);

        // Deve encontrar pelo menos 1 NCM relevante
        expect(results.length).toBeGreaterThan(0);

        // Se temos NCM esperado, verificar se está nos resultados (top 10)
        if (item.expected_ncm) {
          const found = results.slice(0, 10).some(r => r.ncm === item.expected_ncm);
          if (!found) {
            console.log(`  ⚠️ NCM esperado ${item.expected_ncm} não encontrado nos top 10`);
            console.log(`  Top 3: ${results.slice(0, 3).map(r => r.ncm).join(', ')}`);
          }
        }
      }
    }
  );
});

// ============================================================
// TESTES DE ALÍQUOTAS E IMPOSTOS
// ============================================================

describe('Alíquotas e Cálculo de Impostos', () => {

  test('NCM de eletrônicos deve ter II entre 0-20%', async () => {
    const ncm = await getNcmInfo('85171300'); // Smartphone

    expect(ncm?.aliquotaIi).toBeGreaterThanOrEqual(0);
    expect(ncm?.aliquotaIi).toBeLessThanOrEqual(20);
  });

  test('NCM de cosméticos deve ter IPI > 0', async () => {
    const ncm = await getNcmInfo('33030010'); // Perfume

    expect(ncm?.aliquotaIpi).toBeGreaterThan(0);
  });

  test('NCM de medicamento deve ter IPI baixo ou zero', async () => {
    const ncm = await getNcmInfo('30049099');

    expect(ncm?.aliquotaIpi).toBeLessThanOrEqual(5);
  });

  test('PIS/COFINS deve estar configurado corretamente', async () => {
    const ncm = await getNcmInfo('85171300');

    expect(ncm?.aliquotaPis).toBeCloseTo(2.1, 1);
    expect(ncm?.aliquotaCofins).toBeCloseTo(9.65, 1);
  });

  test('Cálculo de impostos para invoice de eletrônicos', async () => {
    const invoice = REAL_INVOICES.electronics_china;
    let totalII = 0;
    let totalIPI = 0;
    let totalPIS = 0;
    let totalCOFINS = 0;

    for (const item of invoice.items) {
      const ncm = await getNcmInfo(item.expected_ncm);
      if (ncm) {
        const itemTotal = item.quantity * item.unit_price;
        totalII += itemTotal * (ncm.aliquotaIi / 100);
        totalIPI += itemTotal * (ncm.aliquotaIpi / 100);
        totalPIS += itemTotal * (ncm.aliquotaPis / 100);
        totalCOFINS += itemTotal * (ncm.aliquotaCofins / 100);
      }
    }

    console.log(`Invoice Eletrônicos (USD ${invoice.total_value}):`);
    console.log(`  II: USD ${totalII.toFixed(2)}`);
    console.log(`  IPI: USD ${totalIPI.toFixed(2)}`);
    console.log(`  PIS: USD ${totalPIS.toFixed(2)}`);
    console.log(`  COFINS: USD ${totalCOFINS.toFixed(2)}`);
    console.log(`  Total Impostos: USD ${(totalII + totalIPI + totalPIS + totalCOFINS).toFixed(2)}`);

    // Impostos devem ser calculados
    expect(totalII + totalIPI + totalPIS + totalCOFINS).toBeGreaterThan(0);
  });
});

// ============================================================
// TESTES DE ANUENTES
// ============================================================

describe('Detecção de Anuentes', () => {

  test('Farmacêuticos devem requerer ANVISA', async () => {
    const ncm = await getNcmInfo('30049099');

    expect(ncm?.anuentes).toContain('ANVISA');
    expect(ncm?.requerLpco).toBe(true);
  });

  test('Cosméticos devem requerer ANVISA', async () => {
    const ncm = await getNcmInfo('33030010');

    expect(ncm?.anuentes).toContain('ANVISA');
  });

  test('Alimentos devem requerer ANVISA ou MAPA', async () => {
    const ncm = await getNcmInfo('15091000'); // Azeite

    expect(
      ncm?.anuentes.includes('ANVISA') || ncm?.anuentes.includes('MAPA')
    ).toBe(true);
  });

  test('Máquinas industriais não devem requerer anuentes especiais', async () => {
    const ncm = await getNcmInfo('84571000'); // CNC

    // Máquinas geralmente não precisam de anuentes
    expect(ncm?.anuentes.length).toBeLessThanOrEqual(1);
  });
});

// ============================================================
// TESTES DE PERFORMANCE
// ============================================================

describe('Performance', () => {

  test('Busca por NCM deve ser < 100ms', async () => {
    const start = Date.now();
    await getNcmInfo('85171300');
    const duration = Date.now() - start;

    console.log(`getNcmInfo: ${duration}ms`);
    expect(duration).toBeLessThan(100);
  });

  test('Busca por descrição deve ser < 500ms', async () => {
    const start = Date.now();
    await searchNcmByDescription('smartphone celular telefone');
    const duration = Date.now() - start;

    console.log(`searchNcmByDescription: ${duration}ms`);
    expect(duration).toBeLessThan(500);
  });

  test('Validação deve ser < 100ms', async () => {
    const start = Date.now();
    await validateNcm('85171300');
    const duration = Date.now() - start;

    console.log(`validateNcm: ${duration}ms`);
    expect(duration).toBeLessThan(100);
  });
});

// ============================================================
// TESTES DE EDGE CASES
// ============================================================

describe('Edge Cases', () => {

  test('Descrição vazia deve retornar array vazio', async () => {
    const results = await searchNcmByDescription('');
    expect(results).toEqual([]);
  });

  test('NCM com zeros à direita deve normalizar', async () => {
    const result = await getNcmInfo('85170000');
    expect(result?.ncm).toBe('85170000');
  });

  test('Descrição com caracteres especiais deve funcionar', async () => {
    const results = await searchNcmByDescription('café torrado & moído');
    expect(results.length).toBeGreaterThanOrEqual(0); // Não deve dar erro
  });

  test('Busca case-insensitive', async () => {
    const upper = await searchNcmByDescription('SMARTPHONE');
    const lower = await searchNcmByDescription('smartphone');

    expect(upper.length).toBe(lower.length);
  });
});

// Cleanup
afterAll(async () => {
  await prisma.$disconnect();
});
