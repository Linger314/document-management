import * as pdfjsLib from 'pdfjs-dist';
import { PaperMetadata } from '../types';

// IMPORTANT: Set worker source to CDN to avoid complex build setups for this demo
// We must point to the ESM version (.mjs) of the worker for pdfjs-dist v5+ to work with dynamic imports
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'at', 'by', 'from', 'for', 'in', 'of', 'on', 'to', 'with', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should',
  'this', 'that', 'these', 'those', 'it', 'its', 'we', 'us', 'our',
  'they', 'them', 'their', 'which', 'who', 'whom', 'whose', 'where',
  'why', 'how', 'abstract', 'introduction', 'conclusion', 'results',
  'discussion', 'method', 'methods', 'data', 'analysis', 'figure', 'table',
  'references', 'doi', 'university', 'department', 'paper', 'research', 
  'journal', 'vol', 'no', 'pp', 'page', 'science', 'international', 
  'proceedings', 'conference', 'copyright', 'rights', 'reserved'
]);

/**
 * Extracts raw text from the first few pages of a PDF
 */
const getPdfText = async (data: ArrayBuffer): Promise<{ fullText: string; firstPageText: string, firstPageItems: any[] }> => {
  // Add cMapUrl to ensure text is extracted correctly even if fonts are missing in client
  const loadingTask = pdfjsLib.getDocument({ 
    data,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });
  
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  let firstPageText = '';
  let firstPageItems: any[] = [];

  const maxPages = Math.min(pdf.numPages, 5); // Analyze first 5 pages for metadata

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    if (i === 1) {
      firstPageItems = textContent.items;
    }

    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    if (i === 1) firstPageText = pageText;
    fullText += pageText + ' ';
  }

  return { fullText, firstPageText, firstPageItems };
};

/**
 * Heuristic algorithms to extract metadata
 */
export const analyzePdf = async (file: File): Promise<PaperMetadata> => {
  const arrayBuffer = await file.arrayBuffer();
  const { fullText, firstPageText, firstPageItems } = await getPdfText(arrayBuffer);

  // 1. Extract Title
  // Strategy: Find the text item with the largest font size (transform[0]) on the first page
  let title = '';
  let maxFontSize = 0;
  
  // Sort items by vertical position (top to bottom) to handle multi-line titles correctly
  // PDF coordinates: (0,0) is bottom-left usually. 'transform[5]' is Y.
  const sortedItems = [...firstPageItems].sort((a, b) => b.transform[5] - a.transform[5]);

  for (const item of sortedItems) {
    const fontSize = item.transform[0]; // Scale X usually indicates font size
    const text = item.str.trim();
    
    if (text.length > 0) {
      if (fontSize > maxFontSize) {
        maxFontSize = fontSize;
        title = text;
      } else if (Math.abs(fontSize - maxFontSize) < 1 && maxFontSize > 0) {
        // Same font size, likely continuation of title
        title += ' ' + text;
      }
    }
  }
  
  // Fallback if title is too short or empty
  if (title.length < 5) {
     // Take the first non-empty line
     title = firstPageText.split('\n').find(line => line.trim().length > 10) || '';
  }

  // 2. Extract DOI
  const doiRegex = /10.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
  const doiMatch = fullText.match(doiRegex);
  const doi = doiMatch ? doiMatch[0] : '';

  // 3. Extract Abstract
  let abstract = '';
  const abstractRegex = /(?:abstract|introduction)/i;
  const abstractMatch = fullText.match(abstractRegex);
  
  if (abstractMatch && abstractMatch.index !== undefined) {
    // Take the next 500 characters after the keyword
    const start = abstractMatch.index + abstractMatch[0].length;
    // Cleanup: remove non-alphanumeric at start
    let rawAbstract = fullText.substring(start, start + 600);
    rawAbstract = rawAbstract.replace(/^[^a-zA-Z]+/, '');
    abstract = rawAbstract.trim();
  }

  // 4. Extract Keywords (Frequency Analysis)
  const words = fullText.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(w => w.length > 3) // Only words > 3 chars
    .filter(w => !STOP_WORDS.has(w));

  const freqMap: Record<string, number> = {};
  words.forEach(w => {
    freqMap[w] = (freqMap[w] || 0) + 1;
  });

  const sortedKeywords = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1]) // Sort by count desc
    .slice(0, 6) // Top 6
    .map(([word]) => word);

  return {
    title: title.trim(),
    doi,
    abstract,
    keywords: sortedKeywords,
    textSample: fullText.substring(0, 200)
  };
};