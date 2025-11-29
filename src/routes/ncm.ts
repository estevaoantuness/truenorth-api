import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getNcmInfo, searchNcmByDescription, validateNcm, getNcmStats } from '../services/ncmService';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/ncm - List NCMs with optional filters
router.get('/', async (req, res) => {
  try {
    const { setor, capitulo, search, limit = 50 } = req.query;

    const where: any = {};

    if (setor) {
      where.setor = setor as string;
    }

    if (capitulo) {
      where.capitulo = capitulo as string;
    }

    if (search) {
      where.OR = [
        { ncm: { contains: search as string } },
        { descricao: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const ncms = await prisma.ncmDatabase.findMany({
      where,
      take: Number(limit),
      orderBy: { ncm: 'asc' },
    });

    res.json(ncms);
  } catch (error: any) {
    console.error('List NCMs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ncm/search - Search NCMs by description
router.get('/search', async (req, res) => {
  try {
    const { q, setor, limit = 20 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Parâmetro de busca "q" é obrigatório' });
    }

    const results = await searchNcmByDescription(q, setor as string, Number(limit));

    res.json(results);
  } catch (error: any) {
    console.error('Search NCM error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ncm/validate/:ncm - Validate NCM
router.get('/validate/:ncm', async (req, res) => {
  try {
    const result = await validateNcm(req.params.ncm);
    res.json(result);
  } catch (error: any) {
    console.error('Validate NCM error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ncm/:ncm - Get specific NCM details (with API fallback)
router.get('/:ncm', async (req, res) => {
  try {
    // Use ncmService with API fallback
    const ncmInfo = await getNcmInfo(req.params.ncm);

    if (!ncmInfo) {
      return res.status(404).json({
        error: 'NCM não encontrado',
        ncm: req.params.ncm,
        suggestion: 'Verifique se o NCM possui 8 dígitos e está correto',
      });
    }

    // Get anuentes details
    const anuentes = await prisma.anuente.findMany({
      where: {
        sigla: { in: ncmInfo.anuentes },
      },
    });

    res.json({
      ncm: ncmInfo.ncm,
      descricao: ncmInfo.descricao,
      capitulo: ncmInfo.capitulo,
      aliquotaIi: ncmInfo.aliquotaIi,
      aliquotaIpi: ncmInfo.aliquotaIpi,
      aliquotaPis: ncmInfo.aliquotaPis,
      aliquotaCofins: ncmInfo.aliquotaCofins,
      anuentes: ncmInfo.anuentes,
      requerLpco: ncmInfo.requerLpco,
      setor: ncmInfo.setor,
      fonte: ncmInfo.fonte,
      anuentesDetalhes: anuentes,
    });
  } catch (error: any) {
    console.error('Get NCM error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ncm/setor/:setor - Get NCMs by sector
router.get('/setor/:setor', async (req, res) => {
  try {
    const ncms = await prisma.ncmDatabase.findMany({
      where: { setor: req.params.setor },
      orderBy: { ncm: 'asc' },
    });

    res.json(ncms);
  } catch (error: any) {
    console.error('Get NCMs by sector error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ncm/stats/setores - Get NCM statistics by sector
router.get('/stats/setores', async (req, res) => {
  try {
    const setores = await prisma.ncmDatabase.groupBy({
      by: ['setor'],
      _count: { ncm: true },
    });

    res.json(
      setores.map((s) => ({
        setor: s.setor || 'Outros',
        quantidade: s._count.ncm,
      }))
    );
  } catch (error: any) {
    console.error('NCM stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ncm/stats/summary - Get full NCM database statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await getNcmStats();
    res.json(stats);
  } catch (error: any) {
    console.error('NCM stats summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
