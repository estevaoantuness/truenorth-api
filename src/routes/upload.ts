import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { runExtractionPipeline } from '../services/extractionPipeline';
import { parseXML } from '../utils/xmlParser';
import { requireAuth, AuthRequest } from '../middleware/auth';

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
    // Image types
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/heic',
    'image/heif',
  ];

  // Accept by file extension
  const fileName = file.originalname.toLowerCase();
  const isPdfExtension = fileName.endsWith('.pdf');
  const isXmlExtension = fileName.endsWith('.xml');
  const isImageExtension = ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'].some(ext => fileName.endsWith(ext));

  console.log(`File upload: ${file.originalname}, MIME: ${file.mimetype}`);

  if (allowedMimeTypes.includes(file.mimetype) || isPdfExtension || isXmlExtension || isImageExtension) {
    cb(null, true);
  } else {
    console.error(`Rejected file: ${file.originalname}, MIME: ${file.mimetype}`);
    cb(new Error(`Tipo de arquivo não suportado (${file.mimetype}). Use PDF, XML ou imagem (PNG, JPG, WEBP).`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// POST /api/upload - Upload and process document in memory (requires auth)
router.post('/', requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const file = req.file;
    const userId = req.user.userId;

    // Determine file type by extension (more reliable than MIME)
    const fileName = file.originalname.toLowerCase();
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'];
    const isImage = imageExtensions.some(ext => fileName.endsWith(ext)) || file.mimetype.startsWith('image/');

    const fileType = fileName.endsWith('.pdf') ? 'PDF' :
                     fileName.endsWith('.xml') ? 'XML' :
                     isImage ? 'IMAGE' :
                     file.mimetype === 'application/pdf' ? 'PDF' : 'XML';

    console.log(`Processing ${fileType} file: ${file.originalname}, size: ${file.size} bytes, user: ${userId}`);

    // Create operation record linked to user
    const operation = await prisma.operacao.create({
      data: {
        arquivoNome: file.originalname,
        arquivoTipo: fileType,
        status: 'PROCESSANDO',
        userId: userId,
      },
    });

    try {
      let extractedData: any = null;
      let pipelineMetadata: any = null;

      // Process file using two-stage pipeline
      if (fileType === 'PDF' || fileType === 'IMAGE') {
        // Use new extraction pipeline (Groq scraper + GPT-4o analyst)
        console.log(`[Upload] Running extraction pipeline for ${fileType}...`);
        const result = await runExtractionPipeline(fileType, file.buffer, file.mimetype);
        extractedData = result.classified;
        pipelineMetadata = result.metadata;
        console.log(`[Upload] Pipeline complete: ${result.metadata.scraperUsed}, ${result.metadata.processingTimeMs}ms`);
      } else {
        // XML processing (direct parse, no AI needed)
        const xmlContent = file.buffer.toString('utf-8');
        extractedData = await parseXML(xmlContent);
      }

      // Update operation with extracted data
      await prisma.operacao.update({
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
        pipeline: pipelineMetadata,
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
