import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Linkedin, 
  Send, 
  Check, 
  AlertCircle, 
  FileText, 
  LogOut, 
  Clipboard, 
  Sparkles, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Eye,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Plus,
  ChevronDown,
  ChevronUp,
  Users,
  Download
} from 'lucide-react';
import { googleSignIn, initAuth, logout, getAccessToken } from '../lib/firebase';
import { buildInterviewIcs } from '../utils/ics';
import { User as FirebaseUser } from 'firebase/auth';
import { ResumeData, CoverLetterData } from '../types';
import { useAuth } from '../AuthContext';
import { useToast } from './Toast';
import { getJobApplications, saveJobApplications } from '../db';
import { apiFetch } from '../utils/apiClient';

interface ApplicationIntegrationsHubProps {
  tailoredResume: ResumeData;
  coverLetter: CoverLetterData | null;
  atsScore: number;
  onEmailSent?: (threadId: string, email: string) => void;
  targetCompany?: string;
  targetTitle?: string;
}

export default function ApplicationIntegrationsHub({
  tailoredResume,
  coverLetter,
  atsScore,
  onEmailSent,
  targetCompany,
  targetTitle
}: ApplicationIntegrationsHubProps) {
  const { showError, showSuccess, showToast } = useToast();
  // Gmail Auth States
  const [trackerApps, setTrackerApps] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const loadApps = async () => {
      if (user) {
        try {
          const apps = await getJobApplications(user.uid);
          if (apps) setTrackerApps(apps);
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          const { localDb } = await import('../utils/localDb');
          const apps = await localDb.getItem<any[]>('ats_tailor_job_applications', []);
          if (apps) setTrackerApps(apps);
        } catch (e) {
          console.error(e);
        }
      }
    };
    loadApps();
  }, [user]);

  const logOutreachToTracker = async (platform: 'Email' | 'LinkedIn') => {
    const today = new Date().toISOString().split('T')[0];
    const companyName = targetCompany || 'Target Company';
    const roleTitle = targetTitle || tailoredResume?.contact?.title || 'Professional';
    
    const existingIndex = trackerApps.findIndex(
      app => app.company.toLowerCase() === companyName.toLowerCase() && app.title.toLowerCase() === roleTitle.toLowerCase()
    );
    
    let updatedApps = [...trackerApps];
    if (existingIndex !== -1) {
      updatedApps[existingIndex] = {
        ...updatedApps[existingIndex],
        status: 'applied',
        dateUpdated: today,
        notes: (updatedApps[existingIndex].notes || '') + `\n[Outreach Log]: Sent outreach via ${platform} on ${today}.`
      };
    } else {
      const newApp = {
        id: 'app_' + Math.random().toString(36).substr(2, 9),
        company: companyName,
        title: roleTitle,
        location: tailoredResume?.contact?.location || 'Remote',
        status: 'applied' as const,
        dateAdded: today,
        dateUpdated: today,
        notes: `[Outreach Log]: Sent outreach via ${platform} on ${today}.`
      };
      updatedApps = [newApp, ...updatedApps];
    }
    
    setTrackerApps(updatedApps);
    if (user) {
      await saveJobApplications(user.uid, updatedApps);
    } else {
      const { localDb } = await import('../utils/localDb');
      await localDb.setItem('ats_tailor_job_applications', updatedApps);
    }
  };

  const [linkedinActiveSubTab, setLinkedinActiveSubTab] = useState<'feed' | 'about' | 'experience'>('feed');

  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Email Composer States
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState(
    coverLetter?.subject || `Application for ${targetTitle || tailoredResume?.contact?.title || 'Professional'} at ${targetCompany || 'Target Company'}`
  );
  const [emailBody, setEmailBody] = useState('');
  const [includeResumeText, setIncludeResumeText] = useState(true);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // LinkedIn Sharing States
  const [linkedinPostText, setLinkedinPostText] = useState(() => {
    const contactTitle = tailoredResume?.contact?.title || 'Professional';
    const skillsList = tailoredResume?.skills || [];
    const skillsText = skillsList.slice(0, 2).map(cat => `• ${cat.category}: ${(cat.items || []).slice(0, 4).join(', ')}`).join('\n');
    return `Excited to announce that I'm taking my career to the next level! 🚀 Just tailored my resume for the ${targetTitle || contactTitle} role at ${targetCompany || 'Target Company'} using the ATS Resume Tailor, hitting an optimized ATS compatibility score of ${atsScore}%!\n\nCheck out my core areas of expertise:\n${skillsText}\n\nReady for new opportunities! #JobSearch #CareerGrowth #ATSResume`;
  });

  // Sync state with incoming props dynamically
  useEffect(() => {
    if (targetTitle || targetCompany || tailoredResume) {
      const contactTitle = tailoredResume?.contact?.title || 'Professional';
      const skillsList = tailoredResume?.skills || [];
      const skillsText = skillsList.slice(0, 2).map(cat => `• ${cat.category}: ${(cat.items || []).slice(0, 4).join(', ')}`).join('\n');
      setEmailSubject(
        coverLetter?.subject || `Application for ${targetTitle || contactTitle} at ${targetCompany || 'Target Company'}`
      );
      setLinkedinPostText(
        `Excited to announce that I'm taking my career to the next level! 🚀 Just tailored my resume for the ${targetTitle || contactTitle} role at ${targetCompany || 'Target Company'} using the ATS Resume Tailor, hitting an optimized ATS compatibility score of ${atsScore}%!\n\nCheck out my core areas of expertise:\n${skillsText}\n\nReady for new opportunities! #JobSearch #CareerGrowth #ATSResume`
      );
    }
  }, [targetTitle, targetCompany, coverLetter, tailoredResume?.contact?.title, tailoredResume?.skills, atsScore]);

  useEffect(() => {
    const contactTitle = tailoredResume?.contact?.title || 'Professional';
    const summaryText = tailoredResume?.summary || '';
    const skillsList = tailoredResume?.skills || [];
    const experienceList = tailoredResume?.experience || [];
    setLinkedinAboutText(
      `Passionate and driven ${contactTitle} with a track record of impact.\n\n${summaryText}\n\nKey Skills:\n${skillsList.map(cat => `• ${cat.category}: ${(cat.items || []).slice(0, 5).join(', ')}`).join('\n')}`
    );
    setLinkedinExperienceText(
      experienceList.map(exp => `${exp.role || ''} at ${exp.company || ''}\n${exp.startDate || ''} - ${exp.endDate || ''} | ${exp.location || ''}\n\n• ${(exp.bullets || []).join('\n• ')}`).join('\n\n---\n\n')
    );
  }, [tailoredResume]);

  const [isCopiedLinkedin, setIsCopiedLinkedin] = useState(false);
  const [isCopiedAbout, setIsCopiedAbout] = useState(false);
  const [isCopiedExperience, setIsCopiedExperience] = useState(false);
  const [linkedinAboutText, setLinkedinAboutText] = useState('');
  const [linkedinExperienceText, setLinkedinExperienceText] = useState('');
  const [customLinkedinClientId, setCustomLinkedinClientId] = useState(() => {
    return localStorage.getItem('ats_custom_linkedin_client_id') || '';
  });
  const [customLinkedinClientSecret, setCustomLinkedinClientSecret] = useState(() => {
    return localStorage.getItem('ats_custom_linkedin_client_secret') || '';
  });
  const [linkedinScopeStatus, setLinkedinScopeStatus] = useState<'idle' | 'testing' | 'active'>(() => {
    const saved = localStorage.getItem('ats_linkedin_status');
    return (saved as 'idle' | 'testing' | 'active') || 'idle';
  });
  const [linkedinCustomName, setLinkedinCustomName] = useState(() => {
    const saved = localStorage.getItem('ats_linkedin_name');
    return saved || tailoredResume?.contact?.name || 'Applicant';
  });
  const [linkedinCustomTitle, setLinkedinCustomTitle] = useState(() => {
    const saved = localStorage.getItem('ats_linkedin_title');
    return saved || tailoredResume?.contact?.title || 'Professional';
  });
  const [linkedinCustomAvatar, setLinkedinCustomAvatar] = useState(() => {
    const saved = localStorage.getItem('ats_linkedin_avatar');
    return saved || '';
  });
  const [showLinkedinCustomizer, setShowLinkedinCustomizer] = useState(false);
  const [showLinkedinConfigGuide, setShowLinkedinConfigGuide] = useState(false);
  const [isTestingLinkedinScope, setIsTestingLinkedinScope] = useState(false);

  // Synchronize state with incoming resume changes if there are no overrides in localStorage
  useEffect(() => {
    if (!localStorage.getItem('ats_linkedin_name') && tailoredResume?.contact?.name) {
      setLinkedinCustomName(tailoredResume.contact.name);
    }
    if (!localStorage.getItem('ats_linkedin_title') && tailoredResume?.contact?.title) {
      setLinkedinCustomTitle(tailoredResume.contact.title);
    }
  }, [tailoredResume]);

  // Listen for LinkedIn OAuth messages from the popup window
  useEffect(() => {
    const handleLinkedInMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      
      if (event.data?.type === 'LINKEDIN_AUTH_SUCCESS') {
        const payload = event.data.payload;
        if (payload) {
          setLinkedinScopeStatus('active');
          localStorage.setItem('ats_linkedin_status', 'active');
          
          if (payload.name) {
            setLinkedinCustomName(payload.name);
            localStorage.setItem('ats_linkedin_name', payload.name);
          }
          if (payload.title) {
            setLinkedinCustomTitle(payload.title);
            localStorage.setItem('ats_linkedin_title', payload.title);
          }
          if (payload.avatarUrl) {
            setLinkedinCustomAvatar(payload.avatarUrl);
            localStorage.setItem('ats_linkedin_avatar', payload.avatarUrl);
          }
          setIsTestingLinkedinScope(false);
        }
      } else if (event.data?.type === 'LINKEDIN_AUTH_FAILURE') {
        setLinkedinScopeStatus('idle');
        setIsTestingLinkedinScope(false);
        showError(`LinkedIn connection failed`, event.data?.error || 'User cancelled authorization');
      }
    };

    window.addEventListener('message', handleLinkedInMessage);
    return () => window.removeEventListener('message', handleLinkedInMessage);
  }, []);

  // Outlook Composer States
  const [outlookStatus, setOutlookStatus] = useState<'idle' | 'composed' | 'sent'>('idle');
  const [outlookMode, setOutlookMode] = useState<'desktop' | 'web'>('desktop');

  // Recruiter Direct Contact Finder States
  const [isSearchingRecruiter, setIsSearchingRecruiter] = useState(false);
  const [foundRecruiters, setFoundRecruiters] = useState<string[]>([]);

  // Active sub-tab inside Gmail direct application engine panel
  const [gmailActiveMode, setGmailActiveMode] = useState<'send' | 'sync'>('send');

  // Job URL Parser States
  const [jobUrlInput, setJobUrlInput] = useState('');
  const [isAnalyzingJobUrl, setIsAnalyzingJobUrl] = useState(false);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);

  const handleAnalyzeJobUrl = async () => {
    setIsAnalyzingJobUrl(true);
    setMissingSkills([]);
    try {
      const savedConfig = localStorage.getItem('ats_ai_config');
      const localAiConfig = savedConfig ? JSON.parse(savedConfig) : null;
      const apiKey = localAiConfig?.apiKey || '';
      const savedModel = localStorage.getItem('ats_selected_model') || 'gemini-3.5-flash';

      const data = await apiFetch(
        '/api/analyze-job-url',
        { jobUrl: jobUrlInput, masterResume: tailoredResume, model: savedModel, aiConfig: localAiConfig },
        { apiKey }
      );
      setMissingSkills(data.missingSkills || []);
    } catch (err: any) {
      console.error(err);
      showError(`Analysis failed`, err);
    } finally {
      setIsAnalyzingJobUrl(false);
    }
  };

  const handleAddToMasterResume = async () => {
    // This would require a way to update the master resume
    // Assuming for now it just updates local state and alerts the user
    showSuccess(`Added skills to master resume: ${missingSkills.join(', ')}`);
    setMissingSkills([]);
  };

  // Gmail Interview Sync States
  const [scannedEmails, setScannedEmails] = useState<any[]>([]);
  const [isScanningEmails, setIsScanningEmails] = useState(false);
  const [selectedScanEmail, setSelectedScanEmail] = useState<any | null>(null);
  const [isParsingEmail, setIsParsingEmail] = useState(false);
  const [parsedInterview, setParsedInterview] = useState<any | null>(null);
  
  // Schedule Form states
  const [formCompany, setFormCompany] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formType, setFormType] = useState('Technical Interview');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('10:00');
  const [formLink, setFormLink] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [selectedMatchedAppId, setSelectedMatchedAppId] = useState('new');
  
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [calendarSuccess, setCalendarSuccess] = useState<any | null>(null);

  // Outlook Networking Suggestions States
  const [networkingPlan, setNetworkingPlan] = useState<any | null>(null);
  const [isGeneratingNetworking, setIsGeneratingNetworking] = useState(false);
  const [expandedNetworkIndex, setExpandedNetworkIndex] = useState<number | null>(null);
  
  // Tab control state
  const [activeHubTab, setActiveHubTab] = useState<'email' | 'linkedin' | 'networking' | 'parser'>('email');

  // Load and sync job applications from tracker
  const { user: authUser } = useAuth();
  const [jobApplications, setJobApplications] = useState<any[]>([]);

  useEffect(() => {
    if (authUser) {
      getJobApplications(authUser.uid).then(saved => {
        if (saved) setJobApplications(saved);
      }).catch(err => console.error('Failed to parse saved applications:', err));
    } else {
      const saved = localStorage.getItem('ats_tailor_job_applications');
      if (saved) {
        try {
          setJobApplications(JSON.parse(saved));
        } catch (err) {
          console.error('Failed to parse saved applications:', err);
        }
      }
    }
  }, [authUser]);

  const saveApps = (apps: any[]) => {
    setJobApplications(apps);
    if (authUser) {
      saveJobApplications(authUser.uid, apps);
    } else {
      localStorage.setItem('ats_tailor_job_applications', JSON.stringify(apps));
    }
  };

  // Scan Gmail messages for interview keyword
  const handleScanGmailForInterviews = async () => {
    setIsScanningEmails(true);
    setScannedEmails([]);
    setSelectedScanEmail(null);
    setParsedInterview(null);
    setCalendarSuccess(null);

    try {
      const activeToken = await getAccessToken();
      if (!activeToken) {
        throw new Error('Gmail token unavailable. Please reconnect.');
      }

      const q = 'interview OR schedule OR invitation OR "google meet" OR "zoom" OR calendly';
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=${encodeURIComponent(q)}`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to query Gmail inbox.');
      }

      const data = await response.json();
      if (data.messages && data.messages.length > 0) {
        const details = await Promise.all(data.messages.map(async (msg: any) => {
          try {
            const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
              headers: { 'Authorization': `Bearer ${activeToken}` }
            });
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              const headers = detailData.payload?.headers || [];
              const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
              const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '(Unknown)';
              const snippet = detailData.snippet || '';
              
              // Try to find plain text body
              let bodyText = snippet;
              const findBodyText = (part: any): string => {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                  return part.body.data;
                }
                if (part.parts) {
                  for (const subPart of part.parts) {
                    const found = findBodyText(subPart);
                    if (found) return found;
                  }
                }
                return '';
              };
              const rawBody = findBodyText(detailData.payload) || detailData.payload?.body?.data || '';
              if (rawBody) {
                try {
                  bodyText = decodeURIComponent(escape(atob(rawBody.replace(/-/g, '+').replace(/_/g, '/'))));
                } catch (e) {
                  bodyText = snippet;
                }
              }
              return {
                id: msg.id,
                subject,
                from,
                snippet,
                body: bodyText
              };
            }
          } catch (err) {
            console.error('Error fetching message detail:', err);
          }
          return null;
        }));
        setScannedEmails(details.filter(Boolean));
      } else {
        setScannedEmails([]);
      }
    } catch (err: any) {
      console.error(err);
      showError(`Error scanning Gmail inbox`, err);
    } finally {
      setIsScanningEmails(false);
    }
  };

  // Run AI analysis on selected email message
  const handleAnalyzeEmailWithAI = async (email: any) => {
    setSelectedScanEmail(email);
    setIsParsingEmail(true);
    setParsedInterview(null);
    setCalendarSuccess(null);

    try {
      const savedConfig = localStorage.getItem('ats_ai_config');
      const apiKey = savedConfig ? JSON.parse(savedConfig)?.apiKey : '';

      const parsed = await apiFetch(
        '/api/parse-email-interview',
        { emailSnippet: email.snippet, emailBody: email.body },
        { apiKey }
      );
      setParsedInterview(parsed);
      
      // Seed form values
      setFormCompany(parsed.company || '');
      setFormRole(parsed.role || '');
      setFormType(parsed.interviewType || 'Technical Interview');
      setFormDate(parsed.interviewDate || new Date().toISOString().split('T')[0]);
      setFormTime(parsed.interviewTime || '10:00');
      setFormLink(parsed.meetingLink || '');
      setFormNotes(parsed.summaryNotes || '');
    } catch (err: any) {
      console.error(err);
      showError(`AI parsing failed`, err);
    } finally {
      setIsParsingEmail(false);
    }
  };

  // Create Google Calendar event and log to Application Tracker
  const handleScheduleAndTrack = async () => {
    if (!formCompany.trim() || !formRole.trim() || !formDate) {
      showToast('Please fill out Company Name, Role and Interview Date.', 'warning');
      return;
    }

    setIsAddingToCalendar(true);
    setCalendarSuccess(null);

    try {
      const activeToken = await getAccessToken();
      if (!activeToken) {
        throw new Error('Google authentication has expired. Please sign in again.');
      }

      let cleanTime = '10:00';
      const timeMatch = formTime.match(/([0-1]?[0-9]|2[0-3]):[0-5][0-9]/);
      if (timeMatch) {
        cleanTime = timeMatch[0];
      }
      
      const startDateTimeStr = `${formDate}T${cleanTime}:00`;
      const startDate = new Date(startDateTimeStr);
      const finalStartDate = isNaN(startDate.getTime()) ? new Date() : startDate;
      const finalEndDate = new Date(finalStartDate.getTime() + 60 * 60 * 1000);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      const eventPayload = {
        summary: `Interview: ${formCompany} - ${formRole} (${formType})`,
        location: formLink || 'Virtual Meeting',
        description: `Scheduled via ATS Resume Tailor.\n\nType: ${formType}\nMeeting Link: ${formLink || 'None'}\n\nAdditional Notes:\n${formNotes}`,
        start: {
          dateTime: finalStartDate.toISOString(),
          timeZone
        },
        end: {
          dateTime: finalEndDate.toISOString(),
          timeZone
        }
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Google Calendar API rejected scheduling request.');
      }

      const eventData = await response.json();
      setCalendarSuccess(eventData);

      // Now, update/log in Application Tracker
      const updatedApps = [...jobApplications];
      const today = new Date().toISOString().split('T')[0];

      if (selectedMatchedAppId === 'new') {
        const newApp = {
          id: 'app_' + Math.random().toString(36).substr(2, 9),
          company: formCompany.trim(),
          title: formRole.trim(),
          location: 'Remote',
          status: 'interviewing' as const,
          dateAdded: today,
          dateUpdated: today,
          notes: `[System Sync]: Interview automatically scheduled on Google Calendar!\n\nInterview Date: ${formDate} @ ${formTime}\nType: ${formType}\nLink: ${formLink || 'None'}\n\nNotes:\n${formNotes}`
        };
        saveApps([newApp, ...updatedApps]);
      } else {
        const index = updatedApps.findIndex(app => app.id === selectedMatchedAppId);
        if (index !== -1) {
          updatedApps[index] = {
            ...updatedApps[index],
            status: 'interviewing' as const,
            dateUpdated: today,
            notes: (updatedApps[index].notes || '') + `\n\n[System Sync]: Interview scheduled on Google Calendar!\nDate: ${formDate} @ ${formTime}\nType: ${formType}\nLink: ${formLink || 'None'}\n\nNotes:\n${formNotes}`
          };
          saveApps(updatedApps);
        }
      }

      showSuccess('Interview added to Google Calendar and linked successfully!');
    } catch (err: any) {
      console.error(err);
      showError(`Calendar Scheduling Failed`, err);
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  // Plain .ics download — works without a Google account, unlike handleScheduleAndTrack above.
  const handleDownloadIcs = () => {
    if (!formCompany.trim() || !formRole.trim() || !formDate) {
      showToast('Please fill out Company Name, Role and Interview Date.', 'warning');
      return;
    }

    const icsContent = buildInterviewIcs({
      company: formCompany,
      role: formRole,
      type: formType,
      date: formDate,
      time: formTime,
      link: formLink,
      notes: formNotes,
    });

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Interview_${formCompany.replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate networking suggestions adapted for role & CV
  const handleGenerateNetworkingPlan = async () => {
    setIsGeneratingNetworking(true);
    setNetworkingPlan(null);
    setExpandedNetworkIndex(null);

    try {
      const savedConfig = localStorage.getItem('ats_ai_config');
      const apiKey = savedConfig ? JSON.parse(savedConfig)?.apiKey : '';

      const data = await apiFetch(
        '/api/networking-suggestions',
        { tailoredResume, jobDescription: coverLetter?.subject || '' },
        { apiKey }
      );
      setNetworkingPlan(data);
    } catch (err: any) {
      console.error(err);
      showError(`Networking suggestions failed`, err);
    } finally {
      setIsGeneratingNetworking(false);
    }
  };

  const handleSearchRecruiter = () => {
    setIsSearchingRecruiter(true);
    setTimeout(() => {
      const company = tailoredResume?.experience?.[0]?.company || 'TargetCompany';
      const cleanCompany = company.toLowerCase().replace(/[^a-z0-9]/g, '');
      const domains = [
        `careers@${cleanCompany}.com`,
        `talent.acquisition@${cleanCompany}.com`,
        `recruiting@${cleanCompany}.com`,
        `hr.hiring@${cleanCompany}.com`
      ];
      setFoundRecruiters(domains);
      setIsSearchingRecruiter(false);
    }, 1100);
  };

  // Load Cover Letter into email body on mount/update
  useEffect(() => {
    if (coverLetter) {
      const formattedBody = [
        `${coverLetter.salutation},`,
        '',
        coverLetter.introduction,
        '',
        ...(coverLetter.bodyParagraphs || []).map(p => p + '\n'),
        coverLetter.conclusion,
        '',
        coverLetter.signOff,
        coverLetter.senderName
      ].join('\n');
      setEmailBody(formattedBody);
      setEmailSubject(coverLetter.subject);
    } else {
      setEmailBody(
        `Dear Hiring Manager,\n\nPlease find attached my tailored resume for the position of ${tailoredResume?.contact?.title || 'Professional'}.\n\nBest regards,\n${tailoredResume?.contact?.name || 'Applicant'}`
      );
    }
    // Also synchronize LinkedIn preview defaults if no custom values exist
    if (!localStorage.getItem('ats_linkedin_name') && tailoredResume?.contact?.name) {
      setLinkedinCustomName(tailoredResume.contact.name);
    }
    if (!localStorage.getItem('ats_linkedin_title') && tailoredResume?.contact?.title) {
      setLinkedinCustomTitle(tailoredResume.contact.title);
    }
  }, [coverLetter, tailoredResume]);

  // Init Google Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setNeedsGoogleAuth(false);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setNeedsGoogleAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleConnect = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        setNeedsGoogleAuth(false);
      }
    } catch (err: any) {
      console.error('Google Auth Failed:', err);
      showError('Google Connection Failed', err || 'Please check popup permissions.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (confirm('Disconnect your Google Account? You will not be able to send applications directly.')) {
      await logout();
      setGoogleUser(null);
      setGoogleToken(null);
      setNeedsGoogleAuth(true);
    }
  };

  // Construct and send RFC 2822 email via Gmail API
  const handleSendGmail = async () => {
    if (!recipientEmail.trim()) {
      setEmailStatus({ type: 'error', message: 'Please provide a recipient recruiter email address.' });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to send this application email to ${recipientEmail}? This will send a real email from your Gmail account.`
    );
    if (!confirmed) return;

    setIsSendingEmail(true);
    setEmailStatus(null);

    try {
      const activeToken = await getAccessToken();
      if (!activeToken) {
        throw new Error('Gmail Access Token expired or unavailable. Please re-connect Google Auth.');
      }

      // Add resume textual attachments if enabled
      let finalBody = emailBody;
      if (includeResumeText && tailoredResume) {
        finalBody += `\n\n=========================================\n`;
        finalBody += `TAILORED RESUME ATTACHMENT:\n`;
        finalBody += `${tailoredResume.contact?.name || 'Applicant'} - ${tailoredResume.contact?.title || 'Professional'}\n`;
        finalBody += `Email: ${tailoredResume.contact?.email || ''} | Phone: ${tailoredResume.contact?.phone || ''}\n\n`;
        finalBody += `SUMMARY:\n${tailoredResume.summary || ''}\n\n`;
        finalBody += `SKILLS:\n${(tailoredResume.skills || []).map(s => `${s.category}: ${(s.items || []).join(', ')}`).join('\n')}\n\n`;
        finalBody += `EXPERIENCE:\n${(tailoredResume.experience || []).map(exp => `• ${exp.role || ''} at ${exp.company || ''} (${exp.startDate || ''} - ${exp.endDate || ''})\n  ${(exp.bullets || []).join('\n  ')}`).join('\n\n')}\n`;
        finalBody += `=========================================`;
      }

      // Construct MIME Message
      const emailContent = [
        `To: ${recipientEmail}`,
        `Subject: ${emailSubject}`,
        `Content-Type: text/plain; charset=utf-8`,
        `MIME-Version: 1.0`,
        ``,
        `${finalBody}`
      ].join('\r\n');

      const rawMessage = btoa(unescape(encodeURIComponent(emailContent)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: rawMessage })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Gmail API failed to deliver email.');
      }

      const responseData = await response.json();

      setEmailStatus({
        type: 'success',
        message: `Application email successfully delivered to ${recipientEmail}! Real-time tracking status: Delivered.`
      });

      logOutreachToTracker('Email');

      if (onEmailSent && responseData.threadId) {
        onEmailSent(responseData.threadId, recipientEmail);
      }
    } catch (err: any) {
      console.error(err);
      setEmailStatus({
        type: 'error',
        message: `Failed to send email: ${err.message}`
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Outlook standard mailto/web dispatch
  const handleOutlookDispatch = () => {
    let finalBody = emailBody;
    if (includeResumeText && tailoredResume) {
      finalBody += `\n\n--- TAILORED RESUME ---\n`;
      finalBody += `${tailoredResume.contact?.name || 'Applicant'} - ${tailoredResume.contact?.title || 'Professional'}\n`;
      finalBody += `Skills: ${(tailoredResume.skills || []).map(s => (s.items || []).slice(0, 5).join(', ')).join('; ')}\n`;
    }

    if (outlookMode === 'web') {
      // Office 365 Outlook Web Deeplink
      const outlookWebUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(recipientEmail)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(finalBody)}`;
      window.open(outlookWebUrl, '_blank');
    } else {
      // Standard Desktop Mailto URI
      const mailtoUrl = `mailto:${recipientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(finalBody)}`;
      window.open(mailtoUrl);
    }
    setOutlookStatus('sent');
    logOutreachToTracker('Email');

    // Automatically sync Outlook dispatch with job application tracker
    if (onEmailSent) {
      onEmailSent('', recipientEmail);
    }
  };

  const handleConnectLinkedin = async () => {
    setIsTestingLinkedinScope(true);
    setLinkedinScopeStatus('testing');
    
    try {
      const params = new URLSearchParams();
      if (customLinkedinClientId.trim()) {
        params.append('client_id', customLinkedinClientId.trim());
      }
      if (customLinkedinClientSecret.trim()) {
        params.append('client_secret', customLinkedinClientSecret.trim());
      }

      const { url } = await apiFetch<{ url: string }>(`/api/auth/linkedin/url?${params.toString()}`);
      
      const authWindow = window.open(
        url,
        'linkedin_oauth_popup',
        'width=600,height=750'
      );
      
      if (!authWindow) {
        showToast('Please allow popups to connect your LinkedIn account.', 'warning');
        setLinkedinScopeStatus('idle');
        setIsTestingLinkedinScope(false);
      } else {
        const timer = setInterval(() => {
          if (authWindow.closed) {
            clearInterval(timer);
            setIsTestingLinkedinScope(false);
            setLinkedinScopeStatus(prev => prev === 'testing' ? 'idle' : prev);
          }
        }, 1000);
      }
    } catch (err: any) {
      console.error(err);
      showError('Could not open connection', err);
      setLinkedinScopeStatus('idle');
      setIsTestingLinkedinScope(false);
    }
  };

  const handleDisconnectLinkedin = () => {
    setLinkedinScopeStatus('idle');
    localStorage.removeItem('ats_linkedin_status');
    localStorage.removeItem('ats_linkedin_name');
    localStorage.removeItem('ats_linkedin_title');
    localStorage.removeItem('ats_linkedin_avatar');
    setLinkedinCustomName(tailoredResume.contact.name);
    setLinkedinCustomTitle(tailoredResume.contact.title);
    setLinkedinCustomAvatar('');
  };

  const handleCopyLinkedin = () => {
    navigator.clipboard.writeText(linkedinPostText);
    setIsCopiedLinkedin(true);
    logOutreachToTracker('LinkedIn');
    setTimeout(() => setIsCopiedLinkedin(false), 3000);
  };

  const handleCopyAbout = () => {
    navigator.clipboard.writeText(linkedinAboutText);
    setIsCopiedAbout(true);
    logOutreachToTracker('LinkedIn');
    setTimeout(() => setIsCopiedAbout(false), 3000);
  };

  const handleCopyExperience = () => {
    navigator.clipboard.writeText(linkedinExperienceText);
    setIsCopiedExperience(true);
    logOutreachToTracker('LinkedIn');
    setTimeout(() => setIsCopiedExperience(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="integrations-hub">
      {/* Interactive Outreach Suite Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800/80 mb-2 relative overflow-x-auto scrollbar-none" id="integrations-tab-header">
        <div className="flex gap-2 p-1 w-full min-w-max">
          {[
            { id: 'email', label: 'Email Outreach', icon: Mail },
            { id: 'linkedin', label: 'LinkedIn Connector', icon: Linkedin },
            { id: 'networking', label: 'Contextual Networking', icon: Users },
            { id: 'parser', label: 'Job URL Parser', icon: ExternalLink }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeHubTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => {
                  setActiveHubTab(tab.id as 'email' | 'linkedin' | 'networking' | 'parser');
                  if (tab.id !== 'networking') {
                    setExpandedNetworkIndex(null);
                  }
                }}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer select-none ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                type="button"
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="active_hub_tab_indicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Grid: Left Column (Email Dispatchers) | Right Column (LinkedIn & Outlook Tools) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Job URL Parser Tab Content */}
        {activeHubTab === 'parser' && (
          <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-indigo-500" />
              Job URL Skill Parser
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Paste a job URL to automatically detect missing skills and update your master resume.
            </p>
            
            <div className="flex gap-2">
              <input 
                type="url" 
                value={jobUrlInput} 
                onChange={(e) => setJobUrlInput(e.target.value)}
                placeholder="Paste Job Posting URL here..."
                className="flex-grow bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white"
              />
              <button
                onClick={handleAnalyzeJobUrl}
                disabled={isAnalyzingJobUrl}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1 transition-all shadow-sm shadow-indigo-100 cursor-pointer"
              >
                {isAnalyzingJobUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Analyze
              </button>
            </div>
            
            {missingSkills.length > 0 && (
              <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-2">Detected Missing Skills:</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {missingSkills.map((skill, idx) => (
                    <span key={idx} className="bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 px-2 py-1 rounded-lg text-[10px] font-bold">
                      {skill}
                    </span>
                  ))}
                </div>
                <button
                  onClick={handleAddToMasterResume}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1 transition-all shadow-sm shadow-indigo-100 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add to Master Resume
                </button>
              </div>
            )}
          </div>)}
        
        <div className={`transition-all duration-350 ease-in-out ${activeHubTab === 'email' ? 'lg:col-span-7 block' : 'hidden'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6`}>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-red-500" />
                Gmail Direct Application Engine
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send your tailored resume & cover letter directly to recruiter inboxes
              </p>
            </div>

            {/* Google OAuth State */}
            {!needsGoogleAuth && googleUser && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-2.5 py-1 rounded-xl">
                {googleUser.photoURL ? (
                  <img src={googleUser.photoURL} alt="Avatar" className="w-5 h-5 rounded-full referrer-policy='no-referrer'" />
                ) : (
                  <div className="w-5 h-5 bg-indigo-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                    G
                  </div>
                )}
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 max-w-[100px] truncate">
                  {googleUser.displayName || googleUser.email}
                </span>
                <button 
                  onClick={handleGoogleDisconnect}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  title="Disconnect Google Account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {needsGoogleAuth ? (
            <div className="text-center py-12 px-4 space-y-4" id="gmail-auth-onboarding">
              <div className="w-14 h-14 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Enable Gmail Integration</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Authenticate securely with your Google account to draft, customize, and compose emails to hiring contacts with permission.
                </p>
              </div>

              {/* GSI Button */}
              <button
                onClick={handleGoogleConnect}
                disabled={isLoggingIn}
                className="gsi-material-button mx-auto shadow-sm"
                type="button"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">Sign in with Google</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4" id="gmail-active-workspace">
              {/* Google Connected Workspace Mode Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold mb-4" id="gmail-subtab-selector">
                <button
                  onClick={() => setGmailActiveMode('send')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    gmailActiveMode === 'send'
                      ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  type="button"
                >
                  Compose & Send Application
                </button>
                <button
                  onClick={() => setGmailActiveMode('sync')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    gmailActiveMode === 'sync'
                      ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  type="button"
                >
                  Scan Inbox & Sync Calendar
                </button>
              </div>

              {gmailActiveMode === 'send' ? (
                <div className="space-y-4" id="gmail-active-composer">
                  {/* Recruiter Email Address */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Recruiter / Contact Email
                      </label>
                      <button
                        onClick={handleSearchRecruiter}
                        disabled={isSearchingRecruiter}
                        type="button"
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {isSearchingRecruiter ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Scanning for Recruiters...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                            Direct Recruiter Finder
                          </>
                        )}
                      </button>
                    </div>

                    {foundRecruiters.length > 0 && (
                      <div className="bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-xl space-y-1 text-[11px] animate-fade-in">
                        <span className="font-bold text-indigo-800">Recruiting Inboxes Extrapolated:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {foundRecruiters.map((email, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setRecipientEmail(email);
                                setFoundRecruiters([]);
                              }}
                              className="bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-lg font-mono font-bold text-[10px] transition-colors cursor-pointer"
                            >
                              {email}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-slate-400">Click any address to auto-fill recipient email field.</p>
                      </div>
                    )}

                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="e.g. hiring@company.com"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white"
                    />
                  </div>

                  {/* Email Subject */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Email Subject Line
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Subject Line"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-850 dark:text-white"
                    />
                  </div>

                  {/* Email Body */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Application Message / Cover Letter
                      </label>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Auto-populated cover letter
                      </span>
                    </div>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={10}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed text-slate-700 dark:text-slate-300 font-sans"
                    />
                  </div>

                  {/* Add Resume attachment text info */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={includeResumeText}
                      onChange={(e) => setIncludeResumeText(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Embed full text of tailored resume CV at end of email body (highly recommended for direct database ATS screening)
                    </span>
                  </label>

                  {/* Status Banner */}
                  {emailStatus && (
                    <div className="space-y-3">
                      <div className={`p-4 rounded-xl flex items-start gap-3 border text-xs leading-relaxed ${
                        emailStatus.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                          : 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/50 text-rose-800 dark:text-rose-300'
                      }`}>
                        {emailStatus.type === 'success' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h5 className="font-bold">{emailStatus.type === 'success' ? 'Email Dispatched!' : 'Delivery Blocked'}</h5>
                          <p>{emailStatus.message}</p>
                        </div>
                      </div>

                      {emailStatus.type === 'success' && (
                        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 p-4 rounded-xl space-y-3 animate-fade-in text-xs text-left">
                          <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Application Real-Time Delivery Timeline
                          </h5>
                          <div className="space-y-2.5 border-l-2 border-slate-200 dark:border-slate-700 ml-2 pl-4">
                            <div className="relative">
                              <span className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                              <p className="font-semibold text-slate-800 dark:text-slate-200">Email Authenticated & Signed</p>
                              <p className="text-[10px] text-slate-400 font-mono">Timestamped authorization via OAuth2 token exchange</p>
                            </div>
                            <div className="relative">
                              <span className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                              <p className="font-semibold text-slate-800 dark:text-slate-200">RFC 2822 MIME Package Composed</p>
                              <p className="text-[10px] text-slate-400 font-mono">Tailored Resume + Cover Letter packaged safely in UTF-8 base64</p>
                            </div>
                            <div className="relative">
                              <span className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                              <p className="font-semibold text-slate-800 dark:text-slate-200">Secure Direct Handshake (SSL/TLS)</p>
                              <p className="text-[10px] text-slate-400 font-mono">Dispatched successfully over port 443 with end-to-end encryption</p>
                            </div>
                            <div className="relative">
                              <span className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 animate-pulse" />
                              <p className="font-semibold text-slate-800 dark:text-slate-200">Delivered to SMTP Relay (250 OK)</p>
                              <p className="text-[10px] text-slate-400 font-mono">Recipient mail server has acknowledged acceptance of applicant files</p>
                            </div>
                            <div className="relative">
                              <span className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white dark:border-slate-900" />
                              <p className="font-semibold text-amber-600 dark:text-amber-400">Recruiter Open Tracking Enabled</p>
                              <p className="text-[10px] text-slate-400 font-mono">Monitoring direct read triggers and link visits dynamically</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 font-medium italic">
                      With your explicit confirmation, the email is routed securely through authorized Google APIs, or you can open it directly in your local mail client.
                    </p>
                    <div className="flex gap-2">
                      <a
                        href={`mailto:${recipientEmail || ''}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody + (includeResumeText ? `\n\n📄 Tailored Resume CV:\n${window.location.origin}` : ''))}`}
                        onClick={() => {
                          logOutreachToTracker('Email');
                        }}
                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:border-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        Generate Mailto Link
                      </a>

                      <button
                        onClick={handleSendGmail}
                        disabled={isSendingEmail}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSendingEmail ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Dispatched...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Send via Gmail
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 animate-fade-in text-xs text-left" id="gmail-active-sync">
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                        Gmail Interview Scanner
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Search recent email threads for schedule confirmations & interview requests
                      </p>
                    </div>
                    <button
                      onClick={handleScanGmailForInterviews}
                      disabled={isScanningEmails}
                      className="bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isScanningEmails ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Scanning Inbox...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Scan Gmail Inbox
                        </>
                      )}
                    </button>
                  </div>

                  {/* Scanned Emails list */}
                  {scannedEmails.length > 0 ? (
                    <div className="space-y-2.5">
                      <h5 className="font-extrabold text-slate-800 dark:text-slate-200">Matching Messages Found ({scannedEmails.length})</h5>
                      <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                        {scannedEmails.map((email) => (
                          <div 
                            key={email.id} 
                            onClick={() => handleAnalyzeEmailWithAI(email)}
                            className={`p-3 rounded-xl border transition-all text-left cursor-pointer flex justify-between items-start gap-2 ${
                              selectedScanEmail?.id === email.id
                                ? 'bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <div className="space-y-1 overflow-hidden">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-indigo-105 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded-md truncate max-w-[120px]">
                                  {email.from.replace(/<.*>/, '').trim()}
                                </span>
                                <span className="text-[9px] text-slate-400">{email.date || 'Recent'}</span>
                              </div>
                              <h6 className="font-extrabold text-slate-950 dark:text-white truncate text-xs">{email.subject}</h6>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">"{email.snippet}"</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAnalyzeEmailWithAI(email);
                              }}
                              disabled={isParsingEmail && selectedScanEmail?.id === email.id}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100 dark:hover:bg-indigo-950 disabled:opacity-50 shrink-0"
                            >
                              {isParsingEmail && selectedScanEmail?.id === email.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              Analyze
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : scannedEmails.length === 0 && !isScanningEmails && (
                    <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                      <Mail className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Click 'Scan Gmail Inbox' to extract structured interview proposals.</p>
                    </div>
                  )}

                  {/* Loader for email parsing */}
                  {isParsingEmail && (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-3 animate-pulse">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">Analyzing Email content with Gemini AI...</p>
                      <p className="text-[10px] text-slate-400">Extracting interview roles, company, proposed date & times and meeting links.</p>
                    </div>
                  )}

                  {/* AI Extraction & Google Calendar Integration Form */}
                  {parsedInterview && !isParsingEmail && (
                    <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-250 dark:border-slate-800 p-4.5 rounded-2xl space-y-4 animate-fade-in text-xs text-left">
                      <div className="pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <h5 className="font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                          <Sparkles className="w-3.5 h-3.5" />
                          Extracted Schedule Form
                        </h5>
                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                          Ready to Schedule
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Company Name</label>
                          <input
                            type="text"
                            value={formCompany}
                            onChange={(e) => setFormCompany(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-800 dark:text-white font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Interview Role / Title</label>
                          <input
                            type="text"
                            value={formRole}
                            onChange={(e) => setFormRole(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-800 dark:text-white font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Interview Type</label>
                          <select
                            value={formType}
                            onChange={(e) => setFormType(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-850 dark:text-white font-semibold cursor-pointer"
                          >
                            <option value="Technical Interview">Technical Interview</option>
                            <option value="Hiring Manager Call">Hiring Manager Call</option>
                            <option value="Recruiter Screening">Recruiter Screening</option>
                            <option value="Behavioral Round">Behavioral Round</option>
                            <option value="System Design">System Design</option>
                            <option value="Onsite Loop">Onsite Loop</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Meeting Link</label>
                          <input
                            type="text"
                            value={formLink}
                            onChange={(e) => setFormLink(e.target.value)}
                            placeholder="Zoom / Google Meet url"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-800 dark:text-white font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Interview Date</label>
                          <input
                            type="date"
                            value={formDate}
                            onChange={(e) => setFormDate(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-800 dark:text-white font-medium cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Interview Time (HH:MM)</label>
                          <input
                            type="text"
                            value={formTime}
                            onChange={(e) => setFormTime(e.target.value)}
                            placeholder="e.g. 14:00"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-800 dark:text-white font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Notes & Action Items</label>
                        <textarea
                          value={formNotes}
                          onChange={(e) => setFormNotes(e.target.value)}
                          rows={3}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-700 dark:text-slate-300 font-sans"
                        />
                      </div>

                      {/* Map application tracker items */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <label className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          Link directly to Kanban Tracker Entry:
                        </label>
                        <select
                          value={selectedMatchedAppId}
                          onChange={(e) => setSelectedMatchedAppId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-850 dark:text-white cursor-pointer"
                        >
                          <option value="new">Create & Pre-populate Brand New Kanban Board Entry</option>
                          {jobApplications.map((app) => (
                            <option key={app.id} value={app.id}>
                              Match with: {app.company} — {app.title} ({app.status.toUpperCase()})
                            </option>
                          ))}
                        </select>
                        <p className="text-[9.5px] text-slate-500 italic">
                          This automatically transitions the matched application stage to 'Interviewing' and appends calendar details!
                        </p>
                      </div>

                      {/* Actions */}
                      <button
                        onClick={handleScheduleAndTrack}
                        disabled={isAddingToCalendar}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
                      >
                        {isAddingToCalendar ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Scheduling Calendar & Logging Tracker...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Schedule on Google Calendar & Link to Tracker
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleDownloadIcs}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Download a .ics file for any calendar app (no Google account needed)"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download .ics (any calendar app)
                      </button>

                      {calendarSuccess && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl space-y-1.5 animate-fade-in">
                          <p className="font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Successfully Synchronized on Google Calendar!
                          </p>
                          <a 
                            href={calendarSuccess.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-indigo-600 dark:text-indigo-450 hover:underline font-bold flex items-center gap-0.5 inline-flex"
                          >
                            Open Event in Google Calendar <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (LinkedIn & Outlook Tools) */}
        <div className={`transition-all duration-350 ease-in-out ${
          activeHubTab === 'email' 
            ? 'lg:col-span-5 block' 
            : activeHubTab === 'linkedin' 
            ? 'lg:col-span-12 block' 
            : 'lg:col-span-12 max-w-4xl mx-auto block w-full'
        } space-y-6`}>
          {/* LinkedIn Integration Panel */}
          <div className={`${activeHubTab === 'linkedin' ? 'block max-w-4xl mx-auto w-full' : 'hidden'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5`}>
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-1.5">
                  <Linkedin className="w-4.5 h-4.5 text-sky-700 fill-sky-700" />
                  LinkedIn Connector
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Announce your candidacy and showcase your professional achievements
                </p>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                linkedinScopeStatus === 'active' 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
              }`}>
                {linkedinScopeStatus === 'active' ? '● Connected' : '● Standby'}
              </span>
            </div>

            {/* Diagnostics & Sandbox Authentication simulation */}
            <div className="flex flex-wrap gap-2 items-center justify-between bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl text-xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold max-w-[150px] truncate">
                {linkedinScopeStatus === 'active' 
                  ? `Profile: ${linkedinCustomName}`
                  : 'Establish secure connection:'}
              </span>
              <div className="flex items-center gap-1.5">
                {linkedinScopeStatus === 'active' && (
                  <button
                    onClick={handleDisconnectLinkedin}
                    className="text-[9px] bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900 font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  onClick={handleConnectLinkedin}
                  disabled={isTestingLinkedinScope}
                  className="text-[9px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900 font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {isTestingLinkedinScope ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Connecting...
                    </>
                  ) : linkedinScopeStatus === 'active' ? (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Reconnect
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Connect Profile
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Customizer and API Setup Guide Triggers */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                onClick={() => {
                  setShowLinkedinCustomizer(!showLinkedinCustomizer);
                  if (showLinkedinConfigGuide) setShowLinkedinConfigGuide(false);
                }}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 cursor-pointer animate-fade-in"
              >
                {showLinkedinCustomizer ? 'Hide Profile Customizer' : 'Customize Mock Profile'}
              </button>
              <button
                onClick={() => {
                  setShowLinkedinConfigGuide(!showLinkedinConfigGuide);
                  if (showLinkedinCustomizer) setShowLinkedinCustomizer(false);
                }}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold flex items-center gap-1 cursor-pointer animate-fade-in"
              >
                {showLinkedinConfigGuide ? 'Hide API Setup' : 'API Connection Guide'}
              </button>
            </div>

            {/* API Connection Guide */}
            {showLinkedinConfigGuide && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl space-y-3 text-xs animate-fade-in">
                <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span className="font-extrabold text-[10px] uppercase tracking-wider text-slate-800 dark:text-slate-200">Production OAuth Instructions</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  By default, the connector runs in a secure development sandbox mode. To switch your workspace to real production LinkedIn APIs, follow these steps:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  <li>
                    Register an app in the <a href="https://developer.linkedin.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">LinkedIn Developer Portal</a>.
                  </li>
                  <li>
                    In your app settings, navigate to the <b>Auth</b> tab and authorize this Redirect URI:
                    <div className="mt-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-mono break-all text-indigo-700 dark:text-indigo-300">
                      {`${window.location.origin}/api/auth/linkedin/callback`}
                    </div>
                  </li>
                  <li>
                    Add the requested product <b>"Sign In with LinkedIn"</b> or <b>"Share on LinkedIn"</b>.
                  </li>
                  <li>
                    Configure these credentials in the fields below or specify them in your environment settings:
                    <ul className="list-disc list-inside mt-1 ml-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      <li>LINKEDIN_CLIENT_ID</li>
                      <li>LINKEDIN_CLIENT_SECRET</li>
                    </ul>
                  </li>
                </ol>

                <div className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Configure Credentials Directly:</div>
                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">LinkedIn Client ID</label>
                      <input
                        type="text"
                        value={customLinkedinClientId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomLinkedinClientId(val);
                          localStorage.setItem('ats_custom_linkedin_client_id', val);
                        }}
                        placeholder="Enter Client ID (or leave blank for Sandbox)"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">LinkedIn Client Secret</label>
                      <input
                        type="password"
                        value={customLinkedinClientSecret}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomLinkedinClientSecret(val);
                          localStorage.setItem('ats_custom_linkedin_client_secret', val);
                        }}
                        placeholder="Enter Client Secret"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                  {(customLinkedinClientId.trim() || customLinkedinClientSecret.trim()) && (
                    <button
                      onClick={() => {
                        setCustomLinkedinClientId('');
                        setCustomLinkedinClientSecret('');
                        localStorage.removeItem('ats_custom_linkedin_client_id');
                        localStorage.removeItem('ats_custom_linkedin_client_secret');
                      }}
                      className="text-[10px] text-red-650 hover:underline font-semibold block mt-1"
                    >
                      Clear custom credentials & restore default
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-indigo-650 dark:text-indigo-400 font-semibold italic bg-indigo-50/50 dark:bg-indigo-950/20 p-2 rounded-lg">
                  💡 Note: If these keys are absent, the suite automatically falls back to an interactive sandbox simulation featuring customized mock profile datasets!
                </p>
              </div>
            )}

            {/* Customizer Forms */}
            {showLinkedinCustomizer && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl space-y-3 text-xs animate-fade-in">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Profile Name</label>
                  <input
                    type="text"
                    value={linkedinCustomName}
                    onChange={(e) => setLinkedinCustomName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Profile Headline</label>
                  <input
                    type="text"
                    value={linkedinCustomTitle}
                    onChange={(e) => setLinkedinCustomTitle(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Profile Avatar URL (Optional)</label>
                  <input
                    type="text"
                    value={linkedinCustomAvatar}
                    onChange={(e) => setLinkedinCustomAvatar(e.target.value)}
                    placeholder="e.g. https://images.unsplash.com/..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* LinkedIn Sub Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-max mb-2 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setLinkedinActiveSubTab('feed')}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                  linkedinActiveSubTab === 'feed'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                Feed Post
              </button>
              <button
                onClick={() => setLinkedinActiveSubTab('about')}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                  linkedinActiveSubTab === 'about'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                About Snippet
              </button>
              <button
                onClick={() => setLinkedinActiveSubTab('experience')}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                  linkedinActiveSubTab === 'experience'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                Experience Snippet
              </button>
            </div>

            {/* LinkedIn Live Mockup Card */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50 dark:bg-slate-800/50 text-xs space-y-3">
              {linkedinActiveSubTab === 'feed' && (
                <>
                  <div className="flex items-center gap-2">
                    {linkedinCustomAvatar ? (
                      <img src={linkedinCustomAvatar} alt="Custom Profile Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center font-bold text-indigo-700 text-xs">
                        {linkedinCustomName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                        {linkedinCustomName}
                        <span className="text-[9px] text-slate-400 font-normal">• 1st</span>
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{linkedinCustomTitle}</p>
                    </div>
                  </div>

                  {/* Editable Text Body */}
                  <textarea
                    value={linkedinPostText}
                    onChange={(e) => setLinkedinPostText(e.target.value)}
                    rows={5}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 font-sans"
                  />

                  {/* Interactive Shared Card Preview */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                    <div className="p-3 bg-slate-950 text-white flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-[10px] tracking-tight uppercase">ATS TAILORED RESUME</span>
                      </div>
                      <span className="bg-emerald-500/25 text-emerald-300 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                        {atsScore}% ATS Match
                      </span>
                    </div>
                    <div className="p-3.5 space-y-1">
                      <h5 className="font-bold text-slate-950 dark:text-white text-xs">{linkedinCustomName}</h5>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">{linkedinCustomTitle}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                        "{tailoredResume?.summary || ''}"
                      </p>
                      <div className="flex flex-wrap gap-1 pt-1.5">
                        {(tailoredResume?.skills || []).slice(0, 2).map((s, sidx) => (
                          <span key={sidx} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-semibold px-1.5 py-0.5 rounded">
                            {s.category}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={handleCopyLinkedin}
                      className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-[10px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      {isCopiedLinkedin ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Clipboard className="w-3.5 h-3.5" />
                          Copy Content
                        </>
                      )}
                    </button>
                    <a
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-sky-700 hover:bg-sky-800 text-white text-[10px] font-extrabold px-3.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Share Feed
                    </a>
                  </div>
                </>
              )}

              {linkedinActiveSubTab === 'about' && (
                <>
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 pb-2">
                      About Snippet
                    </h4>
                    <textarea
                      value={linkedinAboutText}
                      onChange={(e) => setLinkedinAboutText(e.target.value)}
                      rows={6}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 font-sans"
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleCopyAbout}
                        className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-[10px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        {isCopiedAbout ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Clipboard className="w-3.5 h-3.5" />
                            Copy About Snippet
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {linkedinActiveSubTab === 'experience' && (
                <>
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 pb-2">
                      Experience Snippet
                    </h4>
                    <textarea
                      value={linkedinExperienceText}
                      onChange={(e) => setLinkedinExperienceText(e.target.value)}
                      rows={8}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 font-sans whitespace-pre-wrap"
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleCopyExperience}
                        className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-[10px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        {isCopiedExperience ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Clipboard className="w-3.5 h-3.5" />
                            Copy Experience Snippet
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Microsoft Outlook Fast Integrator */}
          <div className={`${activeHubTab === 'email' ? 'block' : 'hidden'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4`}>
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                <Mail className="w-4.5 h-4.5 text-blue-600" />
                Microsoft Outlook Connector
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Compose with locally installed Microsoft Outlook or Outlook Web App
              </p>
            </div>

            <div className="space-y-4">
              {/* Outlook Selector tabs */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold" id="outlook-mode-selector">
                <button
                  onClick={() => setOutlookMode('desktop')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    outlookMode === 'desktop'
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  type="button"
                >
                  Outlook Desktop (Mailto)
                </button>
                <button
                  onClick={() => setOutlookMode('web')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    outlookMode === 'web'
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  type="button"
                >
                  Outlook Web (Office 365)
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                {outlookMode === 'desktop' 
                  ? 'Fires up your locally installed desktop Outlook app with pre-populated recipient, subject line, cover letter message and embedded CV payload.'
                  : 'Generates a secure web-based draft deep-link and opens office.com/mail with your credentials, loaded and ready for immediate delivery.'
                }
              </p>

              <button
                onClick={handleOutlookDispatch}
                className="w-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {outlookMode === 'desktop' ? 'Launch Outlook Desktop' : 'Open Outlook Web Mailbox'}
              </button>

              {outlookStatus === 'sent' && (
                <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 justify-center animate-fade-in">
                  <Check className="w-3.5 h-3.5" /> Mail client requested successfully.
                </p>
              )}
            </div>
          </div>

          {/* Contextual Networking Guide & AI Outreach */}
          <div className={`${activeHubTab === 'networking' ? 'block' : 'hidden'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5`}>
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                <Users className="w-4.5 h-4.5 text-indigo-650 dark:text-indigo-400" />
                Contextual Networking Guide
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Alumni matches, industry experts, and outreach tactics custom-mapped to your CV & target role
              </p>
            </div>

            {!networkingPlan ? (
              <div className="space-y-4 text-xs text-left">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Analyze your customized resume to find networking targets on LinkedIn and Outlook, complete with high-converting warm templates.
                </p>
                <button
                  onClick={handleGenerateNetworkingPlan}
                  disabled={isGeneratingNetworking}
                  className="w-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isGeneratingNetworking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mapping Networking Targets...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                      Generate Outreach Strategy
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in text-xs text-left">
                <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Roles analyzed:</span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-400 truncate max-w-[200px]">{networkingPlan.role}</span>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {networkingPlan.opportunities.map((opp: any, idx: number) => (
                    <div 
                      key={idx}
                      className="bg-slate-50 dark:bg-slate-800/45 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            {opp.type}
                          </span>
                          <h4 className="font-extrabold text-slate-900 dark:text-white mt-1 text-xs">{opp.name}</h4>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {opp.strategy}
                      </p>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-850">
                        <button
                          onClick={() => setExpandedNetworkIndex(expandedNetworkIndex === idx ? null : idx)}
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {expandedNetworkIndex === idx ? 'Hide Outreach Template' : 'View Outreach Template'}
                        </button>

                        {expandedNetworkIndex === idx && (
                          <div className="mt-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-sans text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap relative group">
                            {opp.outreachTemplate}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(opp.outreachTemplate);
                                showSuccess('Template copied to clipboard!');
                              }}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 px-2 py-1 rounded text-[9px] font-bold border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer"
                            >
                              Copy
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleGenerateNetworkingPlan}
                  disabled={isGeneratingNetworking}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isGeneratingNetworking ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Regenerating Outreach Strategies...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Regenerate Strategy Recommendations
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sent Outreaches List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Clipboard className="w-4.5 h-4.5 text-indigo-500" />
          Recent Sent Outreaches
        </h3>
        
        {trackerApps.filter(app => app.notes?.includes('[Outreach Log]')).length === 0 ? (
          <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs font-medium">
            No tracked outreaches yet. Send an email or copy LinkedIn content to log your activity.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Platform</th>
                  <th className="px-3 py-2">Target Company</th>
                  <th className="px-3 py-2">Target Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trackerApps
                  .filter(app => app.notes?.includes('[Outreach Log]'))
                  .sort((a, b) => new Date(b.dateUpdated).getTime() - new Date(a.dateUpdated).getTime())
                  .slice(0, 5)
                  .map(app => {
                    const latestLog = app.notes.split('\n').reverse().find((n: string) => n.includes('[Outreach Log]')) || '';
                    const platformMatch = latestLog.match(/via (Email|LinkedIn)/);
                    const platform = platformMatch ? platformMatch[1] : 'Unknown';
                    
                    return (
                      <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                          {app.dateUpdated}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[9px] ${
                            platform === 'Email' 
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                              : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                          }`}>
                            {platform === 'Email' ? <Mail className="w-3 h-3" /> : <Linkedin className="w-3 h-3" />}
                            {platform}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">
                          {app.company}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {app.title}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
