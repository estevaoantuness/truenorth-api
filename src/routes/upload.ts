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
  // Accept by MIME type
  const allowedMimeTypes = [
    'application/pdf',
    'text/xml',
    'application/xml',
    'application/octet-stream', // Some systems send PDF as this
  ];

  // Accept by file extension
  const fileName = file.originalname.toLowerCase();
  const isPdfExtension = fileName.endsWith('.pdf');
  const isXmlExtension = fileName.endsWith('.xml');

  console.log(`File upload: ${file.originalname}, MIME: ${file.mimetype}`);

  if (allowedMimeTypes.includes(file.mimetype) || isPdfExtension || isXmlExtension) {
    cb(null, true);
  } else {
    console.error(`Rejected file: ${file.originalname}, MIME: ${file.mimetype}`);
    cb(new Error(`Tipo de arquivo não suportado (${file.mimetype}). Use PDF ou XML.`));
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
    // Determine file type by extension (more reliable than MIME)
    const fileName = file.originalname.toLowerCase();
    const fileType = fileName.endsWith('.pdf') ? 'PDF' :
                     fileName.endsWith('.xml') ? 'XML' :
                     file.mimetype === 'application/pdf' ? 'PDF' : 'XML';

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

        // Call AI to extract structured data (passes buffer for Vision fallback)
        extractedData = await extractDataFromDocument(extractedText, 'PDF', file.buffer);
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
