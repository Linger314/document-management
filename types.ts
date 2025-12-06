export interface Paper {
  id: string;
  fileName: string;
  title: string;
  authors?: string;
  doi?: string;
  abstract?: string;
  keywords: string[];
  fileData: ArrayBuffer;
  notes: string;
  createdAt: number;
}

export interface PaperMetadata {
  title: string;
  doi: string;
  abstract: string;
  keywords: string[];
  textSample: string; // Used for search if needed later
}
