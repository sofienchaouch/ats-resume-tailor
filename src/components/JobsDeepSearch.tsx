import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Search,
  Loader2,
  AlertCircle,
  ExternalLink,
  CheckCircle,
  X,
  Download
} from 'lucide-react';
import { ResumeData } from '../types';

interface JobsDeepSearchProps {
  searchBasedOnResume: boolean;
  setSearchBasedOnResume: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  searchLocation: string;
  setSearchLocation: (val: string) => void;
  supportsRelocation: boolean;
  setSupportsRelocation: (val: boolean) => void;
  jobType: string;
  setJobType: (val: string) => void;
  salaryExpectation: string;
  setSalaryExpectation: (val: string) => void;
  remoteStatus: string;
  setRemoteStatus: (val: string) => void;
  isSearchingJobs: boolean;
  searchError: string | null;
  searchResults: any[] | null;
  onClearSearchResults: () => void;
  selectedSearchJobIndex: number | null;
  setSelectedSearchJobIndex: (idx: number | null) => void;
  onDeepSearchJobs: (e: any) => void;
  onImportJobDetails: (job: any) => void;
  masterResume: ResumeData;
  searchQueryUsed: string;
  searchLocationUsed: string;
  batchSelectedIndices?: Set<number>;
  onToggleBatchSelect?: (idx: number) => void;
  onRunBatchTailor?: () => void;
  isBatchRunning?: boolean;
  batchProgress?: { current: number; total: number } | null;
}

