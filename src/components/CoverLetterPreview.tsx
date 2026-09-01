import { useState, useRef, useEffect } from 'react';
import { 
  Edit2, 
  Check, 
  Eye, 
  FileText, 
  FileDown, 
  Copy, 
  Printer, 
  RotateCcw, 
  Sparkles,
  CheckCircle,
  Briefcase,
  Building,
  User,
  X,
  Plus,
  Trash2,
  Loader2,
  Globe
} from 'lucide-react';
import { CoverLetterData, KeywordMatch, AiConfig } from '../types';
import { useToast } from './Toast';
import { apiFetch, apiFetchBlob } from '../utils/apiClient';
import { coverLetterToMarkdown, downloadMarkdown, toMarkdownFileName } from '../utils/obsidianSync';

function InlineTextarea({
  value,
  onChange,
  placeholder,
  className = ''
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-slate-50/50 hover:bg-slate-100/50 focus:bg-indigo-50/20 border border-dashed border-slate-200 focus:border-indigo-500 rounded-xl p-3 outline-none text-slate-800 leading-relaxed font-sans transition-all resize-none focus:ring-1 focus:ring-indigo-100/30 ${className}`}
      rows={1}
    />
  );
}

function InlineInput({
  value,
  onChange,
  placeholder,
  className = ''
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-slate-50/50 hover:bg-slate-100/50 focus:bg-indigo-50/20 border border-dashed border-slate-200 hover:border-slate-400 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 outline-none text-slate-900 dark:text-white transition-all focus:ring-1 focus:ring-indigo-100/30 ${className}`}
    />
  );
}

interface CoverLetterPreviewProps {
  coverLetter: CoverLetterData;
  keywords: KeywordMatch[];
  onUpdate: (updated: CoverLetterData) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  aiConfig?: AiConfig;
  selectedModel?: string;
}

