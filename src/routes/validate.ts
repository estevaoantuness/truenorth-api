import express from 'express';
import { PrismaClient } from '@prisma/client';
import { validateOperation, calculateCosts } from '../services/validationService';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/validate/:operationId - Validate extracted data (requires auth, only own operations)
router.post('/:operationId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { operationId } = req.params;
    const userId = req.user!.userId;

    // Get operation (only if belongs to user)
    const operation = await prisma.operacao.findFirst({
      where: { id: operationId, userId },
    });

    if (!operation) {
      return res.status(404).json({ error: 'Operação não encontrada' });
    }

    if (!operation.dadosExtraidos) {
      return res.status(400).json({ error: 'Operação não possui dados extraídos. Use /api/process primeiro.' });
    }

    // Get NCMs from database for validation
    const ncmCodes = (operation.dadosExtraidos as any).items?.map((item: any) => item.ncm_sugerido) || [];

    const ncmDatabase = await prisma.ncmDatabase.findMany({
      where: {
        ncm: { in: ncmCodes.filter(Boolean) },
      },
    });

    // Get all tipos de erro for cost calculation
    const tiposErro = await prisma.tipoErro.findMany();

    // Get anuentes for reference
    const anuentes = await prisma.anuente.findMany();

    // Validate the operation
    const validationResult = await validateOperation(
      operation.dadosExtraidos as any,
      ncmDatabase,
      tiposErro,
      anuentes
    );

    // Calculate total costs
    const totalCosts = calculateCosts(validationResult.erros, tiposErro, operation.dadosExtraidos as any);

    // Update operation with validation results
    const updatedOperation = await prisma.operacao.update({
      where: { id: operationId },
      data: {
        dadosValidados: validationResult.dadosValidados,
        erros: JSON.parse(JSON.stringify(validationResult.erros)),
        status: validationResult.erros.length > 0 ? 'COM_ERROS' : 'VALIDADO',
        custoTotalErros: totalCosts.custoTotal,
        tempoEconomizadoMin: Math.floor(Math.random() * 10) + 15, // 15-25 min saved (simulated)
      },
    });

    res.json({
      success: true,
      operationId,
      status: updatedOperation.status,
      validacoes: validationResult.validacoes,
      erros: validationResult.erros,
      custos: totalCosts,
      anuentes_necessarios: validationResult.anuentesNecessarios,
      risco_geral: validationResult.riscoGeral,
      tempo_economizado_min: updatedOperation.tempoEconomizadoMin,
    });
  } catch (error: any) {
    console.error('Validation error:', error);
    res.status(500).json({ error: error.message || 'Erro ao validar operação' });
  }
});

// GET /api/validate/tipos-erro - List all error types with costs
router.get('/tipos-erro', async (req, res) => {
  try {
    const tiposErro = await prisma.tipoErro.findMany({
      orderBy: { categoria: 'asc' },
    });
    res.json(tiposErro);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/validate/anuentes - List all regulatory agencies
router.get('/anuentes', async (req, res) => {
  try {
    const anuentes = await prisma.anuente.findMany({
      orderBy: { sigla: 'asc' },
    });
    res.json(anuentes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
