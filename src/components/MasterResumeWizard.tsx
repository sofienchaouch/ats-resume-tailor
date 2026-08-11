import { useState, FormEvent, DragEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Trash2,
  Plus,
  Sparkles,
  X,
  Briefcase,
  GraduationCap,
  Wrench,
  Globe,
  Loader2,
  History,
  RotateCcw,
  Save
} from 'lucide-react';
import { ResumeData, AiConfig } from '../types';
import { useToast } from './Toast';
import { apiFetch } from '../utils/apiClient';

interface ResumeVersion {
  id: string;
  name: string;
  timestamp: string;
  data: ResumeData;
}

interface MasterResumeWizardProps {
  masterResume: ResumeData;
  onUpdateMaster: (data: ResumeData) => void;
  isParsing: boolean;
  onImportFile: (e: any) => void;
  onImportJSON: (e: any) => void;
  onImportDroppedFile?: (file: File) => void;
  onExportJSON: () => void;
  onLoadSample: (preset: string) => void;
  importStatus: { type: 'success' | 'error'; message: string } | null;
  onCloseImportStatus: () => void;
  aiConfig?: AiConfig;
  selectedModel?: string;
}

export default function MasterResumeWizard({
  masterResume,
  onUpdateMaster,
  isParsing,
  onImportFile,
  onImportJSON,
  onImportDroppedFile,
  onExportJSON,
  onLoadSample,
  importStatus,
  onCloseImportStatus,
  aiConfig,
  selectedModel
}: MasterResumeWizardProps) {
  const { showError, showSuccess, showToast } = useToast();
  const [activeFormTab, setActiveFormTab] = useState<'contact' | 'summary' | 'experience' | 'skills' | 'education' | 'projects' | 'certifications' | 'languages'>('contact');

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && onImportDroppedFile) {
      onImportDroppedFile(file);
    }
  };

  // Resume Version History state
  const [versions, setVersions] = useState<ResumeVersion[]>(() => {
    const saved = localStorage.getItem('ats_resume_versions');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [tempVersionName, setTempVersionName] = useState('');
  const [versionAlert, setVersionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSaveVersion = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const name = tempVersionName.trim() || `Snapshot #${versions.length + 1} (${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    const newVersion: ResumeVersion = {
      id: 'ver_' + Math.random().toString(36).substr(2, 9),
      name,
      timestamp: new Date().toLocaleString(),
      data: JSON.parse(JSON.stringify(masterResume)),
    };
    const updated = [newVersion, ...versions];
    setVersions(updated);
    localStorage.setItem('ats_resume_versions', JSON.stringify(updated));
    setTempVersionName('');
    setIsSavingVersion(false);
    
    setVersionAlert({
      type: 'success',
      message: `Snapshot "${name}" saved successfully!`
    });
    setTimeout(() => {
      setVersionAlert(null);
    }, 4000);
  };

  const handleRevertToVersion = (version: ResumeVersion) => {
    if (confirm(`Are you sure you want to revert your current resume to "${version.name}"? Your current unsaved edits will be overwritten.`)) {
      // Create an automatic safety backup of current state first
      const backupName = `Auto-Backup before restoring "${version.name.substring(0, 15)}" (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      const safetyBackup: ResumeVersion = {
        id: 'ver_' + Math.random().toString(36).substr(2, 9),
        name: backupName,
        timestamp: new Date().toLocaleString(),
        data: JSON.parse(JSON.stringify(masterResume)),
      };
      
      onUpdateMaster(version.data);
      
      const updated = [safetyBackup, ...versions];
      setVersions(updated);
      localStorage.setItem('ats_resume_versions', JSON.stringify(updated));

      setVersionAlert({
        type: 'success',
        message: `Restored: "${version.name}". Created auto safety backup: "${backupName}".`
      });
      setTimeout(() => {
        setVersionAlert(null);
      }, 5000);
    }
  };

  const handleDeleteVersion = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the snapshot "${name}"?`)) {
      const updated = versions.filter((v) => v.id !== id);
      setVersions(updated);
      localStorage.setItem('ats_resume_versions', JSON.stringify(updated));
      setVersionAlert({
        type: 'success',
        message: `Deleted snapshot "${name}".`
      });
      setTimeout(() => {
        setVersionAlert(null);
      }, 3000);
    }
  };

  // Interactive local bullet-point improvement state
  const [improvingBulletIdx, setImprovingBulletIdx] = useState<{ expIdx: number; bulletIdx: number } | null>(null);
  const [bulletSuggestions, setBulletSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const [resumeScore, setResumeScore] = useState<number | null>(null);
  const [resumeSuggestions, setResumeSuggestions] = useState<string[]>([]);
  const [isScoring, setIsScoring] = useState(false);

  const handleScoreResume = async () => {
    setIsScoring(true);
    setResumeSuggestions([]);
    try {
      const data = await apiFetch(
        '/api/score-resume',
        { masterResume, model: selectedModel, aiConfig },
        { apiKey: aiConfig?.apiKey }
      );
      setResumeScore(data.score);
      setResumeSuggestions(data.suggestions);
    } catch (err: any) {
      console.error(err);
      showError('Scoring failed', err);
    } finally {
      setIsScoring(false);
    }
  };

  const [isTranslating, setIsTranslating] = useState(false);
  const [translatingLang, setTranslatingLang] = useState<'en' | 'fr' | null>(null);
  
  const handleTranslateResume = async (targetLanguage: 'en' | 'fr') => {
    // Save backup before translate
    const backupName = `Auto-Backup before translation (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    const safetyBackup: ResumeVersion = {
      id: 'ver_' + Math.random().toString(36).substr(2, 9),
      name: backupName,
      timestamp: new Date().toLocaleString(),
      data: JSON.parse(JSON.stringify(masterResume)),
    };
    const updated = [safetyBackup, ...versions];
    setVersions(updated);
    localStorage.setItem('ats_resume_versions', JSON.stringify(updated));

    setIsTranslating(true);
    setTranslatingLang(targetLanguage);
    try {
      const data = await apiFetch(
        '/api/translate-resume',
        { masterResume, targetLanguage, model: selectedModel, aiConfig },
        { apiKey: aiConfig?.apiKey }
      );
      onUpdateMaster(data.translatedResume);
      setVersionAlert({
        type: 'success',
        message: `Resume translated successfully. Created auto safety backup: "${backupName}".`
      });
      setTimeout(() => setVersionAlert(null), 6000);
    } catch (err: any) {
      console.error(err);
      setVersionAlert({
        type: 'error',
        message: `Translation failed: ${err.message}`
      });
      setTimeout(() => setVersionAlert(null), 6000);
    } finally {
      setIsTranslating(false);
      setTranslatingLang(null);
    }
  };

  // Field change handlers
  const handleContactChange = (field: keyof typeof masterResume.contact, value: string) => {
    onUpdateMaster({
      ...masterResume,
      contact: { ...masterResume.contact, [field]: value }
    });
  };

  const handleAddExperience = () => {
    const newExp = {
      company: '',
      role: '',
      location: '',
      startDate: '',
      endDate: '',
      bullets: ['']
    };
    onUpdateMaster({
      ...masterResume,
      experience: [...masterResume.experience, newExp]
    });
  };

  const handleRemoveExperience = (idx: number) => {
    onUpdateMaster({
      ...masterResume,
      experience: masterResume.experience.filter((_, i) => i !== idx)
    });
  };

  const handleExperienceChange = (expIdx: number, field: string, value: any) => {
    const updated = [...masterResume.experience];
    updated[expIdx] = { ...updated[expIdx], [field]: value };
    onUpdateMaster({ ...masterResume, experience: updated });
  };

  const handleExperienceBulletChange = (expIdx: number, bulletIdx: number, value: string) => {
    const updated = [...masterResume.experience];
    const bullets = [...updated[expIdx].bullets];
    bullets[bulletIdx] = value;
    updated[expIdx] = { ...updated[expIdx], bullets };
    onUpdateMaster({ ...masterResume, experience: updated });
  };

  const handleAddBullet = (expIdx: number) => {
    const updated = [...masterResume.experience];
    updated[expIdx] = { ...updated[expIdx], bullets: [...updated[expIdx].bullets, ''] };
    onUpdateMaster({ ...masterResume, experience: updated });
  };

  const handleRemoveBullet = (expIdx: number, bulletIdx: number) => {
    const updated = [...masterResume.experience];
    const bullets = updated[expIdx].bullets.filter((_, i) => i !== bulletIdx);
    updated[expIdx] = { ...updated[expIdx], bullets };
    onUpdateMaster({ ...masterResume, experience: updated });
  };

  const handleAddSkillCategory = () => {
    onUpdateMaster({
      ...masterResume,
      skills: [...masterResume.skills, { category: '', items: [''] }]
    });
  };

  const handleRemoveSkillCategory = (idx: number) => {
    onUpdateMaster({
      ...masterResume,
      skills: masterResume.skills.filter((_, i) => i !== idx)
    });
  };

  const handleSkillCategoryChange = (idx: number, field: 'category' | 'items', value: any) => {
    const updated = [...masterResume.skills];
    if (field === 'category') {
      updated[idx] = { ...updated[idx], category: value };
    } else {
      updated[idx] = { ...updated[idx], items: value };
    }
    onUpdateMaster({ ...masterResume, skills: updated });
  };

  const handleAddEducation = () => {
    onUpdateMaster({
      ...masterResume,
      education: [...masterResume.education, { institution: '', degree: '', location: '', graduationDate: '' }]
    });
  };

  const handleRemoveEducation = (idx: number) => {
    onUpdateMaster({
      ...masterResume,
      education: masterResume.education.filter((_, i) => i !== idx)
    });
  };

  const handleEducationChange = (idx: number, field: string, value: string) => {
    const updated = [...masterResume.education];
    updated[idx] = { ...updated[idx], [field]: value };
    onUpdateMaster({ ...masterResume, education: updated });
  };

  const handleAddProject = () => {
    const projects = masterResume.projects || [];
    onUpdateMaster({
      ...masterResume,
      projects: [...projects, { name: '', description: '', technologies: [''], link: '' }]
    });
  };

  const handleRemoveProject = (idx: number) => {
    const projects = masterResume.projects || [];
    onUpdateMaster({
      ...masterResume,
      projects: projects.filter((_, i) => i !== idx)
    });
  };

  const handleProjectChange = (idx: number, field: string, value: any) => {
    const projects = masterResume.projects || [];
    const updated = [...projects];
    updated[idx] = { ...updated[idx], [field]: value };
    onUpdateMaster({ ...masterResume, projects: updated });
  };

  const handleAddCertification = () => {
    const certifications = masterResume.certifications || [];
    onUpdateMaster({
      ...masterResume,
      certifications: [...certifications, { name: '', issuer: '', date: '' }]
    });
  };

  const handleRemoveCertification = (idx: number) => {
    const certifications = masterResume.certifications || [];
    onUpdateMaster({
      ...masterResume,
      certifications: certifications.filter((_, i) => i !== idx)
    });
  };

  const handleCertificationChange = (idx: number, field: string, value: string) => {
    const certifications = masterResume.certifications || [];
    const updated = [...certifications];
    updated[idx] = { ...updated[idx], [field]: value };
    onUpdateMaster({ ...masterResume, certifications: updated });
  };

  const handleAddLanguage = () => {
    const languages = masterResume.languages || [];
    onUpdateMaster({
      ...masterResume,
      languages: [...languages, '']
    });
  };

  const handleRemoveLanguage = (idx: number) => {
    const languages = masterResume.languages || [];
    onUpdateMaster({
      ...masterResume,
      languages: languages.filter((_, i) => i !== idx)
    });
  };

  const handleLanguageChange = (idx: number, value: string) => {
    const languages = masterResume.languages || [];
    const updated = [...languages];
    updated[idx] = value;
    onUpdateMaster({ ...masterResume, languages: updated });
  };

  // AI achievement bullet rewriting suggestion via Gemini proxy
  const handleTriggerImproveBullet = async (expIdx: number, bulletIdx: number, text: string) => {
    if (!text.trim()) return;
    setImprovingBulletIdx({ expIdx, bulletIdx });
    setBulletSuggestions([]);
    setLoadingSuggestions(true);
    setSuggestionsError(null);

    try {
      const savedConfig = localStorage.getItem('ats_ai_config');
      const localAiConfig = savedConfig ? JSON.parse(savedConfig) : null;
      const apiKey = aiConfig?.apiKey || localAiConfig?.apiKey || '';
      const finalModel = selectedModel || localStorage.getItem('ats_selected_model') || 'gemini-3.5-flash';

      const data = await apiFetch(
        '/api/improve-bullet',
        { bulletText: text, model: finalModel, aiConfig: aiConfig || localAiConfig },
        { apiKey }
      );
      if (data.suggestions && data.suggestions.length > 0) {
        setBulletSuggestions(data.suggestions);
      } else {
        throw new Error('No suggestions returned');
      }
    } catch (err: any) {
      console.error(err);
      setSuggestionsError(err.message || 'Failed to retrieve AI suggestions. Make sure your Gemini API key is configured.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleApplySuggestedBullet = (expIdx: number, bulletIdx: number, replacement: string) => {
    handleExperienceBulletChange(expIdx, bulletIdx, replacement);
    setImprovingBulletIdx(null);
    setBulletSuggestions([]);
  };

  return (
    <div 
      className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm" 
      id="master-resume-panel"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Dropzone drag indicator overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-indigo-600/10 dark:bg-indigo-600/20 backdrop-blur-xs border-3 border-dashed border-indigo-500 rounded-2xl flex flex-col items-center justify-center z-50 pointer-events-none animate-fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-indigo-100 dark:border-slate-800 flex flex-col items-center text-center max-w-sm space-y-3 m-4">
            <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Upload className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Drop your Resume here!</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Release your file to parse and load it instantly. Supports master JSON (.json), PDF (.pdf), or Word (.docx) files.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800" id="master-panel-header">
        <div className="space-y-0.5">
          <h2 className="text-base font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            1. Master Main Resume Workspace
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Build, import/export, or load a preset resume template</p>
        </div>

        {/* Import / Export & Presets Container */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3" id="header-tools-container">
          {/* Pre-fill Quick Presets */}
          <div className="flex items-center gap-1" id="presets-panel">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mr-1">Sample:</span>
            <button
              onClick={() => onLoadSample('en-software-dev')}
              className="text-[10px] font-bold bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 px-2 py-1 rounded transition-colors text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 cursor-pointer"
              id="load-en-sample"
              type="button"
            >
              EN Engineer
            </button>
            <button
              onClick={() => onLoadSample('fr-software-dev')}
              className="text-[10px] font-bold bg-slate-50 dark:bg-slate-800 hover:bg-indigo-55 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 px-2 py-1 rounded transition-colors text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 cursor-pointer"
              id="load-fr-sample"
              type="button"
            >
              FR Dev
            </button>
            <button
              onClick={() => onLoadSample('en-product-mgr')}
              className="text-[10px] font-bold bg-slate-50 dark:bg-slate-800 hover:bg-indigo-55 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 px-2 py-1 rounded transition-colors text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 cursor-pointer"
              id="load-pm-sample"
              type="button"
            >
              EN PM
            </button>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

          {/* File Import / Export actions */}
          <div className="flex items-center gap-2 flex-wrap" id="import-export-actions">
            <input
              type="file"
              id="import-json-file-wizard"
              accept=".json"
              onChange={onImportJSON}
              className="hidden"
            />
            <button
              onClick={() => document.getElementById('import-json-file-wizard')?.click()}
              disabled={isParsing}
              className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 hover:border-slate-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Import a Master Resume JSON file"
              id="btn-import-json"
              type="button"
            >
              <Upload className="w-3.5 h-3.5" />
              Import JSON
            </button>

            <input
              type="file"
              id="import-resume-file-wizard"
              accept=".pdf,.docx"
              onChange={onImportFile}
              className="hidden"
            />
            <button
              onClick={() => document.getElementById('import-resume-file-wizard')?.click()}
              disabled={isParsing}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-900/80 hover:border-indigo-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Parse and import a master resume from PDF or DOCX format"
              id="btn-import-pdf-docx"
              type="button"
            >
              {isParsing ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-600 dark:text-indigo-400" />
                  Parsing...
                </span>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  Import PDF / Word
                </>
              )}
            </button>

            <button
              onClick={onExportJSON}
              disabled={isParsing}
              className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 hover:border-slate-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              title="Export current Master Resume to a JSON file"
              id="btn-export-json"
              type="button"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

            <button
              onClick={() => handleTranslateResume('en')}
              disabled={isTranslating}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 border ${
                translatingLang === 'en'
                  ? 'bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-850 shadow-2xs'
                  : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
              title="Translate to English"
              type="button"
            >
              {translatingLang === 'en' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" /> : <Globe className="w-3.5 h-3.5" />}
              <span>EN</span>
            </button>
            <button
              onClick={() => handleTranslateResume('fr')}
              disabled={isTranslating}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 border ${
                translatingLang === 'fr'
                  ? 'bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-850 shadow-2xs'
                  : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
              title="Translate to French"
              type="button"
            >
              {translatingLang === 'fr' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" /> : <Globe className="w-3.5 h-3.5" />}
              <span>FR</span>
            </button>
          </div>
        </div>
      </div>

      {/* Import status feedback banner */}
      {importStatus && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`p-3 rounded-lg flex items-start justify-between gap-3 text-xs border ${
            importStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
          id="import-feedback-alert"
        >
          <div className="flex items-start gap-2">
            {importStatus.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            )}
            <span>{importStatus.message}</span>
          </div>
          <button
            onClick={onCloseImportStatus}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
            id="btn-close-import-alert"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Resume Version History Section */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-850 rounded-2xl p-4 space-y-3" id="version-history-panel">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-55 dark:bg-indigo-950/50 p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                Resume Snapshots
                <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-slate-200 dark:bg-slate-850 text-slate-600 dark:text-slate-400 rounded-full">
                  {versions.length}
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Save backups of your current resume edits to revert anytime</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSavingVersion ? (
              <form onSubmit={handleSaveVersion} className="flex items-center gap-2 w-full sm:w-auto animate-fade-in">
                <input
                  type="text"
                  value={tempVersionName}
                  onChange={(e) => setTempVersionName(e.target.value)}
                  placeholder="Snapshot name (optional)..."
                  className="text-xs border border-slate-250 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
                  maxLength={50}
                  id="snapshot-name-input"
                  autoFocus
                />
                <button
                  type="submit"
                  className="text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  id="btn-confirm-snapshot-save"
                >
                  <Save className="w-3 h-3" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSavingVersion(false);
                    setTempVersionName('');
                  }}
                  className="text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                  id="btn-cancel-snapshot-save"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                {resumeScore !== null && (
                  <span className={`text-[11px] font-extrabold px-3 py-1.5 rounded-lg border ${
                    resumeScore >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                    resumeScore >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
                  }`}>
                    Score: {resumeScore}/100
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleScoreResume}
                  className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-900/50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Score Master Resume
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingVersion(true)}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 border border-indigo-100/50 dark:border-indigo-900/50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                  id="btn-take-snapshot"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Take Backup Snapshot
                </button>
              </>
            )}
          </div>
        </div>

        {/* Snapshot Alert Feedback banner */}
        {versionAlert && (
          <div
            className={`p-2.5 rounded-lg text-[11px] border flex items-center gap-2 ${
              versionAlert.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30'
            }`}
            id="version-alert-banner"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>{versionAlert.message}</span>
          </div>
        )}

        {/* Versions List */}
        {versions.length === 0 ? (
          <div className="text-center py-3 text-xs text-slate-400 dark:text-slate-500 italic" id="empty-versions-msg">
            No snapshots saved yet. Back up your current edits before making significant updates!
          </div>
        ) : (
          <div className="max-h-36 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin" id="snapshot-versions-list">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all text-xs"
                id={`snapshot-row-${ver.id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 animate-pulse" />
                  <div className="truncate min-w-0">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200" title={ver.name}>{ver.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-2 font-mono">{ver.timestamp}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRevertToVersion(ver)}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 px-2 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer"
                    title="Restore resume state to this backup"
                    id={`btn-revert-snapshot-${ver.id}`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteVersion(ver.id, ver.name)}
                    className="text-[11px] font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1 rounded-md transition-all cursor-pointer"
                    title="Delete backup snapshot"
                    id={`btn-delete-snapshot-${ver.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resume Impact Scorer */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-850 rounded-2xl p-4 space-y-3" id="resume-impact-scorer">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
            Resume Impact Scorer
        </h3>
        <p className="text-[10px] text-slate-500 dark:text-slate-400">Your resume is scored based on content completeness and impact.</p>
        <button
            onClick={handleScoreResume}
            disabled={isScoring}
            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 border border-indigo-100/50 dark:border-indigo-900/50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            id="btn-score-resume"
        >
            {isScoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isScoring ? 'Scoring...' : 'Score Resume'}
        </button>
        {resumeScore !== null && (
            <div className="space-y-2 mt-2">
                <div className={`p-2 rounded-lg text-xs font-bold ${
                    resumeScore >= 80 ? 'bg-emerald-100 text-emerald-800' :
                    resumeScore >= 50 ? 'bg-amber-100 text-amber-800' :
                    'bg-rose-100 text-rose-800'
                }`}>
                    Current Score: {resumeScore} / 100
                </div>
                {resumeSuggestions.length > 0 && (
                    <ul className="text-[10px] text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1">
                        {resumeSuggestions.map((suggestion, idx) => (
                            <li key={idx}>{suggestion}</li>
                        ))}
                    </ul>
                )}
            </div>
        )}
      </div>

      {/* Form Step tabs - horizontal scroll on mobile */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto scrollbar-none" id="form-tab-selector">
        {['contact', 'summary', 'experience', 'skills', 'education', 'projects', 'certifications', 'languages'].map((tab) => {
          let label = tab.charAt(0).toUpperCase() + tab.slice(1);
          if (tab === 'experience') label = `Experience (${(masterResume.experience || []).length})`;
          if (tab === 'skills') label = `Skills (${(masterResume.skills || []).length})`;
          if (tab === 'projects') label = `Projects (${(masterResume.projects || []).length})`;
          if (tab === 'certifications') label = `Certifications (${(masterResume.certifications || []).length})`;
          if (tab === 'languages') label = `Languages (${(masterResume.languages || []).length})`;

          return (
            <button
              key={tab}
              onClick={() => setActiveFormTab(tab as any)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg font-extrabold transition-all cursor-pointer ${
                activeFormTab === tab 
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
              }`}
              id={`form-tab-${tab}`}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Wizard Tab View Content */}
      <div className="pt-1" id="wizard-form-content">
        {/* Contact Tab */}
        {activeFormTab === 'contact' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in" id="form-contact-fields">
            {['name', 'title', 'email', 'phone', 'location', 'linkedin', 'website'].map((field) => {
              const label = field === 'name' ? 'Full Name' : field === 'linkedin' ? 'LinkedIn Link' : field.charAt(0).toUpperCase() + field.slice(1);
              return (
                <div key={field} className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</label>
                  <input
                    type="text"
                    value={(masterResume.contact as any)[field] || ''}
                    onChange={(e) => handleContactChange(field as any, e.target.value)}
                    className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                    placeholder={`e.g. ${field === 'email' ? 'john@example.com' : field === 'location' ? 'New York, USA' : ''}`}
                    id={`field-${field}`}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Summary Tab */}
        {activeFormTab === 'summary' && (
          <div className="space-y-1 animate-fade-in" id="form-summary-field">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Professional Summary / Executive Pitch</label>
            <textarea
              value={masterResume.summary}
              onChange={(e) => onUpdateMaster({ ...masterResume, summary: e.target.value })}
              className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 leading-relaxed"
              rows={6}
              placeholder="Write a powerful summary of your career focus, top qualifications, and value proposition..."
              id="field-summary"
            />
          </div>
        )}

         {/* Experience Tab */}
        {activeFormTab === 'experience' && (
          <div className="space-y-4 animate-fade-in" id="form-experience-fields">
            <div className="flex justify-between items-center pb-1">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Work History ({(masterResume.experience || []).length})</h3>
              <button
                type="button"
                onClick={handleAddExperience}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-850 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                id="btn-add-experience-main"
              >
                <Plus className="w-3.5 h-3.5" /> Add Job
              </button>
            </div>

            <div className="space-y-4" id="experience-list-form">
              {(masterResume.experience || []).map((exp, expIdx) => (
                <div key={expIdx} className="border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3 bg-slate-50/30 dark:bg-slate-800/20 relative" id={`form-experience-row-${expIdx}`}>
                  <button
                    type="button"
                    onClick={() => handleRemoveExperience(expIdx)}
                    className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    title="Delete work history entry"
                    id={`btn-remove-exp-${expIdx}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Company</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => handleExperienceChange(expIdx, 'company', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id={`field-exp-company-${expIdx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Role / Title</label>
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) => handleExperienceChange(expIdx, 'role', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id={`field-exp-role-${expIdx}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Location</label>
                      <input
                        type="text"
                        value={exp.location}
                        onChange={(e) => handleExperienceChange(expIdx, 'location', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id={`field-exp-location-${expIdx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Start Date</label>
                      <input
                        type="text"
                        value={exp.startDate}
                        onChange={(e) => handleExperienceChange(expIdx, 'startDate', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. June 2022"
                        id={`field-exp-start-${expIdx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">End Date</label>
                      <input
                        type="text"
                        value={exp.endDate}
                        onChange={(e) => handleExperienceChange(expIdx, 'endDate', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. Present"
                        id={`field-exp-end-${expIdx}`}
                      />
                    </div>
                  </div>

                  {/* Bullets Sub-Form */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800" id={`exp-bullets-container-${expIdx}`}>
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" /> Key Achievements (STAR Bullet Points)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleAddBullet(expIdx)}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                        id={`btn-add-bullet-${expIdx}`}
                      >
                        <Plus className="w-3 h-3" /> Add Bullet
                      </button>
                    </div>

                    <div className="space-y-2" id={`bullets-list-fields-${expIdx}`}>
                      {exp.bullets.map((bullet, bulletIdx) => (
                        <div key={bulletIdx} className="space-y-1.5" id={`bullet-row-${expIdx}-${bulletIdx}`}>
                           <div className="flex gap-2">
                            <textarea
                              value={bullet}
                              onChange={(e) => handleExperienceBulletChange(expIdx, bulletIdx, e.target.value)}
                              className="flex-grow text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                              rows={2}
                              placeholder="Describe a key action and measurable result using STAR..."
                              id={`field-bullet-${expIdx}-${bulletIdx}`}
                            />
                            <div className="flex flex-col gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => handleTriggerImproveBullet(expIdx, bulletIdx, bullet)}
                                className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-colors"
                                title="Improve with AI Coach"
                                id={`btn-improve-bullet-${expIdx}-${bulletIdx}`}
                              >
                                <Sparkles className="w-4 h-4 text-indigo-500" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveBullet(expIdx, bulletIdx)}
                                className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-colors"
                                title="Delete bullet point"
                                id={`btn-remove-bullet-${expIdx}-${bulletIdx}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* AI Bullet Improver Suggestions overlay container */}
                          <AnimatePresence>
                            {improvingBulletIdx?.expIdx === expIdx && improvingBulletIdx?.bulletIdx === bulletIdx && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/60 rounded-xl p-3 space-y-2 text-[11px]"
                                id="bullet-improver-overlay"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI Copywriter Suggestions (STAR methodology)
                                  </span>
                                  <button
                                    onClick={() => setImprovingBulletIdx(null)}
                                    className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                                    type="button"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {loadingSuggestions && (
                                  <div className="py-3 text-center space-y-1">
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto" />
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Rewriting achievements with metrics...</p>
                                  </div>
                                )}

                                {suggestionsError && (
                                  <p className="text-rose-600 bg-rose-50 dark:bg-rose-950/20 p-2 rounded border border-rose-100 dark:border-rose-900/50">{suggestionsError}</p>
                                )}

                                {!loadingSuggestions && bulletSuggestions.length > 0 && (
                                  <div className="space-y-1.5" id="suggestions-list-fields">
                                    {bulletSuggestions.map((suggestion, sIdx) => (
                                      <div
                                        key={sIdx}
                                        onClick={() => handleApplySuggestedBullet(expIdx, bulletIdx, suggestion)}
                                        className="bg-white dark:bg-slate-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-800 border border-slate-150 dark:border-slate-700 p-2 rounded-lg cursor-pointer transition-all text-slate-700 dark:text-slate-200 leading-relaxed"
                                        id={`btn-apply-suggestion-${sIdx}`}
                                      >
                                        "{suggestion}"
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills Tab */}
        {activeFormTab === 'skills' && (
          <div className="space-y-4 animate-fade-in" id="form-skills-fields">
            <div className="flex justify-between items-center pb-1">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Skills Inventory ({(masterResume.skills || []).length})</h3>
              <button
                type="button"
                onClick={handleAddSkillCategory}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-850 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                id="btn-add-skill-category"
              >
                <Plus className="w-3.5 h-3.5" /> Add Skill Category
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in" id="skills-list-form">
              {(masterResume.skills || []).map((skill, idx) => (
                <div key={idx} className="border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3 bg-slate-50/30 dark:bg-slate-800/20 relative" id={`form-skill-row-${idx}`}>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkillCategory(idx)}
                    className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    id={`btn-remove-skill-${idx}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="space-y-1 pr-6">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Category Title</label>
                    <input
                      type="text"
                      value={skill.category}
                      onChange={(e) => handleSkillCategoryChange(idx, 'category', e.target.value)}
                      className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. Frontend Frameworks or Soft Skills"
                      id={`field-skill-category-${idx}`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-slate-400" /> Skills (Comma separated list)
                    </label>
                    <input
                      type="text"
                      value={skill.items.join(', ')}
                      onChange={(e) => handleSkillCategoryChange(idx, 'items', e.target.value.split(',').map(s => s.trim()))}
                      className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. React, TypeScript, Vue, HTML5"
                      id={`field-skill-items-${idx}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education Tab */}
        {activeFormTab === 'education' && (
          <div className="space-y-4 animate-fade-in" id="form-education-fields">
            <div className="flex justify-between items-center pb-1">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Academic Background</h3>
              <button
                type="button"
                onClick={handleAddEducation}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-850 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                id="btn-add-edu"
              >
                <Plus className="w-3.5 h-3.5" /> Add Education
              </button>
            </div>

            <div className="space-y-4" id="education-list-form">
              {(masterResume.education || []).map((edu, idx) => (
                <div key={idx} className="border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3 bg-slate-50/30 dark:bg-slate-800/20 relative animate-fade-in" id={`form-edu-row-${idx}`}>
                  <button
                    type="button"
                    onClick={() => handleRemoveEducation(idx)}
                    className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    id={`btn-remove-edu-${idx}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-400" /> Institution Name
                      </label>
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) => handleEducationChange(idx, 'institution', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id={`field-edu-institution-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Degree / Course</label>
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => handleEducationChange(idx, 'degree', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id={`field-edu-degree-${idx}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Location</label>
                      <input
                        type="text"
                        value={edu.location}
                        onChange={(e) => handleEducationChange(idx, 'location', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id={`field-edu-location-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Graduation Date</label>
                      <input
                        type="text"
                        value={edu.graduationDate}
                        onChange={(e) => handleEducationChange(idx, 'graduationDate', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id={`field-edu-date-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">GPA (Optional)</label>
                      <input
                        type="text"
                        value={edu.gpa || ''}
                        onChange={(e) => handleEducationChange(idx, 'gpa', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. 3.9/4.0"
                        id={`field-edu-gpa-${idx}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects Tab */}
        {activeFormTab === 'projects' && (
          <div className="space-y-4 animate-fade-in" id="form-projects-fields">
            <div className="flex justify-between items-center pb-1">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Key Projects</h3>
              <button
                type="button"
                onClick={handleAddProject}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-850 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                id="btn-add-project"
              >
                <Plus className="w-3.5 h-3.5" /> Add Project
              </button>
            </div>

            <div className="space-y-4" id="projects-list-form">
              {(masterResume.projects || []).map((proj, idx) => (
                <div key={idx} className="border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3 bg-slate-50/30 dark:bg-slate-800/20 relative animate-fade-in" id={`form-proj-row-${idx}`}>
                  <button
                    type="button"
                    onClick={() => handleRemoveProject(idx)}
                    className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    id={`btn-remove-project-${idx}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Project Name</label>
                      <input
                        type="text"
                        value={proj.name}
                        onChange={(e) => handleProjectChange(idx, 'name', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id={`field-proj-name-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Project URL / Link</label>
                      <input
                        type="text"
                        value={proj.link || ''}
                        onChange={(e) => handleProjectChange(idx, 'link', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. github.com/..."
                        id={`field-proj-link-${idx}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Description</label>
                    <textarea
                      value={proj.description}
                      onChange={(e) => handleProjectChange(idx, 'description', e.target.value)}
                      className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={2}
                      id={`field-proj-desc-${idx}`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Technologies Used (Comma separated)</label>
                    <input
                      type="text"
                      value={(proj.technologies || []).join(', ')}
                      onChange={(e) => handleProjectChange(idx, 'technologies', e.target.value.split(',').map(t => t.trim()))}
                      className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. React, Docker, NodeJS"
                      id={`field-proj-tech-${idx}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications Tab */}
        {activeFormTab === 'certifications' && (
          <div className="space-y-4 animate-fade-in" id="form-certifications-fields">
            <div className="flex justify-between items-center pb-1">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Professional Certifications</h3>
              <button
                type="button"
                onClick={handleAddCertification}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-855 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                id="btn-add-cert"
              >
                <Plus className="w-3.5 h-3.5" /> Add Certificate
              </button>
            </div>

            <div className="space-y-4 animate-fade-in" id="certifications-list-form">
              {(masterResume.certifications || []).map((cert, idx) => (
                <div key={idx} className="border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3 bg-slate-50/30 dark:bg-slate-800/20 relative animate-fade-in" id={`form-cert-row-${idx}`}>
                  <button
                    type="button"
                    onClick={() => handleRemoveCertification(idx)}
                    className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    id={`btn-remove-cert-${idx}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Certificate Name</label>
                      <input
                        type="text"
                        value={cert.name}
                        onChange={(e) => handleCertificationChange(idx, 'name', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id={`field-cert-name-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Issuing Authority</label>
                      <input
                        type="text"
                        value={cert.issuer}
                        onChange={(e) => handleCertificationChange(idx, 'issuer', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id={`field-cert-issuer-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Issue Date</label>
                      <input
                        type="text"
                        value={cert.date}
                        onChange={(e) => handleCertificationChange(idx, 'date', e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. 2024"
                        id={`field-cert-date-${idx}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Languages Tab */}
        {activeFormTab === 'languages' && (
          <div className="space-y-4 animate-fade-in" id="form-languages-fields">
            <div className="flex justify-between items-center pb-1">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Languages</h3>
              <button
                type="button"
                onClick={handleAddLanguage}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-850 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                id="btn-add-lang-main"
              >
                <Plus className="w-3.5 h-3.5" /> Add Language
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="languages-list-form">
              {(masterResume.languages || []).map((lang, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3 relative group" id={`form-lang-row-${idx}`}>
                  <div className="flex-grow space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-slate-400" /> Language & Proficiency
                    </label>
                    <input
                      type="text"
                      value={lang}
                      onChange={(e) => handleLanguageChange(idx, e.target.value)}
                      className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. English (Native) or French (B2)"
                      id={`field-lang-value-${idx}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveLanguage(idx)}
                    className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors self-end pb-1"
                    id={`btn-remove-lang-sub-${idx}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