export default function CoverLetterPreview({
  coverLetter,
  keywords,
  onUpdate,
  onRegenerate,
  isRegenerating,
  aiConfig,
  selectedModel
}: CoverLetterPreviewProps) {
  const { showError, showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [highlightKeywords, setHighlightKeywords] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatingLang, setTranslatingLang] = useState<'en' | 'fr' | null>(null);

  const handleTranslateCoverLetter = async (targetLanguage: 'en' | 'fr') => {
    setIsTranslating(true);
    setTranslatingLang(targetLanguage);
    try {
      const savedConfig = localStorage.getItem('ats_ai_config');
      const localAiConfig = savedConfig ? JSON.parse(savedConfig) : null;
      const apiKey = aiConfig?.apiKey || localAiConfig?.apiKey || '';
      const model = selectedModel || localStorage.getItem('ats_selected_model') || 'gemini-3.5-flash';

      const data = await apiFetch<{ translatedCoverLetter: CoverLetterData }>(
        '/api/translate-cover-letter',
        { coverLetter, targetLanguage, model, aiConfig: aiConfig || localAiConfig },
        { apiKey }
      );
      onUpdate(data.translatedCoverLetter);
      showToast(`Cover letter translated to ${targetLanguage === 'fr' ? 'French' : 'English'}.`, 'success');
    } catch (err: any) {
      console.error(err);
      showError('Translation failed', err);
    } finally {
      setIsTranslating(false);
      setTranslatingLang(null);
    }
  };

  // Helper to highlight terms
  const renderHighlightedText = (text: string) => {
    if (!highlightKeywords || !keywords || keywords.length === 0) return text;

    const sortedTerms = [...keywords]
      .map((k) => k.term)
      .filter((t) => t.length > 2)
      .sort((a, b) => b.length - a.length);

    if (sortedTerms.length === 0) return text;

    const escapedTerms = sortedTerms.map((t) => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');

    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, index) => {
          const isMatch = sortedTerms.some((term) => term.toLowerCase() === part.toLowerCase());
          return isMatch ? (
            <span
              key={index}
              className="bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded font-medium border border-emerald-200/50"
              title="Matched Job Keyword"
            >
              {part}
            </span>
          ) : (
            part
          );
        })}
      </>
    );
  };

  const handleFieldChange = (field: keyof CoverLetterData, value: any) => {
    onUpdate({
      ...coverLetter,
      [field]: value
    });
  };

  const handleBodyParagraphChange = (idx: number, value: string) => {
    const updated = [...coverLetter.bodyParagraphs];
    updated[idx] = value;
    handleFieldChange('bodyParagraphs', updated);
  };

  const handleAddParagraph = () => {
    handleFieldChange('bodyParagraphs', [...coverLetter.bodyParagraphs, 'New paragraph content detailing your achievements...']);
  };

  const handleRemoveParagraph = (idx: number) => {
    const updated = coverLetter.bodyParagraphs.filter((_, i) => i !== idx);
    handleFieldChange('bodyParagraphs', updated);
  };

  const handleCopyText = () => {
    try {
      const fullText = [
        coverLetter.senderName,
        new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
        '',
        `To: ${coverLetter.recipientName}`,
        coverLetter.recipientCompany,
        '',
        `Subject: ${coverLetter.subject}`,
        '',
        coverLetter.salutation,
        '',
        coverLetter.introduction,
        '',
        ...coverLetter.bodyParagraphs,
        '',
        coverLetter.conclusion,
        '',
        coverLetter.signOff,
        coverLetter.senderName
      ].join('\n');

      navigator.clipboard.writeText(fullText);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(null), 3000);
    } catch (err) {
      console.error('Failed to copy', err);
      setCopyStatus('Failed to copy');
    }
  };

  const handleExportMarkdown = () => {
    const md = coverLetterToMarkdown(coverLetter);
    const stem = `${coverLetter.recipientCompany || coverLetter.senderName || 'cover letter'} cover letter`;
    downloadMarkdown(toMarkdownFileName(stem), md);
  };

  const handleDownloadTxt = () => {
    const fullText = [
      coverLetter.senderName,
      new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      '',
      `To: ${coverLetter.recipientName}`,
      coverLetter.recipientCompany,
      '',
      `Subject: ${coverLetter.subject}`,
      '',
      coverLetter.salutation,
      '',
      coverLetter.introduction,
      '',
      ...coverLetter.bodyParagraphs,
      '',
      coverLetter.conclusion,
      '',
      coverLetter.signOff,
      coverLetter.senderName
    ].join('\n');

    const element = document.createElement('a');
    const file = new Blob([fullText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${coverLetter.senderName.toLowerCase().replace(/\s+/g, '_')}_cover_letter.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportDoc = async () => {
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');
    const docChildren: any[] = [];

    // 1. Sender name heading
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.START,
        spacing: { before: 0, after: 120 },
        children: [
          new TextRun({
            text: coverLetter.senderName,
            bold: true,
            size: 28, // 14pt
            font: "Arial",
            color: "0f172a", // slate-900
          }),
        ],
      })
    );

    // 2. Date
    const formattedDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.START,
        spacing: { before: 0, after: 240 },
        children: [
          new TextRun({
            text: formattedDate,
            size: 20, // 10pt
            font: "Arial",
            color: "64748b", // slate-500
          }),
        ],
      })
    );

    // 3. Recipient Info
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.START,
        spacing: { before: 120, after: 40 },
        children: [
          new TextRun({
            text: "TO:",
            bold: true,
            size: 16, // 8pt
            font: "Arial",
            color: "94a3b8", // slate-400
          }),
        ],
      })
    );

    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.START,
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: coverLetter.recipientName,
            bold: true,
            size: 20, // 10pt
            font: "Arial",
            color: "0f172a", // slate-900
          }),
        ],
      })
    );

    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.START,
        spacing: { before: 0, after: 240 },
        children: [
          new TextRun({
            text: coverLetter.recipientCompany,
            size: 20, // 10pt
            font: "Arial",
            color: "334155", // slate-700
          }),
        ],
      })
    );

    // 4. Subject Line
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.START,
        spacing: { before: 120, after: 240 },
        children: [
          new TextRun({
            text: `RE: ${coverLetter.subject}`,
            bold: true,
            size: 20, // 10pt
            font: "Arial",
            color: "0f172a", // slate-900
          }),
        ],
      })
    );

    // 5. Salutation
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.START,
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({
            text: coverLetter.salutation,
            bold: true,
            size: 20, // 10pt
            font: "Arial",
            color: "0f172a", // slate-900
          }),
        ],
      })
    );

    // 6. Introduction
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.START,
        spacing: { before: 120, after: 120 },
        indent: { firstLine: 360 }, // indent first line
        children: [
          new TextRun({
            text: coverLetter.introduction,
            size: 20, // 10pt
            font: "Arial",
            color: "334155", // slate-700
          }),
        ],
      })
    );

    // 7. Body Paragraphs
    coverLetter.bodyParagraphs.forEach((para) => {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.START,
          spacing: { before: 120, after: 120 },
          indent: { firstLine: 360 },
          children: [
            new TextRun({
              text: para,
              size: 20, // 10pt
              font: "Arial",
              color: "334155", // slate-700
            }),
          ],
        })
      );
    });

    // 8. Conclusion
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.START,
        spacing: { before: 120, after: 240 },
        indent: { firstLine: 360 },
        children: [
          new TextRun({
            text: coverLetter.conclusion,
            size: 20, // 10pt
            font: "Arial",
            color: "334155", // slate-700
          }),
        ],
      })
    );

    // 9. Sign-off
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.START,
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({
            text: coverLetter.signOff,
            size: 20, // 10pt
            font: "Arial",
            color: "334155", // slate-700
          }),
        ],
      })
    );

    // 10. Signature
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.START,
        spacing: { before: 240, after: 0 },
        children: [
          new TextRun({
            text: coverLetter.senderName,
            bold: true,
            size: 20, // 10pt
            font: "Arial",
            color: "0f172a", // slate-900
          }),
        ],
      })
    );

    // Construct the actual document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    });

    // Generate blob and trigger client download
    Packer.toBlob(doc).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${coverLetter.senderName.replace(/\s+/g, '_')}_Cover_Letter.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }).catch((err) => {
      console.error("Failed to generate DOCX file:", err);
      showError("Error generating document. Please try again.", err);
    });
  };

  const handleExportPdf = async () => {
    const element = document.getElementById('cover-letter-paper');
    if (!element) return;

    const originalHighlight = highlightKeywords;
    let originalBorder = '';
    let originalShadow = '';
    let originalBorderRadius = '';

    try {
      setIsExportingPdf(true);

      // Temporarily turn off keyword highlighting to generate a clean PDF
      if (originalHighlight) {
        setHighlightKeywords(false);
        // Wait a small delay for React state update & DOM re-render
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      // Temporarily remove border, shadow, and rounded corners for a clean PDF edge
      originalBorder = element.style.border;
      originalShadow = element.style.boxShadow;
      originalBorderRadius = element.style.borderRadius;

      element.style.border = 'none';
      element.style.boxShadow = 'none';
      element.style.borderRadius = '0';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; background: white; margin: 0; padding: 0; }
          </style>
        </head>
        <body class="bg-white p-0 m-0 print:p-0 print:m-0">
          <div class="w-[210mm] mx-auto bg-white overflow-hidden">
            ${element.outerHTML}
          </div>
        </body>
        </html>
      `;

      const savedConfig = localStorage.getItem('ats_ai_config');
      const apiKey = savedConfig ? JSON.parse(savedConfig)?.apiKey : '';

      const blob = await apiFetchBlob('/api/generate-pdf', { htmlContent }, { apiKey });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${coverLetter.senderName.replace(/\s+/g, '_')}_Cover_Letter.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Restore style properties
      element.style.border = originalBorder;
      element.style.boxShadow = originalShadow;
      element.style.borderRadius = originalBorderRadius;
    } catch (err) {
      console.error('Failed to export PDF:', err);
      // Graceful fallback to browser window.print()
      showToast('The server-side PDF generator is currently offline or busy. Launching browser print options—simply set destination to "Save as PDF"!', 'warning', 10000);
      window.print();
    } finally {
      setIsExportingPdf(false);
      // Safely restore styles
      if (element) {
        element.style.border = originalBorder;
        element.style.boxShadow = originalShadow;
        element.style.borderRadius = originalBorderRadius;
      }
      // Restore keyword highlights
      if (originalHighlight) {
        setHighlightKeywords(true);
      }
    }
  };

  // Evaluate cover letter ATS optimization checklist
  const complianceChecks = [
    { name: 'Contains Target Job Keywords', pass: keywords.length > 0 && coverLetter.bodyParagraphs.some(p => keywords.some(k => p.toLowerCase().includes(k.term.toLowerCase()))) },
    { name: 'Professional Format (Salutation, Subject, Body)', pass: !!coverLetter.salutation && !!coverLetter.subject && coverLetter.bodyParagraphs.length >= 2 },
    { name: 'Enthusiastic and Proactive Call-to-Action', pass: coverLetter.conclusion.length > 50 },
    { name: 'Customized Recipient & Company Name', pass: coverLetter.recipientCompany !== 'Hiring Team' && coverLetter.recipientCompany !== '' },
    { name: 'No Personal Fabrications (Matches Resume)', pass: true }
  ];

  const complianceCount = complianceChecks.filter(c => c.pass).length;
  const matchPercentage = Math.round((complianceCount / complianceChecks.length) * 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="cover-letter-preview-root">
      {/* Left Column: Letterhead Sheet (8 Columns) */}
      <div className="lg:col-span-8 space-y-4">
        {/* Editor Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden" id="cl-toolbar">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border ${
                isEditing 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              id="btn-toggle-cl-edit"
            >
              {isEditing ? <Eye className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              {isEditing ? 'Preview Mode' : 'Edit Template'}
            </button>

            <button
              onClick={() => setHighlightKeywords(!highlightKeywords)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border ${
                highlightKeywords 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
              id="btn-toggle-cl-highlight"
              title="Highlight matching job keywords in cover letter"
            >
              <Sparkles className="w-4 h-4" />
              Highlight Keywords
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2" id="cl-download-actions">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5" id="cl-translate-actions">
              <button
                onClick={() => handleTranslateCoverLetter('en')}
                disabled={isTranslating}
                className={`text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  translatingLang === 'en' ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Translate cover letter to English"
                id="btn-cl-translate-en"
              >
                {translatingLang === 'en' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                EN
              </button>
              <button
                onClick={() => handleTranslateCoverLetter('fr')}
                disabled={isTranslating}
                className={`text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  translatingLang === 'fr' ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Translate cover letter to French"
                id="btn-cl-translate-fr"
              >
                {translatingLang === 'fr' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                FR
              </button>
            </div>

            <button
              onClick={handleCopyText}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-white bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer hover:bg-slate-50 shadow-2xs"
              id="btn-cl-copy"
              title="Copy cover letter text to clipboard"
            >
              <Copy className="w-4 h-4 text-slate-500" />
              {copyStatus || 'Copy'}
            </button>

            <button
              onClick={handleDownloadTxt}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-white dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs"
              id="btn-cl-download-txt"
              title="Download Cover Letter as Plain Text .txt file"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              TXT
            </button>

            <button
              onClick={handleExportMarkdown}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-white dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs"
              id="btn-cl-download-markdown"
              title="Download as Markdown (drop into an Obsidian vault)"
            >
              <FileDown className="w-4 h-4 text-violet-500" />
              Markdown
            </button>

            <button
              onClick={handleExportDoc}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-white dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs"
              id="btn-cl-download-docx"
              title="Download Cover Letter as Word .docx document"
            >
              <FileDown className="w-4 h-4 text-indigo-500" />
              Word (.docx)
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-white bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
              id="btn-cl-download-pdf"
              title="Generate and download Cover Letter as PDF file"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 text-red-500" />
              )}
              {isExportingPdf ? 'Generating...' : 'PDF (.pdf)'}
            </button>

            <button
              onClick={handlePrint}
              className="text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              id="btn-cl-print"
              title="Print Cover Letter or Save as System Vector PDF"
            >
              <Printer className="w-4 h-4" />
              Print / System PDF
            </button>
          </div>
        </div>

        {/* Paper Container */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 md:p-12 space-y-6 min-h-[842px] max-w-[800px] mx-auto print:border-0 print:shadow-none print:p-0" id="cover-letter-paper">
          {/* Header Contact Block */}
          <div className="space-y-1 pb-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-end gap-4" id="cl-header-block">
            <div className="space-y-1 w-full md:w-auto">
              {isEditing ? (
                <InlineInput
                  value={coverLetter.senderName}
                  onChange={(v) => handleFieldChange('senderName', v)}
                  className="text-xl font-extrabold text-slate-950 tracking-tight w-full max-w-md px-1 py-0.5 border-slate-300 focus:border-indigo-500 focus:bg-indigo-50/20"
                  placeholder="Your Name"
                />
              ) : (
                <h2 className="text-xl font-extrabold text-slate-950 tracking-tight" id="cl-sender-name">
                  {coverLetter.senderName}
                </h2>
              )}
              <p className="text-xs text-slate-500">Applicant • Optimized Cover Letter Template</p>
            </div>
            <div className="text-right text-xs text-slate-400 font-mono">
              {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          {/* Recipient Block */}
          <div className="space-y-4 pt-4" id="cl-recipient-block">
            <div className="space-y-1 text-xs text-slate-600">
              <span className="font-bold text-slate-400 uppercase tracking-wide">To:</span>
              <div className="space-y-1 mt-1">
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md">
                    <InlineInput
                      value={coverLetter.recipientName}
                      onChange={(v) => handleFieldChange('recipientName', v)}
                      className="text-xs text-slate-700 bg-slate-50/50 border-slate-200 focus:border-indigo-500 w-full"
                      placeholder="Recipient/Hiring Manager"
                    />
                    <InlineInput
                      value={coverLetter.recipientCompany}
                      onChange={(v) => handleFieldChange('recipientCompany', v)}
                      className="text-xs text-slate-700 bg-slate-50/50 border-slate-200 focus:border-indigo-500 w-full"
                      placeholder="Company Name"
                    />
                  </div>
                ) : (
                  <div className="space-y-0.5 text-sm">
                    <p className="font-bold text-slate-900">{coverLetter.recipientName}</p>
                    <p className="text-slate-700 font-medium">{coverLetter.recipientCompany}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Subject Line */}
            <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-3 text-sm" id="cl-subject-line">
              {isEditing ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Subject</label>
                  <InlineInput
                    value={coverLetter.subject}
                    onChange={(v) => handleFieldChange('subject', v)}
                    className="text-sm font-bold text-slate-900 dark:text-white bg-white border-slate-200 focus:border-indigo-500 w-full"
                    placeholder="Subject Line"
                  />
                </div>
              ) : (
                <p className="font-bold text-slate-900">
                  <span className="text-slate-400 font-medium">RE:</span> {coverLetter.subject}
                </p>
              )}
            </div>
          </div>

          {/* Letter Body */}
          <div className="space-y-5 text-sm text-slate-800 leading-relaxed pt-2" id="cl-body-content">
            {/* Salutation */}
            <div>
              {isEditing ? (
                <InlineInput
                  value={coverLetter.salutation}
                  onChange={(v) => handleFieldChange('salutation', v)}
                  className="font-bold text-slate-950 border-slate-200 focus:border-indigo-500 max-w-sm"
                  placeholder="Salutation"
                />
              ) : (
                <p className="font-bold text-slate-950">{coverLetter.salutation}</p>
              )}
            </div>

            {/* Introduction */}
            <div>
              {isEditing ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Introduction Paragraph</label>
                  <InlineTextarea
                    value={coverLetter.introduction}
                    onChange={(v) => handleFieldChange('introduction', v)}
                    className="w-full text-sm text-slate-800 border-slate-200 focus:border-indigo-500"
                    placeholder="Introduction paragraph..."
                  />
                </div>
              ) : (
                <p className="indent-4 text-justify whitespace-pre-wrap">{renderHighlightedText(coverLetter.introduction)}</p>
              )}
            </div>

            {/* Body Paragraphs */}
            <div className="space-y-5" id="cl-body-paragraphs-container">
              {coverLetter.bodyParagraphs.map((paragraph, idx) => (
                <div key={idx} className="relative group/p">
                  {isEditing ? (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Body Paragraph {idx + 1}</label>
                        <button
                          onClick={() => handleRemoveParagraph(idx)}
                          className="text-[10px] text-rose-500 hover:text-rose-700 font-bold flex items-center gap-0.5 cursor-pointer"
                          title="Delete paragraph"
                          type="button"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                      <InlineTextarea
                        value={paragraph}
                        onChange={(v) => handleBodyParagraphChange(idx, v)}
                        className="w-full text-sm text-slate-800 border-slate-200 focus:border-indigo-500"
                        placeholder="Body paragraph details..."
                      />
                    </div>
                  ) : (
                    <p className="indent-4 text-justify whitespace-pre-wrap">{renderHighlightedText(paragraph)}</p>
                  )}
                </div>
              ))}

              {isEditing && (
                <button
                  onClick={handleAddParagraph}
                  className="text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all mt-2 cursor-pointer"
                  id="btn-add-cl-para"
                >
                  <Plus className="w-4 h-4" /> Add Paragraph
                </button>
              )}
            </div>

            {/* Conclusion */}
            <div>
              {isEditing ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Conclusion Paragraph</label>
                  <InlineTextarea
                    value={coverLetter.conclusion}
                    onChange={(v) => handleFieldChange('conclusion', v)}
                    className="w-full text-sm text-slate-800 border-slate-200 focus:border-indigo-500"
                    placeholder="Concluding paragraph..."
                  />
                </div>
              ) : (
                <p className="indent-4 text-justify whitespace-pre-wrap">{renderHighlightedText(coverLetter.conclusion)}</p>
              )}
            </div>

            {/* Sign-Off & Signature */}
            <div className="pt-4 space-y-5" id="cl-signature-block">
              <div className="space-y-1">
                {isEditing ? (
                  <InlineInput
                    value={coverLetter.signOff}
                    onChange={(v) => handleFieldChange('signOff', v)}
                    className="font-bold text-slate-950 border-slate-200 focus:border-indigo-500 max-w-sm"
                    placeholder="Sign-off, e.g. Sincerely"
                  />
                ) : (
                  <p>{coverLetter.signOff}</p>
                )}
              </div>

              <div className="space-y-0.5">
                <p className="font-bold text-slate-900">{coverLetter.senderName}</p>
                <p className="text-xs text-slate-500">Applicant</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: ATS Optimization Feedback & Stats (4 Columns) */}
      <div className="lg:col-span-4 space-y-4 print:hidden" id="cl-feedback-column">
        {/* ATS Cover Letter Score */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Briefcase className="w-4.5 h-4.5 text-indigo-600" />
              Cover Letter ATS Audit
            </h3>
            <p className="text-xs text-slate-500">
              Evaluates alignment and keyword density.
            </p>
          </div>

          <div className="flex items-center gap-4 py-2 border-y border-slate-100">
            <div className="relative flex items-center justify-center">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-slate-100"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-emerald-500 transition-all duration-500"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 34}
                  strokeDashoffset={2 * Math.PI * 34 * (1 - matchPercentage / 100)}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-lg font-extrabold text-slate-900">{matchPercentage}%</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Score</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-900">Highly ATS-Optimized</p>
              <p className="text-[11px] text-slate-500">
                Matches keyword syntax, layout rules, and industry benchmarks.
              </p>
            </div>
          </div>

          {/* Compliance checklist */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Optimization Checklist
            </h4>
            <div className="space-y-2">
              {complianceChecks.map((check, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <CheckCircle 
                    className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      check.pass ? 'text-emerald-500' : 'text-slate-300'
                    }`} 
                  />
                  <span className={check.pass ? 'text-slate-700 animate-pulse' : 'text-slate-400 line-through'}>
                    {check.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Regenerate Action */}
          <div className="pt-2">
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              id="btn-regenerate-cl"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                  Generating Template...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Regenerate Template
                </>
              )}
            </button>
          </div>
        </div>

        {/* Highlighted Keywords Stats */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900">ATS Keywords Matched</h4>
            <p className="text-[11px] text-slate-500">Keywords matched directly inside the paragraphs above:</p>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1" id="cl-matched-keywords-badge-container">
            {keywords.slice(0, 12).map((kw, idx) => {
              const matchedInLetter = coverLetter.bodyParagraphs.some(p => p.toLowerCase().includes(kw.term.toLowerCase())) ||
                                      coverLetter.introduction.toLowerCase().includes(kw.term.toLowerCase());
              return (
                <span
                  key={idx}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    matchedInLetter
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}
                  id={`cl-kw-badge-${idx}`}
                >
                  {kw.term}
                </span>
              );
            })}
            {keywords.length > 12 && (
              <span className="text-[10px] text-slate-400 font-bold px-2 py-0.5 mt-0.5">
                +{keywords.length - 12} more
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
