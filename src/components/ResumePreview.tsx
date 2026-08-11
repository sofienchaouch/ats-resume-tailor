import { useState } from 'react';
import { Edit2, Check, Eye, HelpCircle, FileDown, Printer, Plus, Trash2, Globe, Sparkles, Loader2, AlertCircle, Sparkle } from 'lucide-react';
import { ResumeData, KeywordMatch } from '../types';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import SpellcheckField from './SpellcheckField';
import { useToast } from './Toast';

interface ResumePreviewProps {
  resumeData: ResumeData;
  keywords: KeywordMatch[];
  onUpdate: (updated: ResumeData) => void;
  aiConfig?: any;
  selectedModel?: string;
}

export default function ResumePreview({ 
  resumeData, 
  keywords = [], 
  onUpdate,
  aiConfig,
  selectedModel
}: ResumePreviewProps) {
  const { showError, showSuccess, showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [highlightKeywords, setHighlightKeywords] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [enableSpellcheck, setEnableSpellcheck] = useState(true);
  const [ignoredWords, setIgnoredWords] = useState<string[]>(() => {
    const saved = localStorage.getItem('ats_ignored_spelling_words');
    return saved ? JSON.parse(saved) : [];
  });

  const [isTranslating, setIsTranslating] = useState(false);
  const [translatingLang, setTranslatingLang] = useState<'en' | 'fr' | null>(null);
  const [translationToast, setTranslationToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleTranslateResume = async (targetLanguage: 'en' | 'fr') => {
    const backupName = `Auto-Backup before translation (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    const safetyBackup = {
      id: 'ver_' + Math.random().toString(36).substr(2, 9),
      name: backupName,
      timestamp: new Date().toLocaleString(),
      data: JSON.parse(JSON.stringify(resumeData)),
    };
    
    try {
      const savedVersions = localStorage.getItem('ats_resume_versions');
      const parsedVersions = savedVersions ? JSON.parse(savedVersions) : [];
      const updatedVersions = [safetyBackup, ...parsedVersions];
      localStorage.setItem('ats_resume_versions', JSON.stringify(updatedVersions));
    } catch (e) {
      console.error(e);
    }

    setIsTranslating(true);
    setTranslatingLang(targetLanguage);
    setTranslationToast(null);
    try {
      const savedConfig = localStorage.getItem('ats_ai_config');
      const localAiConfig = savedConfig ? JSON.parse(savedConfig) : null;
      const apiKey = aiConfig?.apiKey || localAiConfig?.apiKey || '';
      const model = selectedModel || localStorage.getItem('ats_selected_model') || 'gemini-3.5-flash';

      const response = await fetch('/api/translate-resume', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-gemini-key': apiKey } : {}),
        },
        body: JSON.stringify({
          masterResume: resumeData,
          targetLanguage,
          model,
          aiConfig: aiConfig || localAiConfig
        })
      });
      if (!response.ok) throw new Error('Failed to translate resume');
      const data = await response.json();
      onUpdate(data.translatedResume);
      setTranslationToast({
        type: 'success',
        message: `Resume translated successfully! Safety backup saved as "${backupName}".`
      });
      setTimeout(() => setTranslationToast(null), 6000);
    } catch (err: any) {
      console.error(err);
      setTranslationToast({
        type: 'error',
        message: `Translation failed: ${err.message}`
      });
      setTimeout(() => setTranslationToast(null), 6000);
    } finally {
      setIsTranslating(false);
      setTranslatingLang(null);
    }
  };

  const handleIgnoreWord = (word: string) => {
    const lower = word.toLowerCase();
    if (!ignoredWords.includes(lower)) {
      const updated = [...ignoredWords, lower];
      setIgnoredWords(updated);
      localStorage.setItem('ats_ignored_spelling_words', JSON.stringify(updated));
    }
  };
  
  const [layoutStyle, setLayoutStyle] = useState<'classic' | 'executive' | 'modern'>(() => {
    return (localStorage.getItem('ats_master_resume_layout_style') as 'classic' | 'executive' | 'modern') || 'classic';
  });

  const [accentColor, setAccentColor] = useState<'indigo' | 'emerald' | 'rose' | 'amber' | 'slate'>(() => {
    return (localStorage.getItem('ats_master_resume_accent_color') as any) || 'indigo';
  });

  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>(() => {
    return (localStorage.getItem('ats_master_resume_font_size') as any) || 'base';
  });

  const [sectionSpacing, setSectionSpacing] = useState<'compact' | 'normal' | 'spacious'>(() => {
    return (localStorage.getItem('ats_master_resume_section_spacing') as any) || 'normal';
  });

  const handleLayoutStyleChange = (style: 'classic' | 'executive' | 'modern') => {
    setLayoutStyle(style);
    localStorage.setItem('ats_master_resume_layout_style', style);
  };

  const handleAccentColorChange = (color: 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate') => {
    setAccentColor(color);
    localStorage.setItem('ats_master_resume_accent_color', color);
  };

  const handleFontSizeChange = (size: 'sm' | 'base' | 'lg') => {
    setFontSize(size);
    localStorage.setItem('ats_master_resume_font_size', size);
  };

  const handleSectionSpacingChange = (spacing: 'compact' | 'normal' | 'spacious') => {
    setSectionSpacing(spacing);
    localStorage.setItem('ats_master_resume_section_spacing', spacing);
  };

  const colorMap = {
    indigo: {
      text: 'text-indigo-600 dark:text-indigo-400',
      hoverText: 'hover:text-indigo-800 dark:hover:text-indigo-300',
      bg: 'bg-indigo-50 dark:bg-indigo-950/45',
      border: 'border-indigo-200 dark:border-indigo-900',
      focusRing: 'focus:ring-indigo-500',
      focusBorder: 'focus:border-indigo-600',
      accentBg: 'bg-indigo-600 text-white',
    },
    emerald: {
      text: 'text-emerald-600 dark:text-emerald-400',
      hoverText: 'hover:text-emerald-800 dark:hover:text-emerald-300',
      bg: 'bg-emerald-50 dark:bg-emerald-950/45',
      border: 'border-emerald-200 dark:border-emerald-900',
      focusRing: 'focus:ring-emerald-500',
      focusBorder: 'focus:border-emerald-600',
      accentBg: 'bg-emerald-600 text-white',
    },
    rose: {
      text: 'text-rose-600 dark:text-rose-400',
      hoverText: 'hover:text-rose-800 dark:hover:text-rose-300',
      bg: 'bg-rose-50 dark:bg-rose-950/45',
      border: 'border-rose-200 dark:border-rose-900',
      focusRing: 'focus:ring-rose-500',
      focusBorder: 'focus:border-rose-600',
      accentBg: 'bg-rose-600 text-white',
    },
    amber: {
      text: 'text-amber-600 dark:text-amber-400',
      hoverText: 'hover:text-amber-800 dark:hover:text-amber-300',
      bg: 'bg-amber-50 dark:bg-amber-950/45',
      border: 'border-amber-200 dark:border-amber-900',
      focusRing: 'focus:ring-amber-500',
      focusBorder: 'focus:border-amber-600',
      accentBg: 'bg-amber-600 text-white',
    },
    slate: {
      text: 'text-slate-700 dark:text-slate-300',
      hoverText: 'hover:text-slate-900 dark:hover:text-slate-100',
      bg: 'bg-slate-100 dark:bg-slate-850',
      border: 'border-slate-300 dark:border-slate-700',
      focusRing: 'focus:ring-slate-500',
      focusBorder: 'focus:border-slate-600',
      accentBg: 'bg-slate-800 dark:bg-slate-750 text-white',
    },
  };
  const activeColor = colorMap[accentColor];

  const spacingMap = {
    compact: {
      section: 'pt-3 space-y-1',
      list: 'space-y-1.5',
      item: 'space-y-0.5',
    },
    normal: {
      section: 'pt-6 space-y-2',
      list: 'space-y-4',
      item: 'space-y-1',
    },
    spacious: {
      section: 'pt-10 space-y-4',
      list: 'space-y-6',
      item: 'space-y-2',
    }
  };
  const activeSpacing = spacingMap[sectionSpacing];

  const fontMap = {
    sm: {
      name: 'text-xl',
      title: 'text-xs',
      heading: 'text-xs',
      body: 'text-[11px]',
      meta: 'text-[10px]'
    },
    base: {
      name: 'text-2xl',
      title: 'text-sm',
      heading: 'text-sm',
      body: 'text-xs',
      meta: 'text-xs'
    },
    lg: {
      name: 'text-3xl',
      title: 'text-base',
      heading: 'text-base',
      body: 'text-sm',
      meta: 'text-sm'
    }
  };
  const activeFont = fontMap[fontSize];
  const [enhancingBullet, setEnhancingBullet] = useState<{ expIdx: number; bulletIdx: number } | null>(null);
  const [bulletSuggestions, setBulletSuggestions] = useState<string[] | null>(null);
  const [isImproving, setIsImproving] = useState(false);

  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('ats_section_order');
    return saved ? JSON.parse(saved) : [
      'summary',
      'experience',
      'skills',
      'education',
      'projects',
      'certifications',
      'languages'
    ];
  });

  // Helper to dynamically check keyword presence in the resume text
  const checkLiveKeywordMatch = (term: string): boolean => {
    const normalizedTerm = term.toLowerCase().trim();
    if (normalizedTerm.length <= 1) return false;

    // Compile all current resume text to check keyword matches live
    const name = resumeData.contact.name || '';
    const title = resumeData.contact.title || '';
    const summary = resumeData.summary || '';
    const experienceStr = (resumeData.experience || []).map(exp => 
      `${exp.company || ''} ${exp.role || ''} ${exp.location || ''} ${(exp.bullets || []).join(' ')}`
    ).join(' ');
    const skillsStr = (resumeData.skills || []).map(s => 
      `${s.category || ''} ${(s.items || []).join(' ')}`
    ).join(' ');
    const educationStr = (resumeData.education || []).map(e => 
      `${e.institution || ''} ${e.degree || ''} ${e.location || ''}`
    ).join(' ');
    const certificationsStr = (resumeData.certifications || []).map(c => c.name).join(' ');
    const languagesStr = (resumeData.languages || []).join(' ');

    const fullText = `${name} ${title} ${summary} ${experienceStr} ${skillsStr} ${educationStr} ${certificationsStr} ${languagesStr}`.toLowerCase();
    return fullText.includes(normalizedTerm);
  };

  // Live ATS Scorer calculation
  const matchedKeywordsList = keywords.filter(k => checkLiveKeywordMatch(k.term));
  const missingKeywordsList = keywords.filter(k => !checkLiveKeywordMatch(k.term));
  const matchedCount = matchedKeywordsList.length;
  const totalCount = keywords.length;
  const liveScore = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 100;

  // AI Bullet point enhancer API integration
  const handleEnhanceBullet = async (expIdx: number, bulletIdx: number, originalText: string) => {
    setEnhancingBullet({ expIdx, bulletIdx });
    setIsImproving(true);
    setBulletSuggestions(null);
    try {
      const savedConfig = localStorage.getItem('ats_ai_config');
      const apiKey = savedConfig ? JSON.parse(savedConfig)?.apiKey : '';
      const savedModel = localStorage.getItem('ats_selected_model') || 'gemini-3.5-flash';
      const response = await fetch('/api/improve-bullet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-gemini-key': apiKey } : {}),
        },
        body: JSON.stringify({ bulletText: originalText, model: savedModel }),
      });
      if (!response.ok) throw new Error('Failed to improve bullet point.');
      const data = await response.json();
      setBulletSuggestions(data.suggestions || []);
    } catch (err) {
      console.error(err);
      showError('Failed to connect to the AI Bullet Enhancer. Please try again.', err);
      setEnhancingBullet(null);
    } finally {
      setIsImproving(false);
    }
  };

  const handleApplySuggestion = (suggestion: string) => {
    if (!enhancingBullet) return;
    const { expIdx, bulletIdx } = enhancingBullet;
    handleExperienceBulletChange(expIdx, bulletIdx, suggestion);
    setEnhancingBullet(null);
    setBulletSuggestions(null);
  };

  // Helper to highlight terms
  const renderHighlightedText = (text: string) => {
    if (!highlightKeywords || !keywords || keywords.length === 0) return text;

    // Create a regex from keywords, sorting by length descending to match longer phrases first
    const sortedTerms = [...keywords]
      .map((k) => k.term)
      .filter((t) => t.length > 2)
      .sort((a, b) => b.length - a.length);

    if (sortedTerms.length === 0) return text;

    // Escape regex characters
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

  // Safe handlers for nested edits
  const handleContactChange = (field: keyof typeof resumeData.contact, value: string) => {
    onUpdate({
      ...resumeData,
      contact: {
        ...resumeData.contact,
        [field]: value,
      },
    });
  };

  const handleSummaryChange = (value: string) => {
    onUpdate({
      ...resumeData,
      summary: value,
    });
  };

  const handleExperienceChange = (index: number, field: string, value: any) => {
    const updatedExperience = [...resumeData.experience];
    updatedExperience[index] = {
      ...updatedExperience[index],
      [field]: value,
    };
    onUpdate({
      ...resumeData,
      experience: updatedExperience,
    });
  };

  const handleAddExperience = () => {
    const newExp = {
      company: 'New Company',
      role: 'Role Title',
      location: 'Location',
      startDate: 'YYYY-MM',
      endDate: 'Present',
      bullets: ['Describe your achievements using action verbs and quantifiable impact.'],
    };
    onUpdate({
      ...resumeData,
      experience: [...resumeData.experience, newExp],
    });
  };

  const handleRemoveExperience = (index: number) => {
    const updatedExperience = resumeData.experience.filter((_, i) => i !== index);
    onUpdate({
      ...resumeData,
      experience: updatedExperience,
    });
  };

  const handleExperienceBulletChange = (expIndex: number, bulletIndex: number, value: string) => {
    const updatedExperience = [...resumeData.experience];
    const updatedBullets = [...updatedExperience[expIndex].bullets];
    updatedBullets[bulletIndex] = value;
    updatedExperience[expIndex] = {
      ...updatedExperience[expIndex],
      bullets: updatedBullets,
    };
    onUpdate({
      ...resumeData,
      experience: updatedExperience,
    });
  };

  const handleAddBullet = (expIndex: number) => {
    const updatedExperience = [...resumeData.experience];
    updatedExperience[expIndex] = {
      ...updatedExperience[expIndex],
      bullets: [...updatedExperience[expIndex].bullets, 'New achievement bullet point.'],
    };
    onUpdate({
      ...resumeData,
      experience: updatedExperience,
    });
  };

  const handleRemoveBullet = (expIndex: number, bulletIndex: number) => {
    const updatedExperience = [...resumeData.experience];
    const updatedBullets = updatedExperience[expIndex].bullets.filter((_, i) => i !== bulletIndex);
    updatedExperience[expIndex] = {
      ...updatedExperience[expIndex],
      bullets: updatedBullets,
    };
    onUpdate({
      ...resumeData,
      experience: updatedExperience,
    });
  };

  const handleSkillChange = (categoryIndex: number, field: 'category' | 'items', value: any) => {
    const updatedSkills = [...resumeData.skills];
    if (field === 'category') {
      updatedSkills[categoryIndex] = {
        ...updatedSkills[categoryIndex],
        category: value,
      };
    } else {
      updatedSkills[categoryIndex] = {
        ...updatedSkills[categoryIndex],
        items: value,
      };
    }
    onUpdate({
      ...resumeData,
      skills: updatedSkills,
    });
  };

  const handleAddSkillCategory = () => {
    const newCategory = {
      category: 'New Category',
      items: ['Skill A', 'Skill B'],
    };
    onUpdate({
      ...resumeData,
      skills: [...resumeData.skills, newCategory],
    });
  };

  const handleRemoveSkillCategory = (index: number) => {
    const updatedSkills = resumeData.skills.filter((_, i) => i !== index);
    onUpdate({
      ...resumeData,
      skills: updatedSkills,
    });
  };

  const handleEducationChange = (index: number, field: string, value: string) => {
    const updatedEducation = [...resumeData.education];
    updatedEducation[index] = {
      ...updatedEducation[index],
      [field]: value,
    };
    onUpdate({
      ...resumeData,
      education: updatedEducation,
    });
  };

  const handleAddEducation = () => {
    const newEdu = {
      institution: 'University Name',
      degree: 'Degree Program',
      location: 'City, State',
      graduationDate: 'YYYY-MM',
    };
    onUpdate({
      ...resumeData,
      education: [...resumeData.education, newEdu],
    });
  };

  const handleRemoveEducation = (index: number) => {
    const updatedEducation = resumeData.education.filter((_, i) => i !== index);
    onUpdate({
      ...resumeData,
      education: updatedEducation,
    });
  };

  const handleProjectChange = (index: number, field: string, value: any) => {
    const updatedProjects = [...(resumeData.projects || [])];
    updatedProjects[index] = {
      ...updatedProjects[index],
      [field]: value,
    };
    onUpdate({
      ...resumeData,
      projects: updatedProjects,
    });
  };

  const handleAddProject = () => {
    const newProj = {
      name: 'New Project',
      description: 'Project description details here.',
      technologies: ['React'],
      link: '',
    };
    onUpdate({
      ...resumeData,
      projects: [...(resumeData.projects || []), newProj],
    });
  };

  const handleRemoveProject = (index: number) => {
    const updatedProjects = (resumeData.projects || []).filter((_, i) => i !== index);
    onUpdate({
      ...resumeData,
      projects: updatedProjects,
    });
  };

  const handleCertificationChange = (index: number, field: string, value: string) => {
    const updatedCerts = [...(resumeData.certifications || [])];
    updatedCerts[index] = {
      ...updatedCerts[index],
      [field]: value,
    };
    onUpdate({
      ...resumeData,
      certifications: updatedCerts,
    });
  };

  const handleAddCertification = () => {
    const newCert = {
      name: 'Certification Name',
      issuer: 'Issuer',
      date: 'YYYY-MM',
    };
    onUpdate({
      ...resumeData,
      certifications: [...(resumeData.certifications || []), newCert],
    });
  };

  const handleRemoveCertification = (index: number) => {
    const updatedCerts = (resumeData.certifications || []).filter((_, i) => i !== index);
    onUpdate({
      ...resumeData,
      certifications: updatedCerts,
    });
  };

  const handleLanguageChange = (index: number, value: string) => {
    const updatedLangs = [...(resumeData.languages || [])];
    updatedLangs[index] = value;
    onUpdate({
      ...resumeData,
      languages: updatedLangs,
    });
  };

  const handleAddLanguage = () => {
    onUpdate({
      ...resumeData,
      languages: [...(resumeData.languages || []), 'New Language'],
    });
  };

  const handleRemoveLanguage = (index: number) => {
    const updatedLangs = (resumeData.languages || []).filter((_, i) => i !== index);
    onUpdate({
      ...resumeData,
      languages: updatedLangs,
    });
  };

  const handleExportDoc = () => {
    const exportFont = layoutStyle === 'executive' ? 'Georgia' : 'Arial';
    
    // Collect contact details string
    const contactParts = [
      resumeData.contact.email,
      resumeData.contact.phone,
      resumeData.contact.location,
    ];
    if (resumeData.contact.linkedin) {
      contactParts.push(resumeData.contact.linkedin);
    }
    if (resumeData.contact.website) {
      contactParts.push(resumeData.contact.website);
    }
    const contactString = contactParts.join('  •  ');

    // Section title generator helper to keep consistent styling
    const createSectionHeader = (title: string) => {
      return new Paragraph({
        spacing: { before: 360, after: 120 },
        children: [
          new TextRun({
            text: title.toUpperCase(),
            bold: true,
            size: 24, // 12pt
            font: exportFont,
            color: "0f172a", // slate-900
          }),
        ],
      });
    };

    const docChildren: any[] = [];

    // 1. Header: Name
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [
          new TextRun({
            text: resumeData.contact.name,
            bold: true,
            size: 32, // 16pt
            font: exportFont,
            color: "0f172a", // slate-900
          }),
        ],
      })
    );

    // 2. Header: Title
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
        children: [
          new TextRun({
            text: resumeData.contact.title.toUpperCase(),
            bold: true,
            size: 22, // 11pt
            font: exportFont,
            color: "4f46e5", // indigo-600
          }),
        ],
      })
    );

    // 3. Header: Contact info
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 240 },
        children: [
          new TextRun({
            text: contactString,
            size: 18, // 9pt
            font: exportFont,
            color: "64748b", // slate-500
          }),
        ],
      })
    );

    // Section generator map
    const sectionGenerators: Record<string, () => void> = {
      summary: () => {
        docChildren.push(createSectionHeader("Professional Summary"));
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.START,
            spacing: { before: 80, after: 180 },
            children: [
              new TextRun({
                text: resumeData.summary,
                size: 20, // 10pt
                font: exportFont,
                color: "334155", // slate-700
              }),
            ],
          })
        );
      },
      experience: () => {
        if (resumeData.experience && resumeData.experience.length > 0) {
          docChildren.push(createSectionHeader("Professional Experience"));
          resumeData.experience.forEach((job) => {
            // Job Role and Company
            docChildren.push(
              new Paragraph({
                spacing: { before: 180, after: 40 },
                children: [
                  new TextRun({
                    text: job.role,
                    bold: true,
                    size: 21, // 10.5pt
                    font: exportFont,
                    color: "0f172a", // slate-900
                  }),
                  new TextRun({
                    text: "  |  ",
                    size: 20,
                    font: exportFont,
                    color: "cbd5e1", // slate-300
                  }),
                  new TextRun({
                    text: job.company,
                    bold: true,
                    size: 21,
                    font: exportFont,
                    color: "4f46e5", // indigo-600
                  }),
                ],
              })
            );

            // Job Dates and Location
            docChildren.push(
              new Paragraph({
                spacing: { before: 0, after: 80 },
                children: [
                  new TextRun({
                    text: `${job.startDate} – ${job.endDate}  •  ${job.location}`,
                    size: 18, // 9pt
                    font: exportFont,
                    color: "64748b", // slate-500
                    italics: true,
                  }),
                ],
              })
            );

            // Job Bullets
            job.bullets.forEach((bullet) => {
              docChildren.push(
                new Paragraph({
                  bullet: { level: 0 },
                  spacing: { before: 30, after: 30 },
                  children: [
                    new TextRun({
                      text: bullet,
                      size: 19, // 9.5pt
                      font: exportFont,
                      color: "334155", // slate-700
                    }),
                  ],
                })
              );
            });
          });
        }
      },
      skills: () => {
        if (resumeData.skills && resumeData.skills.length > 0) {
          docChildren.push(createSectionHeader("Skills & Expertise"));
          resumeData.skills.forEach((skillCat) => {
            docChildren.push(
              new Paragraph({
                spacing: { before: 80, after: 60 },
                children: [
                  new TextRun({
                    text: `${skillCat.category}:  `,
                    bold: true,
                    size: 20, // 10pt
                    font: exportFont,
                    color: "0f172a", // slate-900
                  }),
                  new TextRun({
                    text: skillCat.items.join(', '),
                    size: 20,
                    font: exportFont,
                    color: "334155", // slate-700
                  }),
                ],
              })
            );
          });
        }
      },
      education: () => {
        if (resumeData.education && resumeData.education.length > 0) {
          docChildren.push(createSectionHeader("Education"));
          resumeData.education.forEach((edu) => {
            // Degree and Institution
            docChildren.push(
              new Paragraph({
                spacing: { before: 140, after: 40 },
                children: [
                  new TextRun({
                    text: edu.degree,
                    bold: true,
                    size: 21, // 10.5pt
                    font: exportFont,
                    color: "0f172a", // slate-900
                  }),
                  new TextRun({
                    text: "  –  ",
                    size: 20,
                    font: exportFont,
                    color: "cbd5e1", // slate-300
                  }),
                  new TextRun({
                    text: edu.institution,
                    size: 21,
                    font: exportFont,
                    color: "334155", // slate-700
                  }),
                ],
              })
            );

            // Location, Graduation and optional GPA
            const gpaText = edu.gpa ? `  •  GPA: ${edu.gpa}` : "";
            docChildren.push(
              new Paragraph({
                spacing: { before: 0, after: 80 },
                children: [
                  new TextRun({
                    text: `${edu.location}  •  Graduated: ${edu.graduationDate}${gpaText}`,
                    size: 18, // 9pt
                    font: exportFont,
                    color: "64748b", // slate-500
                    italics: true,
                  }),
                ],
              })
            );
          });
        }
      },
      projects: () => {
        if (resumeData.projects && resumeData.projects.length > 0) {
          docChildren.push(createSectionHeader("Projects"));
          resumeData.projects.forEach((proj) => {
            // Project name and optional link
            const linkRuns = proj.link ? [
              new TextRun({
                text: "  (Link: ",
                size: 18,
                font: exportFont,
                color: "64748b",
              }),
              new TextRun({
                text: proj.link,
                size: 18,
                font: exportFont,
                color: "4f46e5",
                italics: true,
              }),
              new TextRun({
                text: ")",
                size: 18,
                font: exportFont,
                color: "64748b",
              })
            ] : [];

            docChildren.push(
              new Paragraph({
                spacing: { before: 140, after: 40 },
                children: [
                  new TextRun({
                    text: proj.name,
                    bold: true,
                    size: 21,
                    font: exportFont,
                    color: "0f172a",
                  }),
                  ...linkRuns,
                ],
              })
            );

            // Project Description
            docChildren.push(
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: proj.description,
                    size: 20,
                    font: exportFont,
                    color: "334155",
                  }),
                ],
              })
            );

            // Project Technologies
            if (proj.technologies && proj.technologies.length > 0) {
              docChildren.push(
                new Paragraph({
                  spacing: { before: 0, after: 100 },
                  children: [
                    new TextRun({
                      text: "Technologies: ",
                      bold: true,
                      size: 18,
                      font: exportFont,
                      color: "64748b",
                    }),
                    new TextRun({
                      text: proj.technologies.join(', '),
                      size: 18,
                      font: exportFont,
                      color: "64748b",
                    }),
                  ],
                })
              );
            }
          });
        }
      },
      certifications: () => {
        if (resumeData.certifications && resumeData.certifications.length > 0) {
          docChildren.push(createSectionHeader("Certifications"));
          resumeData.certifications.forEach((cert) => {
            docChildren.push(
              new Paragraph({
                spacing: { before: 80, after: 60 },
                children: [
                  new TextRun({
                    text: cert.name,
                    bold: true,
                    size: 20,
                    font: exportFont,
                    color: "0f172a",
                  }),
                  new TextRun({
                    text: ` (${cert.issuer})`,
                    size: 20,
                    font: exportFont,
                    color: "334155",
                  }),
                  new TextRun({
                    text: `  •  ${cert.date}`,
                    size: 18,
                    font: exportFont,
                    color: "64748b",
                    italics: true,
                  }),
                ],
              })
            );
          });
        }
      },
      languages: () => {
        if (resumeData.languages && resumeData.languages.length > 0) {
          docChildren.push(createSectionHeader("Languages"));
          docChildren.push(
            new Paragraph({
              spacing: { before: 80, after: 80 },
              children: [
                new TextRun({
                  text: resumeData.languages.join('  •  '),
                  size: 20,
                  font: exportFont,
                  color: "334155",
                }),
              ],
            })
          );
        }
      }
    };

    // Append sections in selected order sequence
    sectionOrder.forEach((sectionId) => {
      const generator = sectionGenerators[sectionId];
      if (generator) {
        generator();
      }
    });

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
      a.download = `${resumeData.contact.name.replace(/\s+/g, '_')}_Tailored_Resume.docx`;
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
    const element = document.getElementById('printable-resume-canvas');
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

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-gemini-key': apiKey } : {}),
        },
        body: JSON.stringify({ htmlContent })
      });

      if (!response.ok) throw new Error('Failed to generate PDF on server');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resumeData.contact.name.replace(/\s+/g, '_')}_Tailored_Resume.pdf`;
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 animate-fade-in" id="resume-preview-root">
      {/* Control panel (Hidden on actual print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 print:hidden" id="preview-controls">
        <div className="flex flex-wrap items-center gap-3" id="preview-left-actions">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border ${
              isEditing
                ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
            id="toggle-edit-mode"
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            {isEditing ? 'Finish Editing' : 'Edit Resume'}
          </button>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/40 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800" id="preview-translation-selector">
            <span className="text-[9px] font-bold text-slate-400 uppercase px-1.5 flex items-center gap-1">
              <Globe className="w-3 h-3 text-indigo-500" /> Translate:
            </span>
            <button
              onClick={() => handleTranslateResume('en')}
              disabled={isTranslating}
              className={`text-[10px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                isTranslating
                  ? 'opacity-50 cursor-not-allowed'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-xs'
              } ${translatingLang === 'en' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' : ''}`}
              title="Translate to English"
              type="button"
            >
              {translatingLang === 'en' ? <Loader2 className="w-3 h-3 animate-spin text-indigo-500" /> : null}
              <span>EN</span>
            </button>
            <button
              onClick={() => handleTranslateResume('fr')}
              disabled={isTranslating}
              className={`text-[10px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                isTranslating
                  ? 'opacity-50 cursor-not-allowed'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-xs'
              } ${translatingLang === 'fr' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' : ''}`}
              title="Translate to French"
              type="button"
            >
              {translatingLang === 'fr' ? <Loader2 className="w-3 h-3 animate-spin text-indigo-500" /> : null}
              <span>FR</span>
            </button>
          </div>

          {!isEditing && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer" id="label-highlight">
              <input
                type="checkbox"
                checked={highlightKeywords}
                onChange={(e) => setHighlightKeywords(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                id="checkbox-highlight"
              />
              <span className="flex items-center gap-1">
                Highlight keywords
                <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {keywords.length} terms
                </span>
              </span>
            </label>
          )}

          {isEditing && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer" id="label-spellcheck">
              <input
                type="checkbox"
                checked={enableSpellcheck}
                onChange={(e) => setEnableSpellcheck(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                id="checkbox-spellcheck"
              />
              <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                ⚠️ Real-time Spellcheck
              </span>
            </label>
          )}

          {/* Dynamic Design Templates Style Selector */}
          <div className="flex flex-wrap items-center gap-2" id="design-customizer-toolbar">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/40 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800" id="layout-style-selector">
              <button
                onClick={() => handleLayoutStyleChange('classic')}
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${
                  layoutStyle === 'classic'
                    ? 'bg-white dark:bg-slate-850 text-indigo-700 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Classic stacked ATS template"
              >
                Classic
              </button>
              <button
                onClick={() => handleLayoutStyleChange('executive')}
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all font-serif cursor-pointer ${
                  layoutStyle === 'executive'
                    ? 'bg-white dark:bg-slate-850 text-indigo-700 dark:text-indigo-400 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Elegant Serif Executive layout"
              >
                Executive
              </button>
              <button
                onClick={() => handleLayoutStyleChange('modern')}
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${
                  layoutStyle === 'modern'
                    ? 'bg-white dark:bg-slate-850 text-indigo-700 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Modern 2-column sidebar layout"
              >
                Modern Columns
              </button>
            </div>

            {/* Accent Color Circles */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/40 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-slate-800">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Accent:</span>
              <div className="flex items-center gap-1">
                {(['indigo', 'emerald', 'rose', 'amber', 'slate'] as const).map(color => (
                  <button
                    key={color}
                    onClick={() => handleAccentColorChange(color)}
                    type="button"
                    className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                      color === 'indigo' ? 'bg-indigo-500' :
                      color === 'emerald' ? 'bg-emerald-500' :
                      color === 'rose' ? 'bg-rose-500' :
                      color === 'amber' ? 'bg-amber-500' : 'bg-slate-600'
                    } ${accentColor === color ? 'ring-2 ring-offset-1 ring-indigo-500 dark:ring-indigo-400 border-white' : 'border-transparent'}`}
                    title={`Set accent to ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Font Size Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/40 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800" id="font-size-selector">
              <span className="text-[9px] font-bold text-slate-400 uppercase px-1">Font:</span>
              {(['sm', 'base', 'lg'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => handleFontSizeChange(size)}
                  type="button"
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                    fontSize === size
                      ? 'bg-white dark:bg-slate-850 text-indigo-700 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {size === 'sm' ? 'A-' : size === 'base' ? 'A' : 'A+'}
                </button>
              ))}
            </div>

            {/* Section Spacing / Margin Density */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/40 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800" id="margin-density-selector">
              <span className="text-[9px] font-bold text-slate-400 uppercase px-1">Margins:</span>
              {(['compact', 'normal', 'spacious'] as const).map(spacing => (
                <button
                  key={spacing}
                  onClick={() => handleSectionSpacingChange(spacing)}
                  type="button"
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                    sectionSpacing === spacing
                      ? 'bg-white dark:bg-slate-850 text-indigo-700 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {spacing === 'compact' ? 'Tight' : spacing === 'normal' ? 'Norm' : 'Wide'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2" id="preview-right-actions">
          <button
            onClick={handleExportDoc}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
            id="btn-export-doc"
          >
            <FileDown className="w-4 h-4 text-indigo-500" />
            Word (.docx)
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            id="btn-export-direct-pdf"
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
            className="flex items-center gap-1.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 px-3 py-1.5 rounded-lg transition-all"
            id="btn-export-pdf"
          >
            <Printer className="w-4 h-4" />
            Print / System PDF
          </button>
        </div>
      </div>

      {translationToast && (
        <div 
          className={`flex items-start gap-3 p-4 rounded-xl text-xs font-semibold border print:hidden animate-fade-in ${
            translationToast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400'
              : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-400'
          }`}
          id="translation-toast-banner"
        >
          <div className="flex-1">{translationToast.message}</div>
          <button 
            onClick={() => setTranslationToast(null)} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Info notice about ATS formatting */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl p-4 text-xs leading-relaxed print:hidden flex items-start gap-2.5" id="ats-tip-notice">
        <Globe className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div>
          <strong>ATS Optimization Intelligence:</strong> Real-time matching automatically scores your resume text. The <strong>Georgia (Executive)</strong> and <strong>Inter (Classic)</strong> layouts preserve semantic styling rules perfectly readable by modern ATS parse filters.
        </div>
      </div>

      {/* Ultimate Premium Sidebar Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in" id="resume-preview-workspace">
        
        {/* Left Side: Live ATS Scorer & Keywords checklist */}
        <div className="lg:col-span-1 space-y-4 print:hidden" id="ats-realtime-panel">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs sticky top-4 space-y-4">
            <div className="text-center pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live ATS Match Rating</h3>
              <div className="mt-3 flex items-center justify-center">
                <div className="relative w-24 h-24 flex flex-col items-center justify-center rounded-full bg-slate-50 dark:bg-slate-950/60 border-4 border-slate-100 dark:border-slate-800">
                  <span className={`text-2xl font-extrabold tracking-tight ${
                    liveScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : liveScore >= 50 ? 'text-amber-500' : 'text-rose-500 dark:text-rose-400'
                  }`}>
                    {liveScore}%
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">MATCH</span>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {matchedCount} of {totalCount} keywords integrated
                </p>
                <div className="w-full bg-slate-100 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      liveScore >= 80 ? 'bg-emerald-500' : liveScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${liveScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Keyword Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ATS Keyword Checklist</h4>
                <span className="text-[8px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">LIVE</span>
              </div>

              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1 text-xs">
                {keywords.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No targeted keywords present. Upload a job description to extract target keywords.</p>
                ) : (
                  keywords.map((kw, idx) => {
                    const isMatched = checkLiveKeywordMatch(kw.term);
                    return (
                      <div 
                        key={idx} 
                        className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                          isMatched 
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-300' 
                            : 'bg-slate-50/60 dark:bg-slate-950/20 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <span className="font-semibold truncate max-w-[120px]" title={kw.term}>
                          {kw.term}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isMatched ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                          )}
                          <span className={`text-[8px] font-bold ${
                            isMatched ? 'text-emerald-700 dark:text-emerald-450' : 'text-slate-400'
                          }`}>
                            {isMatched ? 'MATCHED' : 'MISSING'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Section Reordering Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3" id="section-reordering-card">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800" id="section-reordering-header">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-indigo-500 font-bold text-sm">⇅</span> Section Ordering
              </h4>
              <button
                onClick={() => {
                  const defaultOrder = [
                    'summary',
                    'experience',
                    'skills',
                    'education',
                    'projects',
                    'certifications',
                    'languages'
                  ];
                  setSectionOrder(defaultOrder);
                  localStorage.setItem('ats_section_order', JSON.stringify(defaultOrder));
                }}
                className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                id="btn-reset-order"
              >
                Reset
              </button>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Arrange sections dynamically to control order on canvas and exports:
            </p>

            <div className="space-y-1" id="section-order-list">
              {sectionOrder.map((sectionId, idx) => {
                const sectionLabels: Record<string, string> = {
                  summary: 'Professional Summary',
                  experience: 'Work Experience',
                  skills: 'Skills & Expertise',
                  education: 'Education History',
                  projects: 'Key Projects',
                  certifications: 'Certifications',
                  languages: 'Languages',
                };

                const handleMove = (direction: 'up' | 'down') => {
                  const newOrder = [...sectionOrder];
                  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
                  if (targetIdx < 0 || targetIdx >= newOrder.length) return;
                  
                  // Swap
                  const temp = newOrder[idx];
                  newOrder[idx] = newOrder[targetIdx];
                  newOrder[targetIdx] = temp;
                  
                  setSectionOrder(newOrder);
                  localStorage.setItem('ats_section_order', JSON.stringify(newOrder));
                };

                return (
                  <div 
                    key={sectionId}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50/60 dark:bg-slate-950/45 border border-slate-100 dark:border-slate-850 text-[11px] text-slate-700 dark:text-slate-300 font-medium transition-all hover:bg-slate-100/50 dark:hover:bg-slate-900/60"
                    id={`section-order-item-${sectionId}`}
                  >
                    <span className="truncate">{sectionLabels[sectionId] || sectionId}</span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMove('up')}
                        className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-35 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                        title="Move up"
                        id={`btn-move-up-${sectionId}`}
                      >
                        ▲
                      </button>
                      <button
                        disabled={idx === sectionOrder.length - 1}
                        onClick={() => handleMove('down')}
                        className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-35 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                        title="Move down"
                        id={`btn-move-down-${sectionId}`}
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: The Interactive Resume Sheet */}
        <div className="lg:col-span-3 space-y-4" id="resume-sheet-panel">
          <div
            className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl text-slate-800 dark:text-slate-100 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0 print:max-w-full ${
              layoutStyle === 'executive' ? 'font-serif' : 'font-sans'
            } ${
              sectionSpacing === 'compact' ? 'p-4 md:p-6' : sectionSpacing === 'normal' ? 'p-8 md:p-12' : 'p-12 md:p-16'
            } ${activeFont.body}`}
            style={{ 
              fontFamily: layoutStyle === 'executive' ? '"Georgia", serif' : '"Inter", sans-serif',
              lineHeight: '1.5'
            }}
            id="printable-resume-canvas"
          >
            {/* 1. CLASSIC STACKED LAYOUT */}
            {layoutStyle === 'classic' && (
              <div 
                className={`animate-fade-in flex flex-col ${
                  sectionSpacing === 'compact' ? 'gap-y-3' : sectionSpacing === 'normal' ? 'gap-y-6' : 'gap-y-8'
                }`} 
                id="classic-layout-container"
              >
                {/* Contact Info Header */}
                <div className="text-center space-y-2 border-b pb-6 border-slate-200" id="resume-header" style={{ order: -1 }}>
          {isEditing ? (
            <div className="space-y-2 max-w-md mx-auto" id="edit-header-fields">
              <SpellcheckField
                type="input"
                value={resumeData.contact.name}
                onChange={(val) => handleContactChange('name', val)}
                className="w-full text-center text-2xl font-bold border-b border-indigo-200 focus:outline-none focus:border-indigo-600 p-1 bg-transparent dark:text-white"
                placeholder="Full Name"
                ignoredWords={ignoredWords}
                onIgnoreWord={handleIgnoreWord}
                enableSpellcheck={enableSpellcheck}
              />
              <SpellcheckField
                type="input"
                value={resumeData.contact.title}
                onChange={(val) => handleContactChange('title', val)}
                className="w-full text-center text-base text-slate-600 dark:text-slate-300 border-b border-indigo-200 focus:outline-none focus:border-indigo-600 p-1 bg-transparent"
                placeholder="Target Job Title"
                ignoredWords={ignoredWords}
                onIgnoreWord={handleIgnoreWord}
                enableSpellcheck={enableSpellcheck}
              />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <SpellcheckField
                  type="input"
                  value={resumeData.contact.email}
                  onChange={(val) => handleContactChange('email', val)}
                  className="border-b border-indigo-200 focus:outline-none focus:border-indigo-600 p-1 bg-transparent dark:text-slate-100"
                  placeholder="Email Address"
                  ignoredWords={ignoredWords}
                  onIgnoreWord={handleIgnoreWord}
                  enableSpellcheck={enableSpellcheck}
                />
                <SpellcheckField
                  type="input"
                  value={resumeData.contact.phone}
                  onChange={(val) => handleContactChange('phone', val)}
                  className="border-b border-indigo-200 focus:outline-none focus:border-indigo-600 p-1 bg-transparent dark:text-slate-100"
                  placeholder="Phone Number"
                  ignoredWords={ignoredWords}
                  onIgnoreWord={handleIgnoreWord}
                  enableSpellcheck={enableSpellcheck}
                />
                <div className="col-span-2">
                  <SpellcheckField
                    type="input"
                    value={resumeData.contact.location}
                    onChange={(val) => handleContactChange('location', val)}
                    className="border-b border-indigo-200 focus:outline-none focus:border-indigo-600 p-1 text-center w-full bg-transparent dark:text-slate-100"
                    placeholder="City, State"
                    ignoredWords={ignoredWords}
                    onIgnoreWord={handleIgnoreWord}
                    enableSpellcheck={enableSpellcheck}
                  />
                </div>
                <SpellcheckField
                  type="input"
                  value={resumeData.contact.linkedin || ''}
                  onChange={(val) => handleContactChange('linkedin', val)}
                  className="border-b border-indigo-200 focus:outline-none focus:border-indigo-600 p-1 bg-transparent dark:text-slate-100"
                  placeholder="LinkedIn URL"
                  ignoredWords={ignoredWords}
                  onIgnoreWord={handleIgnoreWord}
                  enableSpellcheck={enableSpellcheck}
                />
                <SpellcheckField
                  type="input"
                  value={resumeData.contact.website || ''}
                  onChange={(val) => handleContactChange('website', val)}
                  className="border-b border-indigo-200 focus:outline-none focus:border-indigo-600 p-1 bg-transparent dark:text-slate-100"
                  placeholder="Personal Website"
                  ignoredWords={ignoredWords}
                  onIgnoreWord={handleIgnoreWord}
                  enableSpellcheck={enableSpellcheck}
                />
              </div>
            </div>
          ) : (
            <div id="preview-header-fields">
              <h1 className={`${activeFont.name} font-extrabold text-slate-900 dark:text-white tracking-tight`}>{resumeData.contact.name}</h1>
              <p className={`${activeFont.title} font-semibold ${activeColor.text} tracking-wide uppercase`}>{resumeData.contact.title}</p>
              <div className="text-xs text-slate-500 flex flex-wrap justify-center gap-x-3 gap-y-1 pt-1 font-mono">
                <span>{resumeData.contact.email}</span>
                <span>•</span>
                <span>{resumeData.contact.phone}</span>
                <span>•</span>
                <span>{resumeData.contact.location}</span>
                {resumeData.contact.linkedin && (
                  <>
                    <span>•</span>
                    <span>{resumeData.contact.linkedin}</span>
                  </>
                )}
                {resumeData.contact.website && (
                  <>
                    <span>•</span>
                    <span>{resumeData.contact.website}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Professional Summary */}
        <div className={`${sectionSpacing === 'compact' ? 'pt-3 space-y-1' : sectionSpacing === 'normal' ? 'pt-6 space-y-2' : 'pt-8 space-y-3'}`} id="resume-summary-section" style={{ order: sectionOrder.indexOf('summary') }}>
          <h2 className={`${activeFont.heading} font-bold text-slate-950 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1`}>
            Professional Summary
          </h2>
          {isEditing ? (
            <SpellcheckField
              type="textarea"
              value={resumeData.summary}
              onChange={handleSummaryChange}
              className={`w-full text-xs text-slate-700 dark:text-slate-250 leading-relaxed p-2 border ${activeColor.border} rounded focus:outline-none focus:ring-1 ${activeColor.focusRing} bg-transparent`}
              rows={4}
              ignoredWords={ignoredWords}
              onIgnoreWord={handleIgnoreWord}
              enableSpellcheck={enableSpellcheck}
            />
          ) : (
            <p className={`${activeFont.body} text-slate-700 dark:text-slate-300 leading-relaxed text-justify`}>
              {renderHighlightedText(resumeData.summary)}
            </p>
          )}
        </div>

        {/* Experience Section */}
        <div className={`${sectionSpacing === 'compact' ? 'pt-3' : sectionSpacing === 'normal' ? 'pt-6' : 'pt-8'}`} id="resume-experience-section" style={{ order: sectionOrder.indexOf('experience') }}>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-3">
            <h2 className={`${activeFont.heading} font-bold text-slate-950 dark:text-white uppercase tracking-wider`}>
              Professional Experience
            </h2>
            {isEditing && (
              <button
                onClick={handleAddExperience}
                className={`flex items-center gap-1 text-[10px] font-bold ${activeColor.text} ${activeColor.hoverText} ${activeColor.bg} px-2 py-1 rounded cursor-pointer`}
                id="btn-add-experience"
              >
                <Plus className="w-3 h-3" /> Add Experience
              </button>
            )}
          </div>

          <div className="space-y-5" id="experience-list-container">
            {(resumeData.experience || []).map((job, expIdx) => (
              <div key={expIdx} className="space-y-1.5 relative group" id={`preview-job-${expIdx}`}>
                {isEditing && (
                  <button
                    onClick={() => handleRemoveExperience(expIdx)}
                    className="absolute -right-2 -top-2 text-rose-500 hover:text-rose-700 bg-rose-50 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    id={`btn-remove-exp-${expIdx}`}
                    title="Delete this role"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {isEditing ? (
                  <div className="grid grid-cols-2 gap-2 text-xs p-2 bg-slate-50 dark:bg-slate-850 rounded animate-fade-in" id={`edit-job-fields-${expIdx}`}>
                    <SpellcheckField
                      type="input"
                      value={job.role}
                      onChange={(val) => handleExperienceChange(expIdx, 'role', val)}
                      className="font-bold border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                      placeholder="Role Title"
                      ignoredWords={ignoredWords}
                      onIgnoreWord={handleIgnoreWord}
                      enableSpellcheck={enableSpellcheck}
                    />
                    <SpellcheckField
                      type="input"
                      value={job.company}
                      onChange={(val) => handleExperienceChange(expIdx, 'company', val)}
                      className="font-bold border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                      placeholder="Company Name"
                      ignoredWords={ignoredWords}
                      onIgnoreWord={handleIgnoreWord}
                      enableSpellcheck={enableSpellcheck}
                    />
                    <SpellcheckField
                      type="input"
                      value={job.startDate}
                      onChange={(val) => handleExperienceChange(expIdx, 'startDate', val)}
                      className="border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                      placeholder="Start Date (YYYY-MM)"
                      ignoredWords={ignoredWords}
                      onIgnoreWord={handleIgnoreWord}
                      enableSpellcheck={enableSpellcheck}
                    />
                    <SpellcheckField
                      type="input"
                      value={job.endDate}
                      onChange={(val) => handleExperienceChange(expIdx, 'endDate', val)}
                      className="border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                      placeholder="End Date"
                      ignoredWords={ignoredWords}
                      onIgnoreWord={handleIgnoreWord}
                      enableSpellcheck={enableSpellcheck}
                    />
                    <div className="col-span-2">
                      <SpellcheckField
                        type="input"
                        value={job.location}
                        onChange={(val) => handleExperienceChange(expIdx, 'location', val)}
                        className="border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                        placeholder="Location"
                        ignoredWords={ignoredWords}
                        onIgnoreWord={handleIgnoreWord}
                        enableSpellcheck={enableSpellcheck}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs" id={`preview-job-header-${expIdx}`}>
                    <span className="font-bold text-slate-900 text-[13px] dark:text-white">
                      {job.role} <span className="font-normal text-slate-400">|</span> <span className="text-indigo-600 font-semibold">{job.company}</span>
                    </span>
                    <span className="text-slate-500 font-mono text-[11px] pt-0.5 sm:pt-0">
                      {job.startDate} – {job.endDate} • {job.location}
                    </span>
                  </div>
                )}

                {/* Bullet Points */}
                <ul className="list-disc list-outside ml-4 space-y-1 text-xs text-slate-700" id={`job-bullets-${expIdx}`}>
                  {(job.bullets || []).map((bullet, bulletIdx) => (
                    <li key={bulletIdx} className="relative group/bullet leading-relaxed text-justify" id={`job-bullet-item-${expIdx}-${bulletIdx}`}>
                      {isEditing ? (
                        <div className="flex items-start gap-1 w-full" id={`edit-bullet-${expIdx}-${bulletIdx}`}>
                          <SpellcheckField
                            type="textarea"
                            value={bullet}
                            onChange={(val) => handleExperienceBulletChange(expIdx, bulletIdx, val)}
                            className="w-full text-xs text-slate-700 dark:text-slate-200 p-1 border border-indigo-100 dark:border-indigo-900 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-transparent"
                            rows={1}
                            ignoredWords={ignoredWords}
                            onIgnoreWord={handleIgnoreWord}
                            enableSpellcheck={enableSpellcheck}
                          />
                          <button
                            onClick={() => handleRemoveBullet(expIdx, bulletIdx)}
                            className="text-rose-500 hover:text-rose-700 p-1 mt-0.5"
                            id={`btn-remove-bullet-${expIdx}-${bulletIdx}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span>{renderHighlightedText(bullet)}</span>
                      )}
                    </li>
                  ))}
                </ul>

                {isEditing && (
                  <button
                    onClick={() => handleAddBullet(expIdx)}
                    className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-0.5 mt-1"
                    id={`btn-add-bullet-${expIdx}`}
                  >
                    <Plus className="w-3 h-3" /> Add Bullet Point
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Skills Section */}
        <div className="pt-6 space-y-2.5" id="resume-skills-section" style={{ order: sectionOrder.indexOf('skills') }}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
            <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider">
              Skills & Expertise
            </h2>
            {isEditing && (
              <button
                onClick={handleAddSkillCategory}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded"
                id="btn-add-skill-cat"
              >
                <Plus className="w-3 h-3" /> Add Category
              </button>
            )}
          </div>

          <div className="space-y-2 text-xs" id="skills-list-container">
            {(resumeData.skills || []).map((skillCat, idx) => (
              <div key={idx} className="relative group/skill flex flex-col sm:flex-row sm:items-start gap-1" id={`skill-category-${idx}`}>
                {isEditing && (
                  <button
                    onClick={() => handleRemoveSkillCategory(idx)}
                    className="absolute right-0 top-0 text-rose-500 hover:text-rose-700 bg-rose-50 p-1 rounded-full opacity-0 group-hover/skill:opacity-100 transition-opacity"
                    id={`btn-remove-skill-cat-${idx}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}

                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full p-1 bg-slate-50 dark:bg-slate-850 rounded animate-fade-in" id={`edit-skill-fields-${idx}`}>
                    <SpellcheckField
                      type="input"
                      value={skillCat.category}
                      onChange={(val) => handleSkillChange(idx, 'category', val)}
                      className="font-bold border-b border-indigo-100 text-xs focus:outline-none bg-transparent text-slate-800 dark:text-slate-100"
                      placeholder="Category Name"
                      ignoredWords={ignoredWords}
                      onIgnoreWord={handleIgnoreWord}
                      enableSpellcheck={enableSpellcheck}
                    />
                    <div className="sm:col-span-2">
                      <SpellcheckField
                        type="input"
                        value={skillCat.items.join(', ')}
                        onChange={(val) => handleSkillChange(idx, 'items', val.split(',').map((s) => s.trim()))}
                        className="border-b border-indigo-100 text-xs focus:outline-none w-full bg-transparent text-slate-800 dark:text-slate-100"
                        placeholder="Skill, Skill, Skill (comma separated)"
                        ignoredWords={ignoredWords}
                        onIgnoreWord={handleIgnoreWord}
                        enableSpellcheck={enableSpellcheck}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="font-bold text-slate-900 w-full sm:w-1/4" id={`skill-cat-title-${idx}`}>
                      {skillCat.category}:
                    </span>
                    <span className="text-slate-700 w-full sm:w-3/4" id={`skill-cat-items-${idx}`}>
                      {(skillCat.items || []).map((item, itemIdx) => (
                        <span key={itemIdx}>
                          {renderHighlightedText(item)}
                          {itemIdx < (skillCat.items || []).length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Education Section */}
        <div className="pt-6 space-y-3" id="resume-education-section" style={{ order: sectionOrder.indexOf('education') }}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
            <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider">
              Education
            </h2>
            {isEditing && (
              <button
                onClick={handleAddEducation}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded"
                id="btn-add-education"
              >
                <Plus className="w-3 h-3" /> Add Education
              </button>
            )}
          </div>

          <div className="space-y-3" id="education-list-container">
            {(resumeData.education || []).map((edu, idx) => (
              <div key={idx} className="relative group/edu text-xs space-y-0.5" id={`education-item-${idx}`}>
                {isEditing && (
                  <button
                    onClick={() => handleRemoveEducation(idx)}
                    className="absolute right-0 top-0 text-rose-500 hover:text-rose-700 bg-rose-50 p-1 rounded-full opacity-0 group-hover/edu:opacity-100 transition-opacity"
                    id={`btn-remove-edu-${idx}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}

                {isEditing ? (
                  <div className="grid grid-cols-2 gap-2 w-full p-2 bg-slate-50 dark:bg-slate-850 rounded animate-fade-in" id={`edit-edu-fields-${idx}`}>
                    <SpellcheckField
                      type="input"
                      value={edu.degree}
                      onChange={(val) => handleEducationChange(idx, 'degree', val)}
                      className="font-bold border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                      placeholder="Degree & Major"
                      ignoredWords={ignoredWords}
                      onIgnoreWord={handleIgnoreWord}
                      enableSpellcheck={enableSpellcheck}
                    />
                    <SpellcheckField
                      type="input"
                      value={edu.institution}
                      onChange={(val) => handleEducationChange(idx, 'institution', val)}
                      className="font-bold border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                      placeholder="Institution Name"
                      ignoredWords={ignoredWords}
                      onIgnoreWord={handleIgnoreWord}
                      enableSpellcheck={enableSpellcheck}
                    />
                    <SpellcheckField
                      type="input"
                      value={edu.graduationDate}
                      onChange={(val) => handleEducationChange(idx, 'graduationDate', val)}
                      className="border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                      placeholder="Graduation Date"
                      ignoredWords={ignoredWords}
                      onIgnoreWord={handleIgnoreWord}
                      enableSpellcheck={enableSpellcheck}
                    />
                    <SpellcheckField
                      type="input"
                      value={edu.gpa || ''}
                      onChange={(val) => handleEducationChange(idx, 'gpa', val)}
                      className="border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                      placeholder="GPA (optional)"
                      ignoredWords={ignoredWords}
                      onIgnoreWord={handleIgnoreWord}
                      enableSpellcheck={enableSpellcheck}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs font-bold text-slate-900" id={`edu-header-${idx}`}>
                      <span>{edu.degree}</span>
                      <span className="font-mono font-normal text-slate-500">{edu.graduationDate}</span>
                    </div>
                    <div className="text-xs text-slate-600 flex justify-between" id={`edu-sub-${idx}`}>
                      <span>{edu.institution} • {edu.location}</span>
                      {edu.gpa && <span className="font-mono text-slate-500">GPA: {edu.gpa}</span>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Projects Section */}
        {((resumeData.projects && resumeData.projects.length > 0) || isEditing) && (
          <div className="pt-6 space-y-3" id="resume-projects-section" style={{ order: sectionOrder.indexOf('projects') }}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider">
                Projects
              </h2>
              {isEditing && (
                <button
                  onClick={handleAddProject}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded"
                  id="btn-add-project"
                >
                  <Plus className="w-3 h-3" /> Add Project
                </button>
              )}
            </div>

            <div className="space-y-4" id="projects-list-container">
              {(resumeData.projects || []).map((proj, idx) => (
                <div key={idx} className="relative group/proj text-xs space-y-1" id={`project-item-${idx}`}>
                  {isEditing && (
                    <button
                      onClick={() => handleRemoveProject(idx)}
                      className="absolute right-0 top-0 text-rose-500 hover:text-rose-700 bg-rose-50 p-1 rounded-full opacity-0 group-hover/proj:opacity-100 transition-opacity"
                      id={`btn-remove-proj-${idx}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-2 w-full p-2 bg-slate-50 dark:bg-slate-850 rounded animate-fade-in" id={`edit-proj-fields-${idx}`}>
                      <SpellcheckField
                        type="input"
                        value={proj.name}
                        onChange={(val) => handleProjectChange(idx, 'name', val)}
                        className="font-bold border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100"
                        placeholder="Project Name"
                        ignoredWords={ignoredWords}
                        onIgnoreWord={handleIgnoreWord}
                        enableSpellcheck={enableSpellcheck}
                      />
                      <SpellcheckField
                        type="input"
                        value={proj.link || ''}
                        onChange={(val) => handleProjectChange(idx, 'link', val)}
                        className="border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100"
                        placeholder="Project Link (Optional)"
                        ignoredWords={ignoredWords}
                        onIgnoreWord={handleIgnoreWord}
                        enableSpellcheck={enableSpellcheck}
                      />
                      <div className="col-span-2">
                        <SpellcheckField
                          type="input"
                          value={(proj.technologies || []).join(', ')}
                          onChange={(val) => handleProjectChange(idx, 'technologies', val.split(',').map((s) => s.trim()))}
                          className="border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                          placeholder="Technologies (Comma Separated)"
                          ignoredWords={ignoredWords}
                          onIgnoreWord={handleIgnoreWord}
                          enableSpellcheck={enableSpellcheck}
                        />
                      </div>
                      <div className="col-span-2">
                        <SpellcheckField
                          type="textarea"
                          value={proj.description}
                          onChange={(val) => handleProjectChange(idx, 'description', val)}
                          className="border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                          placeholder="Project Description"
                          rows={2}
                          ignoredWords={ignoredWords}
                          onIgnoreWord={handleIgnoreWord}
                          enableSpellcheck={enableSpellcheck}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs font-bold text-slate-900" id={`proj-header-${idx}`}>
                        <div className="flex items-center gap-1.5">
                          <span>{renderHighlightedText(proj.name)}</span>
                          {proj.link && (
                            <span className="text-slate-400 font-mono font-normal text-[10px] hover:text-indigo-600">
                              ({proj.link})
                            </span>
                          )}
                        </div>
                        {proj.technologies && proj.technologies.length > 0 && (
                          <span className="font-mono text-[10px] font-normal text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                            {proj.technologies.join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed" id={`proj-desc-${idx}`}>
                        {renderHighlightedText(proj.description)}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications Section */}
        {((resumeData.certifications && resumeData.certifications.length > 0) || isEditing) && (
          <div className="pt-6 space-y-2" id="resume-certifications-section" style={{ order: sectionOrder.indexOf('certifications') }}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider">
                Certifications
              </h2>
              {isEditing && (
                <button
                  onClick={handleAddCertification}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded"
                  id="btn-add-certification"
                >
                  <Plus className="w-3 h-3" /> Add Certification
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs" id="certs-list">
              {(resumeData.certifications || []).map((cert, idx) => (
                <div key={idx} className="relative group/cert flex justify-between items-center text-slate-700" id={`cert-item-${idx}`}>
                  {isEditing ? (
                    <div className="grid grid-cols-3 gap-1 w-full p-2 bg-slate-50 dark:bg-slate-850 rounded animate-fade-in" id={`edit-cert-fields-${idx}`}>
                      <SpellcheckField
                        type="input"
                        value={cert.name}
                        onChange={(val) => handleCertificationChange(idx, 'name', val)}
                        className="font-medium border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                        placeholder="Certification Name"
                        ignoredWords={ignoredWords}
                        onIgnoreWord={handleIgnoreWord}
                        enableSpellcheck={enableSpellcheck}
                      />
                      <SpellcheckField
                        type="input"
                        value={cert.issuer}
                        onChange={(val) => handleCertificationChange(idx, 'issuer', val)}
                        className="border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100 w-full"
                        placeholder="Issuer"
                        ignoredWords={ignoredWords}
                        onIgnoreWord={handleIgnoreWord}
                        enableSpellcheck={enableSpellcheck}
                      />
                      <div className="flex gap-1 items-center">
                        <SpellcheckField
                          type="input"
                          value={cert.date}
                          onChange={(val) => handleCertificationChange(idx, 'date', val)}
                          className="w-full border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100"
                          placeholder="Date"
                          ignoredWords={ignoredWords}
                          onIgnoreWord={handleIgnoreWord}
                          enableSpellcheck={enableSpellcheck}
                        />
                        <button
                          onClick={() => handleRemoveCertification(idx)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{renderHighlightedText(cert.name)}</span>
                        {cert.issuer && <span className="text-[10px] text-slate-500">{cert.issuer}</span>}
                      </div>
                      <span className="text-slate-500 font-mono text-[10px]">{cert.date}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Languages Section */}
        {((resumeData.languages && resumeData.languages.length > 0) || isEditing) && (
          <div className="pt-6 space-y-2" id="resume-languages-section" style={{ order: sectionOrder.indexOf('languages') }}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider">
                Languages
              </h2>
              {isEditing && (
                <button
                  onClick={handleAddLanguage}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded"
                  id="btn-add-language"
                >
                  <Plus className="w-3 h-3" /> Add Language
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs" id="edit-langs-list">
                {(resumeData.languages || []).map((lang, idx) => (
                  <div key={idx} className="flex gap-1 items-center p-2 bg-slate-50 dark:bg-slate-850 rounded">
                    <SpellcheckField
                      type="input"
                      value={lang}
                      onChange={(val) => handleLanguageChange(idx, val)}
                      className="flex-grow border-b border-indigo-100 focus:outline-none bg-transparent text-slate-800 dark:text-slate-100"
                      placeholder="Language & Proficiency"
                      ignoredWords={ignoredWords}
                      onIgnoreWord={handleIgnoreWord}
                      enableSpellcheck={enableSpellcheck}
                    />
                    <button
                      onClick={() => handleRemoveLanguage(idx)}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-700 font-medium" id="langs-list">
                {(resumeData.languages || []).join(' • ')}
              </div>
            )}
          </div>
        )}
              </div>
            )}

            {/* 2. EXECUTIVE SERIF LAYOUT */}
            {layoutStyle === 'executive' && (
              <div className="animate-fade-in text-slate-900 flex flex-col gap-y-6 font-serif" id="executive-layout-container">
                {/* Header block centered */}
                <div className="text-center space-y-2 pb-4 border-b-4 border-double border-slate-800" id="executive-header" style={{ order: -1 }}>
                  {isEditing ? (
                    <div className="space-y-2 max-w-md mx-auto font-sans" id="executive-edit-header">
                      <input
                        type="text"
                        value={resumeData.contact.name}
                        onChange={(e) => handleContactChange('name', e.target.value)}
                        className="w-full text-center text-2xl font-bold border-b border-slate-300 p-1 font-serif"
                        placeholder="Full Name"
                      />
                      <input
                        type="text"
                        value={resumeData.contact.title}
                        onChange={(e) => handleContactChange('title', e.target.value)}
                        className="w-full text-center text-xs text-slate-600 border-b border-slate-300 p-1 font-serif"
                        placeholder="Job Title / Target Focus"
                      />
                    </div>
                  ) : (
                    <div id="executive-view-header">
                      <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight font-serif uppercase">{resumeData.contact.name}</h1>
                      <p className="text-sm font-bold text-slate-700 tracking-widest uppercase mt-1 font-serif italic">{resumeData.contact.title}</p>
                      <div className="text-xs text-slate-600 flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 font-serif">
                        <span>{resumeData.contact.email}</span>
                        <span>•</span>
                        <span>{resumeData.contact.phone}</span>
                        <span>•</span>
                        <span>{resumeData.contact.location}</span>
                        {resumeData.contact.linkedin && (
                          <>
                            <span>•</span>
                            <span>{resumeData.contact.linkedin}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="space-y-2" id="executive-summary-section" style={{ order: sectionOrder.indexOf('summary') }}>
                  <h2 className="text-xs font-bold text-slate-950 uppercase tracking-widest text-center border-b-2 border-slate-950 pb-0.5">
                    Professional Statement
                  </h2>
                  <p className="text-[12px] text-slate-850 leading-relaxed text-justify italic">
                    {renderHighlightedText(resumeData.summary)}
                  </p>
                </div>

                {/* Experience */}
                <div className="space-y-3" id="executive-experience-section" style={{ order: sectionOrder.indexOf('experience') }}>
                  <h2 className="text-xs font-bold text-slate-950 uppercase tracking-widest text-center border-b-2 border-slate-950 pb-0.5">
                    Chronology of Experience
                  </h2>
                  <div className="space-y-4">
                    {(resumeData.experience || []).map((job, expIdx) => (
                      <div key={expIdx} className="space-y-1 relative group text-xs" id={`executive-job-${expIdx}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between font-bold text-slate-950">
                          <span className="text-[13px]">
                            {job.role} <span className="font-normal text-slate-400">|</span> <span className="text-slate-850 italic">{job.company}</span>
                          </span>
                          <span className="text-[10px] text-slate-600 font-normal italic">
                            {job.startDate} – {job.endDate} • {job.location}
                          </span>
                        </div>
                        <ul className="list-disc list-outside ml-4 space-y-1 text-[11px] text-slate-800">
                          {(job.bullets || []).map((bullet, bulletIdx) => (
                            <li key={bulletIdx} className="leading-relaxed text-justify relative group/bullet" id={`executive-bullet-${expIdx}-${bulletIdx}`}>
                              {renderHighlightedText(bullet)}
                              <button
                                onClick={() => {
                                  setIsEditing(true);
                                  handleEnhanceBullet(expIdx, bulletIdx, bullet);
                                }}
                                className="inline-flex items-center gap-1 text-[9px] text-indigo-600 ml-1 opacity-0 group-hover/bullet:opacity-100 transition-opacity font-sans font-bold print:hidden"
                                type="button"
                              >
                                <Sparkles className="w-2.5 h-2.5" /> AI Enhance
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skills */}
                <div className="space-y-2" id="executive-skills-section" style={{ order: sectionOrder.indexOf('skills') }}>
                  <h2 className="text-xs font-bold text-slate-950 uppercase tracking-widest text-center border-b-2 border-slate-950 pb-0.5">
                    Skills & Areas of Expertise
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                    {(resumeData.skills || []).map((skillCat, idx) => (
                      <div key={idx} className="flex gap-1.5" id={`executive-skill-${idx}`}>
                        <span className="font-bold text-slate-950">{skillCat.category}:</span>
                        <span className="text-slate-800">{(skillCat.items || []).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Education */}
                <div className="space-y-2" id="executive-education-section" style={{ order: sectionOrder.indexOf('education') }}>
                  <h2 className="text-xs font-bold text-slate-950 uppercase tracking-widest text-center border-b-2 border-slate-950 pb-0.5">
                    Education & Credentials
                  </h2>
                  <div className="space-y-2 text-[11px]">
                    {(resumeData.education || []).map((edu, idx) => (
                      <div key={idx} className="flex justify-between items-start" id={`executive-edu-${idx}`}>
                        <div>
                          <p className="font-bold text-slate-950">{edu.degree}</p>
                          <p className="text-slate-700 italic">{edu.institution} • {edu.location}</p>
                        </div>
                        <span className="text-slate-600">{edu.graduationDate}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Projects Section (Executive) */}
                {resumeData.projects && resumeData.projects.length > 0 && (
                  <div className="space-y-2 pt-3" id="executive-projects-section" style={{ order: sectionOrder.indexOf('projects') }}>
                    <h2 className="text-xs font-bold text-slate-950 uppercase tracking-widest text-center border-b-2 border-slate-950 pb-0.5">
                      Key Projects
                    </h2>
                    <div className="space-y-3 text-[11px] pt-1">
                      {(resumeData.projects || []).map((proj, idx) => (
                        <div key={idx} className="space-y-0.5" id={`executive-proj-${idx}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between font-bold text-slate-950">
                            <span>
                              {proj.name} {proj.link && <span className="font-normal font-mono text-[9px] text-slate-500">({proj.link})</span>}
                            </span>
                            {proj.technologies && proj.technologies.length > 0 && (
                              <span className="font-normal italic text-slate-600 text-[10px]">
                                {(proj.technologies || []).join(', ')}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-800 leading-relaxed text-justify">
                            {renderHighlightedText(proj.description)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certifications Section (Executive) */}
                {resumeData.certifications && resumeData.certifications.length > 0 && (
                  <div className="space-y-2 pt-3" id="executive-certifications-section" style={{ order: sectionOrder.indexOf('certifications') }}>
                    <h2 className="text-xs font-bold text-slate-950 uppercase tracking-widest text-center border-b-2 border-slate-950 pb-0.5">
                      Certifications
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] pt-1">
                      {(resumeData.certifications || []).map((cert, idx) => (
                        <div key={idx} className="flex justify-between text-slate-800" id={`executive-cert-${idx}`}>
                          <span><span className="font-bold text-slate-950">{cert.name}</span> — {cert.issuer}</span>
                          <span className="italic text-slate-600">{cert.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Languages Section (Executive) */}
                {resumeData.languages && resumeData.languages.length > 0 && (
                  <div className="space-y-2 pt-3" id="executive-languages-section" style={{ order: sectionOrder.indexOf('languages') }}>
                    <h2 className="text-xs font-bold text-slate-950 uppercase tracking-widest text-center border-b-2 border-slate-950 pb-0.5">
                      Languages
                    </h2>
                    <div className="text-center text-[11px] text-slate-850 italic pt-1" id="executive-langs-list">
                      {(resumeData.languages || []).join(' • ')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. MODERN DUAL-COLUMN LAYOUT */}
            {layoutStyle === 'modern' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-slate-800 animate-fade-in font-sans" id="modern-layout-container">
                {/* LEFT COLUMN (1/3 Width) - Sidebar */}
                <div className="md:col-span-1 flex flex-col gap-y-6 md:border-r md:border-slate-100 md:pr-6" id="modern-sidebar">
                  <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-2" id="modern-sidebar-avatar" style={{ order: -2 }}>
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-xs">
                      {resumeData.contact.name.charAt(0)}
                    </div>
                    <div>
                      <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">{resumeData.contact.name}</h1>
                      <p className="text-xs text-indigo-600 font-bold tracking-wide uppercase">{resumeData.contact.title}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs" id="modern-sidebar-contact" style={{ order: -1 }}>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Contact</h3>
                    <div className="space-y-1.5 text-slate-600 font-medium">
                      <p className="truncate" title={resumeData.contact.email}>📧 {resumeData.contact.email}</p>
                      <p>📱 {resumeData.contact.phone}</p>
                      <p>📍 {resumeData.contact.location}</p>
                      {resumeData.contact.linkedin && <p className="truncate">🔗 {resumeData.contact.linkedin.replace(/^https?:\/\//i, '')}</p>}
                      {resumeData.contact.website && <p className="truncate">🌐 {resumeData.contact.website.replace(/^https?:\/\//i, '')}</p>}
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs" id="modern-sidebar-education" style={{ order: sectionOrder.indexOf('education') }}>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Education</h3>
                    <div className="space-y-3">
                      {(resumeData.education || []).map((edu, idx) => (
                        <div key={idx} className="space-y-0.5" id={`modern-edu-${idx}`}>
                          <p className="font-bold text-slate-900">{edu.degree}</p>
                          <p className="text-slate-600 text-[11px]">{edu.institution}</p>
                          <p className="text-slate-400 font-mono text-[10px]">{edu.graduationDate}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {resumeData.languages && resumeData.languages.length > 0 && (
                    <div className="space-y-2.5 text-xs" id="modern-sidebar-langs" style={{ order: sectionOrder.indexOf('languages') }}>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Languages</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(resumeData.languages || []).map((lang, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-800 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN (2/3 Width) */}
                <div className="md:col-span-2 flex flex-col gap-y-6" id="modern-main-content">
                  <div className="space-y-2" id="modern-summary" style={{ order: sectionOrder.indexOf('summary') }}>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Professional Profile</h3>
                    <p className="text-xs text-slate-700 leading-relaxed text-justify">
                      {renderHighlightedText(resumeData.summary)}
                    </p>
                  </div>

                  <div className="space-y-3" id="modern-experience" style={{ order: sectionOrder.indexOf('experience') }}>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Experience</h3>
                    <div className="space-y-4">
                      {(resumeData.experience || []).map((job, expIdx) => (
                        <div key={expIdx} className="space-y-1 relative group text-xs" id={`modern-job-${expIdx}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-950 text-[12px]">{job.role}</h4>
                              <p className="text-indigo-600 font-semibold text-[11px]">{job.company}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono text-right font-semibold">
                              {job.startDate} – {job.endDate}<br />{job.location}
                            </span>
                          </div>
                          <ul className="list-disc list-outside ml-4 space-y-1 text-slate-600 text-[11px]">
                            {(job.bullets || []).map((bullet, bulletIdx) => (
                              <li key={bulletIdx} className="leading-relaxed text-justify relative group/bullet" id={`modern-bullet-${expIdx}-${bulletIdx}`}>
                                {renderHighlightedText(bullet)}
                                <button
                                  onClick={() => {
                                    setIsEditing(true);
                                    handleEnhanceBullet(expIdx, bulletIdx, bullet);
                                  }}
                                  className="inline-flex items-center gap-1 text-[9px] text-indigo-600 ml-1 opacity-0 group-hover/bullet:opacity-100 transition-opacity font-bold print:hidden"
                                  type="button"
                                >
                                  <Sparkles className="w-2.5 h-2.5" /> AI Enhance
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {resumeData.projects && resumeData.projects.length > 0 && (
                    <div className="space-y-3" id="modern-projects" style={{ order: sectionOrder.indexOf('projects') }}>
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Projects Portfolio</h3>
                      <div className="space-y-3">
                        {(resumeData.projects || []).map((proj, idx) => (
                          <div key={idx} className="space-y-1 text-xs" id={`modern-proj-${idx}`}>
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-slate-950 text-[12px]">{renderHighlightedText(proj.name)}</h4>
                              {proj.link && (
                                <span className="text-[10px] text-indigo-600 font-mono">{proj.link}</span>
                              )}
                            </div>
                            {proj.technologies && proj.technologies.length > 0 && (
                              <p className="text-[10px] text-slate-500 font-mono">Technologies: {(proj.technologies || []).join(', ')}</p>
                            )}
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {renderHighlightedText(proj.description)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2" id="modern-skills" style={{ order: sectionOrder.indexOf('skills') }}>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Skills & Capabilities</h3>
                    <div className="space-y-2 text-xs">
                      {(resumeData.skills || []).map((skillCat, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-1" id={`modern-skill-${idx}`}>
                          <span className="font-bold text-slate-900 w-full sm:w-1/3">{skillCat.category}</span>
                          <span className="text-slate-600 w-full sm:w-2/3">{(skillCat.items || []).join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {resumeData.certifications && resumeData.certifications.length > 0 && (
                    <div className="space-y-2" id="modern-certs" style={{ order: sectionOrder.indexOf('certifications') }}>
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Certifications</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {(resumeData.certifications || []).map((cert, idx) => (
                          <div key={idx} className="flex justify-between text-slate-700">
                            <span className="font-medium text-slate-900">{cert.name}</span>
                            <span className="text-slate-400 font-mono text-[10px]">{cert.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
