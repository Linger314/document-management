import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Paper } from '../types';

interface PaperLibDB extends DBSchema {
  papers: {
    key: string;
    value: Paper;
    indexes: { 'by-date': number };
  };
}

const DB_NAME = 'LocalScholarDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PaperLibDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<PaperLibDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('papers', { keyPath: 'id' });
        store.createIndex('by-date', 'createdAt');
      },
    });
  }
  return dbPromise;
};

export const savePaper = async (paper: Paper): Promise<string> => {
  const db = await getDB();
  await db.put('papers', paper);
  return paper.id;
};

export const getAllPapers = async (): Promise<Paper[]> => {
  const db = await getDB();
  return db.getAllFromIndex('papers', 'by-date');
};

export const getPaperById = async (id: string): Promise<Paper | undefined> => {
  const db = await getDB();
  return db.get('papers', id);
};

export const updatePaperNote = async (id: string, note: string): Promise<void> => {
  const db = await getDB();
  const paper = await db.get('papers', id);
  if (paper) {
    paper.notes = note;
    await db.put('papers', paper);
  }
};

export const deletePaper = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.delete('papers', id);
};
