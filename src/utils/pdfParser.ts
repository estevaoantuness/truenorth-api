import pdf from 'pdf-parse';
import fs from 'fs';
import path from 'path';

export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      console.error('PDF file not found at:', filePath);
      throw new Error(`Arquivo PDF não encontrado: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);

    // Verificar se o buffer tem conteúdo
    if (dataBuffer.length === 0) {
      throw new Error('Arquivo PDF está vazio');
    }

    console.log(`Processing PDF: ${filePath}, size: ${dataBuffer.length} bytes`);

    const data = await pdf(dataBuffer);

    // Return extracted text
    if (!data.text || data.text.trim().length === 0) {
      console.warn('PDF text extraction returned empty - PDF may be image-based');
      return '[PDF sem texto extraível - possivelmente baseado em imagem]';
    }

    return data.text;
  } catch (error: any) {
    console.error('PDF parsing error:', error);
    console.error('File path attempted:', filePath);

    // Verificar se é erro de arquivo não encontrado
    if (error.code === 'ENOENT') {
      throw new Error(`Arquivo PDF não encontrado no caminho: ${filePath}`);
    }

    // Verificar se é erro de PDF inválido
    if (error.message && error.message.includes('Invalid')) {
      throw new Error('O arquivo PDF parece estar corrompido ou em formato inválido');
    }

    throw new Error(`Erro ao extrair texto do PDF: ${error.message || 'erro desconhecido'}`);
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
