import pdf from 'pdf-parse';
import fs from 'fs';

export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);

    // Return extracted text
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Erro ao extrair texto do PDF');
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
