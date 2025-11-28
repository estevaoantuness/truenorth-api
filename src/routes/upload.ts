import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

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

// POST /api/upload - Upload a document
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const file = req.file;
    const fileType = file.mimetype === 'application/pdf' ? 'PDF' : 'XML';

    // Create operation record
    const operation = await prisma.operacao.create({
      data: {
        arquivoNome: file.originalname,
        arquivoUrl: `/uploads/${file.filename}`,
        arquivoTipo: fileType,
        status: 'PROCESSANDO',
      },
    });

    res.json({
      success: true,
      operationId: operation.id,
      file: {
        name: file.originalname,
        type: fileType,
        size: file.size,
        url: `/uploads/${file.filename}`,
      },
      message: 'Arquivo enviado com sucesso. Use /api/process para extrair os dados.',
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Erro ao fazer upload do arquivo' });
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