export default function JobsDeepSearch({
  searchBasedOnResume,
  setSearchBasedOnResume,
  searchQuery,
  setSearchQuery,
  searchLocation,
  setSearchLocation,
  supportsRelocation,
  setSupportsRelocation,
  jobType,
  setJobType,
  salaryExpectation,
  setSalaryExpectation,
  remoteStatus,
  setRemoteStatus,
  isSearchingJobs,
  searchError,
  searchResults,
  onClearSearchResults,
  selectedSearchJobIndex,
  setSelectedSearchJobIndex,
  onDeepSearchJobs,
  onImportJobDetails,
  masterResume,
  batchSelectedIndices,
  onToggleBatchSelect,
  onRunBatchTailor,
  isBatchRunning,
  batchProgress,
  searchQueryUsed,
  searchLocationUsed
}: JobsDeepSearchProps) {
  const exportToCSV = () => {
    if (!searchResults || searchResults.length === 0) return;
    
    const headers = ['Title', 'Company', 'Location', 'URL', 'Match Score'];
    const rows = searchResults.map(job => [
      `"${job.title?.replace(/"/g, '""') || ''}"`,
      `"${job.company?.replace(/"/g, '""') || ''}"`,
      `"${job.location?.replace(/"/g, '""') || ''}"`,
      `"${job.applyUrl?.replace(/"/g, '""') || ''}"`,
      job.matchScore || ''
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'job_search_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm relative overflow-hidden" id="jobs-deep-search-card">
      {/* Decorative subtle visual gradient accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full blur-2xl opacity-70 pointer-events-none" />

      <div className="space-y-0.5 pb-3 border-b border-slate-100" id="jobs-search-header">
        <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
          AI Jobs Deep Search
        </h2>
        <p className="text-xs text-slate-500 font-medium">Search active web listings with Gemini Search Grounding to import requirements instantly</p>
      </div>

      <form onSubmit={onDeepSearchJobs} className="space-y-3" id="jobs-search-form">
        {/* Search Options Checkbox Group */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 pb-2 border-b border-slate-50" id="search-options-container">
          <div className="flex items-center gap-2" id="search-resume-option-container">
            <input
              type="checkbox"
              id="toggle-search-based-on-resume"
              checked={searchBasedOnResume}
              onChange={(e) => {
                const checked = e.target.checked;
                setSearchBasedOnResume(checked);
                if (checked) {
                  const fallbackTitle = masterResume?.contact?.title || (masterResume?.experience?.[0]?.role) || '';
                  const fallbackLoc = masterResume?.contact?.location || '';
                  setSearchQuery(fallbackTitle);
                  setSearchLocation(fallbackLoc);
                }
              }}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="toggle-search-based-on-resume" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5 selection:bg-transparent">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Search based on my Master Resume profile
            </label>
          </div>

          <div className="flex items-center gap-2" id="search-relocation-option-container">
            <input
              type="checkbox"
              id="toggle-supports-relocation"
              checked={supportsRelocation}
              onChange={(e) => setSupportsRelocation(e.target.checked)}
              className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="toggle-supports-relocation" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5 selection:bg-transparent">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Only search jobs supporting relocation / visa support
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Job Title / Role</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Senior React Developer"
                className="w-full text-xs border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg pl-8 pr-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 bg-slate-50/50 dark:bg-slate-800"
                id="field-search-query"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Location</label>
            <input
              type="text"
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              placeholder="e.g. Remote, Berlin, SF"
              className="w-full text-xs border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 bg-slate-50/50 dark:bg-slate-800"
              id="field-search-location"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Remote Status</label>
            <select
              value={remoteStatus}
              onChange={(e) => setRemoteStatus(e.target.value)}
              className="w-full text-xs border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 bg-slate-50/50 dark:bg-slate-800"
            >
              <option value="">Any</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Job Type</label>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              className="w-full text-xs border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 bg-slate-50/50 dark:bg-slate-800"
            >
              <option value="">Any</option>
              <option value="Full-time">Full-time</option>
              <option value="Contract">Contract</option>
              <option value="Part-time">Part-time</option>
              <option value="Internship">Internship</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Salary Range</label>
            <select
              value={salaryExpectation}
              onChange={(e) => setSalaryExpectation(e.target.value)}
              className="w-full text-xs border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 bg-slate-50/50 dark:bg-slate-800"
            >
              <option value="">Any</option>
              <option value="$50k+">$50k+</option>
              <option value="$80k+">$80k+</option>
              <option value="$120k+">$120k+</option>
              <option value="$150k+">$150k+</option>
              <option value="$200k+">$200k+</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSearchingJobs || (!searchBasedOnResume && !searchQuery.trim())}
          className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-50 font-bold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
          id="btn-jobs-search-submit"
        >
          {isSearchingJobs ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Deep Searching Real Listings...
            </>
          ) : (
            <>
              <Search className="w-3.5 h-3.5" />
              Run Deep Search
            </>
          )}
        </button>
      </form>

      {/* Search Error */}
      {searchError && (
        <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-xs text-rose-700 flex gap-2" id="search-error">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{searchError}</p>
        </div>
      )}

      {/* Search Results */}
      <AnimatePresence>
        {searchResults && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 pt-2"
            id="search-results-panel"
          >
            {searchBasedOnResume && searchQueryUsed && (
              <div className="text-[10px] bg-indigo-50/50 border border-indigo-100 rounded-lg p-2 text-indigo-700 flex items-center gap-1.5" id="auto-search-profile-info">
                <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                <span>AI Profile Search Query Used: <strong>{searchQueryUsed}</strong> {searchLocationUsed ? `in ${searchLocationUsed}` : ''}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Found Postings ({searchResults.length})</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportToCSV}
                  className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 cursor-pointer flex items-center gap-1"
                  type="button"
                >
                  <Download className="w-3 h-3" />
                  Export CSV
                </button>
                <button
                  onClick={onClearSearchResults}
                  className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                  type="button"
                >
                  Clear Results
                </button>
              </div>
            </div>

            {onRunBatchTailor && batchSelectedIndices && (
              <div className="flex items-center justify-between gap-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl px-3 py-2">
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400">
                  {isBatchRunning && batchProgress
                    ? `Tailoring ${batchProgress.current}/${batchProgress.total}...`
                    : `${batchSelectedIndices.size} job${batchSelectedIndices.size !== 1 ? 's' : ''} selected for batch tailoring`}
                </span>
                <button
                  onClick={onRunBatchTailor}
                  disabled={batchSelectedIndices.size === 0 || isBatchRunning}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  type="button"
                >
                  {isBatchRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Tailor Selected
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1" id="search-results-list">
              {searchResults.map((job, idx) => {
                const isSelected = selectedSearchJobIndex === idx;
                const isBatchSelected = batchSelectedIndices?.has(idx) || false;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 }}
                    key={idx}
                    className={`border rounded-xl p-3 transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/20 shadow-xs'
                        : 'border-slate-100 hover:border-slate-300 bg-white'
                    }`}
                    onClick={() => setSelectedSearchJobIndex(isSelected ? null : idx)}
                  >
                    <div className="flex justify-between items-start gap-1">
                      {onToggleBatchSelect && (
                        <input
                          type="checkbox"
                          checked={isBatchSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            onToggleBatchSelect(idx);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 mr-2 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 flex-none"
                          title="Select for batch tailoring"
                        />
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">{job.title}</h4>
                        <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                          {job.company} • <span className="text-slate-500">{job.location}</span>
                        </p>
                        {job.relocationOffered && (
                          <div className="flex flex-wrap gap-1 mt-1.5" id={`relo-info-${idx}`}>
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-150 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Relocation / Visa Support
                            </span>
                            {job.visaSupport && (
                              <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded-md font-medium italic">
                                {job.visaSupport}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0">
                        {job.source || 'Web'}
                      </span>
                    </div>

                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 pt-3 border-t border-indigo-100/50 space-y-3"
                      >
                        <div className="text-[11px] text-slate-600 leading-relaxed max-h-[140px] overflow-y-auto whitespace-pre-line bg-white/60 p-2 rounded-lg border border-slate-100">
                          {job.description}
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                          {job.url && (
                            <a
                              href={job.url}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View Post <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onImportJobDetails(job);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-md shadow-xs transition-all flex items-center gap-1 ml-auto cursor-pointer"
                            type="button"
                          >
                            <CheckCircle className="w-3 h-3" /> Import Requirements & URL
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
