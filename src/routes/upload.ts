import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { extractTextFromPDFBuffer } from '../utils/pdfParser';
import { extractDataFromDocument } from '../services/geminiService';
import { parseXML } from '../utils/xmlParser';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for MEMORY storage (no disk writes)
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['application/pdf', 'text/xml', 'application/xml'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado. Use PDF ou XML.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// POST /api/upload - Upload and process document in memory
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const file = req.file;
    const fileType = file.mimetype === 'application/pdf' ? 'PDF' : 'XML';

    console.log(`Processing ${fileType} file: ${file.originalname}, size: ${file.size} bytes`);

    // Create operation record first
    const operation = await prisma.operacao.create({
      data: {
        arquivoNome: file.originalname,
        arquivoTipo: fileType,
        status: 'PROCESSANDO',
      },
    });

    try {
      let extractedData: any = null;

      // Process file from memory buffer
      if (fileType === 'PDF') {
        // Extract text from PDF buffer
        const extractedText = await extractTextFromPDFBuffer(file.buffer);
        console.log(`Extracted ${extractedText.length} characters from PDF`);

        // Call Gemini to extract structured data
        extractedData = await extractDataFromDocument(extractedText, 'PDF');
      } else {
        // XML processing
        const xmlContent = file.buffer.toString('utf-8');
        extractedData = await parseXML(xmlContent);
      }

      // Update operation with extracted data
      const updatedOperation = await prisma.operacao.update({
        where: { id: operation.id },
        data: {
          dadosExtraidos: extractedData,
          status: 'EXTRAIDO',
        },
      });

      console.log(`Operation ${operation.id} processed successfully`);

      res.json({
        success: true,
        operationId: operation.id,
        status: 'EXTRAIDO',
        file: {
          name: file.originalname,
          type: fileType,
          size: file.size,
        },
        dadosExtraidos: extractedData,
        message: 'Arquivo processado com sucesso. Use /api/validate para validar.',
      });

    } catch (processError: any) {
      // Update operation status to error
      await prisma.operacao.update({
        where: { id: operation.id },
        data: { status: 'ERRO' },
      });
      throw processError;
    }

  } catch (error: any) {
    console.error('Upload/Process error:', error);
    res.status(500).json({ error: error.message || 'Erro ao processar arquivo' });
  }
});

// GET /api/upload/:id - Get upload status
router.get('/:id', async (req, res) => {
  try {
    const operation = await prisma.operacao.findUnique({
      where: { id: req.params.id },
    });

    if (!operation) {
      return res.status(404).json({ error: 'Operação não encontrada' });
    }

    res.json(operation);
  } catch (error: any) {
    console.error('Get upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
