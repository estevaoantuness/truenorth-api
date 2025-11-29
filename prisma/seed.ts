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

  // ========== NCMs (base com 200+ NCMs realistas) ==========
  const ncms = [
    // ============ ELETRÔNICOS (Cap. 84-85) - 35 NCMs ============
    { ncm: '85171231', descricao: 'Telefones celulares', capitulo: '85', aliquotaIi: 16, aliquotaIpi: 15, anuentes: ['ANATEL'], setor: 'Eletronicos' },
    { ncm: '85171291', descricao: 'Aparelhos para transmissão de dados sem fio', capitulo: '85', aliquotaIi: 16, aliquotaIpi: 15, anuentes: ['ANATEL'], setor: 'Eletronicos' },
    { ncm: '85183000', descricao: 'Fones de ouvido e auriculares', capitulo: '85', aliquotaIi: 20, aliquotaIpi: 15, anuentes: ['ANATEL'], setor: 'Eletronicos' },
    { ncm: '84713012', descricao: 'Notebooks e laptops', capitulo: '84', aliquotaIi: 16, aliquotaIpi: 15, anuentes: ['ANATEL'], exTarifario: true, setor: 'Eletronicos' },
    { ncm: '84717020', descricao: 'Unidades de disco rígido (HDD)', capitulo: '84', aliquotaIi: 2, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85234110', descricao: 'Cartões de memória flash', capitulo: '85', aliquotaIi: 16, aliquotaIpi: 15, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85285990', descricao: 'Monitores de vídeo', capitulo: '85', aliquotaIi: 20, aliquotaIpi: 15, anuentes: [], setor: 'Eletronicos' },
    { ncm: '84719000', descricao: 'Outras máquinas de processamento de dados', capitulo: '84', aliquotaIi: 16, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85176200', descricao: 'Aparelhos para recepção, conversão e transmissão de voz, imagem ou dados', capitulo: '85', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANATEL'], setor: 'Eletronicos' },
    { ncm: '85171210', descricao: 'Telefones sem fio', capitulo: '85', aliquotaIi: 16, aliquotaIpi: 15, anuentes: ['ANATEL'], setor: 'Eletronicos' },
    { ncm: '84715010', descricao: 'Unidades de processamento digitais', capitulo: '84', aliquotaIi: 0, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '84714900', descricao: 'Outras máquinas automáticas para processamento de dados', capitulo: '84', aliquotaIi: 0, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85423100', descricao: 'Processadores e controladores', capitulo: '85', aliquotaIi: 0, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85423200', descricao: 'Memórias semicondutoras', capitulo: '85', aliquotaIi: 0, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85044090', descricao: 'Conversores estáticos', capitulo: '85', aliquotaIi: 14, aliquotaIpi: 5, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85176294', descricao: 'Roteadores digitais', capitulo: '85', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANATEL'], setor: 'Eletronicos' },
    { ncm: '85287200', descricao: 'Aparelhos receptores de televisão', capitulo: '85', aliquotaIi: 20, aliquotaIpi: 15, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85219090', descricao: 'Aparelhos de videocassete ou gravação de vídeo', capitulo: '85', aliquotaIi: 20, aliquotaIpi: 15, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85258019', descricao: 'Câmeras de vídeo digitais', capitulo: '85', aliquotaIi: 20, aliquotaIpi: 15, anuentes: [], setor: 'Eletronicos' },
    { ncm: '84716052', descricao: 'Teclados para máquinas de processamento de dados', capitulo: '84', aliquotaIi: 2, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '84716053', descricao: 'Dispositivos de entrada por coordenadas (mouse)', capitulo: '84', aliquotaIi: 2, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85171800', descricao: 'Outros aparelhos telefônicos', capitulo: '85', aliquotaIi: 16, aliquotaIpi: 15, anuentes: ['ANATEL'], setor: 'Eletronicos' },
    { ncm: '85177090', descricao: 'Partes de aparelhos telefônicos', capitulo: '85', aliquotaIi: 12, aliquotaIpi: 10, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85181000', descricao: 'Microfones e seus suportes', capitulo: '85', aliquotaIi: 20, aliquotaIpi: 15, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85182100', descricao: 'Alto-falantes únicos montados em caixas', capitulo: '85', aliquotaIi: 20, aliquotaIpi: 15, anuentes: [], setor: 'Eletronicos' },
    { ncm: '90318099', descricao: 'Outros instrumentos e aparelhos de medida ou controle', capitulo: '90', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85171232', descricao: 'Telefones celulares portáteis exceto por satélite', capitulo: '85', aliquotaIi: 16, aliquotaIpi: 15, anuentes: ['ANATEL'], setor: 'Eletronicos' },
    { ncm: '84718000', descricao: 'Outras unidades de máquinas de processamento de dados', capitulo: '84', aliquotaIi: 2, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85235910', descricao: 'Dispositivos de armazenamento semicondutor (SSD)', capitulo: '85', aliquotaIi: 0, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85393190', descricao: 'Lâmpadas LED', capitulo: '85', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85044030', descricao: 'Carregadores de acumuladores', capitulo: '85', aliquotaIi: 14, aliquotaIpi: 5, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85076000', descricao: 'Acumuladores de íons de lítio', capitulo: '85', aliquotaIi: 16, aliquotaIpi: 0, anuentes: [], setor: 'Eletronicos' },
    { ncm: '84433110', descricao: 'Impressoras multifuncionais', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 15, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85198190', descricao: 'Aparelhos reprodutores de som (MP3)', capitulo: '85', aliquotaIi: 20, aliquotaIpi: 15, anuentes: [], setor: 'Eletronicos' },
    { ncm: '85176269', descricao: 'Outros aparelhos para transmissão ou recepção de dados', capitulo: '85', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANATEL'], setor: 'Eletronicos' },

    // ============ AUTOPEÇAS (Cap. 87) - 30 NCMs ============
    { ncm: '87089990', descricao: 'Outras partes e acessórios de veículos', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87088000', descricao: 'Amortecedores de suspensão', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87083010', descricao: 'Freios e suas partes', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87084090', descricao: 'Caixas de marchas', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87085099', descricao: 'Eixos e semi-eixos', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87087010', descricao: 'Rodas e suas partes', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '40111000', descricao: 'Pneus novos para automóveis', capitulo: '40', aliquotaIi: 16, aliquotaIpi: 0, anuentes: ['INMETRO', 'IBAMA'], setor: 'Autopecas' },
    { ncm: '68138100', descricao: 'Pastilhas de freio', capitulo: '68', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87082990', descricao: 'Outras partes e acessórios de carroçarias', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87089100', descricao: 'Radiadores para veículos', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87089200', descricao: 'Silenciadores e tubos de escape', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO', 'IBAMA'], setor: 'Autopecas' },
    { ncm: '87089300', descricao: 'Embreagens e suas partes', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87089400', descricao: 'Volantes, colunas e caixas de direção', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87085010', descricao: 'Eixos de transmissão com diferencial', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '87083090', descricao: 'Outros freios e servo-freios', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 5, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '84099190', descricao: 'Partes de motores de ignição por centelha', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Autopecas' },
    { ncm: '84099990', descricao: 'Partes de outros motores', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Autopecas' },
    { ncm: '85119090', descricao: 'Partes de equipamentos elétricos de ignição', capitulo: '85', aliquotaIi: 16, aliquotaIpi: 0, anuentes: [], setor: 'Autopecas' },
    { ncm: '85122090', descricao: 'Outros equipamentos de iluminação para veículos', capitulo: '85', aliquotaIi: 18, aliquotaIpi: 15, anuentes: [], setor: 'Autopecas' },
    { ncm: '70091000', descricao: 'Espelhos retrovisores para veículos', capitulo: '70', aliquotaIi: 14, aliquotaIpi: 10, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '40169300', descricao: 'Juntas de vedação de borracha', capitulo: '40', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Autopecas' },
    { ncm: '84133090', descricao: 'Bombas de combustível para motores', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Autopecas' },
    { ncm: '87082100', descricao: 'Cintos de segurança', capitulo: '87', aliquotaIi: 18, aliquotaIpi: 0, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '40112000', descricao: 'Pneus novos para ônibus ou caminhões', capitulo: '40', aliquotaIi: 16, aliquotaIpi: 0, anuentes: ['INMETRO', 'IBAMA'], setor: 'Autopecas' },
    { ncm: '40119290', descricao: 'Pneus novos para veículos agrícolas', capitulo: '40', aliquotaIi: 4, aliquotaIpi: 0, anuentes: ['INMETRO'], setor: 'Autopecas' },
    { ncm: '73182100', descricao: 'Arruelas de pressão e de segurança', capitulo: '73', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Autopecas' },
    { ncm: '84212100', descricao: 'Aparelhos para filtrar ou depurar água', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Autopecas' },
    { ncm: '85113020', descricao: 'Distribuidores e bobinas de ignição', capitulo: '85', aliquotaIi: 18, aliquotaIpi: 0, anuentes: [], setor: 'Autopecas' },
    { ncm: '85114090', descricao: 'Outros motores de arranque', capitulo: '85', aliquotaIi: 18, aliquotaIpi: 0, anuentes: [], setor: 'Autopecas' },
    { ncm: '84831019', descricao: 'Virabrequins', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Autopecas' },

    // ============ COSMÉTICOS (Cap. 33) - 25 NCMs ============
    { ncm: '33049990', descricao: 'Outros produtos de beleza ou maquiagem', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 22, anuentes: ['ANVISA'], requerLpco: true, tipoLpco: 'LPCO', setor: 'Cosmeticos' },
    { ncm: '33049100', descricao: 'Pós para maquiagem', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 22, anuentes: ['ANVISA'], requerLpco: true, tipoLpco: 'LPCO', setor: 'Cosmeticos' },
    { ncm: '33041000', descricao: 'Produtos de maquiagem para lábios', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 22, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33042090', descricao: 'Produtos de maquiagem para olhos', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 22, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33051000', descricao: 'Xampus', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 7, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33059000', descricao: 'Outras preparações capilares', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 7, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33061000', descricao: 'Dentifrícios', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33030010', descricao: 'Perfumes e águas-de-colônia', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 42, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33030020', descricao: 'Águas de toalete', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 42, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33042010', descricao: 'Sombras para olhos', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 22, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33043000', descricao: 'Preparações para manicuros e pedicuros', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 22, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33049910', descricao: 'Cremes de beleza', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 22, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33052000', descricao: 'Preparações para ondulação ou alisamento permanentes', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 7, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33053000', descricao: 'Lacas para cabelo', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 7, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33069000', descricao: 'Outras preparações para higiene bucal ou dentária', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33071000', descricao: 'Preparações para barbear', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 12, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33072010', descricao: 'Desodorantes corporais', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 7, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33073000', descricao: 'Sais perfumados e outras preparações para banho', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 12, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33079000', descricao: 'Outros produtos de perfumaria ou toucador', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 12, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '34011190', descricao: 'Sabões de toucador', capitulo: '34', aliquotaIi: 18, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '34012000', descricao: 'Sabões em outras formas', capitulo: '34', aliquotaIi: 18, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33054000', descricao: 'Outras preparações capilares', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 7, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33059010', descricao: 'Loções capilares', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 7, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33062000', descricao: 'Fios utilizados para limpar os espaços interdentais', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },
    { ncm: '33051010', descricao: 'Xampus para cabelos normais', capitulo: '33', aliquotaIi: 18, aliquotaIpi: 7, anuentes: ['ANVISA'], requerLpco: true, setor: 'Cosmeticos' },

    // ============ ALIMENTOS E BEBIDAS (Cap. 02-22) - 35 NCMs ============
    { ncm: '22041000', descricao: 'Vinhos espumantes', capitulo: '22', aliquotaIi: 27, aliquotaIpi: 40, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '22042100', descricao: 'Outros vinhos em recipientes até 2L', capitulo: '22', aliquotaIi: 27, aliquotaIpi: 30, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '22030000', descricao: 'Cervejas de malte', capitulo: '22', aliquotaIi: 20, aliquotaIpi: 40, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '18063100', descricao: 'Chocolates recheados', capitulo: '18', aliquotaIi: 20, aliquotaIpi: 5, anuentes: ['MAPA'], setor: 'Alimentos' },
    { ncm: '18063200', descricao: 'Chocolate em tabletes ou barras', capitulo: '18', aliquotaIi: 20, aliquotaIpi: 5, anuentes: ['MAPA'], setor: 'Alimentos' },
    { ncm: '21069090', descricao: 'Outras preparações alimentícias', capitulo: '21', aliquotaIi: 16, aliquotaIpi: 0, anuentes: ['ANVISA', 'MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '16010000', descricao: 'Embutidos e produtos similares de carne', capitulo: '16', aliquotaIi: 16, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '04069000', descricao: 'Outros queijos', capitulo: '04', aliquotaIi: 28, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '20098900', descricao: 'Outros sucos de frutas', capitulo: '20', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['MAPA'], setor: 'Alimentos' },
    { ncm: '22042900', descricao: 'Outros vinhos em recipientes acima de 2L', capitulo: '22', aliquotaIi: 27, aliquotaIpi: 20, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '22082000', descricao: 'Aguardentes de vinho ou de bagaço de uvas', capitulo: '22', aliquotaIi: 20, aliquotaIpi: 60, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '22083011', descricao: 'Uísques', capitulo: '22', aliquotaIi: 20, aliquotaIpi: 60, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '22084000', descricao: 'Rum e outras aguardentes de cana', capitulo: '22', aliquotaIi: 20, aliquotaIpi: 30, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '22085000', descricao: 'Gin e genebra', capitulo: '22', aliquotaIi: 20, aliquotaIpi: 60, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '22086000', descricao: 'Vodca', capitulo: '22', aliquotaIi: 20, aliquotaIpi: 60, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '22087000', descricao: 'Licores', capitulo: '22', aliquotaIi: 20, aliquotaIpi: 60, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '04061010', descricao: 'Queijo mussarela', capitulo: '04', aliquotaIi: 28, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '04062000', descricao: 'Queijos ralados ou em pó', capitulo: '04', aliquotaIi: 28, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '04063000', descricao: 'Queijos fundidos', capitulo: '04', aliquotaIi: 28, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '04064000', descricao: 'Queijos de pasta mofada', capitulo: '04', aliquotaIi: 28, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '02011000', descricao: 'Carcaças e meias-carcaças de bovino', capitulo: '02', aliquotaIi: 10, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '02013000', descricao: 'Carnes bovinas desossadas', capitulo: '02', aliquotaIi: 10, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '02031100', descricao: 'Carcaças e meias-carcaças de suíno', capitulo: '02', aliquotaIi: 10, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '02071100', descricao: 'Galos e galinhas não cortados', capitulo: '02', aliquotaIi: 10, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '03028900', descricao: 'Outros peixes frescos ou refrigerados', capitulo: '03', aliquotaIi: 10, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '03034900', descricao: 'Outros atuns congelados', capitulo: '03', aliquotaIi: 10, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '16024100', descricao: 'Presuntos e pedaços', capitulo: '16', aliquotaIi: 16, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '16025000', descricao: 'Preparações e conservas de bovinos', capitulo: '16', aliquotaIi: 16, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '19053100', descricao: 'Biscoitos e bolachas adicionados de edulcorante', capitulo: '19', aliquotaIi: 16, aliquotaIpi: 0, anuentes: ['MAPA'], setor: 'Alimentos' },
    { ncm: '19053200', descricao: 'Waffles e wafers', capitulo: '19', aliquotaIi: 16, aliquotaIpi: 0, anuentes: ['MAPA'], setor: 'Alimentos' },
    { ncm: '18061000', descricao: 'Cacau em pó adoçado', capitulo: '18', aliquotaIi: 20, aliquotaIpi: 5, anuentes: ['MAPA'], setor: 'Alimentos' },
    { ncm: '17049010', descricao: 'Chocolates brancos', capitulo: '17', aliquotaIi: 20, aliquotaIpi: 5, anuentes: ['MAPA'], setor: 'Alimentos' },
    { ncm: '08051000', descricao: 'Laranjas', capitulo: '08', aliquotaIi: 10, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '08061000', descricao: 'Uvas frescas', capitulo: '08', aliquotaIi: 10, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },
    { ncm: '08081000', descricao: 'Maçãs', capitulo: '08', aliquotaIi: 10, aliquotaIpi: 0, anuentes: ['MAPA'], requerLpco: true, setor: 'Alimentos' },

    // ============ MÁQUINAS INDUSTRIAIS (Cap. 84) - 25 NCMs ============
    { ncm: '84798999', descricao: 'Outras máquinas e aparelhos mecânicos', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], exTarifario: true, setor: 'Maquinas' },
    { ncm: '84212300', descricao: 'Aparelhos para filtrar óleos', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },
    { ncm: '84229090', descricao: 'Partes de máquinas de lavar louça', capitulo: '84', aliquotaIi: 18, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },
    { ncm: '84314990', descricao: 'Partes de guindastes e gruas', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 5, anuentes: [], setor: 'Maquinas' },
    { ncm: '84329000', descricao: 'Partes de máquinas agrícolas', capitulo: '84', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['MAPA'], destaque: 'Máquinas agrícolas', setor: 'Maquinas' },
    { ncm: '84248990', descricao: 'Outros aparelhos mecânicos para projetar', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 5, anuentes: [], setor: 'Maquinas' },
    { ncm: '84223000', descricao: 'Máquinas de encher, fechar ou etiquetar', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], exTarifario: true, setor: 'Maquinas' },
    { ncm: '84669400', descricao: 'Partes para máquinas-ferramenta', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },
    { ncm: '84313900', descricao: 'Outras partes de elevadores ou monta-cargas', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },
    { ncm: '84321000', descricao: 'Arados', capitulo: '84', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['MAPA'], setor: 'Maquinas' },
    { ncm: '84322100', descricao: 'Grades de discos', capitulo: '84', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['MAPA'], setor: 'Maquinas' },
    { ncm: '84323000', descricao: 'Semeadores, plantadores e transplantadores', capitulo: '84', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['MAPA'], setor: 'Maquinas' },
    { ncm: '84324000', descricao: 'Espalhadores de estrume e distribuidores de adubos', capitulo: '84', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['MAPA'], setor: 'Maquinas' },
    { ncm: '84335990', descricao: 'Colheitadeiras', capitulo: '84', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['MAPA'], setor: 'Maquinas' },
    { ncm: '84381000', descricao: 'Máquinas para padaria, pastelaria ou fabricação de biscoitos', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },
    { ncm: '84224000', descricao: 'Máquinas de empacotar mercadorias', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], exTarifario: true, setor: 'Maquinas' },
    { ncm: '84181000', descricao: 'Combinações de refrigeradores e congeladores', capitulo: '84', aliquotaIi: 20, aliquotaIpi: 15, anuentes: ['IBAMA'], setor: 'Maquinas' },
    { ncm: '84186990', descricao: 'Outros equipamentos de refrigeração', capitulo: '84', aliquotaIi: 18, aliquotaIpi: 10, anuentes: ['IBAMA'], setor: 'Maquinas' },
    { ncm: '84195090', descricao: 'Trocadores de calor', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },
    { ncm: '84518090', descricao: 'Outras máquinas para lavar roupas', capitulo: '84', aliquotaIi: 20, aliquotaIpi: 20, anuentes: [], setor: 'Maquinas' },
    { ncm: '84521000', descricao: 'Máquinas de costura domésticas', capitulo: '84', aliquotaIi: 20, aliquotaIpi: 5, anuentes: [], setor: 'Maquinas' },
    { ncm: '84529090', descricao: 'Partes de máquinas de costura', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },
    { ncm: '84581900', descricao: 'Tornos horizontais', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },
    { ncm: '84602900', descricao: 'Outras retificadoras', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },
    { ncm: '84621090', descricao: 'Máquinas de forjar', capitulo: '84', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Maquinas' },

    // ============ TÊXTEIS E VESTUÁRIO (Cap. 50-63) - 25 NCMs ============
    { ncm: '62034200', descricao: 'Calças masculinas de algodão', capitulo: '62', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '62046200', descricao: 'Calças femininas de algodão', capitulo: '62', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '61091000', descricao: 'T-shirts de malha de algodão', capitulo: '61', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '62052000', descricao: 'Camisas masculinas de algodão', capitulo: '62', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '61046200', descricao: 'Calças femininas de malha de algodão', capitulo: '61', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '64039990', descricao: 'Outros calçados de couro', capitulo: '64', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '42021200', descricao: 'Malas e maletas com superfície exterior de plástico', capitulo: '42', aliquotaIi: 20, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '42022200', descricao: 'Bolsas com superfície exterior de plástico', capitulo: '42', aliquotaIi: 20, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '61033200', descricao: 'Paletós de malha de algodão', capitulo: '61', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '61034200', descricao: 'Calças masculinas de malha de algodão', capitulo: '61', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '61043200', descricao: 'Tailleurs de malha de algodão', capitulo: '61', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '61051000', descricao: 'Camisas de malha de algodão', capitulo: '61', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '62011200', descricao: 'Sobretudos de algodão para homens', capitulo: '62', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '62021200', descricao: 'Sobretudos de algodão para mulheres', capitulo: '62', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '62042200', descricao: 'Conjuntos femininos de algodão', capitulo: '62', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '62063000', descricao: 'Camisas femininas de algodão', capitulo: '62', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '64019200', descricao: 'Calçados impermeáveis', capitulo: '64', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '64029990', descricao: 'Outros calçados', capitulo: '64', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '64041100', descricao: 'Calçados para esporte', capitulo: '64', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '65050029', descricao: 'Chapéus e bonés', capitulo: '65', aliquotaIi: 20, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '42031000', descricao: 'Vestuário de couro', capitulo: '42', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '42032900', descricao: 'Luvas de couro', capitulo: '42', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '42033000', descricao: 'Cintos e bandoleiras de couro', capitulo: '42', aliquotaIi: 35, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '63026000', descricao: 'Roupas de toucador ou de cozinha', capitulo: '63', aliquotaIi: 20, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },
    { ncm: '63041900', descricao: 'Colchas', capitulo: '63', aliquotaIi: 20, aliquotaIpi: 0, anuentes: [], setor: 'Texteis' },

    // ============ QUÍMICOS E FARMACÊUTICOS (Cap. 28-38) - 25 NCMs ============
    { ncm: '29181400', descricao: 'Ácido cítrico', capitulo: '29', aliquotaIi: 12, aliquotaIpi: 0, anuentes: ['ANVISA'], destaque: 'Uso farmacêutico', setor: 'Quimicos' },
    { ncm: '29362100', descricao: 'Vitaminas A e seus derivados', capitulo: '29', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], setor: 'Quimicos' },
    { ncm: '38089410', descricao: 'Desinfetantes', capitulo: '38', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '32089090', descricao: 'Outras tintas e vernizes', capitulo: '32', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['IBAMA'], setor: 'Quimicos' },
    { ncm: '34022000', descricao: 'Preparações tensoativas', capitulo: '34', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['ANVISA'], setor: 'Quimicos' },
    { ncm: '30049099', descricao: 'Outros medicamentos', capitulo: '30', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '30042099', descricao: 'Medicamentos contendo outros antibióticos', capitulo: '30', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '30043990', descricao: 'Medicamentos contendo hormônios', capitulo: '30', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '30045090', descricao: 'Medicamentos contendo vitaminas', capitulo: '30', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '30051010', descricao: 'Curativos adesivos', capitulo: '30', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '30062000', descricao: 'Reagentes para determinação de grupos sanguíneos', capitulo: '30', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '29362200', descricao: 'Vitamina B1 e seus derivados', capitulo: '29', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], setor: 'Quimicos' },
    { ncm: '29362300', descricao: 'Vitamina B2 e seus derivados', capitulo: '29', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], setor: 'Quimicos' },
    { ncm: '29362500', descricao: 'Vitamina B6 e seus derivados', capitulo: '29', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], setor: 'Quimicos' },
    { ncm: '29362600', descricao: 'Vitamina B12 e seus derivados', capitulo: '29', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], setor: 'Quimicos' },
    { ncm: '29362700', descricao: 'Vitamina C e seus derivados', capitulo: '29', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], setor: 'Quimicos' },
    { ncm: '29362800', descricao: 'Vitamina E e seus derivados', capitulo: '29', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], setor: 'Quimicos' },
    { ncm: '28352600', descricao: 'Fosfatos de cálcio', capitulo: '28', aliquotaIi: 10, aliquotaIpi: 0, anuentes: [], setor: 'Quimicos' },
    { ncm: '28369990', descricao: 'Outros carbonatos', capitulo: '28', aliquotaIi: 10, aliquotaIpi: 0, anuentes: [], setor: 'Quimicos' },
    { ncm: '28421000', descricao: 'Silicatos duplos ou complexos', capitulo: '28', aliquotaIi: 10, aliquotaIpi: 0, anuentes: [], setor: 'Quimicos' },
    { ncm: '38089119', descricao: 'Inseticidas', capitulo: '38', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['ANVISA', 'IBAMA', 'MAPA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '38089219', descricao: 'Fungicidas', capitulo: '38', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['ANVISA', 'IBAMA', 'MAPA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '38089319', descricao: 'Herbicidas', capitulo: '38', aliquotaIi: 14, aliquotaIpi: 0, anuentes: ['ANVISA', 'IBAMA', 'MAPA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '38220000', descricao: 'Reagentes de diagnóstico ou de laboratório', capitulo: '38', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Quimicos' },
    { ncm: '39269090', descricao: 'Outras obras de plástico', capitulo: '39', aliquotaIi: 18, aliquotaIpi: 0, anuentes: [], setor: 'Quimicos' },

    // ============ INSTRUMENTOS MÉDICOS E CIENTÍFICOS (Cap. 90) - 15 NCMs ============
    { ncm: '90181990', descricao: 'Outros aparelhos de eletrodiagnóstico', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90189099', descricao: 'Outros instrumentos e aparelhos para medicina', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90211000', descricao: 'Aparelhos ortopédicos', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90212100', descricao: 'Dentes artificiais', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90213100', descricao: 'Próteses articulares', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90221200', descricao: 'Aparelhos de tomografia', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90221400', descricao: 'Outros aparelhos de raio-X para uso médico', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90183190', descricao: 'Seringas', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90183200', descricao: 'Agulhas tubulares de metal', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90183900', descricao: 'Outros cateteres e cânulas', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90192010', descricao: 'Aparelhos de oxigenoterapia', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90181100', descricao: 'Eletrocardiógrafos', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90181200', descricao: 'Aparelhos de ultrassonografia', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90181300', descricao: 'Aparelhos de ressonância magnética', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },
    { ncm: '90184990', descricao: 'Outros instrumentos e aparelhos de odontologia', capitulo: '90', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANVISA'], requerLpco: true, setor: 'Medico' },

    // ============ BRINQUEDOS E JOGOS (Cap. 95) - 10 NCMs ============
    { ncm: '95030010', descricao: 'Triciclos, patinetes e carros de pedais', capitulo: '95', aliquotaIi: 20, aliquotaIpi: 20, anuentes: ['INMETRO'], setor: 'Brinquedos' },
    { ncm: '95030021', descricao: 'Bonecas', capitulo: '95', aliquotaIi: 20, aliquotaIpi: 20, anuentes: ['INMETRO'], setor: 'Brinquedos' },
    { ncm: '95030031', descricao: 'Modelos em escala reduzida', capitulo: '95', aliquotaIi: 20, aliquotaIpi: 20, anuentes: ['INMETRO'], setor: 'Brinquedos' },
    { ncm: '95030040', descricao: 'Quebra-cabeças', capitulo: '95', aliquotaIi: 20, aliquotaIpi: 20, anuentes: ['INMETRO'], setor: 'Brinquedos' },
    { ncm: '95030050', descricao: 'Brinquedos de construção', capitulo: '95', aliquotaIi: 20, aliquotaIpi: 20, anuentes: ['INMETRO'], setor: 'Brinquedos' },
    { ncm: '95030060', descricao: 'Brinquedos com motor elétrico', capitulo: '95', aliquotaIi: 20, aliquotaIpi: 20, anuentes: ['INMETRO', 'ANATEL'], setor: 'Brinquedos' },
    { ncm: '95030070', descricao: 'Outros brinquedos apresentados em conjuntos', capitulo: '95', aliquotaIi: 20, aliquotaIpi: 20, anuentes: ['INMETRO'], setor: 'Brinquedos' },
    { ncm: '95030098', descricao: 'Outros brinquedos', capitulo: '95', aliquotaIi: 20, aliquotaIpi: 20, anuentes: ['INMETRO'], setor: 'Brinquedos' },
    { ncm: '95049090', descricao: 'Consoles de videogame', capitulo: '95', aliquotaIi: 20, aliquotaIpi: 50, anuentes: ['INMETRO'], setor: 'Brinquedos' },
    { ncm: '95045000', descricao: 'Consoles de videogame portáteis', capitulo: '95', aliquotaIi: 20, aliquotaIpi: 50, anuentes: ['INMETRO'], setor: 'Brinquedos' },

    // ============ MATERIAIS DE CONSTRUÇÃO (Cap. 25, 68-70, 73) - 10 NCMs ============
    { ncm: '25232900', descricao: 'Cimento Portland', capitulo: '25', aliquotaIi: 10, aliquotaIpi: 0, anuentes: [], setor: 'Construcao' },
    { ncm: '69041000', descricao: 'Tijolos de construção', capitulo: '69', aliquotaIi: 12, aliquotaIpi: 0, anuentes: [], setor: 'Construcao' },
    { ncm: '69072100', descricao: 'Ladrilhos e placas cerâmicas', capitulo: '69', aliquotaIi: 18, aliquotaIpi: 0, anuentes: [], setor: 'Construcao' },
    { ncm: '70052100', descricao: 'Vidro float', capitulo: '70', aliquotaIi: 12, aliquotaIpi: 0, anuentes: [], setor: 'Construcao' },
    { ncm: '70071900', descricao: 'Vidro de segurança temperado', capitulo: '70', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Construcao' },
    { ncm: '72142000', descricao: 'Barras de ferro ou aço', capitulo: '72', aliquotaIi: 12, aliquotaIpi: 0, anuentes: [], setor: 'Construcao' },
    { ncm: '72163100', descricao: 'Perfis de ferro ou aço', capitulo: '72', aliquotaIi: 12, aliquotaIpi: 0, anuentes: [], setor: 'Construcao' },
    { ncm: '73066100', descricao: 'Tubos soldados de seção quadrada', capitulo: '73', aliquotaIi: 14, aliquotaIpi: 0, anuentes: [], setor: 'Construcao' },
    { ncm: '76061190', descricao: 'Chapas de alumínio', capitulo: '76', aliquotaIi: 12, aliquotaIpi: 0, anuentes: [], setor: 'Construcao' },
    { ncm: '74091900', descricao: 'Chapas de cobre', capitulo: '74', aliquotaIi: 8, aliquotaIpi: 0, anuentes: [], setor: 'Construcao' },

    // ============ UTENSÍLIOS E TALHERES (Cap. 82) - 11 NCMs ============
    { ncm: '82111000', descricao: 'Sortidos de facas de lâmina cortante', capitulo: '82', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Utensilios' },
    { ncm: '82119100', descricao: 'Facas de mesa, de lâmina fixa', capitulo: '82', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Utensilios' },
    { ncm: '82119200', descricao: 'Outras facas de lâmina fixa', capitulo: '82', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Utensilios' },
    { ncm: '82119300', descricao: 'Facas de lâmina não fixa', capitulo: '82', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Utensilios' },
    { ncm: '82141000', descricao: 'Espátulas, abre-cartas, corta-papéis e suas lâminas', capitulo: '82', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Utensilios' },
    { ncm: '82142000', descricao: 'Utensílios e sortidos de manicure ou pedicure', capitulo: '82', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Utensilios' },
    { ncm: '82151000', descricao: 'Sortidos de colheres, garfos, conchas, escumadeiras, pegadores de açúcar', capitulo: '82', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Utensilios' },
    { ncm: '82152000', descricao: 'Outros sortidos de artigos de cutelaria', capitulo: '82', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Utensilios' },
    { ncm: '82159100', descricao: 'Colheres, garfos, conchas, escumadeiras, etc. (não em sortidos)', capitulo: '82', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Utensilios' },
    { ncm: '82159200', descricao: 'Facas de mesa (exceto de lâmina fixa)', capitulo: '82', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Utensilios' },
    { ncm: '82159900', descricao: 'Outros artigos de cutelaria de mesa', capitulo: '82', aliquotaIi: 18, aliquotaIpi: 5, anuentes: [], setor: 'Utensilios' },

    // ============ COMBUSTÍVEIS E ENERGIA (Cap. 27) - 10 NCMs ============
    { ncm: '27101259', descricao: 'Gasolina para veículos', capitulo: '27', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANP'], requerLpco: true, setor: 'Combustiveis' },
    { ncm: '27101921', descricao: 'Diesel', capitulo: '27', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANP'], requerLpco: true, setor: 'Combustiveis' },
    { ncm: '27111100', descricao: 'Gás natural liquefeito', capitulo: '27', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANP'], requerLpco: true, setor: 'Combustiveis' },
    { ncm: '27111290', descricao: 'Propano liquefeito', capitulo: '27', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANP'], requerLpco: true, setor: 'Combustiveis' },
    { ncm: '27101911', descricao: 'Querosene de aviação', capitulo: '27', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANP'], requerLpco: true, setor: 'Combustiveis' },
    { ncm: '27101231', descricao: 'Nafta petroquímica', capitulo: '27', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANP'], requerLpco: true, setor: 'Combustiveis' },
    { ncm: '27109100', descricao: 'Resíduos de óleos', capitulo: '27', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANP', 'IBAMA'], requerLpco: true, setor: 'Combustiveis' },
    { ncm: '27101993', descricao: 'Óleos lubrificantes', capitulo: '27', aliquotaIi: 4, aliquotaIpi: 0, anuentes: ['ANP'], setor: 'Combustiveis' },
    { ncm: '38260090', descricao: 'Biodiesel', capitulo: '38', aliquotaIi: 0, aliquotaIpi: 0, anuentes: ['ANP', 'IBAMA'], requerLpco: true, setor: 'Combustiveis' },
    { ncm: '22071000', descricao: 'Álcool etílico não desnaturado', capitulo: '22', aliquotaIi: 20, aliquotaIpi: 0, anuentes: ['ANP', 'MAPA'], requerLpco: true, setor: 'Combustiveis' },
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
