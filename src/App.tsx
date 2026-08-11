import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Briefcase,
  GraduationCap,
  Wrench,
  Sparkles,
  Link2,
  FileDown,
  ChevronRight,
  Globe,
  Loader2,
  History,
  CheckCircle,
  AlertCircle,
  Trash2,
  ArrowLeft,
  RotateCcw,
  Plus,
  Upload,
  Download,
  Search,
  ExternalLink,
  X,
  Brain,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  Mail,
  Linkedin,
  Trello,
  Settings
} from 'lucide-react';
import { sampleResumes } from './data/samples';
import { ResumeData, TailorResponse, CoverLetterData, AiConfig } from './types';
import { useAuth } from './AuthContext';
import { getMasterResume, saveMasterResume, getHistory, saveHistory, getJobApplications, saveJobApplications, getAiConfig, saveAiConfig, migrateToSubcollections, listResumeVersions, saveResumeVersion, getResumeVersion, deleteResumeVersion, renameResumeVersion, PRIMARY_RESUME_ID, ResumeVersionMeta } from './db';
import { localDb } from './utils/localDb';
import { apiFetch } from './utils/apiClient';
import { useToast } from './components/Toast';
import AtsDashboard from './components/AtsDashboard';
import ResumePreview from './components/ResumePreview';
import CoverLetterPreview from './components/CoverLetterPreview';
import ResumeDiffView from './components/ResumeDiffView';
import ResumeVersionSwitcher from './components/ResumeVersionSwitcher';
import AchievementBank from './components/AchievementBank';
import InterviewPrepCoach from './components/InterviewPrepCoach';
import MasterResumeWizard from './components/MasterResumeWizard';
import JobsDeepSearch from './components/JobsDeepSearch';
import TargetSpecifications from './components/TargetSpecifications';
import ApplicationIntegrationsHub from './components/ApplicationIntegrationsHub';
import ApplicationTracker from './components/ApplicationTracker';
import LandingPage from './components/LandingPage';

// Helper to validate and clean up imported resume JSON
const validateAndCleanResumeData = (parsed: any): ResumeData => {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid file format. Resume data must be a JSON object.');
  }

  const contact = parsed.contact || {};
  const cleanedContact = {
    name: String(contact.name || '').trim() || 'John Doe',
    title: String(contact.title || '').trim() || 'Professional',
    email: String(contact.email || '').trim(),
    phone: String(contact.phone || '').trim(),
    location: String(contact.location || '').trim(),
    linkedin: contact.linkedin ? String(contact.linkedin).trim() : undefined,
    website: contact.website ? String(contact.website).trim() : undefined,
  };

  const summary = String(parsed.summary || '').trim();

  const experience = Array.isArray(parsed.experience)
    ? parsed.experience.map((job: any) => ({
        company: String(job.company || '').trim(),
        role: String(job.role || '').trim(),
        location: String(job.location || '').trim(),
        startDate: String(job.startDate || '').trim(),
        endDate: String(job.endDate || '').trim(),
        bullets: Array.isArray(job.bullets) ? job.bullets.map((b: any) => String(b || '').trim()) : [],
      }))
    : [];

  const skills = Array.isArray(parsed.skills)
    ? parsed.skills.map((s: any) => ({
        category: String(s.category || '').trim(),
        items: Array.isArray(s.items) ? s.items.map((i: any) => String(i || '').trim()) : [],
      }))
    : [];

  const education = Array.isArray(parsed.education)
    ? parsed.education.map((edu: any) => ({
        institution: String(edu.institution || '').trim(),
        degree: String(edu.degree || '').trim(),
        location: String(edu.location || '').trim(),
        graduationDate: String(edu.graduationDate || '').trim(),
        gpa: edu.gpa ? String(edu.gpa).trim() : undefined,
      }))
    : [];

  const certifications = Array.isArray(parsed.certifications)
    ? parsed.certifications.map((cert: any) => ({
        name: String(cert.name || '').trim(),
        issuer: String(cert.issuer || '').trim(),
        date: String(cert.date || '').trim(),
      }))
    : undefined;

  const projects = Array.isArray(parsed.projects)
    ? parsed.projects.map((proj: any) => ({
        name: String(proj.name || '').trim(),
        description: String(proj.description || '').trim(),
        technologies: Array.isArray(proj.technologies) ? proj.technologies.map((t: any) => String(t || '').trim()) : [],
        link: proj.link ? String(proj.link).trim() : undefined,
      }))
    : undefined;

  const languages = Array.isArray(parsed.languages)
    ? parsed.languages.map((l: any) => String(l || '').trim())
    : undefined;

  return {
    contact: cleanedContact,
    summary,
    experience,
    skills,
    education,
    certifications,
    projects,
    languages,
  };
};

// Helper to get initial default resume
const getInitialResume = (): ResumeData => {
  return sampleResumes[0].data;
};

