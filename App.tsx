import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FileText, Trash2, Search, BookOpen, Clock, Tag, X, Save, Menu, Download } from 'lucide-react';
import { getAllPapers, savePaper, deletePaper, updatePaperNote } from './services/db';
import { analyzePdf } from './services/pdfProcessor';
import { Paper } from './types';

// Helper to format date
const formatDate = (ts: number) => new Date(ts).toLocaleDateString();

export default function App() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load papers on mount
  useEffect(() => {
    loadPapers();
  }, []);

  const loadPapers = async () => {
    try {
      const all = await getAllPapers();
      // Sort by newest first
      setPapers(all.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error("Failed to load papers", err);
      setError("Failed to load library.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    setLoading(true);
    setError(null);
    const files = Array.from(e.target.files) as File[];

    try {
      for (const file of files) {
        if (file.type !== 'application/pdf') continue;

        const metadata = await analyzePdf(file);
        const buffer = await file.arrayBuffer();
        
        const newPaper: Paper = {
          id: crypto.randomUUID(),
          fileName: file.name,
          title: metadata.title || file.name.replace('.pdf', ''),
          authors: '', // Hard to extract reliably without complex ML
          doi: metadata.doi,
          abstract: metadata.abstract,
          keywords: metadata.keywords,
          fileData: buffer,
          notes: '',
          createdAt: Date.now(),
        };

        await savePaper(newPaper);
      }
      await loadPapers();
    } catch (err) {
      console.error(err);
      setError("Error processing files. Please try again.");
    } finally {
      setLoading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this paper?")) return;
    
    await deletePaper(id);
    if (selectedPaperId === id) setSelectedPaperId(null);
    await loadPapers();
  };

  const selectedPaper = papers.find(p => p.id === selectedPaperId);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col relative`}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2 text-indigo-700 overflow-hidden whitespace-nowrap">
            <BookOpen className="w-6 h-6 flex-shrink-0" />
            LocalScholar
          </h1>
        </div>

        <div className="p-4">
          <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-indigo-200 rounded-lg bg-indigo-50 text-indigo-600 cursor-pointer hover:bg-indigo-100 transition-colors">
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-5 h-5" />
              <span className="text-sm font-medium whitespace-nowrap">Upload PDF(s)</span>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf" 
              multiple 
              onChange={handleFileUpload}
              disabled={loading}
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {papers.length === 0 ? (
            <div className="text-center text-gray-400 mt-10 p-4">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No papers yet.</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {papers.map(paper => (
                <div 
                  key={paper.id}
                  onClick={() => setSelectedPaperId(paper.id)}
                  className={`p-3 rounded-lg cursor-pointer group transition-all border ${
                    selectedPaperId === paper.id 
                      ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                      : 'bg-white border-transparent hover:bg-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-sm line-clamp-2 leading-tight text-gray-800">
                      {paper.title}
                    </h3>
                    <button 
                      onClick={(e) => handleDelete(e, paper.id)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="Delete paper"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(paper.createdAt)}</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {paper.keywords.slice(0, 3).map(k => (
                      <span key={k} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] truncate max-w-[80px]">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-10 p-2 bg-white rounded-full shadow-md text-gray-600 hover:text-indigo-600 md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {loading && (
          <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-indigo-900 font-medium">Processing Paper...</p>
            </div>
          </div>
        )}

        {!selectedPaper ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <BookOpen className="w-12 h-12 text-gray-300" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-600 mb-2">Welcome to LocalScholar</h2>
            <p className="max-w-md text-center text-gray-500">
              Select a paper from the sidebar or upload a new PDF to get started. 
              All data is stored locally in your browser.
            </p>
          </div>
        ) : (
          <PaperView paper={selectedPaper} />
        )}
      </div>
    </div>
  );
}

// Sub-component for the paper view - NOTES ONLY version
function PaperView({ paper }: { paper: Paper }) {
  const [note, setNote] = useState(paper.notes);
  const [isSaving, setIsSaving] = useState(false);

  // Sync note state when paper changes
  useEffect(() => {
    setNote(paper.notes);
  }, [paper.id]);

  // Debounced save
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (note !== paper.notes) {
        setIsSaving(true);
        await updatePaperNote(paper.id, note);
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [note, paper.id, paper.notes]);

  const downloadPdf = () => {
    const blob = new Blob([paper.fileData], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = paper.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-start gap-4 mb-2">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{paper.title}</h1>
            <button 
              onClick={downloadPdf}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors shrink-0 shadow-sm"
              title="Download original PDF"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
            {paper.doi && (
              <a 
                href={`https://doi.org/${paper.doi}`} 
                target="_blank" 
                rel="noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded"
              >
                DOI: {paper.doi}
              </a>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Added: {formatDate(paper.createdAt)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {paper.keywords.map((keyword, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-700 font-medium border border-gray-200">
                <Tag className="w-3 h-3 text-gray-400" />
                {keyword}
              </span>
            ))}
          </div>

          {paper.abstract && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm text-gray-700 leading-relaxed">
              <span className="font-semibold text-gray-900 block mb-1">Abstract</span>
              {paper.abstract}...
            </div>
          )}
        </div>
      </div>

      {/* Content Area - Notes Only */}
      <div className="flex-1 overflow-hidden p-4 md:p-8">
        <div className="max-w-4xl mx-auto h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="font-semibold text-gray-700 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Research Notes
            </span>
            {isSaving ? (
              <span className="text-xs text-indigo-600 animate-pulse font-medium">Saving...</span>
            ) : (
              <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                <Save className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
          <textarea
            className="flex-1 p-6 resize-none outline-none text-gray-800 leading-7 text-base focus:bg-yellow-50/10 transition-colors"
            placeholder="Write your research notes, thoughts, and summaries here..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
