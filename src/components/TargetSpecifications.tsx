import {
  Briefcase,
  Globe,
  Link2,
  AlertCircle,
  Sparkles,
  History,
  Building,
  Tag
} from 'lucide-react';

interface TargetSpecificationsProps {
  targetLanguage: 'en' | 'fr';
  setTargetLanguage: (lang: 'en' | 'fr') => void;
  jobUrl: string;
  setJobUrl: (url: string) => void;
  jobDescription: string;
  setJobDescription: (desc: string) => void;
  error: string | null;
  onSubmitTailor: (e: any) => void;
  historyList: any[];
  onLoadHistory: (item: any) => void;
  onClearHistory: () => void;
  optimizeForRelocation: boolean;
  setOptimizeForRelocation: (opt: boolean) => void;
  targetCompany: string;
  setTargetCompany: (company: string) => void;
  targetTitle: string;
  setTargetTitle: (title: string) => void;
}

export default function TargetSpecifications({
  targetLanguage,
  setTargetLanguage,
  jobUrl,
  setJobUrl,
  jobDescription,
  setJobDescription,
  error,
  onSubmitTailor,
  historyList,
  onLoadHistory,
  onClearHistory,
  optimizeForRelocation,
  setOptimizeForRelocation,
  targetCompany,
  setTargetCompany,
  targetTitle,
  setTargetTitle
}: TargetSpecificationsProps) {
  return (
    <div className="space-y-4">
      {/* Target Job Specifications Card */}
      <form onSubmit={onSubmitTailor} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm" id="tailoring-form">
        <div className="space-y-0.5 pb-3 border-b border-slate-100 dark:border-slate-800" id="tailor-form-header">
          <h2 className="text-base font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            2. Target Job & Specifications
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Provide the job context to run the keywords matching optimizer</p>
        </div>

        {/* Target Company & Job Title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="target-company-title-fields">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Building className="w-3.5 h-3.5" /> Target Company Name
            </label>
            <input
              type="text"
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              placeholder="e.g. Google, Microsoft, Startup"
              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850"
              id="field-target-company"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" /> Target Job Title
            </label>
            <input
              type="text"
              value={targetTitle}
              onChange={(e) => setTargetTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850"
              id="field-target-title"
            />
          </div>
        </div>

        {/* Languages Selector */}
        <div className="space-y-1.5" id="spec-lang-selector">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Output Resume Language</label>
          <div className="grid grid-cols-2 gap-2" id="spec-lang-toggles">
            <button
              type="button"
              onClick={() => setTargetLanguage('en')}
              className={`text-xs font-bold py-2 px-3 border rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                targetLanguage === 'en'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              id="lang-toggle-en"
            >
              <Globe className="w-3.5 h-3.5" /> English (English)
            </button>
            <button
              type="button"
              onClick={() => setTargetLanguage('fr')}
              className={`text-xs font-bold py-2 px-3 border rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                targetLanguage === 'fr'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              id="lang-toggle-fr"
            >
              <Globe className="w-3.5 h-3.5" /> French (Français)
            </button>
          </div>
        </div>

        {/* Relocation Adaptation Switch */}
        <div className="space-y-1.5" id="spec-relo-selector">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Relocation & Sponsorship Optimization</label>
          <label className="flex items-start gap-2.5 p-2.5 border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 rounded-xl cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
            <input
              type="checkbox"
              checked={optimizeForRelocation}
              onChange={(e) => setOptimizeForRelocation(e.target.checked)}
              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Emphasize Global Mobility & Visa Suitability</span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                Instructs the AI agent to optimize your resume statement and credentials to emphasize global flexibility, multicultural collaboration, and active suitability for visa sponsorship & relocation support.
              </p>
            </div>
          </label>
        </div>

        {/* Job Link */}
        <div className="space-y-1" id="spec-url-field">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
            <Link2 className="w-3.5 h-3.5" /> Job URL / Link (Optional)
          </label>
          <input
            type="url"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="e.g. https://linkedin.com/jobs/view/..."
            className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850"
            id="field-job-url"
          />
        </div>

        {/* Job Description Text */}
        <div className="space-y-1" id="spec-description-field">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Job Post Description / Requirements
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the target job description details, qualifications, tech stack requirements, and roles here to let the ATS engine do full keywords extraction..."
            className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850 leading-relaxed"
            rows={6}
            id="field-job-desc"
          />
        </div>

        {/* Errors display */}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-lg p-3 text-xs text-rose-700 dark:text-rose-300 flex gap-2" id="error-display">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Action button */}
        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 transition-all cursor-pointer"
          id="btn-tailor-resume"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          Adapt & Optimize Resume
        </button>
      </form>

      {/* Local Tailoring History logs */}
      {historyList.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm" id="history-panel">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800" id="history-header">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-400" />
              Recent Tailor History
            </h3>
            <button
              onClick={onClearHistory}
              className="text-[10px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
              id="btn-clear-history"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-1.5 max-h-[180px] overflow-y-auto" id="history-items-container">
            {historyList.map((item) => (
              <div
                key={item.id}
                onClick={() => onLoadHistory(item)}
                className="p-2 border border-slate-50 dark:border-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-all animate-fade-in"
                id={`history-item-${item.id}`}
              >
                <div className="space-y-0.5 truncate pr-2" id={`history-item-meta-${item.id}`}>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.title}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{item.timestamp}</p>
                </div>
                <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded" id={`history-item-score-${item.id}`}>
                  {item.result.atsScoreAfter}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
