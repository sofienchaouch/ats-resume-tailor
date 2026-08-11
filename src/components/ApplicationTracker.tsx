import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { getJobApplications, saveJobApplications } from '../db';
import { localDb } from '../utils/localDb';
import { useToast } from './Toast';
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  Calendar, 
  DollarSign, 
  MapPin, 
  ExternalLink, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Building, 
  Bookmark, 
  Award, 
  Archive, 
  FileText,
  User,
  Activity,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export interface JobApplication {
  id: string;
  company: string;
  title: string;
  location: string;
  salary?: string;
  jobUrl?: string;
  status: 'saved' | 'applied' | 'interviewing' | 'offer' | 'archived';
  dateAdded: string;
  dateUpdated: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  gmailThreadId?: string;
}

const STAGES = [
  { id: 'saved', label: 'Saved / Reviewing', color: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700', icon: Bookmark },
  { id: 'applied', label: 'Applied / Sent', color: 'bg-indigo-50 text-indigo-700 border-indigo-150 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/50', icon: Briefcase },
  { id: 'interviewing', label: 'Interviewing', color: 'bg-amber-50 text-amber-700 border-amber-150 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50', icon: Clock },
  { id: 'offer', label: 'Offer Received', color: 'bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50', icon: Award },
  { id: 'archived', label: 'Archived / Closed', color: 'bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50', icon: Archive }
] as const;

export default function ApplicationTracker() {
  const { showError, showSuccess, showToast } = useToast();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);

  // Form State
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [salary, setSalary] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [status, setStatus] = useState<JobApplication['status']>('saved');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');

  const { user } = useAuth();

  // Load from LocalStorage / Firebase
  useEffect(() => {
    const loadGuestApps = async () => {
      try {
        await localDb.migrateFromLocalStorage(['ats_tailor_job_applications']);
        const saved = await localDb.getItem<JobApplication[]>('ats_tailor_job_applications', []);
        setApplications(saved);
      } catch (err) {
        console.error('Failed to load job applications from IndexedDB:', err);
      }
    };

    if (user) {
      getJobApplications(user.uid).then(saved => {
        if (saved) setApplications(saved);
      }).catch(err => console.error('Failed to parse saved applications:', err));
    } else {
      loadGuestApps();
    }
  }, [user]);

  // Sync to LocalStorage / Firebase
  const saveApps = (apps: JobApplication[]) => {
    setApplications(apps);
    if (user) {
      saveJobApplications(user.uid, apps);
    } else {
      localDb.setItem('ats_tailor_job_applications', apps);
    }
  };

  // Gmail API polling for replies
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkReplies = async () => {
      if (!user) return;
      const { getAccessToken } = await import('../lib/firebase');
      const token = await getAccessToken();
      if (!token) return;

      const appliedApps = applications.filter(app => app.status === 'applied' && app.gmailThreadId);
      if (appliedApps.length === 0) return;

      let changed = false;
      const updatedApps = [...applications];

      for (const app of appliedApps) {
        try {
          const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${app.gmailThreadId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            // If there's more than one message in the thread, assume a reply!
            if (data.messages && data.messages.length > 1) {
              const lastMessage = data.messages[data.messages.length - 1];
              // Optional: check if the sender is not the user
              const fromHeader = lastMessage.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'from');
              const userEmail = user.email || '';
              if (fromHeader && !fromHeader.value.includes(userEmail)) {
                // Reply detected!
                const index = updatedApps.findIndex(a => a.id === app.id);
                if (index !== -1) {
                  updatedApps[index] = {
                    ...updatedApps[index],
                    status: 'interviewing',
                    dateUpdated: new Date().toISOString().split('T')[0],
                    notes: (updatedApps[index].notes || '') + '\n[System]: Auto-moved to Interviewing due to email reply detected!'
                  };
                  changed = true;
                  // Notify user
                  showToast(`Recruiter replied for ${app.company} - ${app.title}! Moved to Interviewing.`, 'info', 10000);
                }
              }
            }
          }
        } catch (err) {
          console.error("Error polling thread", app.gmailThreadId, err);
        }
      }

      if (changed) {
        saveApps(updatedApps);
      }
    };

    // Check immediately, then every 30 seconds
    if (applications.length > 0) {
      checkReplies();
      intervalId = setInterval(checkReplies, 30000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [applications.length, user]);

  const handleOpenAddForm = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEditApp = (app: JobApplication) => {
    setEditingAppId(app.id);
    setCompany(app.company);
    setTitle(app.title);
    setLocation(app.location);
    setSalary(app.salary || '');
    setJobUrl(app.jobUrl || '');
    setStatus(app.status);
    setContactName(app.contactName || '');
    setContactEmail(app.contactEmail || '');
    setNotes(app.notes || '');
    setShowAddForm(true);
  };

  const resetForm = () => {
    setEditingAppId(null);
    setCompany('');
    setTitle('');
    setLocation('');
    setSalary('');
    setJobUrl('');
    setStatus('saved');
    setContactName('');
    setContactEmail('');
    setNotes('');
  };

  const handleSaveApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !title.trim()) return;

    const today = new Date().toISOString().split('T')[0];

    if (editingAppId) {
      // Update
      const updated = applications.map(app => {
        if (app.id === editingAppId) {
          return {
            ...app,
            company: company.trim(),
            title: title.trim(),
            location: location.trim(),
            salary: salary.trim() || undefined,
            jobUrl: jobUrl.trim() || undefined,
            status,
            contactName: contactName.trim() || undefined,
            contactEmail: contactEmail.trim() || undefined,
            notes: notes.trim() || undefined,
            dateUpdated: today
          };
        }
        return app;
      });
      saveApps(updated);
    } else {
      // Create
      const newApp: JobApplication = {
        id: 'app_' + Math.random().toString(36).substr(2, 9),
        company: company.trim(),
        title: title.trim(),
        location: location.trim() || 'Remote',
        salary: salary.trim() || undefined,
        jobUrl: jobUrl.trim() || undefined,
        status,
        dateAdded: today,
        dateUpdated: today,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        notes: notes.trim() || undefined
      };
      saveApps([newApp, ...applications]);
    }

    setShowAddForm(false);
    resetForm();
  };

  const handleDeleteApp = (id: string) => {
    setApplications(prev => {
      const filtered = prev.filter(app => app.id !== id);
      if (user) {
        saveJobApplications(user.uid, filtered);
      } else {
        localDb.setItem('ats_tailor_job_applications', filtered);
      }
      return filtered;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('applicationId', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, statusId: JobApplication['status']) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('applicationId');
    if (id) {
      handleMoveStatus(id, statusId);
    }
  };

  const handleMoveStatus = (id: string, newStatus: JobApplication['status']) => {
    const updated = applications.map(app => {
      if (app.id === id) {
        return {
          ...app,
          status: newStatus,
          dateUpdated: new Date().toISOString().split('T')[0]
        };
      }
      return app;
    });
    saveApps(updated);
  };

  // Analytics Helpers
  const counts = {
    total: applications.length,
    saved: applications.filter(a => a.status === 'saved').length,
    applied: applications.filter(a => a.status === 'applied').length,
    interviewing: applications.filter(a => a.status === 'interviewing').length,
    offer: applications.filter(a => a.status === 'offer').length,
    archived: applications.filter(a => a.status === 'archived').length,
  };

  const interviewRate = counts.applied > 0 ? Math.round((counts.interviewing / counts.applied) * 100) : 0;
  const successRate = counts.applied > 0 ? Math.round((counts.offer / counts.applied) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in" id="application-tracker-container">
      {/* 1. PIPELINE STATISTICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="tracker-stats-row">
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl flex items-center gap-4 shadow-sm" title="Total number of jobs you have tracked in your pipeline.">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Tracked</span>
            <span className="text-xl font-black text-slate-800 dark:text-slate-100">{counts.total} Jobs</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl flex items-center gap-4 shadow-sm" title="Number of job applications currently in the 'Interviewing' stage.">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Active Interviews</span>
            <span className="text-xl font-black text-slate-800 dark:text-slate-100">{counts.interviewing} Scheduled</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl flex items-center gap-4 shadow-sm" title="Number of job applications where you have received an offer.">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Offers Secured</span>
            <span className="text-xl font-black text-slate-800 dark:text-slate-100">{counts.offer} Won 🎉</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl flex items-center gap-4 shadow-sm col-span-2 lg:col-span-1" title="Interview-to-Application ratio and Offer-to-Application ratio.">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Conversion Metrics</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {interviewRate}% Interview • {successRate}% Offer
            </span>
          </div>
        </div>
      </div>

      {/* 2. PIPELINE BOARD / KANBAN */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        <div className="space-y-0.5">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Building className="w-4.5 h-4.5 text-indigo-600" />
            Your Tailored Application Board
          </h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Manage, update, and review the current stages of your submitted applications.</p>
        </div>
        <button
          onClick={handleOpenAddForm}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1 transition-all shadow-sm shadow-indigo-100 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Application
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 overflow-x-auto pb-4" id="kanban-columns-container">
        {STAGES.map(stage => {
          const stageApps = applications.filter(app => app.status === stage.id);
          const IconComponent = stage.icon;
          return (
            <div 
              key={stage.id} 
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
              className="bg-slate-50/70 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800 rounded-2xl p-3 space-y-3 min-w-[220px] flex-grow flex flex-col h-[520px]"
            >
              {/* Column Header */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/50 dark:border-slate-800">
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${stage.color} flex items-center gap-1`}>
                  <IconComponent className="w-3 h-3" />
                  {stage.label}
                </span>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-extrabold">{stageApps.length}</span>
              </div>

              {/* Cards List */}
              <div className="space-y-3 overflow-y-auto flex-grow pr-1 custom-scrollbar">
                {stageApps.length === 0 ? (
                  <div className="h-28 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-4">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic font-medium">No postings listed</p>
                  </div>
                ) : (
                  stageApps.map(app => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={app.id}
                      draggable
                      onDragStart={(e: any) => handleDragStart(e, app.id)}
                      className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-3 rounded-xl shadow-xs space-y-2 relative group hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs cursor-grab active:cursor-grabbing"
                    >
                      {/* Actions hover triggers */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditApp(app);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                          title="Edit application parameters"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteApp(app.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          title="Remove application"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1 pr-6">
                        <h4 className="font-extrabold text-slate-900 dark:text-slate-100 leading-tight tracking-tight break-words">{app.title}</h4>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-400" />
                          {app.company}
                        </p>
                      </div>

                      <div className="space-y-1.5 pt-1.5 border-t border-slate-50 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400">
                        {app.location && (
                          <div className="flex items-center gap-1 font-medium">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {app.location}
                          </div>
                        )}
                        {app.salary && (
                          <div className="flex items-center gap-1 font-medium">
                            <DollarSign className="w-3 h-3 text-slate-400" />
                            {app.salary}
                          </div>
                        )}
                        <div className="flex items-center gap-1 font-mono text-[9px] text-slate-400">
                          <Calendar className="w-3 h-3 text-slate-300" />
                          Added {app.dateAdded}
                        </div>
                      </div>

                      {/* Recruiter brief indicator */}
                      {(app.contactName || app.contactEmail) && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg text-[9px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="font-bold truncate">{app.contactName || app.contactEmail}</span>
                        </div>
                      )}

                      {/* Link to details */}
                      {app.jobUrl && (
                        <a
                          href={app.jobUrl}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          className="text-[9px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold flex items-center gap-0.5 hover:underline"
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> View Posting
                        </a>
                      )}

                      {/* Stage shifting control buttons */}
                      <div className="flex items-center gap-1 pt-1.5 border-t border-slate-50 dark:border-slate-800/80">
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Move:</span>
                        <div className="flex flex-wrap gap-1 flex-grow">
                          {STAGES.filter(s => s.id !== app.status).map(s => (
                            <button
                              key={s.id}
                              onClick={() => handleMoveStatus(app.id, s.id)}
                              className="text-[8px] bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 px-1 py-0.5 rounded transition-colors text-slate-500 cursor-pointer uppercase font-extrabold"
                            >
                              {s.id}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. ADD / EDIT APPLICATION MODAL POPUP */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="tracker-form-modal">
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-50 dark:bg-slate-850 p-4 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Briefcase className="w-4.5 h-4.5 text-indigo-500" />
                  {editingAppId ? 'Update Tracked Application' : 'Track New Application'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveApplication} className="p-5 space-y-4 overflow-y-auto flex-grow text-xs leading-relaxed">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Google"
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-850 dark:text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Job Title / Role *</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Senior Frontend Engineer"
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-850 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. London, UK / Remote"
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-850 dark:text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Salary Range</label>
                    <input
                      type="text"
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                      placeholder="e.g. £85k - £100k"
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-850 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Posting URL</label>
                    <input
                      type="url"
                      value={jobUrl}
                      onChange={(e) => setJobUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-850 dark:text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Active Stage</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-850 dark:text-slate-200"
                    >
                      {STAGES.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-150 dark:border-slate-800 space-y-3">
                  <span className="font-bold text-indigo-800 dark:text-indigo-400 block tracking-wide uppercase text-[9px]">Direct Contact Information</span>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 dark:text-slate-400">Recruiter Name</label>
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        className="w-full text-xs border border-slate-250 dark:border-slate-750 rounded-lg p-2 bg-white dark:bg-slate-900 dark:text-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600 dark:text-slate-400">Recruiter Email</label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="recruiter@company.com"
                        className="w-full text-xs border border-slate-250 dark:border-slate-750 rounded-lg p-2 bg-white dark:bg-slate-900 dark:text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Notes / Reminders / Checklist</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Provide any application logs, checklists, interview round dates, or custom follow-ups here..."
                    className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-850 dark:text-slate-200 leading-relaxed"
                    rows={3}
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                  {editingAppId ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteApp(editingAppId);
                        setShowAddForm(false);
                      }}
                      className="text-rose-600 hover:text-rose-800 dark:text-rose-400 font-bold px-2 py-1 flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove Application
                    </button>
                  ) : (
                    <div></div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm shadow-indigo-100 cursor-pointer"
                    >
                      {editingAppId ? 'Update Entry' : 'Log Application'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