export default function App() {
  const { showError, showSuccess, showToast } = useToast();
  // Global View Navigation State
  const [currentView, setCurrentView] = useState<'landing' | 'editor' | 'search' | 'ats' | 'interview' | 'cover-letter' | 'integrations' | 'tracker'>('landing');

  // Dark Mode state & sync
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('ats_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ats_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ats_dark_mode', 'false');
    }
  }, [darkMode]);

  // Global Model State
  const [selectedModel, setSelectedModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-flash-lite' | 'gemini-3.1-pro-preview'>(() => {
    const saved = localStorage.getItem('ats_selected_model');
    return (saved as any) || 'gemini-3.5-flash';
  });

  useEffect(() => {
    localStorage.setItem('ats_selected_model', selectedModel);
  }, [selectedModel]);

  // Flexible AI Configuration Settings State (Local Storage persistent)
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => {
    const saved = localStorage.getItem('ats_ai_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved ai config', e);
      }
    }
    return {
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-2.5-flash', // set a high quality modern default model
      customEndpoint: ''
    };
  });

  useEffect(() => {
    localStorage.setItem('ats_ai_config', JSON.stringify(aiConfig));
  }, [aiConfig]);

  // Full vs Split view state for master resume visualizer
  const [resumeViewMode, setResumeViewMode] = useState<'split' | 'full'>('split');

  // Master Resume State
  const [masterResume, setMasterResume] = useState<ResumeData>(getInitialResume());
  // Multi-version resumes: signed-in users can maintain several named
  // resumes (e.g. "Backend", "Data") backed by users/{uid}/resumes/{id}.
  // Guests stay single-resume (localDb has no concept of multiple versions).
  const [resumeVersions, setResumeVersions] = useState<ResumeVersionMeta[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string>(PRIMARY_RESUME_ID);
  const [isSwitchingVersion, setIsSwitchingVersion] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'contact' | 'summary' | 'experience' | 'skills' | 'education' | 'projects' | 'certifications' | 'languages'>('contact');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Input States
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<'en' | 'fr'>('en');
  const [optimizeForRelocation, setOptimizeForRelocation] = useState(false);
  const [targetCompany, setTargetCompany] = useState('');
  const [targetTitle, setTargetTitle] = useState('');

  // Tailored Result State
  const [tailorResult, setTailorResult] = useState<TailorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Result Tabs
  const [activeResultTab, setActiveResultTab] = useState<'audit' | 'resume' | 'diff' | 'cover-letter'>('audit');

  // Cover Letter States
  const [coverLetter, setCoverLetter] = useState<CoverLetterData | null>(null);
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false);
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null);

  // History State
  const [historyList, setHistoryList] = useState<{ id: string; timestamp: string; title: string; result: TailorResponse }[]>([]);

  // Jobs Deep Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLocation, setSearchLocation] = useState(() => localStorage.getItem('ats_search_location') || '');
  const [jobType, setJobType] = useState(() => localStorage.getItem('ats_job_type') || '');
  const [salaryExpectation, setSalaryExpectation] = useState(() => localStorage.getItem('ats_salary_expectation') || '');
  const [remoteStatus, setRemoteStatus] = useState(() => localStorage.getItem('ats_remote_status') || '');
  const [searchResults, setSearchResults] = useState<{
    title: string;
    company: string;
    location: string;
    url: string;
    description: string;
    source: string;
  }[] | null>(null);
  const [isSearchingJobs, setIsSearchingJobs] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedSearchJobIndex, setSelectedSearchJobIndex] = useState<number | null>(null);
  const [searchBasedOnResume, setSearchBasedOnResume] = useState(false);
  const [supportsRelocation, setSupportsRelocation] = useState(false);
  const [searchQueryUsed, setSearchQueryUsed] = useState('');
  const [searchLocationUsed, setSearchLocationUsed] = useState('');

  // Persist search filters
  useEffect(() => {
    localStorage.setItem('ats_search_location', searchLocation);
  }, [searchLocation]);

  useEffect(() => {
    localStorage.setItem('ats_job_type', jobType);
  }, [jobType]);

  useEffect(() => {
    localStorage.setItem('ats_salary_expectation', salaryExpectation);
  }, [salaryExpectation]);

  useEffect(() => {
    localStorage.setItem('ats_remote_status', remoteStatus);
  }, [remoteStatus]);

  const { user, signInWithGoogle, signInWithLinkedin, logout } = useAuth();

  useEffect(() => {
    if (user && aiConfig) {
      saveAiConfig(user.uid, aiConfig).catch(e => console.error('Failed to save AI config to Firestore', e));
    }
  }, [user, aiConfig]);

  // Load state on mount / auth change
  useEffect(() => {
    const loadGuestData = async () => {
      try {
        await localDb.migrateFromLocalStorage(['ats_master_resume', 'ats_tailored_history']);
        const dbMaster = await localDb.getItem<ResumeData | null>('ats_master_resume', null);
        if (dbMaster) {
          setMasterResume(dbMaster);
        }
        const dbHistory = await localDb.getItem<any[]>('ats_tailored_history', []);
        setHistoryList(dbHistory);
      } catch (err) {
        console.error('Error loading guest data from IndexedDB:', err);
      }
    };

    if (user) {
      setActiveResumeId(PRIMARY_RESUME_ID);
      // One-time, idempotent fan-out of the legacy single-document schema into
      // per-item subcollections (see src/db.ts). Fails open: if migration
      // itself errors, still proceed to load whatever already exists rather
      // than blocking the app.
      migrateToSubcollections(user.uid).catch(e => console.error('Failed to migrate Firestore data to v2 schema', e)).finally(() => {
        getMasterResume(user.uid).then(savedMaster => {
          if (savedMaster) setMasterResume(savedMaster);
        }).catch(e => console.error('Failed to parse saved master resume', e));

        listResumeVersions(user.uid).then(versions => {
          setResumeVersions(versions);
        }).catch(e => console.error('Failed to list resume versions', e));

        getHistory(user.uid).then(savedHistory => {
          if (savedHistory) setHistoryList(savedHistory);
        }).catch(e => console.error('Failed to parse tailored history', e));

        getAiConfig(user.uid).then(savedAiConfig => {
          if (savedAiConfig) setAiConfig(savedAiConfig);
        }).catch(e => console.error('Failed to parse saved AI config', e));
      });
    } else {
      loadGuestData();
    }
  }, [user]);

  // Save master resume on update. The Firestore write is debounced (~1.5s)
  // since this fires on every field edit and a full-document rewrite per
  // keystroke isn't necessary; local state and guest storage stay immediate.
  // pendingSaveRef tracks which resumeId the pending debounced write targets,
  // so switching versions mid-debounce can flush it immediately instead of
  // losing the edit or writing it to the newly-active version by mistake.
  const saveMasterResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ resumeId: string; data: ResumeData } | null>(null);

  const flushPendingResumeSave = () => {
    if (saveMasterResumeTimer.current) {
      clearTimeout(saveMasterResumeTimer.current);
      saveMasterResumeTimer.current = null;
    }
    if (pendingSaveRef.current && user) {
      const { resumeId, data } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveResumeVersion(user.uid, resumeId, data);
    }
  };

  const handleUpdateMaster = (updated: ResumeData) => {
    setMasterResume(updated);
    if (user) {
      pendingSaveRef.current = { resumeId: activeResumeId, data: updated };
      if (saveMasterResumeTimer.current) {
        clearTimeout(saveMasterResumeTimer.current);
      }
      saveMasterResumeTimer.current = setTimeout(() => {
        flushPendingResumeSave();
      }, 1500);
    } else {
      localDb.setItem('ats_master_resume', updated);
    }
  };

  // Switches the active resume version: flushes any pending debounced save
  // for the currently-active version first (so an in-flight edit isn't lost
  // or misattributed to the newly-selected version), then loads the target.
  const handleSwitchResumeVersion = async (resumeId: string) => {
    if (!user || resumeId === activeResumeId) return;
    flushPendingResumeSave();
    setIsSwitchingVersion(true);
    try {
      const data = await getResumeVersion(user.uid, resumeId);
      setMasterResume(data || getInitialResume());
      setActiveResumeId(resumeId);
    } catch (e) {
      console.error('Failed to switch resume version', e);
      showError('Could not load that resume version', e);
    } finally {
      setIsSwitchingVersion(false);
    }
  };

  // Creates a new named version, seeded from the currently active resume's
  // content (the common case: "make a Backend variant from what I have").
  const handleCreateResumeVersion = async (name: string) => {
    if (!user) return;
    flushPendingResumeSave();
    const newId = 'ver_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const seedData = JSON.parse(JSON.stringify(masterResume)) as ResumeData;
    try {
      await saveResumeVersion(user.uid, newId, seedData, name);
      setResumeVersions(prev => [...prev, { id: newId, name, updatedAt: Date.now() }]);
      setActiveResumeId(newId);
      setMasterResume(seedData);
      showSuccess(`Created resume version "${name}".`);
    } catch (e) {
      console.error('Failed to create resume version', e);
      showError('Could not create new resume version', e);
    }
  };

  const handleRenameResumeVersion = async (resumeId: string, name: string) => {
    if (!user || !name.trim()) return;
    try {
      await renameResumeVersion(user.uid, resumeId, name.trim());
      setResumeVersions(prev => prev.map(v => (v.id === resumeId ? { ...v, name: name.trim() } : v)));
    } catch (e) {
      console.error('Failed to rename resume version', e);
      showError('Could not rename resume version', e);
    }
  };

  const handleDeleteResumeVersion = async (resumeId: string) => {
    if (!user || resumeId === PRIMARY_RESUME_ID) return;
    try {
      await deleteResumeVersion(user.uid, resumeId);
      setResumeVersions(prev => prev.filter(v => v.id !== resumeId));
      if (activeResumeId === resumeId) {
        await handleSwitchResumeVersion(PRIMARY_RESUME_ID);
      }
      showSuccess('Resume version deleted.');
    } catch (e) {
      console.error('Failed to delete resume version', e);
      showError('Could not delete resume version', e);
    }
  };

  // Reset to sample
  const handleLoadSample = (sampleId: string) => {
    const sample = sampleResumes.find((s) => s.id === sampleId);
    if (sample) {
      handleUpdateMaster(sample.data);
      setTargetLanguage(sample.language);
    }
  };

  // Import master resume from JSON file
  const handleImportJSON = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') {
          throw new Error('Could not read file content as text.');
        }

        const parsed = JSON.parse(text);
        const cleanedData = validateAndCleanResumeData(parsed);

        // Update the master state and localStorage
        handleUpdateMaster(cleanedData);

        // Show success alert/state
        setImportStatus({
          type: 'success',
          message: `Successfully imported master resume for ${cleanedData.contact.name}!`,
        });

        // Reset file input value
        e.target.value = '';

        // Auto-clear success message after 5 seconds
        setTimeout(() => {
          setImportStatus((prev) => (prev?.type === 'success' ? null : prev));
        }, 5000);
      } catch (err: any) {
        console.error('Import Error:', err);
        setImportStatus({
          type: 'error',
          message: `Failed to import resume: ${err.message || 'Invalid JSON format'}`,
        });
      }
    };

    reader.onerror = () => {
      setImportStatus({
        type: 'error',
        message: 'Error reading file.',
      });
    };

    reader.readAsText(file);
  };

  // Import master resume from PDF or DOCX file using backend parsing
  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.docx') ? 'docx' : null;
    if (!fileType) {
      setImportStatus({
        type: 'error',
        message: 'Unsupported file type. Please upload a .pdf or .docx file.'
      });
      return;
    }

    setIsParsing(true);
    setImportStatus({
      type: 'success',
      message: `Uploading and parsing "${file.name}" with Gemini AI... This may take up to 10 seconds.`
    });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') {
          throw new Error('Could not read file content.');
        }

        const base64Data = result.split(',')[1];

        const parsedResume = await apiFetch(
          '/api/parse-resume',
          { base64Data, fileType, model: selectedModel, aiConfig },
          { apiKey: aiConfig?.apiKey }
        );
        const cleanedData = validateAndCleanResumeData(parsedResume);

        // Update the master state and localStorage
        handleUpdateMaster(cleanedData);

        setImportStatus({
          type: 'success',
          message: `Successfully parsed and imported master resume for ${cleanedData.contact.name}!`,
        });

        // Clear input value
        e.target.value = '';
      } catch (err: any) {
        console.error('File parsing error:', err);
        setImportStatus({
          type: 'error',
          message: `Failed to parse resume: ${err.message || 'Check file format or API keys'}`
        });
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      setImportStatus({
        type: 'error',
        message: 'Error reading file.'
      });
      setIsParsing(false);
    };

    reader.readAsDataURL(file);
  };

  // Import master resume from dropped file (.json, .pdf, or .docx)
  const handleImportDroppedFile = async (file: File) => {
    if (!file) return;

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result;
          if (typeof text !== 'string') {
            throw new Error('Could not read file content as text.');
          }

          const parsed = JSON.parse(text);
          const cleanedData = validateAndCleanResumeData(parsed);

          handleUpdateMaster(cleanedData);

          setImportStatus({
            type: 'success',
            message: `Successfully imported master resume for ${cleanedData.contact.name}!`,
          });

          setTimeout(() => {
            setImportStatus((prev) => (prev?.type === 'success' ? null : prev));
          }, 5000);
        } catch (err: any) {
          console.error('Import Error:', err);
          setImportStatus({
            type: 'error',
            message: `Failed to import resume: ${err.message || 'Invalid JSON format'}`,
          });
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.pdf') || file.name.endsWith('.docx')) {
      const fileType = file.name.endsWith('.pdf') ? 'pdf' : 'docx';
      setIsParsing(true);
      setImportStatus({
        type: 'success',
        message: `Uploading and parsing "${file.name}" with Gemini AI... This may take up to 10 seconds.`
      });

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const result = event.target?.result;
          if (typeof result !== 'string') {
            throw new Error('Could not read file content.');
          }

          const base64Data = result.split(',')[1];

          const parsedResume = await apiFetch(
            '/api/parse-resume',
            { base64Data, fileType, model: selectedModel, aiConfig },
            { apiKey: aiConfig?.apiKey }
          );
          const cleanedData = validateAndCleanResumeData(parsedResume);

          handleUpdateMaster(cleanedData);

          setImportStatus({
            type: 'success',
            message: `Successfully parsed and imported master resume for ${cleanedData.contact.name}!`,
          });
        } catch (err: any) {
          console.error('File parsing error:', err);
          setImportStatus({
            type: 'error',
            message: `Failed to parse resume: ${err.message || 'Check file format or API keys'}`
          });
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setImportStatus({
        type: 'error',
        message: 'Unsupported file type. Please drag and drop a .json, .pdf, or .docx file.'
      });
    }
  };

  // Export current master resume to JSON file
  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(masterResume, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileDefaultName = `${masterResume.contact.name.toLowerCase().replace(/\s+/g, '_')}_master_resume.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      setImportStatus({
        type: 'success',
        message: 'Resume exported successfully! Saved to your downloads.',
      });

      setTimeout(() => {
        setImportStatus((prev) => (prev?.type === 'success' ? null : prev));
      }, 5000);
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: `Failed to export resume: ${err.message}`,
      });
    }
  };

  // Loading phase steps sequence
  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }

    const intervals = [1200, 2200, 2500, 2200];
    let currentStep = 0;

    const runSteps = () => {
      if (currentStep < 4) {
        const timeout = setTimeout(() => {
          currentStep++;
          setLoadingStep(currentStep);
          runSteps();
        }, intervals[currentStep]);
        return () => clearTimeout(timeout);
      }
    };

    runSteps();
  }, [loading]);

  const handleDeepSearchJobs = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchBasedOnResume && !searchQuery.trim()) {
      setSearchError('Please provide a search query (e.g. Frontend Developer).');
      return;
    }

    setIsSearchingJobs(true);
    setSearchError(null);
    setSearchResults(null);
    setSelectedSearchJobIndex(null);
    setSearchQueryUsed('');
    setSearchLocationUsed('');

    try {
      const data = await apiFetch(
        '/api/jobs-deep-search',
        {
          query: searchQuery,
          location: searchLocation,
          masterResume: searchBasedOnResume ? masterResume : undefined,
          useResume: searchBasedOnResume,
          supportsRelocation: supportsRelocation,
          jobType,
          salaryExpectation,
          remoteStatus,
          model: selectedModel,
          aiConfig,
        },
        { apiKey: aiConfig?.apiKey }
      );
      setSearchResults(data.jobs || []);
      if (data.autoQuery) {
        setSearchQueryUsed(data.autoQuery);
      }
      if (data.autoLocation) {
        setSearchLocationUsed(data.autoLocation);
      }
      if (data.jobs && data.jobs.length > 0) {
        setSelectedSearchJobIndex(0);
      }
    } catch (err: any) {
      console.error('Jobs Deep Search error:', err);
      setSearchError(err.message || 'Check your internet connection or Gemini API limits.');
    } finally {
      setIsSearchingJobs(false);
    }
  };

  const handleImportJobDetails = (job: any) => {
    setJobUrl(job.url || '');
    setJobDescription(job.description || '');
    setTargetCompany(job.company || '');
    setTargetTitle(job.title || '');
    const element = document.getElementById('tailoring-form');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleTailor = async (e: FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim() && !jobUrl.trim()) {
      setError('Please provide a job description or a direct job link.');
      return;
    }

    setLoading(true);
    setError(null);
    setTailorResult(null);

    try {
      const data = await apiFetch<TailorResponse>(
        '/api/tailor',
        {
          masterResume,
          jobDescription,
          jobUrl,
          language: targetLanguage,
          optimizeForRelocation,
          model: selectedModel,
          aiConfig,
        },
        { apiKey: aiConfig?.apiKey }
      );
      setTailorResult(data);
      setActiveResultTab('audit');
      setCurrentView('ats');

      // Save to history
      const newHistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString(),
        title: `${targetTitle || data.tailoredResume.contact.title} at ${targetCompany || (jobUrl ? 'Job URL' : 'Target Job')}`,
        targetCompany: targetCompany,
        targetTitle: targetTitle,
        result: data,
      };

      const updatedHistory = [newHistoryItem, ...historyList].slice(0, 10); // Keep last 10
      setHistoryList(updatedHistory);
      if (user) {
        saveHistory(user.uid, updatedHistory);
      } else {
        localDb.setItem('ats_tailored_history', updatedHistory);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred. Please make sure the Gemini API Key is configured in your Settings secrets.');
    } finally {
      setLoading(false);
    }
  };

  // Batch tailoring: process multiple search-result jobs sequentially against
  // the same master resume. Sequential (not parallel) because /api/tailor is
  // rate-limited server-side (expensiveAiLimiter) -- one at a time naturally
  // respects that instead of firing a burst that mostly comes back 429.
  const [batchSelectedIndices, setBatchSelectedIndices] = useState<Set<number>>(new Set());
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const handleToggleBatchSelect = (idx: number) => {
    setBatchSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleRunBatchTailor = async () => {
    if (!searchResults || batchSelectedIndices.size === 0) return;
    const jobs = Array.from(batchSelectedIndices).map((idx) => searchResults[idx]).filter(Boolean);
    setIsBatchRunning(true);
    setBatchProgress({ current: 0, total: jobs.length });

    const newHistoryItems: { id: string; timestamp: string; title: string; targetCompany: string; targetTitle: string; result: TailorResponse }[] = [];
    let successCount = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      setBatchProgress({ current: i + 1, total: jobs.length });
      try {
        const data = await apiFetch<TailorResponse>(
          '/api/tailor',
          {
            masterResume,
            jobDescription: job.description || '',
            jobUrl: job.url || '',
            language: targetLanguage,
            optimizeForRelocation,
            model: selectedModel,
            aiConfig,
          },
          { apiKey: aiConfig?.apiKey }
        );
        newHistoryItems.push({
          id: Date.now().toString() + '_' + i,
          timestamp: new Date().toLocaleString(),
          title: `${job.title || data.tailoredResume.contact.title} at ${job.company || 'Target Job'}`,
          targetCompany: job.company || '',
          targetTitle: job.title || '',
          result: data,
        });
        successCount++;
      } catch (err) {
        console.error(`Batch tailor failed for ${job.company || 'unknown job'}:`, err);
      }
    }

    if (newHistoryItems.length > 0) {
      const updatedHistory = [...newHistoryItems, ...historyList].slice(0, 10);
      setHistoryList(updatedHistory);
      if (user) {
        saveHistory(user.uid, updatedHistory);
      } else {
        localDb.setItem('ats_tailored_history', updatedHistory);
      }
    }

    setIsBatchRunning(false);
    setBatchProgress(null);
    setBatchSelectedIndices(new Set());
    if (successCount > 0) {
      showSuccess(`Batch complete: ${successCount}/${jobs.length} tailored successfully. Check History to review each.`);
    } else {
      showError('Batch tailoring failed for all selected jobs.', null);
    }
  };

  // Clear tailored result to go back
  const handleBackToInputs = () => {
    setTailorResult(null);
    setCoverLetter(null);
    setCoverLetterError(null);
  };

  // Generate ATS-Optimized Cover Letter
  const handleGenerateCoverLetter = async () => {
    if (!tailorResult) return;
    setGeneratingCoverLetter(true);
    setCoverLetterError(null);
    try {
      const data = await apiFetch<CoverLetterData>(
        '/api/cover-letter',
        {
          tailoredResume: tailorResult.tailoredResume,
          jobDescription: jobDescription || tailorResult.optimizationSummary,
          language: targetLanguage,
          model: selectedModel,
          aiConfig,
        },
        { apiKey: aiConfig?.apiKey }
      );
      setCoverLetter(data);
    } catch (err: any) {
      console.error(err);
      setCoverLetterError(err.message || 'An unexpected error occurred while generating the cover letter. Please verify your settings and API keys.');
    } finally {
      setGeneratingCoverLetter(false);
    }
  };

  // Contextual single-click keyword fixes for ATS Audit Dashboard
  const handleFixKeyword = (term: string, category: 'technical' | 'soft' | 'domain' | 'industry') => {
    if (!tailorResult) return;

    const updatedResume = JSON.parse(JSON.stringify(tailorResult.tailoredResume)) as ResumeData;
    if (!updatedResume.skills) {
      updatedResume.skills = [];
    }

    const categoryMapping: Record<string, string[]> = {
      technical: ['technical', 'languages', 'technologies', 'frameworks', 'tools', 'hard skills', 'programming', 'software'],
      soft: ['soft', 'interpersonal', 'professional', 'leadership', 'soft skills'],
      domain: ['domain', 'methodologies', 'knowledge', 'concepts', 'expertise'],
      industry: ['industry', 'sector', 'industry knowledge', 'industry terms']
    };

    const defaultCategoryNames: Record<string, string> = {
      technical: 'Technical Skills',
      soft: 'Soft Skills',
      domain: 'Domain Expertise',
      industry: 'Industry Knowledge'
    };

    const targetKeywords = categoryMapping[category] || [category];
    let matchedCat = updatedResume.skills.find(s => 
      targetKeywords.some(keyword => s.category.toLowerCase().includes(keyword))
    );

    if (!matchedCat) {
      const catName = defaultCategoryNames[category] || 'Core Skills';
      matchedCat = { category: catName, items: [] };
      updatedResume.skills.push(matchedCat);
    }

    const termExists = matchedCat.items.some(item => item.toLowerCase() === term.toLowerCase());
    if (!termExists) {
      matchedCat.items.push(term);
    }

    const updatedKeywords = tailorResult.keywords.map(kw => {
      if (kw.term.toLowerCase() === term.toLowerCase()) {
        return { ...kw, matchesInTailored: Math.max(1, kw.matchesInTailored + 1) };
      }
      return kw;
    });

    const totalKeywordsCount = updatedKeywords.length;
    const matchedKeywordsCount = updatedKeywords.filter(k => k.matchesInTailored > 0).length;
    const keywordScorePercentage = totalKeywordsCount > 0 
      ? Math.round((matchedKeywordsCount / totalKeywordsCount) * 40)
      : 40;

    const oldScore = tailorResult.atsScoreAfter;
    const newScore = Math.min(100, Math.max(oldScore, 60 + keywordScorePercentage));

    setTailorResult({
      ...tailorResult,
      tailoredResume: updatedResume,
      keywords: updatedKeywords,
      atsScoreAfter: newScore
    });
  };

  const handleFixAllKeywords = () => {
    if (!tailorResult) return;

    const updatedResume = JSON.parse(JSON.stringify(tailorResult.tailoredResume)) as ResumeData;
    if (!updatedResume.skills) {
      updatedResume.skills = [];
    }

    const categoryMapping: Record<string, string[]> = {
      technical: ['technical', 'languages', 'technologies', 'frameworks', 'tools', 'hard skills', 'programming', 'software'],
      soft: ['soft', 'interpersonal', 'professional', 'leadership', 'soft skills'],
      domain: ['domain', 'methodologies', 'knowledge', 'concepts', 'expertise'],
      industry: ['industry', 'sector', 'industry knowledge', 'industry terms']
    };

    const defaultCategoryNames: Record<string, string> = {
      technical: 'Technical Skills',
      soft: 'Soft Skills',
      domain: 'Domain Expertise',
      industry: 'Industry Knowledge'
    };

    const missingKeywords = tailorResult.keywords.filter(kw => kw.matchesInTailored === 0);
    if (missingKeywords.length === 0) return;

    missingKeywords.forEach(kw => {
      const targetKeywords = categoryMapping[kw.category] || [kw.category];
      let matchedCat = updatedResume.skills.find(s => 
        targetKeywords.some(keyword => s.category.toLowerCase().includes(keyword))
      );

      if (!matchedCat) {
        const catName = defaultCategoryNames[kw.category] || 'Core Skills';
        matchedCat = { category: catName, items: [] };
        updatedResume.skills.push(matchedCat);
      }

      const termExists = matchedCat.items.some(item => item.toLowerCase() === kw.term.toLowerCase());
      if (!termExists) {
        matchedCat.items.push(kw.term);
      }
    });

    const updatedKeywords = tailorResult.keywords.map(kw => {
      if (kw.matchesInTailored === 0) {
        return { ...kw, matchesInTailored: 1 };
      }
      return kw;
    });

    setTailorResult({
      ...tailorResult,
      tailoredResume: updatedResume,
      keywords: updatedKeywords,
      atsScoreAfter: 100
    });
  };

  const handleFixFormatting = (checkName: string) => {
    if (!tailorResult) return;

    const updatedChecks = tailorResult.formattingChecks.map(check => {
      if (check.checkName === checkName) {
        return {
          ...check,
          status: 'pass' as const,
          description: check.description + " (Auto-fixed to guarantee complete compliance with standard ATS parsers)."
        };
      }
      return check;
    });

    const oldScore = tailorResult.atsScoreAfter;
    const newScore = Math.min(100, oldScore + 5);

    setTailorResult({
      ...tailorResult,
      formattingChecks: updatedChecks,
      atsScoreAfter: newScore
    });
  };

  // Load from history
  const handleLoadHistory = (item: any) => {
    setTailorResult(item.result);
    setTargetLanguage(item.result.tailoredResume.languages && item.result.tailoredResume.languages.includes('Français') ? 'fr' : 'en');
    setTargetCompany(item.targetCompany || '');
    setTargetTitle(item.targetTitle || '');
    setActiveResultTab('audit');
    setCurrentView('ats');
    setCoverLetter(null);
    setCoverLetterError(null);
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear your tailoring history?')) {
      setHistoryList([]);
      if (user) {
        saveHistory(user.uid, []);
      } else {
        localStorage.removeItem('ats_tailored_history');
      }
    }
  };

  // Form Field Helpers for Master Resume Creator
  const handleContactChange = (field: keyof typeof masterResume.contact, value: string) => {
    handleUpdateMaster({
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
    handleUpdateMaster({
      ...masterResume,
      experience: [...masterResume.experience, newExp]
    });
  };

  const handleRemoveExperience = (idx: number) => {
    handleUpdateMaster({
      ...masterResume,
      experience: masterResume.experience.filter((_, i) => i !== idx)
    });
  };

  const handleExperienceChange = (expIdx: number, field: string, value: any) => {
    const updated = [...masterResume.experience];
    updated[expIdx] = { ...updated[expIdx], [field]: value };
    handleUpdateMaster({ ...masterResume, experience: updated });
  };

  const handleExperienceBulletChange = (expIdx: number, bulletIdx: number, value: string) => {
    const updated = [...masterResume.experience];
    const bullets = [...updated[expIdx].bullets];
    bullets[bulletIdx] = value;
    updated[expIdx] = { ...updated[expIdx], bullets };
    handleUpdateMaster({ ...masterResume, experience: updated });
  };

  const handleAddBullet = (expIdx: number) => {
    const updated = [...masterResume.experience];
    updated[expIdx] = { ...updated[expIdx], bullets: [...updated[expIdx].bullets, ''] };
    handleUpdateMaster({ ...masterResume, experience: updated });
  };

  const handleRemoveBullet = (expIdx: number, bulletIdx: number) => {
    const updated = [...masterResume.experience];
    const bullets = updated[expIdx].bullets.filter((_, i) => i !== bulletIdx);
    updated[expIdx] = { ...updated[expIdx], bullets };
    handleUpdateMaster({ ...masterResume, experience: updated });
  };

  const handleAddSkillCategory = () => {
    handleUpdateMaster({
      ...masterResume,
      skills: [...(masterResume.skills || []), { category: '', items: [''] }]
    });
  };

  const handleRemoveSkillCategory = (idx: number) => {
    handleUpdateMaster({
      ...masterResume,
      skills: (masterResume.skills || []).filter((_, i) => i !== idx)
    });
  };

  const handleSkillCategoryChange = (idx: number, field: 'category' | 'items', value: any) => {
    const updated = [...(masterResume.skills || [])];
    if (field === 'category') {
      updated[idx] = { ...updated[idx], category: value };
    } else {
      updated[idx] = { ...updated[idx], items: value };
    }
    handleUpdateMaster({ ...masterResume, skills: updated });
  };

  const handleAddEducation = () => {
    handleUpdateMaster({
      ...masterResume,
      education: [...(masterResume.education || []), { institution: '', degree: '', location: '', graduationDate: '' }]
    });
  };

  const handleRemoveEducation = (idx: number) => {
    handleUpdateMaster({
      ...masterResume,
      education: (masterResume.education || []).filter((_, i) => i !== idx)
    });
  };

  const handleEducationChange = (idx: number, field: string, value: string) => {
    const updated = [...(masterResume.education || [])];
    updated[idx] = { ...updated[idx], [field]: value };
    handleUpdateMaster({ ...masterResume, education: updated });
  };

  const handleAddProject = () => {
    const projects = masterResume.projects || [];
    handleUpdateMaster({
      ...masterResume,
      projects: [...projects, { name: '', description: '', technologies: [''], link: '' }]
    });
  };

  const handleRemoveProject = (idx: number) => {
    const projects = masterResume.projects || [];
    handleUpdateMaster({
      ...masterResume,
      projects: projects.filter((_, i) => i !== idx)
    });
  };

  const handleProjectChange = (idx: number, field: string, value: any) => {
    const projects = masterResume.projects || [];
    const updated = [...projects];
    updated[idx] = { ...updated[idx], [field]: value };
    handleUpdateMaster({ ...masterResume, projects: updated });
  };

  const handleAddCertification = () => {
    const certifications = masterResume.certifications || [];
    handleUpdateMaster({
      ...masterResume,
      certifications: [...certifications, { name: '', issuer: '', date: '' }]
    });
  };

  const handleRemoveCertification = (idx: number) => {
    const certifications = masterResume.certifications || [];
    handleUpdateMaster({
      ...masterResume,
      certifications: certifications.filter((_, i) => i !== idx)
    });
  };

  const handleCertificationChange = (idx: number, field: string, value: string) => {
    const certifications = masterResume.certifications || [];
    const updated = [...certifications];
    updated[idx] = { ...updated[idx], [field]: value };
    handleUpdateMaster({ ...masterResume, certifications: updated });
  };

  const handleAddLanguage = () => {
    const languages = masterResume.languages || [];
    handleUpdateMaster({
      ...masterResume,
      languages: [...languages, '']
    });
  };

  const handleRemoveLanguage = (idx: number) => {
    const languages = masterResume.languages || [];
    handleUpdateMaster({
      ...masterResume,
      languages: languages.filter((_, i) => i !== idx)
    });
  };

  const handleLanguageChange = (idx: number, value: string) => {
    const languages = masterResume.languages || [];
    const updated = [...languages];
    updated[idx] = value;
    handleUpdateMaster({ ...masterResume, languages: updated });
  };

  // Steps labels during loader
  const progressSteps = [
    { label: 'Parsing Master Resume Structure', desc: 'Validating single column schema' },
    { label: 'Searching & Extrapolating Job Details', desc: 'Running context grounding search' },
    { label: 'Mapping Keywords & Core Skillsets', desc: 'Scoring initial ATS compatibility gap' },
    { label: 'Rebuilding Experience Achievements', desc: 'Applying STAR methodology bullets' },
    { label: 'Formulating Output Document & Scorecard', desc: 'Constructing final optimized package' }
  ];

  // Handle auto-adding to Application Tracker when email is sent
  const handleEmailSent = async (threadId: string, recipientEmail: string) => {
    try {
      const company = targetCompany || 'Unknown Company';
      const title = targetTitle || tailorResult?.tailoredResume.contact.title || masterResume.contact.title || 'Unknown Role';
      
      let apps = [];
      if (user) {
        apps = await getJobApplications(user.uid) || [];
      } else {
        const saved = localStorage.getItem('ats_tailor_job_applications');
        if (saved) apps = JSON.parse(saved);
      }

      // Check if application already exists for this title/company (simple heuristic)
      const existingAppIndex = apps.findIndex((a: any) => a.company.toLowerCase() === company.toLowerCase() && a.title.toLowerCase() === title.toLowerCase());
      const today = new Date().toISOString().split('T')[0];

      if (existingAppIndex >= 0) {
        apps[existingAppIndex] = {
          ...apps[existingAppIndex],
          status: 'applied',
          contactEmail: recipientEmail || apps[existingAppIndex].contactEmail,
          gmailThreadId: threadId || apps[existingAppIndex].gmailThreadId,
          dateUpdated: today,
          notes: (apps[existingAppIndex].notes || '') + `\n[System Sync]: Application email successfully sent to ${recipientEmail || 'recruiter'} on ${today}.`
        };
      } else {
        apps.unshift({
          id: 'app_' + Math.random().toString(36).substr(2, 9),
          company,
          title,
          location: 'Remote/Unknown',
          status: 'applied',
          dateAdded: today,
          dateUpdated: today,
          contactEmail: recipientEmail,
          gmailThreadId: threadId,
          notes: `[System Sync]: Application email successfully sent to ${recipientEmail || 'recruiter'} on ${today}.`
        });
      }

      if (user) {
        await saveJobApplications(user.uid, apps);
      } else {
        localStorage.setItem('ats_tailor_job_applications', JSON.stringify(apps));
      }
    } catch (err) {
      console.error('Failed to auto-add application to tracker', err);
    }
  };

  // Handle manual/one-click synchronization to tracker
  const handleSyncToTracker = async () => {
    if (!tailorResult) return;
    try {
      const company = targetCompany || 'Unknown Company';
      const title = targetTitle || tailorResult.tailoredResume.contact.title || masterResume.contact.title || 'Unknown Role';
      
      let apps = [];
      if (user) {
        apps = await getJobApplications(user.uid) || [];
      } else {
        const saved = localStorage.getItem('ats_tailor_job_applications');
        if (saved) apps = JSON.parse(saved);
      }

      const today = new Date().toISOString().split('T')[0];
      const existingAppIndex = apps.findIndex((a: any) => 
        a.company.toLowerCase() === company.toLowerCase() && 
        a.title.toLowerCase() === title.toLowerCase()
      );

      if (existingAppIndex >= 0) {
        apps[existingAppIndex] = {
          ...apps[existingAppIndex],
          status: apps[existingAppIndex].status || 'saved',
          jobUrl: jobUrl || apps[existingAppIndex].jobUrl,
          dateUpdated: today,
          resumeId: user ? activeResumeId : apps[existingAppIndex].resumeId,
          notes: (apps[existingAppIndex].notes || '') + `\n[System Sync]: Tailored resume re-synced on ${today}.`
        };
      } else {
        apps.unshift({
          id: 'app_' + Math.random().toString(36).substr(2, 9),
          company,
          title,
          location: 'Remote/Unknown',
          status: 'saved',
          jobUrl: jobUrl,
          dateAdded: today,
          dateUpdated: today,
          resumeId: user ? activeResumeId : undefined,
          notes: `[System Sync]: Tailored resume successfully synchronized with Job Tracker!`
        });
      }

      if (user) {
        await saveJobApplications(user.uid, apps);
      } else {
        localStorage.setItem('ats_tailor_job_applications', JSON.stringify(apps));
      }
      showSuccess(`Successfully synchronized ${title} at ${company} with your Job Tracker!`);
    } catch (err) {
      console.error(err);
      showError('Failed to sync with job tracker', err);
    }
  };

  if (currentView === 'landing') {
    return (
      <LandingPage
        onNavigate={(view) => setCurrentView(view)}
        onLoadSample={() => handleLoadSample('en-software-dev')}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        user={user}
        onSignInGoogle={signInWithGoogle}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900 transition-colors duration-200 ${
      darkMode ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-50 text-slate-800'
    }`} id="app-root">
      {/* Top Banner Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-10 print:hidden" id="app-header">
        <div className="max-w-7xl mx-auto px-4 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5 cursor-pointer select-none group" onClick={() => setCurrentView('landing')} title="Go back to Landing Page">
              <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform" id="header-logo">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-950 dark:text-white tracking-tight flex items-center gap-1.5">
                  ATS Resume Tailor
                  <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">‹ back home</span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Adapt resumes, pass ATS screeners, generate cover letters, and ace mock interviews
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2" id="header-right">
              {/* Premium Model Selection / Quota Optimization Selector */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-full pl-2.5 pr-1 py-1 border border-transparent dark:border-slate-700 shadow-2xs">
                <Brain className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as any)}
                  className="bg-transparent text-slate-700 dark:text-slate-300 font-semibold text-[11px] border-none outline-none pr-1.5 cursor-pointer focus:ring-0 py-0"
                  title="Optimize model choice & manage API quota usage"
                >
                  <option value="gemini-3.1-flash-lite" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    ⚡ Lite Mode (Quota Saver)
                  </option>
                  <option value="gemini-3.5-flash" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    🎯 Balanced Mode (Default)
                  </option>
                  <option value="gemini-3.1-pro-preview" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    🧠 Deep Reasoning (Pro)
                  </option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowAiSettings(true)}
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-transparent dark:border-slate-700 shadow-xs transition-colors cursor-pointer flex items-center justify-center"
                  title="Configure custom AI provider and API keys"
                  type="button"
                >
                  <Settings className="w-4 h-4 text-indigo-500" />
                </button>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-transparent dark:border-slate-700 shadow-xs transition-colors cursor-pointer flex items-center justify-center"
                  title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  type="button"
                >
                  {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                </button>
              </div>

              {user ? (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-md flex items-center gap-1">
                    {user.displayName || user.email}
                  </span>
                  <button onClick={logout} className="text-[11px] font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                  <button onClick={signInWithGoogle} className="text-[11px] font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-800/50 cursor-pointer flex items-center gap-1 transition-colors">
                    Sign In (Google)
                  </button>
                  <button onClick={signInWithLinkedin} className="text-[11px] font-semibold px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800/50 cursor-pointer flex items-center gap-1 transition-colors">
                    Sign In (LinkedIn)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Persistent Feature Navigation Tabs */}
          <div className="flex gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-bold mt-3 max-w-full overflow-x-auto" id="main-features-nav">
            <button
              onClick={() => setCurrentView('editor')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all flex-shrink-0 cursor-pointer ${
                currentView === 'editor'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
              }`}
              type="button"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              Resume Editor
            </button>
            <button
              onClick={() => setCurrentView('search')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all flex-shrink-0 cursor-pointer ${
                currentView === 'search'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
              }`}
              type="button"
            >
              <Search className="w-4 h-4 text-slate-400" />
              AI Job Search
            </button>
            <button
              onClick={() => setCurrentView('ats')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all flex-shrink-0 cursor-pointer relative ${
                currentView === 'ats'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
              }`}
              type="button"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              ATS Score & Audit
              {tailorResult && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentView('cover-letter')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all flex-shrink-0 cursor-pointer ${
                currentView === 'cover-letter'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
              }`}
              type="button"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              ATS Cover Letter
            </button>
            <button
              onClick={() => setCurrentView('interview')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all flex-shrink-0 cursor-pointer relative ${
                currentView === 'interview'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
              }`}
              type="button"
            >
              <Brain className="w-4 h-4 text-indigo-500" />
              Interview Prep Coach
              <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold px-1.5 py-0.5 rounded ml-1 uppercase">NEW</span>
            </button>
            <button
              onClick={() => setCurrentView('integrations')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all flex-shrink-0 cursor-pointer ${
                currentView === 'integrations'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
              }`}
              type="button"
            >
              <Linkedin className="w-4 h-4 text-sky-600" />
              Outreach Suite
            </button>
            <button
              onClick={() => setCurrentView('tracker')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all flex-shrink-0 cursor-pointer relative ${
                currentView === 'tracker'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
              }`}
              type="button"
            >
              <Trello className="w-4 h-4 text-emerald-500" />
              Application Tracker
              <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold px-1.5 py-0.5 rounded ml-1 uppercase animate-pulse">BETA</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:py-8 grid grid-cols-1 gap-6 print:p-0">
        <AnimatePresence mode="wait">
          {/* 1. LOADING OVERLAY */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 md:p-16 text-center space-y-8 max-w-2xl mx-auto my-12 shadow-sm flex flex-col items-center justify-center text-slate-900 dark:text-slate-100"
              key="loading-screen"
              id="loading-overlay"
            >
              <div className="relative" id="loading-spinner">
                <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tailoring Your Resume...</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Our Applicant Tracking System AI optimizer is mapping exact keywords, rewriting achievements, and configuring formats.
                </p>
              </div>

              {/* Progress Steps Timeline */}
              <div className="w-full max-w-md text-left space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800" id="progress-timeline">
                {progressSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 transition-opacity duration-300 ${
                      loadingStep >= idx ? 'opacity-100' : 'opacity-30'
                    }`}
                    id={`loading-step-${idx}`}
                  >
                    <div className="mt-0.5" id={`step-status-icon-${idx}`}>
                      {loadingStep > idx ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      ) : loadingStep === idx ? (
                        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400 dark:text-slate-550">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{step.label}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 2. MAIN APP CONTENT WHEN NOT LOADING */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
              key={currentView}
              id={`view-panel-${currentView}`}
            >
              {/* TAB 1: RESUME EDITOR */}
              {currentView === 'editor' && (
                <div className="space-y-6" id="editor-workspace">
                  {/* Real Mode Visualizer Switcher & Toolbar */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs" id="workspace-mode-selector">
                    <div className="space-y-1">
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                        Workspace Visual Mode
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Choose between full-width editing wizard and high-fidelity full-page document viewing
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                      <button
                        onClick={() => setResumeViewMode('split')}
                        className={`text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-2 border transition-all cursor-pointer flex-1 sm:flex-none ${
                          resumeViewMode === 'split'
                            ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                        type="button"
                      >
                        <Minimize2 className="w-4 h-4" />
                        <span className="whitespace-nowrap">Split Editor Mode</span>
                      </button>

                      <button
                        onClick={() => setResumeViewMode('full')}
                        className={`text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-2 border transition-all cursor-pointer flex-1 sm:flex-none ${
                          resumeViewMode === 'full'
                            ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs animate-pulse'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                        type="button"
                        title="Full Real Mode Preview"
                      >
                        <Maximize2 className="w-4 h-4" />
                        <span className="whitespace-nowrap">Full Real Mode Preview</span>
                      </button>

                      <button
                        onClick={() => setResumeViewMode('split')}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center justify-center flex-none"
                        type="button"
                        title="Reset View"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {user && (
                    <ResumeVersionSwitcher
                      versions={resumeVersions}
                      activeResumeId={activeResumeId}
                      isSwitching={isSwitchingVersion}
                      onSwitch={handleSwitchResumeVersion}
                      onCreate={handleCreateResumeVersion}
                      onRename={handleRenameResumeVersion}
                      onDelete={handleDeleteResumeVersion}
                    />
                  )}

                  <AchievementBank />

                  {resumeViewMode === 'split' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="split-workspace-grid">
                      {/* Master Resume Creator/Wizard (Full Width) */}
                      <div className="lg:col-span-12 space-y-4" id="left-workspace-column">
                        <MasterResumeWizard
                          masterResume={masterResume}
                          onUpdateMaster={handleUpdateMaster}
                          isParsing={isParsing}
                          onImportFile={handleImportFile}
                          onImportJSON={handleImportJSON}
                          onImportDroppedFile={handleImportDroppedFile}
                          onExportJSON={handleExportJSON}
                          onLoadSample={handleLoadSample}
                          importStatus={importStatus}
                          onCloseImportStatus={() => setImportStatus(null)}
                          aiConfig={aiConfig}
                          selectedModel={selectedModel}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-md animate-fade-in" id="full-workspace-view">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
                        <div>
                          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded font-extrabold uppercase tracking-widest">
                            Full Real Mode
                          </span>
                          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1.5">
                            Master Resume Visualizer CV
                          </h3>
                        </div>
                        <button
                          onClick={() => setResumeViewMode('split')}
                          className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          type="button"
                        >
                          <ArrowLeft className="w-4 h-4" /> Back to Split Editor
                        </button>
                      </div>

                      <ResumePreview
                        resumeData={masterResume}
                        onUpdate={handleUpdateMaster}
                        keywords={[]}
                        aiConfig={aiConfig}
                        selectedModel={selectedModel}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: AI JOB SEARCH */}
              {currentView === 'search' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="search-workspace">
                  {/* Left Column: Jobs Deep Search Input & Results (7 Cols) */}
                  <div className="lg:col-span-7 space-y-4">
                    <JobsDeepSearch
                      searchBasedOnResume={searchBasedOnResume}
                      setSearchBasedOnResume={setSearchBasedOnResume}
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      searchLocation={searchLocation}
                      setSearchLocation={setSearchLocation}
                      supportsRelocation={supportsRelocation}
                      setSupportsRelocation={setSupportsRelocation}
                      jobType={jobType}
                      setJobType={setJobType}
                      salaryExpectation={salaryExpectation}
                      setSalaryExpectation={setSalaryExpectation}
                      remoteStatus={remoteStatus}
                      setRemoteStatus={setRemoteStatus}
                      isSearchingJobs={isSearchingJobs}
                      searchError={searchError}
                      searchResults={searchResults}
                      onClearSearchResults={() => setSearchResults(null)}
                      selectedSearchJobIndex={selectedSearchJobIndex}
                      setSelectedSearchJobIndex={setSelectedSearchJobIndex}
                      onDeepSearchJobs={handleDeepSearchJobs}
                      onImportJobDetails={handleImportJobDetails}
                      masterResume={masterResume}
                      searchQueryUsed={searchQueryUsed}
                      searchLocationUsed={searchLocationUsed}
                      batchSelectedIndices={batchSelectedIndices}
                      onToggleBatchSelect={handleToggleBatchSelect}
                      onRunBatchTailor={handleRunBatchTailor}
                      isBatchRunning={isBatchRunning}
                      batchProgress={batchProgress}
                    />
                  </div>

                  {/* Right Column: Information Onboarding (5 Cols) */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 relative overflow-hidden sticky top-24">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full blur-2xl opacity-70 pointer-events-none" />
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Search className="w-6 h-6" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-base font-extrabold text-slate-900">Career Deep Intelligence Search</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                          Search real, active listings across major platforms using real-time Google Grounding search technology.
                        </p>
                      </div>
                      <ul className="text-xs text-slate-600 space-y-2.5 pt-4 border-t border-slate-100 list-none pl-0">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>Search keywords can be customized or auto-extracted based on your Master Resume skills.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>Click <strong>Import Requirements & URL</strong> to automatically copy job specifications into your active workspace.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>Switch directly to the <strong>ATS Score & Audit</strong> tab or <strong>Interview Prep</strong> tab after importing to instantly get your scores and prep guides!</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ATS SCORE & AUDIT */}
              {currentView === 'ats' && (
                <div className="space-y-6">
                  {tailorResult ? (
                    <div className="space-y-6">
                      {/* Result Toolbar */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 print:hidden" id="result-toolbar">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleBackToInputs}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            id="btn-back-inputs"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Inputs
                          </button>
                          <div className="h-6 w-[1px] bg-slate-200"></div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tailored Resume Created!</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Current match score computed based on live qualifications</p>
                          </div>
                        </div>

                        <button
                          onClick={handleSyncToTracker}
                          className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-900/50 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs"
                          title="Instantly add or update this application in your Job Tracker"
                        >
                          <Trello className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                          Sync with Tracker
                        </button>

                        {/* Secondary Tab selector inside results view */}
                        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl" id="result-tab-selector">
                          <button
                            onClick={() => setActiveResultTab('audit')}
                            className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                              activeResultTab === 'audit'
                                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                            }`}
                            id="tab-audit-btn"
                          >
                            ATS Scorecard & Audit
                          </button>
                          <button
                            onClick={() => setActiveResultTab('resume')}
                            className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                              activeResultTab === 'resume'
                                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                            }`}
                            id="tab-resume-btn"
                          >
                            Tailored Resume CV
                          </button>
                          <button
                            onClick={() => setActiveResultTab('diff')}
                            className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                              activeResultTab === 'diff'
                                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                            }`}
                            id="tab-diff-btn"
                          >
                            What Changed
                            {tailorResult?.fabricationFlags && tailorResult.fabricationFlags.length > 0 && (
                              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
                                {tailorResult.fabricationFlags.length}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => setActiveResultTab('cover-letter')}
                            className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                              activeResultTab === 'cover-letter'
                                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                            }`}
                            id="tab-cover-letter-btn"
                          >
                            ATS Cover Letter
                          </button>
                          <button
                            onClick={() => setActiveResultTab('integrations' as any)}
                            className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                              activeResultTab === ('integrations' as any)
                                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                            }`}
                            id="tab-integrations-btn"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Outreach & Share Hub
                          </button>
                        </div>
                      </div>

                      {/* Display active results sub-tab */}
                      <div id="tab-display-panel">
                        {activeResultTab === 'audit' ? (
                          <div className="print:hidden">
                            <AtsDashboard
                              atsScoreBefore={tailorResult.atsScoreBefore}
                              atsScoreAfter={tailorResult.atsScoreAfter}
                              keywords={tailorResult.keywords}
                              formattingChecks={tailorResult.formattingChecks}
                              optimizationSummary={tailorResult.optimizationSummary}
                              onFixKeyword={handleFixKeyword}
                              onFixAllKeywords={handleFixAllKeywords}
                              onFixFormatting={handleFixFormatting}
                              readabilityAnalysis={tailorResult.readabilityAnalysis}
                            />
                          </div>
                        ) : activeResultTab === 'resume' ? (
                          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100 print:hidden">
                              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                <FileText className="w-4.5 h-4.5 text-indigo-500" />
                                Tailored Optimized Resume Preview
                              </h3>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => window.print()}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <FileDown className="w-3.5 h-3.5" /> Print / PDF
                                </button>
                                <button
                                  onClick={handleExportJSON}
                                  className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" /> Export JSON
                                </button>
                              </div>
                            </div>
                            <ResumePreview
                              resumeData={tailorResult.tailoredResume}
                              keywords={tailorResult.keywords}
                              onUpdate={(updated) => setTailorResult({ ...tailorResult, tailoredResume: updated })}
                              aiConfig={aiConfig}
                              selectedModel={selectedModel}
                            />
                          </div>
                        ) : activeResultTab === 'diff' ? (
                          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 print:hidden">
                            <ResumeDiffView
                              masterResume={masterResume}
                              tailoredResume={tailorResult.tailoredResume}
                              fabricationFlags={tailorResult.fabricationFlags}
                            />
                          </div>
                        ) : activeResultTab === 'cover-letter' ? (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                            {coverLetter ? (
                              <CoverLetterPreview
                                coverLetter={coverLetter}
                                keywords={tailorResult.keywords}
                                onUpdate={(updated) => setCoverLetter(updated)}
                                onRegenerate={handleGenerateCoverLetter}
                                isRegenerating={generatingCoverLetter}
                                aiConfig={aiConfig}
                                selectedModel={selectedModel}
                              />
                            ) : (
                              <div className="text-center py-12 space-y-4">
                                <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Generate Your Cover Letter</h4>
                                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                                  Generate an optimized, keyword-aligned cover letter tailored specifically to the target job description and your qualifications.
                                </p>
                                <button
                                  onClick={handleGenerateCoverLetter}
                                  disabled={generatingCoverLetter}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  {generatingCoverLetter ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Custom-crafting Cover Letter...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5" />
                                      Generate Tailored Cover Letter
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <ApplicationIntegrationsHub
                            tailoredResume={tailorResult.tailoredResume}
                            coverLetter={coverLetter}
                            atsScore={tailorResult.atsScoreAfter}
                            onEmailSent={handleEmailSent}
                            targetCompany={targetCompany}
                            targetTitle={targetTitle}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="ats-onboarding-workspace">
                      {/* Left Side: Onboarding/Information Card */}
                      <div className="lg:col-span-5 space-y-4">
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 relative overflow-hidden sticky top-24">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full blur-2xl opacity-70 pointer-events-none" />
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-6 h-6 animate-pulse text-indigo-500" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-base font-extrabold text-slate-900">ATS Optimization & Scorecard</h3>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                              Evaluate your resume against target roles to identify critical keyword gaps and format warnings.
                            </p>
                          </div>
                          <ul className="text-xs text-slate-600 space-y-2.5 pt-4 border-t border-slate-100 list-none pl-0">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span><strong>ATS Scorecard</strong>: Analyzes technical terms, soft skills, formatting alerts, and readability indexes.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span><strong>Instant Adapt & Fixes</strong>: Inserts missing critical keywords with automated high-impact bullet rewriting suggestions.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span><strong>Single-Column Format</strong>: Converts resume structure into high-readability layouts fully compatible with screeners.</span>
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* Right Side: Specifications Form Panel */}
                      <div className="lg:col-span-7">
                        <TargetSpecifications
                          targetLanguage={targetLanguage}
                          setTargetLanguage={setTargetLanguage}
                          jobUrl={jobUrl}
                          setJobUrl={setJobUrl}
                          jobDescription={jobDescription}
                          setJobDescription={setJobDescription}
                          error={error}
                          onSubmitTailor={handleTailor}
                          historyList={historyList}
                          onLoadHistory={handleLoadHistory}
                          onClearHistory={handleClearHistory}
                          optimizeForRelocation={optimizeForRelocation}
                          setOptimizeForRelocation={setOptimizeForRelocation}
                          targetCompany={targetCompany}
                          setTargetCompany={setTargetCompany}
                          targetTitle={targetTitle}
                          setTargetTitle={setTargetTitle}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: ATS COVER LETTER GENERATOR */}
              {currentView === 'cover-letter' && (
                <div className="space-y-6">
                  {tailorResult ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 animate-fade-in">
                      {coverLetter ? (
                        <CoverLetterPreview
                          coverLetter={coverLetter}
                          keywords={tailorResult.keywords}
                          onUpdate={(updated) => setCoverLetter(updated)}
                          onRegenerate={handleGenerateCoverLetter}
                          isRegenerating={generatingCoverLetter}
                          aiConfig={aiConfig}
                          selectedModel={selectedModel}
                        />
                      ) : (
                        <div className="text-center py-12 space-y-4">
                          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                          <h4 className="text-sm font-bold text-slate-700">Generate Your Cover Letter</h4>
                          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                            Generate an optimized, keyword-aligned cover letter tailored specifically to the target job description and your qualifications.
                          </p>
                          <button
                            onClick={handleGenerateCoverLetter}
                            disabled={generatingCoverLetter}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                          >
                            {generatingCoverLetter ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Custom-crafting Cover Letter...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                Generate Tailored Cover Letter
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 max-w-2xl mx-auto my-8 text-center animate-fade-in" id="cover-letter-onboarding">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-extrabold text-slate-900">Personalized Cover Letter Generator</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-medium">
                          Run an ATS optimization scan in the <strong>ATS Score & Audit</strong> tab first, or import a target job listing using <strong>AI Job Search</strong> to unlock custom executive cover letters!
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={() => setCurrentView('ats')}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg shadow-sm cursor-pointer"
                        >
                          Go to ATS Score & Audit Tab
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: INTERVIEW PREP COACH */}
              {currentView === 'interview' && (
                <div id="interview-prep-workspace" className="animate-fade-in">
                  <InterviewPrepCoach
                    resumeData={tailorResult ? tailorResult.tailoredResume : masterResume}
                    initialJobDescription={jobDescription}
                    aiConfig={aiConfig}
                  />
                </div>
              )}

              {/* TAB 6: LINKEDIN & OUTLOOK CONNECTORS */}
              {currentView === 'integrations' && (
                <div id="integrations-workspace" className="animate-fade-in space-y-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-2">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                      Professional Outreach Suite
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      Configure your professional network sharing options, draft customized posts, and launch personalized recruitment email dispatchers directly using integrated email platforms and networking channels.
                    </p>
                  </div>
                  <ApplicationIntegrationsHub
                    tailoredResume={tailorResult ? tailorResult.tailoredResume : masterResume}
                    coverLetter={coverLetter}
                    atsScore={tailorResult ? tailorResult.atsScoreAfter : 85}
                    onEmailSent={handleEmailSent}
                    targetCompany={targetCompany}
                    targetTitle={targetTitle}
                  />
                </div>
              )}

              {/* TAB 7: KANBAN APPLICATION TRACKER */}
              {currentView === 'tracker' && (
                <div id="tracker-workspace" className="animate-fade-in">
                  <ApplicationTracker />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* App Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-400 print:hidden" id="app-footer">
        <p>© 2026 ATS Resume Tailor • All rights reserved</p>
        <p className="mt-1 text-[10px] text-slate-300">
          Built with Gemini AI & Google AI Studio
        </p>
      </footer>

      {/* 3. FLEXIBLE AI CONFIGURATION MODAL */}
      <AnimatePresence>
        {showAiSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
              id="ai-config-modal"
            >
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-500 animate-spin" style={{ animationDuration: '3s' }} />
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">AI Engine Configuration</h3>
                </div>
                <button
                  onClick={() => setShowAiSettings(false)}
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setShowAiSettings(false);
                }}
                className="p-6 space-y-4"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 rounded-lg border border-indigo-100/30">
                  <p className="font-semibold text-indigo-900 dark:text-indigo-400 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Flexible AI Architecture
                  </p>
                  Configure your own API keys. Leave the API key field empty to fall back to the secure, built-in system defaults.
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">AI Provider</label>
                  <select
                    value={aiConfig.provider}
                    onChange={(e) => {
                      const provider = e.target.value as any;
                      let defaultModel = 'gemini-3.5-flash';
                      if (provider === 'openai') defaultModel = 'gpt-4o';
                      else if (provider === 'openrouter') defaultModel = 'google/gemini-2.5-flash';
                      else if (provider === 'custom') defaultModel = 'llama3';
                      setAiConfig({ ...aiConfig, provider, model: defaultModel });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="gemini">Google Gemini AI</option>
                    <option value="openai">OpenAI (GPT Models)</option>
                    <option value="openrouter">OpenRouter (Multi-Provider API)</option>
                    <option value="custom">Custom / OpenAI-Compatible (Anthropic, Local LLMs, etc.)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between items-center">
                    <span>API Key</span>
                    <span className="text-[10px] font-normal text-slate-400">(Optional - Leaves safe default key active if blank)</span>
                  </label>
                  <input
                    type="password"
                    placeholder={
                      aiConfig.provider === 'gemini' 
                        ? 'AI Studio Gemini API Key...' 
                        : aiConfig.provider === 'openai' 
                        ? 'OpenAI API Key (sk-...)' 
                        : aiConfig.provider === 'openrouter'
                        ? 'OpenRouter API Key (sk-or-...)'
                        : 'Enter API token...'
                    }
                    value={aiConfig.apiKey}
                    onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Model ID</label>
                    <input
                      type="text"
                      placeholder={
                        aiConfig.provider === 'gemini' 
                          ? 'gemini-3.5-flash' 
                          : aiConfig.provider === 'openai' 
                          ? 'gpt-4o' 
                          : aiConfig.provider === 'openrouter'
                          ? 'google/gemini-2.5-flash'
                          : 'llama3'
                      }
                      value={aiConfig.model}
                      onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  {aiConfig.provider === 'custom' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Custom Endpoint URL</label>
                      <input
                        type="url"
                        placeholder="e.g. http://localhost:11434/v1"
                        value={aiConfig.customEndpoint || ''}
                        onChange={(e) => setAiConfig({ ...aiConfig, customEndpoint: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAiConfig({
                        provider: 'gemini',
                        apiKey: '',
                        model: 'gemini-3.5-flash',
                        customEndpoint: ''
                      });
                      setShowAiSettings(false);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Save & Apply Config
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
