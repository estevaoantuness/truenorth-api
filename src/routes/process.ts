import express from 'express';
import { PrismaClient } from '@prisma/client';
import { extractDataFromDocument } from '../services/geminiService';
import { parseXML } from '../utils/xmlParser';
import { extractTextFromPDF } from '../utils/pdfParser';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/process/:operationId - Process document with Gemini AI
router.post('/:operationId', async (req, res) => {
  try {
    const { operationId } = req.params;

    // Get operation
    const operation = await prisma.operacao.findUnique({
      where: { id: operationId },
    });

    if (!operation) {
      return res.status(404).json({ error: 'Operação não encontrada' });
    }

    if (!operation.arquivoUrl) {
      return res.status(400).json({ error: 'Operação não possui arquivo associado' });
    }

    // Get file path
    const filePath = path.join(__dirname, '../..', operation.arquivoUrl);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
    }

    let extractedText = '';
    let extractedData: any = null;

    // Extract text based on file type
    if (operation.arquivoTipo === 'PDF') {
      extractedText = await extractTextFromPDF(filePath);
      // Call Gemini to extract structured data
      extractedData = await extractDataFromDocument(extractedText, 'PDF');
    } else if (operation.arquivoTipo === 'XML') {
      const xmlContent = fs.readFileSync(filePath, 'utf-8');
      extractedData = await parseXML(xmlContent);
    }

    // Update operation with extracted data
    const updatedOperation = await prisma.operacao.update({
      where: { id: operationId },
      data: {
        dadosExtraidos: extractedData,
        status: 'EXTRAIDO',
      },
    });

    res.json({
      success: true,
      operationId,
      status: 'EXTRAIDO',
      dadosExtraidos: extractedData,
      message: 'Dados extraídos com sucesso. Use /api/validate para validar.',
    });
  } catch (error: any) {
    console.error('Process error:', error);

    // Update operation status to error
    if (req.params.operationId) {
      await prisma.operacao.update({
        where: { id: req.params.operationId },
        data: { status: 'ERRO' },
      }).catch(() => {});
    }

    res.status(500).json({ error: error.message || 'Erro ao processar documento' });
  }
});

// POST /api/process/demo - Process demo data (without file upload)
router.post('/demo', async (req, res) => {
  try {
    const { invoiceType } = req.body; // 'electronics', 'autoparts', 'cosmetics'

    // Demo data based on invoice type
    const demoData: Record<string, any> = {
      electronics: {
        invoice_number: 'INV-2024-SZ-00847',
        invoice_date: '2024-11-15',
        supplier: {
          name: 'Shenzhen TechPro Electronics Co., Ltd.',
          address: 'Building A12, Huaqiang North, Futian District, Shenzhen 518031, China',
          country: 'China',
        },
        buyer: {
          name: 'Importadora Brasil Tech Ltda',
          cnpj: '12.345.678/0001-99',
        },
        incoterm: 'FOB',
        currency: 'USD',
        total_value: 18450.00,
        freight: 1250.00,
        insurance: 185.00,
        items: [
          {
            description: 'Smartphone Android 128GB - Model TP-X15 Pro',
            quantity: 100,
            unit: 'UN',
            unit_price: 150.00,
            total_price: 15000.00,
            ncm_sugerido: '85171231',
            peso_kg: 150,
            origem: 'CN',
          },
          {
            description: 'Fone Bluetooth TWS - Model AirBuds Pro 3',
            quantity: 200,
            unit: 'UN',
            unit_price: 15.00,
            total_price: 3000.00,
            ncm_sugerido: '85183000',
            peso_kg: 50,
            origem: 'CN',
          },
        ],
      },
      autoparts: {
        invoice_number: 'DE-2024-AUT-003291',
        invoice_date: '2024-11-10',
        supplier: {
          name: 'Süddeutsche Automotive GmbH',
          address: 'Industriestraße 45, 70565 Stuttgart, Germany',
          country: 'Alemanha',
        },
        buyer: {
          name: 'Auto Peças Nacional SA',
          cnpj: '98.765.432/0001-11',
        },
        incoterm: 'CIF',
        currency: 'EUR',
        total_value: 8750.00,
        freight: 0,
        insurance: 0,
        items: [
          {
            description: 'Kit Embreagem Completo - Ref. VAG-001234',
            quantity: 15,
            unit: 'KIT',
            unit_price: 300.00,
            total_price: 4500.00,
            ncm_sugerido: '87089990',
            peso_kg: 25,
            origem: 'DE',
          },
          {
            description: 'Amortecedor Dianteiro Par - Ref. BILSTEIN-B4',
            quantity: 20,
            unit: 'PAR',
            unit_price: 160.00,
            total_price: 3200.00,
            ncm_sugerido: '87088000',
            peso_kg: 18,
            origem: 'DE',
          },
          {
            description: 'Pastilha Freio Cerâmica Premium - Ref. ATE-13046',
            quantity: 30,
            unit: 'JG',
            unit_price: 35.00,
            total_price: 1050.00,
            ncm_sugerido: '68138100',
            peso_kg: 5,
            origem: 'DE',
          },
        ],
      },
      cosmetics: {
        invoice_number: 'US-NYC-2024-78456',
        invoice_date: '2024-11-08',
        supplier: {
          name: 'Manhattan Beauty Supplies Inc.',
          address: '350 Fifth Avenue, Suite 4500, New York, NY 10118, USA',
          country: 'Estados Unidos',
        },
        buyer: {
          name: 'Beleza & Cia Importadora',
          cnpj: '55.444.333/0001-22',
        },
        incoterm: 'DAP',
        currency: 'USD',
        total_value: 12500.00,
        freight: 0,
        insurance: 0,
        items: [
          {
            description: 'Sérum Vitamina C 30ml - SkinCeuticals C E Ferulic',
            quantity: 50,
            unit: 'UN',
            unit_price: 170.00,
            total_price: 8500.00,
            ncm_sugerido: '33049990',
            peso_kg: 2,
            origem: 'US',
          },
          {
            description: 'Creme Anti-idade 50g - La Prairie Platinum Rare',
            quantity: 8,
            unit: 'UN',
            unit_price: 500.00,
            total_price: 4000.00,
            ncm_sugerido: '33049100',
            peso_kg: 3,
            origem: 'CH',
          },
        ],
      },
    };

    const selectedData = demoData[invoiceType] || demoData.electronics;

    // Create operation with demo data
    const operation = await prisma.operacao.create({
      data: {
        arquivoNome: `Demo_Invoice_${invoiceType}.pdf`,
        arquivoTipo: 'PDF',
        dadosExtraidos: selectedData,
        status: 'EXTRAIDO',
      },
    });

    res.json({
      success: true,
      operationId: operation.id,
      status: 'EXTRAIDO',
      dadosExtraidos: selectedData,
      message: 'Dados de demonstração carregados. Use /api/validate para validar.',
    });
  } catch (error: any) {
    console.error('Demo process error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
