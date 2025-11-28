import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/operations - List all operations
router.get('/', async (req, res) => {
  try {
    const { limit = 10, offset = 0, status } = req.query;

    const where = status ? { status: status as string } : {};

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

// GET /api/operations/:id - Get operation details
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
    console.error('Get operation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/operations/:id - Delete operation
router.delete('/:id', async (req, res) => {
  try {
    await prisma.operacao.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true, message: 'Operação excluída com sucesso' });
  } catch (error: any) {
    console.error('Delete operation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/operations/stats/summary - Get operations statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const totalOperations = await prisma.operacao.count();

    const operationsWithErrors = await prisma.operacao.count({
      where: { status: 'COM_ERROS' },
    });

    const operationsValidated = await prisma.operacao.count({
      where: { status: 'VALIDADO' },
    });

    const totalCostsAvoided = await prisma.operacao.aggregate({
      _sum: { custoTotalErros: true },
    });

    const totalTimeSaved = await prisma.operacao.aggregate({
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

export default router;
