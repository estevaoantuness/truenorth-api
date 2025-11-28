import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ========== ANUENTES (16 órgãos fiscalizadores) ==========
  const anuentes = [
    { sigla: 'ANVISA', nomeCompleto: 'Agência Nacional de Vigilância Sanitária', descricao: 'Controla produtos relacionados à saúde: cosméticos, medicamentos, alimentos, artigos médicos', multaMinima: 5000, multaMaxima: 50000, tempoLiberacaoDias: 15 },
    { sigla: 'MAPA', nomeCompleto: 'Ministério da Agricultura, Pecuária e Abastecimento', descricao: 'Fiscaliza insumos e produtos agropecuários, in natura e industrializados', multaMinima: 2000, multaMaxima: 30000, tempoLiberacaoDias: 10 },
    { sigla: 'INMETRO', nomeCompleto: 'Instituto Nacional de Metrologia, Qualidade e Tecnologia', descricao: 'Certificação de brinquedos, calçados, vestuário para segurança e qualidade', multaMinima: 1000, multaMaxima: 20000, tempoLiberacaoDias: 7 },
    { sigla: 'DPF', nomeCompleto: 'Polícia Federal', descricao: 'Controle de armas e munições', multaMinima: 10000, multaMaxima: 100000, tempoLiberacaoDias: 30 },
    { sigla: 'ANP', nomeCompleto: 'Agência Nacional do Petróleo, Gás Natural e Biocombustíveis', descricao: 'Fiscaliza produtos do setor de petróleo e gás', multaMinima: 5000, multaMaxima: 80000, tempoLiberacaoDias: 20 },
    { sigla: 'ANEEL', nomeCompleto: 'Agência Nacional de Energia Elétrica', descricao: 'Regula importação de equipamentos elétricos', multaMinima: 3000, multaMaxima: 40000, tempoLiberacaoDias: 12 },
    { sigla: 'COMEXE', nomeCompleto: 'Exército Brasileiro', descricao: 'Controla armas de fogo, veículos blindados, artefatos com potencial destrutivo', multaMinima: 15000, multaMaxima: 150000, tempoLiberacaoDias: 45 },
    { sigla: 'CNEN', nomeCompleto: 'Comissão Nacional de Energia Nuclear', descricao: 'Fiscaliza equipamentos e materiais nucleares', multaMinima: 20000, multaMaxima: 200000, tempoLiberacaoDias: 60 },
    { sigla: 'IBAMA', nomeCompleto: 'Instituto Brasileiro do Meio Ambiente', descricao: 'Controla produtos com impacto ambiental', multaMinima: 5000, multaMaxima: 100000, tempoLiberacaoDias: 20 },
    { sigla: 'ECT', nomeCompleto: 'Correios', descricao: 'Supervisiona trânsito de mercadorias por serviços postais', multaMinima: 500, multaMaxima: 5000, tempoLiberacaoDias: 5 },
    { sigla: 'SUFRAMA', nomeCompleto: 'Superintendência da Zona Franca de Manaus', descricao: 'Fiscaliza entrada de produtos na região', multaMinima: 2000, multaMaxima: 25000, tempoLiberacaoDias: 10 },
    { sigla: 'DECEX', nomeCompleto: 'Departamento de Operações de Comércio Exterior', descricao: 'Gerencia emissão de licenças de importação e exportação', multaMinima: 1000, multaMaxima: 15000, tempoLiberacaoDias: 8 },
    { sigla: 'ANM', nomeCompleto: 'Agência Nacional de Mineração', descricao: 'Fiscaliza produtos minerais', multaMinima: 3000, multaMaxima: 35000, tempoLiberacaoDias: 15 },
    { sigla: 'MCTI', nomeCompleto: 'Ministério da Ciência, Tecnologia e Inovação', descricao: 'Fiscaliza produtos e tecnologias específicas', multaMinima: 2000, multaMaxima: 20000, tempoLiberacaoDias: 12 },
    { sigla: 'CNPq', nomeCompleto: 'Conselho Nacional de Desenvolvimento Científico e Tecnológico', descricao: 'Regula produtos relacionados a projetos científicos', multaMinima: 1500, multaMaxima: 18000, tempoLiberacaoDias: 10 },
    { sigla: 'ANATEL', nomeCompleto: 'Agência Nacional de Telecomunicações', descricao: 'Homologa equipamentos de telecomunicações', multaMinima: 2000, multaMaxima: 25000, tempoLiberacaoDias: 14 },
  ];

  for (const anuente of anuentes) {
    await prisma.anuente.upsert({
      where: { sigla: anuente.sigla },
      update: anuente,
      create: anuente,
    });
  }
  console.log(`✅ ${anuentes.length} anuentes criados`);

  // ========== TIPOS DE ERRO (custos variáveis) ==========
  const tiposErro = [
    { codigo: 'NCM_INVALIDO', nome: 'NCM Inválido ou Inexistente', descricao: 'Código NCM não existe na tabela TIPI', categoria: 'NCM', custoBase: 500, custoPercentual: 0, custoMaximo: 2000, severidade: 'MEDIA', diasAtrasoMedio: 3 },
    { codigo: 'NCM_ERRADO_SETOR', nome: 'NCM de Setor Diferente', descricao: 'Ex: Classificar autopeças como cosmético', categoria: 'NCM', custoBase: 2000, custoPercentual: 1.5, custoMaximo: 50000, severidade: 'CRITICA', diasAtrasoMedio: 15, multiplicadorQuimico: 1.5, multiplicadorCosmeticos: 1.8 },
    { codigo: 'NCM_SUBFATURAMENTO', nome: 'Suspeita de Subfaturamento', descricao: 'Valor/peso muito abaixo da média do NCM', categoria: 'VALOR', custoBase: 5000, custoPercentual: 5.0, custoMaximo: 100000, severidade: 'CRITICA', diasAtrasoMedio: 20 },

    { codigo: 'LPCO_NAO_DECLARADO', nome: 'LPCO Não Solicitado', descricao: 'Mercadoria requer licença não solicitada', categoria: 'ANUENCIA', custoBase: 3000, custoPercentual: 2.0, custoMaximo: 40000, severidade: 'ALTA', diasAtrasoMedio: 10 },
    { codigo: 'LPCO_INCORRETO', nome: 'Tipo de LPCO Incorreto', descricao: 'Licença solicitada não corresponde ao produto', categoria: 'ANUENCIA', custoBase: 1500, custoPercentual: 1.0, custoMaximo: 20000, severidade: 'MEDIA', diasAtrasoMedio: 7 },
    { codigo: 'ANUENTE_FALTANDO', nome: 'Órgão Anuente Não Identificado', descricao: 'Mercadoria requer anuência não declarada', categoria: 'ANUENCIA', custoBase: 2500, custoPercentual: 1.5, custoMaximo: 35000, severidade: 'ALTA', diasAtrasoMedio: 12 },

    { codigo: 'DOC_PESO_DIVERGENTE', nome: 'Peso Divergente entre Documentos', descricao: 'Peso na invoice diferente do BL/PL', categoria: 'DOCUMENTO', custoBase: 500, custoPercentual: 0.5, custoMaximo: 5000, severidade: 'BAIXA', diasAtrasoMedio: 2 },
    { codigo: 'DOC_VALOR_DIVERGENTE', nome: 'Valor Divergente', descricao: 'Valor na invoice diferente do declarado', categoria: 'DOCUMENTO', custoBase: 1000, custoPercentual: 1.0, custoMaximo: 15000, severidade: 'MEDIA', diasAtrasoMedio: 5 },
    { codigo: 'DOC_QUANTIDADE_DIVERGENTE', nome: 'Quantidade Divergente', descricao: 'Quantidade não bate entre documentos', categoria: 'DOCUMENTO', custoBase: 800, custoPercentual: 0.5, custoMaximo: 8000, severidade: 'MEDIA', diasAtrasoMedio: 3 },
    { codigo: 'DOC_DESCRICAO_INCOMPLETA', nome: 'Descrição Incompleta', descricao: 'Falta detalhes técnicos obrigatórios', categoria: 'DOCUMENTO', custoBase: 300, custoPercentual: 0, custoMaximo: 1500, severidade: 'BAIXA', diasAtrasoMedio: 1 },

    { codigo: 'INCOTERM_INCONSISTENTE', nome: 'Incoterm Inconsistente', descricao: 'Incoterm não bate com valores declarados', categoria: 'VALOR', custoBase: 700, custoPercentual: 0.5, custoMaximo: 7000, severidade: 'MEDIA', diasAtrasoMedio: 3 },
    { codigo: 'ORIGEM_SUSPEITA', nome: 'País de Origem Suspeito', descricao: 'Origem não corresponde ao tipo de produto', categoria: 'DOCUMENTO', custoBase: 1500, custoPercentual: 1.0, custoMaximo: 20000, severidade: 'ALTA', diasAtrasoMedio: 8 },
  ];

  for (const erro of tiposErro) {
    await prisma.tipoErro.upsert({
      where: { codigo: erro.codigo },
      update: erro,
      create: erro,
    });
  }
  console.log(`✅ ${tiposErro.length} tipos de erro criados`);

  // ========== NCMs (base inicial com ~50 NCMs) ==========
  const ncms = [
    // ELETRÔNICOS (Cap. 84-85)
    { ncm: '85171231', descricao: 'Telefones celulares', capitulo: '85', aliquotaIi: 16, aliquotaIpi: 15, anuentes: ['ANATEL'], setor: 'Eletronicos' },
    { ncm: '85171291', descricao: 'Aparelhos para transmissão de dados sem fio', capitulo: '85', aliquotaIi: 16, aliquotaIpi: 15, anuentes: ['ANATEL'], setor: 'Eletronicos' },
    { ncm: '85183000', descricao: 'Fones de ouvido e auriculares', capitulo: '85', aliquotaIi: 20, aliquotaIpi: 15, anuentes: ['ANATEL'], setor: 'Eletronicos' },
    { ncm: '84713012', descricao: 'Notebooks e laptops', capitulo: '84', aliquotaIi: 16, aliquotaIpi: 15, anuentes: ['ANATEL'], exTarifario: true, setor: 'Eletronicos' },
    { ncm: '84717020', descricao: 'Unidades de disco rígido (HDD)', capitulo: '84', aliquotaIi: 2, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85234110', descricao: 'Cartões de memória flash', capitulo: '85', aliquotaIi: 16, aliquotaIpi: 15, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85285990', descricao: 'Monitores de vídeo', capitulo: '85', aliquotaIi: 20, aliquotaIpi: 15, anuentes: [], setor: 'Eletronicos' },
    { ncm: '84719000', descricao: 'Outras máquinas de processamento de dados', capitulo: '84', aliquotaIi: 16, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },

    // AUTOPEÇAS (Cap. 87)
    { ncm: '87089990', descricao: 'Outras partes e acessórios de veículos', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87088000', descricao: 'Amortecedores de suspensão', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87083010', descricao: 'Freios e suas partes', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87084090', descricao: 'Caixas de marchas', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87085099', descricao: 'Eixos e semi-eixos', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87087010', descricao: 'Rodas e suas partes', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '40111000', descricao: 'Pneus novos para automóveis', capitulo: '40', aliquotaIi: 16, aliquotaIpi: 0, anuentes: ['INMETRO', 'IBAMA'], setor: 'Autopecas' },
    { ncm: '68138100', descricao: 'Pastilhas de freio', capitulo: '68', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['INMETRO'], setor: 'Autopecas' },

    // COSMÉTICOS (Cap. 33)
    { ncm: '33049990', descricao: 'Outros produtos de beleza ou maquiagem', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 22, anuentes: ['ANVISA'], requerLpco: true, tipoLpco: 'LPCO', setor: 'Cosmeticos' },
    { ncm: '33049100', descricao: 'Pós para maquiagem', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 22, anuentes: ['ANVISA'], requerLpco: true, tipoLpco: 'LPCO', setor: 'Cosmeticos' },
    { ncm: '33041000', descricao: 'Produtos de maquiagem para lábios', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 22, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33042090', descricao: 'Produtos de maquiagem para olhos', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 22, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33051000', descricao: 'Xampus', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 7, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33059000', descricao: 'Outras preparações capilares', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 7, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33061000', descricao: 'Dentifrícios', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33030010', descricao: 'Perfumes e águas-de-colônia', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 42, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },

    // ALIMENTOS (Cap. 16-22)
    { ncm: '22041000', descricao: 'Vinhos espumantes', capitulo: '22', aliquotaIi: 27, aliquotaIpi: 40, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '22042100', descricao: 'Outros vinhos em recipientes até 2L', capitulo: '22', aliquotaIi: 27, aliquotaIpi: 30, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '22030000', descricao: 'Cervejas de malte', capitulo: '22', aliquotaIi: 20, aliquotaIpi: 40, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '18063100', descricao: 'Chocolates recheados', capitulo: '18', aliquotaIi: 20, aliquotaIpi: 5, anuentes: ['MAPA'], setor: 'Alimentos' },
    { ncm: '18063200', descricao: 'Chocolate em tabletes ou barras', capitulo: '18', aliquotaIi: 20, aliquotaIpi: 5, anuentes: ['MAPA'], setor: 'Alimentos' },
    { ncm: '21069090', descricao: 'Outras preparações alimentícias', capitulo: '21', aliquotaIi: 16, aliquotaIpi: 0, anuentes: ['ANVISA', 'MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '16010000', descricao: 'Embutidos e produtos similares de carne', capitulo: '16', aliquotaIi: 16, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '04069000', descricao: 'Outros queijos', capitulo: '04', aliquotaIi: 28, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '20098900', descricao: 'Outros sucos de frutas', capitulo: '20', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['MAPA'], setor: 'Alimentos' },

    // MÁQUINAS INDUSTRIAIS (Cap. 84)
    { ncm: '84798999', descricao: 'Outras máquinas e aparelhos mecânicos', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], exTarifario: true, setor: 'Maquinas' },
    { ncm: '84212300', descricao: 'Aparelhos para filtrar óleos', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },
    { ncm: '84229090', descricao: 'Partes de máquinas de lavar louça', capitulo: '84', aliquotaIi: 18, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },
    { ncm: '84314990', descricao: 'Partes de guindastes e gruas', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 5, anuentes: [], setor: 'Maquinas' },
    { ncm: '84329000', descricao: 'Partes de máquinas agrícolas', capitulo: '84', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['MAPA'], destaque: 'Máquinas agrícolas', setor: 'Maquinas' },
    { ncm: '84248990', descricao: 'Outros aparelhos mecânicos para projetar', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 5, anuentes: [], setor: 'Maquinas' },
    { ncm: '84223000', descricao: 'Máquinas de encher, fechar ou etiquetar', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], exTarifario: true, setor: 'Maquinas' },
    { ncm: '84669400', descricao: 'Partes para máquinas-ferramenta', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },

    // TÊXTEIS (Cap. 50-63)
    { ncm: '62034200', descricao: 'Calças masculinas de algodão', capitulo: '62', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '62046200', descricao: 'Calças femininas de algodão', capitulo: '62', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '61091000', descricao: 'T-shirts de malha de algodão', capitulo: '61', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '62052000', descricao: 'Camisas masculinas de algodão', capitulo: '62', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '61046200', descricao: 'Calças femininas de malha de algodão', capitulo: '61', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '64039990', descricao: 'Outros calçados de couro', capitulo: '64', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '42021200', descricao: 'Malas e maletas com superfície exterior de plástico', capitulo: '42', aliquotaIi: 20, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '42022200', descricao: 'Bolsas com superfície exterior de plástico', capitulo: '42', aliquotaIi: 20, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },

    // QUÍMICOS (Cap. 28-38)
    { ncm: '29181400', descricao: 'Ácido cítrico', capitulo: '29', aliquotaIi: 12, aliquotaIpi: 0, anuentes: ['ANVISA'], destaque: 'Uso farmacêutico', setor: 'Quimicos' },
    { ncm: '29362100', descricao: 'Vitaminas A e seus derivados', capitulo: '29', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], setor: 'Quimicos' },
    { ncm: '38089410', descricao: 'Desinfetantes', capitulo: '38', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '32089090', descricao: 'Outras tintas e vernizes', capitulo: '32', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['IBAMA'], setor: 'Quimicos' },
    { ncm: '34022000', descricao: 'Preparações tensoativas', capitulo: '34', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['ANVISA'], setor: 'Quimicos' },
  ];

  for (const ncm of ncms) {
    await prisma.ncmDatabase.upsert({
      where: { ncm: ncm.ncm },
      update: ncm,
      create: ncm,
    });
  }
  console.log(`✅ ${ncms.length} NCMs criados`);

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
