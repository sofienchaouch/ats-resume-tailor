import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search, 
  Sparkles, 
  HelpCircle, 
  FileText, 
  LayoutList, 
  TrendingUp, 
  Info,
  BookOpen,
  Award,
  AlertCircle,
  BarChart2,
  Activity
} from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { KeywordMatch, FormattingCheck, ReadabilityAnalysis } from '../types';

interface AtsDashboardProps {
  atsScoreBefore: number;
  atsScoreAfter: number;
  keywords: KeywordMatch[];
  formattingChecks: FormattingCheck[];
  optimizationSummary: string;
  onFixKeyword?: (term: string, category: 'technical' | 'soft' | 'domain' | 'industry') => void;
  onFixAllKeywords?: () => void;
  onFixFormatting?: (checkName: string) => void;
  readabilityAnalysis?: ReadabilityAnalysis;
}

export default function AtsDashboard({
  atsScoreBefore,
  atsScoreAfter,
  keywords,
  formattingChecks,
  optimizationSummary,
  onFixKeyword,
  onFixAllKeywords,
  onFixFormatting,
  readabilityAnalysis,
}: AtsDashboardProps) {
  const [keywordSearch, setKeywordSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterImportance, setFilterImportance] = useState<string>('all');
  const [chartViewMode, setChartViewMode] = useState<'radar' | 'bar'>('radar');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      const hasDarkClass = document.getElementById('app-root')?.classList.contains('dark') || document.documentElement.classList.contains('dark');
      setIsDark(!!hasDarkClass);
    };
    checkDark();
    const appRoot = document.getElementById('app-root');
    if (appRoot) {
      const observer = new MutationObserver(checkDark);
      observer.observe(appRoot, { attributes: true, attributeFilter: ['class'] });
      return () => observer.disconnect();
    }
  }, []);

  // Theme colors based on dark mode state
  const gridColor = isDark ? '#334155' : '#e2e8f0'; // slate-700 vs slate-200
  const textColor = isDark ? '#94a3b8' : '#64748b'; // slate-400 vs slate-500

  // 1. Category Data for Radar Chart
  const categories = [
    { key: 'technical', label: 'Technical / Hard' },
    { key: 'soft', label: 'Soft Skills' },
    { key: 'domain', label: 'Domain Knowledge' },
    { key: 'industry', label: 'Industry Terms' },
  ];

  const radarData = categories.map((cat) => {
    const catKeywords = keywords.filter((k) => k.category === cat.key);
    const totalRequired = catKeywords.length;
    const masterMatched = catKeywords.filter((k) => k.matchesInMaster > 0).length;
    const tailoredMatched = catKeywords.filter((k) => k.matchesInTailored > 0).length;

    return {
      subject: cat.label,
      'Target Job (Required)': totalRequired,
      'Your Master CV': masterMatched,
      'Tailored Output': tailoredMatched,
    };
  });

  // 2. Individual Keyword Data for Bar Chart
  const topKeywords = [...keywords]
    .sort((a, b) => b.frequencyInJob - a.frequencyInJob)
    .slice(0, 6);

  const barData = topKeywords.map((kw) => ({
    term: kw.term,
    'Required Frequency': kw.frequencyInJob,
    'Your Master CV Matches': kw.matchesInMaster,
    'Tailored Output Matches': kw.matchesInTailored,
  }));

  const hasKeywords = keywords && keywords.length > 0;
  
  const finalRadarData = hasKeywords ? radarData : [
    { subject: 'Technical / Hard', 'Target Job (Required)': 8, 'Your Master CV': 3, 'Tailored Output': 8 },
    { subject: 'Soft Skills', 'Target Job (Required)': 5, 'Your Master CV': 4, 'Tailored Output': 5 },
    { subject: 'Domain Knowledge', 'Target Job (Required)': 6, 'Your Master CV': 2, 'Tailored Output': 6 },
    { subject: 'Industry Terms', 'Target Job (Required)': 4, 'Your Master CV': 1, 'Tailored Output': 4 },
  ];

  // A shared, floored radius so the polygon keeps a readable footprint. With
  // recharts' 'dataMax + 1' a job description that surfaced only a couple of
  // keywords rescaled the whole chart until the shape collapsed into a sliver.
  const radarValues = finalRadarData.flatMap((d) => [
    d['Target Job (Required)'],
    d['Your Master CV'],
    d['Tailored Output'],
  ]);
  const radarAxisMax = Math.max(4, ...radarValues) + 1;

  // Categories the job description simply never mentioned. Worth calling out --
  // otherwise a legitimately flat axis reads as a broken chart.
  const emptyCategories = finalRadarData
    .filter((d) => d['Target Job (Required)'] === 0)
    .map((d) => d.subject);

  const finalBarData = hasKeywords ? barData : [
    { term: 'TypeScript', 'Required Frequency': 4, 'Your Master CV Matches': 1, 'Tailored Output Matches': 4 },
    { term: 'React', 'Required Frequency': 5, 'Your Master CV Matches': 2, 'Tailored Output Matches': 5 },
    { term: 'Node.js', 'Required Frequency': 3, 'Your Master CV Matches': 0, 'Tailored Output Matches': 3 },
    { term: 'System Design', 'Required Frequency': 2, 'Your Master CV Matches': 0, 'Tailored Output Matches': 2 },
    { term: 'Agile', 'Required Frequency': 3, 'Your Master CV Matches': 3, 'Tailored Output Matches': 3 },
    { term: 'CI/CD', 'Required Frequency': 2, 'Your Master CV Matches': 1, 'Tailored Output Matches': 2 },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-lg space-y-1 text-xs">
          <p className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">{label}</p>
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
              <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
              <span className="font-bold text-slate-900 dark:text-white">{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const filteredKeywords = keywords.filter((k) => {
    const matchesSearch = k.term.toLowerCase().includes(keywordSearch.toLowerCase());
    const matchesCategory = filterCategory === 'all' || k.category === filterCategory;
    const matchesImportance = filterImportance === 'all' || k.importance === filterImportance;
    return matchesSearch && matchesCategory && matchesImportance;
  });

  const getStatusIcon = (status: 'pass' | 'warning' | 'fail') => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" id="icon-pass" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" id="icon-warning" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" id="icon-fail" />;
    }
  };

  const getStatusBg = (status: 'pass' | 'warning' | 'fail') => {
    switch (status) {
      case 'pass':
        return 'bg-emerald-50 text-emerald-800 border-emerald-100';
      case 'warning':
        return 'bg-amber-50 text-amber-800 border-amber-100';
      case 'fail':
        return 'bg-rose-50 text-rose-800 border-rose-100';
    }
  };

  const scoreIncrease = Math.max(0, atsScoreAfter - atsScoreBefore);

  return (
    <div className="space-y-6" id="ats-dashboard-root">
      {/* Visual ATS Scoreboard Panel with Concentric Circular Gauge */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 md:p-8" id="ats-gauge-panel">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* Concentric Gauge Graphic */}
          <div className="flex-shrink-0 relative flex items-center justify-center w-44 h-44" id="concentric-gauge-container">
            <svg width="176" height="176" className="transform -rotate-90 drop-shadow-sm">
              <defs>
                <linearGradient id="afterScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" /> {/* emerald-500 */}
                  <stop offset="100%" stopColor="#06b6d4" /> {/* cyan-500 */}
                </linearGradient>
                <linearGradient id="beforeScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f43f5e" /> {/* rose-500 */}
                  <stop offset="100%" stopColor="#f59e0b" /> {/* amber-500 */}
                </linearGradient>
              </defs>
              
              {/* Outer Ring Track (After / Optimized) */}
              <circle
                cx="88"
                cy="88"
                r="72"
                className="stroke-slate-100 fill-none"
                strokeWidth="12"
              />
              {/* Outer Ring Progress (After / Optimized) */}
              <motion.circle
                cx="88"
                cy="88"
                r="72"
                stroke="url(#afterScoreGrad)"
                className="fill-none"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="452.4"
                initial={{ strokeDashoffset: 452.4 }}
                animate={{ strokeDashoffset: 452.4 * (1 - atsScoreAfter / 100) }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />

              {/* Inner Ring Track (Before / Original) */}
              <circle
                cx="88"
                cy="88"
                r="52"
                className="stroke-slate-100/70 fill-none"
                strokeWidth="10"
              />
              {/* Inner Ring Progress (Before / Original) */}
              <motion.circle
                cx="88"
                cy="88"
                r="52"
                stroke="url(#beforeScoreGrad)"
                className="fill-none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="326.7"
                initial={{ strokeDashoffset: 326.7 }}
                animate={{ strokeDashoffset: 326.7 * (1 - atsScoreBefore / 100) }}
                transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
              />
            </svg>

            {/* Inner Dashboard Values */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <span className="text-3xl font-black text-slate-800 tracking-tight leading-none" id="overall-gauge-score">
                {atsScoreAfter}%
              </span>
              <span className="text-[10px] font-extrabold text-emerald-600 tracking-wider uppercase mt-1 flex items-center gap-0.5" id="overall-gauge-label">
                <TrendingUp className="w-3 h-3" /> MATCH
              </span>
            </div>
          </div>

          {/* Description & Impact Metrics */}
          <div className="flex-grow space-y-4 text-center lg:text-left">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100" id="badge-scorecard">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                ATS Parser Fit Scorecard
              </span>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Interactive Match Analytics</h3>
              <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
                Recruiter screening software (ATS) auto-ranks applicants by matching keyword frequency and layout compatibility. Your general CV has been optimized to pass these critical programmatic filters.
              </p>
            </div>

            {/* Score Comparison Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2" id="scorecard-comparison-metrics">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-left space-y-1" id="comparison-before">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Before</span>
                </div>
                <p className="text-2xl font-bold text-slate-700">{atsScoreBefore}%</p>
                <p className="text-[11px] text-slate-500 leading-tight">Missing critical keywords; higher pre-filter risk.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100/80 text-left space-y-1" id="comparison-after">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Optimized</span>
                </div>
                <p className="text-2xl font-black text-emerald-600">{atsScoreAfter}%</p>
                <p className="text-[11px] text-emerald-700 leading-tight">High keyword density and complete layout alignment.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-left space-y-1 flex flex-col justify-center" id="comparison-boost">
                <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Overall Boost</span>
                <p className="text-2xl font-extrabold text-indigo-700 flex items-center gap-1">
                  +{scoreIncrease}%
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                </p>
                <p className="text-[11px] text-indigo-600 leading-tight font-medium">Relevance boost to secure human review.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Skill Gap & Keywords Coverage Analysis */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm" id="skill-gap-visualizer-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800" id="skill-gap-header">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40" id="badge-interactive-gap">
              <BarChart2 className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              Interactive Skill Gap Analytics
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2" id="skill-gap-title">
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              AI Skill Match & Gap Visualizer
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visual comparison of required qualifications vs. your original Master CV vs. the final Tailored Resume.
            </p>
          </div>

          {/* Toggle between Radar and Bar Charts */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/40 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800" id="chart-style-selector">
            <button
              onClick={() => setChartViewMode('radar')}
              className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all flex items-center gap-1 cursor-pointer ${
                chartViewMode === 'radar'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              type="button"
              id="btn-radar-mode"
            >
              Category Radar Map
            </button>
            <button
              onClick={() => setChartViewMode('bar')}
              className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all flex items-center gap-1 cursor-pointer ${
                chartViewMode === 'bar'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              type="button"
              id="btn-bar-mode"
            >
              Keyword Match Gaps
            </button>
          </div>
        </div>

        {/* Visual Charts Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fade-in" id="chart-content-grid">
          <div className="lg:col-span-7 h-[380px] w-full flex items-center justify-center relative" id="recharts-chart-wrapper">
            {chartViewMode === 'radar' ? (
              <>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="46%"
                  outerRadius="68%"
                  data={finalRadarData}
                  // Without room reserved on every side, the longest axis labels
                  // ("Domain Knowledge", "Industry Terms") ran off the plot box
                  // and collided with the legend underneath it.
                  margin={{ top: 16, right: 56, bottom: 24, left: 56 }}
                >
                  <PolarGrid stroke={gridColor} />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: textColor, fontSize: 10, fontWeight: 600 }}
                  />
                  {/* Axis ticks are deliberately hidden: drawn at 30 degrees they
                      cut straight across the polygons and read as stray marks.
                      The tooltip already gives exact per-category counts. */}
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, radarAxisMax]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Target Job (Required)"
                    dataKey="Target Job (Required)"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <Radar
                    name="Your Master CV"
                    dataKey="Your Master CV"
                    stroke="#f43f5e"
                    fill="#f43f5e"
                    fillOpacity={0.1}
                    strokeWidth={2}
                    // Dashed so it stays readable where it sits exactly on top of
                    // the tailored polygon (a very common outcome).
                    strokeDasharray="4 3"
                  />
                  <Radar
                    name="Tailored Output"
                    dataKey="Tailored Output"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '4px' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
              {emptyCategories.length > 0 && (
                <p className="absolute bottom-0 left-0 right-0 text-center text-[10px] text-slate-500 dark:text-slate-400 px-4">
                  No {emptyCategories.join(' or ')} keywords were found in this job description, so
                  {emptyCategories.length > 1 ? ' those axes sit' : ' that axis sits'} at zero.
                </p>
              )}
              </>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={finalBarData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis 
                    dataKey="term" 
                    tick={{ fill: textColor, fontSize: 10, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: textColor, fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} 
                  />
                  <Bar 
                    name="Target Job (Required)" 
                    dataKey="Required Frequency" 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    name="Your Master CV Matches" 
                    dataKey="Your Master CV Matches" 
                    fill="#f43f5e" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    name="Tailored Output Matches" 
                    dataKey="Tailored Output Matches" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Right Column: Dynamic Explanatory Insights Card */}
          <div className="lg:col-span-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl" id="chart-insights-panel">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5" id="insights-heading">
              <Info className="w-4 h-4 text-indigo-500" />
              Visual Gap Insights
            </h4>
            
            <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed" id="insights-content">
              <p>
                The charts represent where your original professional qualifications matched the job description (red area) vs. where the required profile lies (indigo outline).
              </p>
              
              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                  <p>
                    <strong className="text-slate-800 dark:text-slate-200">The Red Gap:</strong> Highlights essential keywords/skills missing or under-represented in your initial Master CV, risking automated ATS rejection.
                  </p>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <p>
                    <strong className="text-slate-800 dark:text-slate-200">The Emerald Expansion:</strong> Showcases how our AI Adaptor successfully bridges the gaps, rewriting achievements in STAR formats to incorporate maximum keyword compliance.
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl flex items-center gap-2.5 shadow-xs" id="gap-quick-tip">
                <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  <strong>Tip:</strong> High Importance keywords listed in the <strong>Keyword Mapping Engine</strong> table below are matched first to boost your immediate parser fit score.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Readability, Style & Clarity Analysis Card */}
      {readabilityAnalysis && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm" id="readability-analysis-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100" id="readability-header">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                Master CV Readability, Style & Clarity Audit
              </h3>
              <p className="text-xs text-slate-500">
                Detailed style analysis of your uploaded Master Resume using deep semantic grading.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2" id="readability-badges">
              <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-indigo-100">
                Complexity: <span className="font-bold capitalize">{readabilityAnalysis.sentenceComplexity}</span>
              </span>
              <span className="bg-slate-50 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200">
                {readabilityAnalysis.readabilityLevel}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="readability-grid">
            {/* Left side: Circular Style & Clarity Score */}
            <div className="lg:col-span-4 flex flex-col items-center justify-center p-5 bg-slate-50/50 border border-slate-100 rounded-2xl text-center space-y-3" id="readability-score-gauge">
              <div className="relative flex items-center justify-center w-28 h-28">
                <svg width="112" height="112" className="transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="46"
                    className="stroke-slate-100 fill-none"
                    strokeWidth="8"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="46"
                    className={`fill-none transition-all duration-1000 ${
                      readabilityAnalysis.styleClarityScore >= 80 ? 'stroke-emerald-500' : readabilityAnalysis.styleClarityScore >= 60 ? 'stroke-amber-500' : 'stroke-rose-500'
                    }`}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 46}
                    strokeDashoffset={2 * Math.PI * 46 * (1 - readabilityAnalysis.styleClarityScore / 100)}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                    {readabilityAnalysis.styleClarityScore}%
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Clarity Score
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-extrabold text-slate-700">Writing Style Quality</p>
                <p className="text-[11px] text-slate-500 px-2 leading-relaxed">
                  {readabilityAnalysis.styleClarityScore >= 80 
                    ? 'Superb phrasing, clear verb usage, and concise professional layouts.' 
                    : readabilityAnalysis.styleClarityScore >= 60
                    ? 'Moderate clarity. Some wordy bullet points or cliché usage can be optimized.'
                    : 'High density of passive voice, corporate fluff, or complex structures.'}
                </p>
              </div>
            </div>

            {/* Middle side: Detailed Stats indicators */}
            <div className="lg:col-span-8 flex flex-col justify-between gap-4" id="readability-metrics-container">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="readability-metrics-grid">
                <div className="p-4 bg-white border border-slate-100 rounded-xl space-y-1.5 shadow-xs" id="metric-words">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Word Count</span>
                  <p className="text-2xl font-bold text-slate-800">{readabilityAnalysis.wordCount}</p>
                  <p className="text-[10px] text-slate-500">Perfect range is 400 - 800 words.</p>
                </div>

                <div className="p-4 bg-white border border-slate-100 rounded-xl space-y-1.5 shadow-xs" id="metric-cliche">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Buzzwords Used</span>
                  <p className="text-2xl font-bold text-amber-600">{readabilityAnalysis.clicheCount}</p>
                  <p className="text-[10px] text-slate-500">Industry clichés reduce screening impact.</p>
                </div>

                <div className="p-4 bg-white border border-slate-100 rounded-xl space-y-1.5 shadow-xs" id="metric-passive">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Passive Phrases</span>
                  <p className="text-2xl font-bold text-rose-500">{readabilityAnalysis.passiveVoiceInstances.length}</p>
                  <p className="text-[10px] text-slate-500">Always lead bullets with active verbs.</p>
                </div>
              </div>

              {/* Actionable recommendations lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="readability-points-lists">
                {/* Improvements */}
                <div className="space-y-2.5 p-4 bg-rose-50/30 border border-rose-100/50 rounded-xl" id="readability-improvements">
                  <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    Critiques & Improvements
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc list-inside">
                    {readabilityAnalysis.improvements.map((imp, idx) => (
                      <li key={idx} className="leading-relaxed pl-1 marker:text-rose-500">{imp}</li>
                    ))}
                  </ul>
                </div>

                {/* Strong Points */}
                <div className="space-y-2.5 p-4 bg-emerald-50/30 border border-emerald-100/50 rounded-xl" id="readability-strengths">
                  <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                    Exceptional Writing Strengths
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc list-inside">
                    {readabilityAnalysis.strongPoints.map((sp, idx) => (
                      <li key={idx} className="leading-relaxed pl-1 marker:text-emerald-500">{sp}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Passive Voice Details */}
          {readabilityAnalysis.passiveVoiceInstances.length > 0 && (
            <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-2" id="passive-voice-breakdown">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                Detected Passive Phrasing
              </h4>
              <p className="text-[11px] text-slate-500 leading-tight">
                These phrases reduce executive impact. Consider rewriting them with immediate active verbs (e.g. "Responsible for leading team" → "Led a cross-functional team of 5").
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1" id="passive-voice-items">
                {readabilityAnalysis.passiveVoiceInstances.map((pv, idx) => (
                  <div key={idx} className="bg-white border border-rose-100 rounded-lg p-2.5 text-xs font-mono text-rose-700 italic border-l-2 border-l-rose-500" id={`pv-item-${idx}`}>
                    "{pv}"
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Tab */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3" id="optimization-summary-card">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          AI Optimization Strategy
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{optimizationSummary}</p>
      </div>

      {/* ATS Formatting Checks */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4" id="formatting-checks-card">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <LayoutList className="w-5 h-5 text-indigo-500" />
          ATS Format Parser Compliance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="checks-list">
          {formattingChecks.map((check, index) => (
            <div
              key={index}
              className={`p-3 border rounded-lg flex items-start justify-between gap-3 transition-colors ${getStatusBg(check.status)} relative group`}
              id={`format-check-${index}`}
            >
              {/* Tooltip */}
              {check.status !== 'pass' && (
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 shadow-xl pointer-events-none">
                  {check.description}
                </div>
              )}
              <div className="flex items-start gap-3">
                {getStatusIcon(check.status)}
                <div className="space-y-0.5" id={`check-desc-${index}`}>
                  <h4 className="text-xs font-bold uppercase tracking-wide">{check.checkName}</h4>
                  <p className="text-xs opacity-90 leading-relaxed">{check.description}</p>
                </div>
              </div>
              {check.status !== 'pass' && onFixFormatting && (
                <button
                  onClick={() => onFixFormatting(check.checkName)}
                  className="flex-shrink-0 text-[10px] font-extrabold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 self-center"
                  id={`btn-fix-format-${index}`}
                >
                  <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                  Fix It
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Keyword Optimization Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4" id="keyword-optimization-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" id="keyword-header">
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Keyword Mapping Engine
            </h3>
            <p className="text-xs text-slate-500">Track and compare critical job requirements</p>
          </div>

          <div className="flex flex-wrap items-center gap-2" id="keyword-filters">
            {keywords.some(kw => kw.matchesInTailored === 0) && onFixAllKeywords && (
              <button
                onClick={onFixAllKeywords}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
                id="btn-fix-all-keywords"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Fix All Missing
              </button>
            )}

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              id="select-category"
            >
              <option value="all">All Categories</option>
              <option value="technical">Technical / Hard</option>
              <option value="soft">Soft Skills</option>
              <option value="domain">Domain / Concepts</option>
              <option value="industry">Industry Terms</option>
            </select>

            <select
              value={filterImportance}
              onChange={(e) => setFilterImportance(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              id="select-importance"
            >
              <option value="all">All Importance</option>
              <option value="high">🔥 High</option>
              <option value="medium">⚡ Medium</option>
              <option value="low">💤 Low</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative" id="search-container">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search keywords mapped..."
            value={keywordSearch}
            onChange={(e) => setKeywordSearch(e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            id="keyword-search-input"
          />
        </div>

        {/* Keywords Table/Grid */}
        <div className="overflow-x-auto border border-slate-100 rounded-lg" id="keywords-table-container">
          <table className="w-full border-collapse text-left" id="keywords-table">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
                <th className="p-3">Keyword / Skill</th>
                <th className="p-3">Category</th>
                <th className="p-3">Importance</th>
                <th className="p-3 text-center">Job Post Count</th>
                <th className="p-3 text-center">In Master</th>
                <th className="p-3 text-center text-emerald-600 font-bold bg-emerald-50/50">In Tailored</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredKeywords.length > 0 ? (
                filteredKeywords.map((kw, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors relative group" id={`keyword-row-${idx}`}>
                    <td className="p-3 font-medium text-slate-800">
                      <span className="flex items-center gap-1.5">
                        {kw.term}
                        {kw.matchesInTailored > kw.matchesInMaster && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full" id={`badge-optimized-${idx}`}>
                            Optimized
                          </span>
                        )}
                      </span>
                      {/* Keyword Tooltip */}
                      {kw.matchesInTailored === 0 && (
                          <div className="absolute left-4 top-full mt-1 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 shadow-xl pointer-events-none">
                              Requirement: <span className="font-bold">{kw.frequencyInJob}</span> occurrences needed in tailored resume, currently <span className="font-bold">{kw.matchesInTailored}</span>.
                          </div>
                      )}
                    </td>
                    <td className="p-3 text-xs capitalize text-slate-500">{kw.category}</td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          kw.importance === 'high'
                            ? 'bg-rose-100 text-rose-800'
                            : kw.importance === 'medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                        id={`badge-importance-${idx}`}
                      >
                        {kw.importance}
                      </span>
                    </td>
                    <td className="p-3 text-center font-medium text-slate-600">{kw.frequencyInJob}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`font-semibold ${
                          kw.matchesInMaster > 0 ? 'text-slate-700' : 'text-slate-300'
                        }`}
                        id={`master-count-${idx}`}
                      >
                        {kw.matchesInMaster}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold bg-emerald-50/20 text-emerald-600" id={`tailored-count-${idx}`}>
                      {kw.matchesInTailored}
                    </td>
                    <td className="p-3 text-right">
                      {kw.matchesInTailored === 0 ? (
                        <button
                          onClick={() => onFixKeyword?.(kw.term, kw.category)}
                          className="inline-flex items-center gap-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded transition-colors cursor-pointer shadow-sm"
                          id={`btn-fix-keyword-${idx}`}
                        >
                          <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                          Fix It
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Matched
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr id="no-keywords-found">
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No keywords found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
