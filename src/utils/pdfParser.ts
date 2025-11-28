import pdf from 'pdf-parse';
import fs from 'fs';

/**
 * Extrai texto de um PDF a partir de um Buffer (processamento em memória)
 */
export async function extractTextFromPDFBuffer(buffer: Buffer): Promise<string> {
  try {
    // Verificar se o buffer tem conteúdo
    if (!buffer || buffer.length === 0) {
      throw new Error('Buffer do PDF está vazio');
    }

    console.log(`Processing PDF from buffer, size: ${buffer.length} bytes`);

    const data = await pdf(buffer);

    // Return extracted text
    if (!data.text || data.text.trim().length === 0) {
      console.warn('PDF text extraction returned empty - PDF may be image-based');
      return '[PDF sem texto extraível - possivelmente baseado em imagem]';
    }

    console.log(`PDF processed successfully, extracted ${data.text.length} characters`);
    return data.text;
  } catch (error: any) {
    console.error('PDF parsing error:', error);

    // Verificar se é erro de PDF inválido
    if (error.message && error.message.includes('Invalid')) {
      throw new Error('O arquivo PDF parece estar corrompido ou em formato inválido');
    }

    throw new Error(`Erro ao extrair texto do PDF: ${error.message || 'erro desconhecido'}`);
  }
}

/**
 * Extrai texto de um PDF a partir de um caminho de arquivo (legado)
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo PDF não encontrado: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    return extractTextFromPDFBuffer(buffer);
  } catch (error: any) {
    console.error('PDF file parsing error:', error);
    throw error;
  }
}

export function getPDFInfo(filePath: string): Promise<{
  numpages: number;
  info: any;
}> {
  return new Promise(async (resolve, reject) => {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);

      resolve({
        numpages: data.numpages,
        info: data.info,
      });
    } catch (error) {
      reject(error);
    }
  });
}
