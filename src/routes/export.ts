import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import {
  generateDuimpXml,
  transformToExportData,
  validateExportData,
} from '../services/siscomexExporter';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/export/:operationId/xml
 * Exports operation data as Siscomex-compatible XML
 * Requires authentication, only allows export of own operations
 */
router.get('/:operationId/xml', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { operationId } = req.params;
    const userId = req.user!.userId;

    // Get operation (only if belongs to user)
    const operation = await prisma.operacao.findFirst({
      where: { id: operationId, userId },
    });

    if (!operation) {
      return res.status(404).json({
        error: 'Operação não encontrada',
        message: 'Verifique se o ID da operação está correto',
      });
    }

    if (!operation.dadosExtraidos) {
      return res.status(400).json({
        error: 'Dados não disponíveis',
        message: 'Esta operação não possui dados extraídos para exportar',
      });
    }

    // Transform extracted data to export format
    const exportData = transformToExportData(operation.dadosExtraidos);

    // Validate data before exporting
    const validationErrors = validateExportData(exportData);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Dados incompletos para exportação',
        message: 'Corrija os seguintes campos antes de exportar:',
        validationErrors,
      });
    }

    // Generate XML
    const xml = generateDuimpXml(exportData);

    // Generate filename based on invoice number
    const invoiceNumber = exportData.numeroReferencia.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `duimp_${invoiceNumber}_${new Date().toISOString().split('T')[0]}.xml`;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(xml, 'utf8'));

    // Send XML
    res.send(xml);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Erro ao exportar',
      message: error.message || 'Não foi possível gerar o arquivo XML',
    });
  }
});

/**
 * GET /api/export/:operationId/preview
 * Returns export data as JSON for preview/validation
 * Requires authentication, only allows preview of own operations
 */
router.get('/:operationId/preview', requireAuth, async (req: AuthRequest, res) => {
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
      return res.status(400).json({ error: 'Dados não disponíveis' });
    }

    // Transform and validate
    const exportData = transformToExportData(operation.dadosExtraidos);
    const validationErrors = validateExportData(exportData);

    res.json({
      exportData,
      validationErrors,
      isValid: validationErrors.length === 0,
    });
  } catch (error: any) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message || 'Erro ao gerar preview' });
  }
});

export default router;
