import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/operations - List user's operations (requires auth)
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { limit = 10, offset = 0, status } = req.query;
    const userId = req.user!.userId;

    const where: any = { userId };
    if (status) {
      where.status = status as string;
    }

    const operations = await prisma.operacao.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      select: {
        id: true,
        arquivoNome: true,
        arquivoTipo: true,
        status: true,
        custoTotalErros: true,
        tempoEconomizadoMin: true,
        createdAt: true,
      },
    });

    const total = await prisma.operacao.count({ where });

    res.json({
      operations,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    console.error('List operations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/operations/stats/summary - Get user's operations statistics (requires auth)
router.get('/stats/summary', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const totalOperations = await prisma.operacao.count({ where: { userId } });

    const operationsWithErrors = await prisma.operacao.count({
      where: { userId, status: 'COM_ERROS' },
    });

    const operationsValidated = await prisma.operacao.count({
      where: { userId, status: 'VALIDADO' },
    });

    const totalCostsAvoided = await prisma.operacao.aggregate({
      where: { userId },
      _sum: { custoTotalErros: true },
    });

    const totalTimeSaved = await prisma.operacao.aggregate({
      where: { userId },
      _sum: { tempoEconomizadoMin: true },
    });

    res.json({
      totalOperations,
      operationsWithErrors,
      operationsValidated,
      totalCostsAvoided: totalCostsAvoided._sum.custoTotalErros || 0,
      totalTimeSavedMin: totalTimeSaved._sum.tempoEconomizadoMin || 0,
      averageTimeSavedMin: totalOperations > 0
        ? Math.round((totalTimeSaved._sum.tempoEconomizadoMin || 0) / totalOperations)
        : 0,
    });
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/operations/:id - Get operation details (requires auth, only own operations)
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const operation = await prisma.operacao.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!operation) {
      return res.status(404).json({ error: 'Operação não encontrada' });
    }

    res.json(operation);
  } catch (error: any) {
    console.error('Get operation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/operations/:id - Delete operation (requires auth, only own operations)
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // First check if operation belongs to user
    const operation = await prisma.operacao.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!operation) {
      return res.status(404).json({ error: 'Operação não encontrada' });
    }

    await prisma.operacao.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true, message: 'Operação excluída com sucesso' });
  } catch (error: any) {
    console.error('Delete operation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
