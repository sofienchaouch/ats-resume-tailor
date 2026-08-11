import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  FileText, 
  Search, 
  Brain, 
  Linkedin, 
  Trello, 
  ArrowRight, 
  CheckCircle, 
  Users, 
  Briefcase, 
  Flame, 
  Award, 
  Compass, 
  Check, 
  ChevronRight, 
  Github, 
  Globe, 
  Database,
  Cpu,
  RefreshCw,
  Gauge
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (view: 'editor' | 'search' | 'ats' | 'interview' | 'cover-letter' | 'integrations' | 'tracker') => void;
  onLoadSample: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  user: any;
  onSignInGoogle: () => void;
}

export default function LandingPage({ 
  onNavigate, 
  onLoadSample, 
  darkMode, 
  onToggleDarkMode,
  user,
  onSignInGoogle
}: LandingPageProps) {
  // Playground simulator state
  const [simulatorStep, setSimulatorStep] = useState<'idle' | 'scanning' | 'optimizing' | 'done'>('idle');
  const [atsScore, setAtsScore] = useState(42);

  const runSimulator = () => {
    if (simulatorStep !== 'idle') return;
    setSimulatorStep('scanning');
    
    // Simulate scan
    setTimeout(() => {
      setSimulatorStep('optimizing');
      setAtsScore(68);
      
      // Simulate optimize
      setTimeout(() => {
        setSimulatorStep('done');
        setAtsScore(96);
      }, 2000);
    }, 1500);
  };

  const resetSimulator = () => {
    setSimulatorStep('idle');
    setAtsScore(42);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 overflow-x-hidden relative" id="landing-page-root">
      
      {/* Decorative Blur Backdrops */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/40 dark:bg-indigo-900/15 rounded-full blur-3xl -z-10" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-emerald-200/30 dark:bg-emerald-900/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-blue-200/30 dark:bg-indigo-950/20 rounded-full blur-3xl -z-10" />

      {/* Navigation Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md shadow-indigo-100 dark:shadow-none" id="landing-logo">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-base font-extrabold text-slate-950 dark:text-white tracking-tight flex items-center gap-1.5 font-sans">
                ATS Resume Tailor
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-wider uppercase">AI Cockpit</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Core Engine</a>
              <a href="#simulator" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Live Simulation</a>
              <a href="#workflow" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">How It Works</a>
              <a href="#testimonials" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Success Stories</a>
            </nav>

            <div className="flex items-center gap-2">
              {/* Dark mode button */}
              <button
                onClick={onToggleDarkMode}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title={darkMode ? 'Switch to Light' : 'Switch to Dark'}
              >
                {darkMode ? <motion.div animate={{ rotate: 180 }}><Sparkles className="w-4 h-4 text-amber-400" /></motion.div> : <Sparkles className="w-4 h-4 text-indigo-500" />}
              </button>

              {user ? (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex text-[11px] font-bold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 rounded-lg">
                    {user.displayName || user.email}
                  </span>
                  <button 
                    onClick={() => onNavigate('editor')}
                    className="text-xs font-bold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    Go to Workspace <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={onSignInGoogle}
                    className="hidden sm:inline-flex text-xs font-bold px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-150 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => {
                      onLoadSample();
                      onNavigate('editor');
                    }}
                    className="text-xs font-bold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    Enter App <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 px-4 max-w-7xl mx-auto" id="hero">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/85 text-indigo-700 dark:text-indigo-400 text-[11px] font-extrabold rounded-full border border-indigo-100 dark:border-indigo-900 shadow-3xs uppercase tracking-wider"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            Groundbreaking ATS Co-Pilot V2.5
          </motion.div>

          {/* Heading */}
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight font-sans"
          >
            Pass the ATS Screening. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-500 to-emerald-500">
              Land the Interview.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed"
          >
            Adapt your master portfolio into targeted, high-scoring resume variations in <strong>English and French</strong>. Fully customized for any job post with real-time keyword optimization, customized cover letters, and integrated interactive interview preparation.
          </motion.p>

          {/* Call to Actions */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4"
          >
            <button
              onClick={() => onNavigate('editor')}
              className="w-full sm:w-auto text-sm font-extrabold px-7 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 group transform active:scale-98"
            >
              Tailor My Resume Now
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => {
                onLoadSample();
                onNavigate('editor');
              }}
              className="w-full sm:w-auto text-sm font-bold px-7 py-4 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-250 dark:border-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              Load Demo Template
            </button>
          </motion.div>

          {/* Trust and Stats Banner */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            {[
              { value: '98.4%', label: 'ATS Match Accuracy', icon: Award, color: 'text-emerald-500' },
              { value: '10x', label: 'Faster Customization', icon: Flame, color: 'text-amber-500' },
              { value: '100% Verified', label: 'Bilingual (EN / FR)', icon: Globe, color: 'text-indigo-500' },
              { value: 'Mock Engine', label: 'Audio Prep Simulator', icon: Brain, color: 'text-violet-500' }
            ].map((stat, i) => {
              const StatIcon = stat.icon;
              return (
                <div key={i} className="bg-white/60 dark:bg-slate-900/45 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 text-center space-y-1 backdrop-blur-xs">
                  <div className="flex justify-center">
                    <StatIcon className={`w-5 h-5 ${stat.color} mb-1`} />
                  </div>
                  <div className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white">{stat.value}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">{stat.label}</div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Interactive Simulator Section */}
      <section className="bg-white dark:bg-slate-900 border-y border-slate-200/80 dark:border-slate-800 py-16 px-4" id="simulator">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-5 space-y-6">
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-lg font-extrabold uppercase tracking-widest">
              Live Interactive Demo
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white leading-tight font-sans">
              Watch AI rewrite achievements and bypass screening barriers in real-time.
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              See how our algorithm parses a generic CV, extracts target job specifications, highlights critical gaps, and instantly applies vocabulary matching to boost ATS rating from deficient to interview-ready.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">1</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Parse & Extract</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Scans your CV for experience timeline, soft skills, and credentials.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">2</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Alignment Matching</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Analyzes semantic density of the target job post and highlights missing core parameters.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">3</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Refine Achievement Density</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Rephrases generic bullet points into results-oriented metrics (CAR formula).</p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onNavigate('editor')}
                className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 group cursor-pointer"
              >
                Launch Live Editor <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            {/* Interactive Simulator Box */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 md:p-6 shadow-md relative overflow-hidden">
              <div className="absolute top-2 right-4 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>

              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                  ATS Match Engine Simulator
                </span>
                
                {simulatorStep !== 'idle' && (
                  <button 
                    onClick={resetSimulator} 
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Reset Demo
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Score Widget */}
                <div className="md:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Target Score</div>
                  
                  <div className="relative flex items-center justify-center w-24 h-24">
                    {/* SVG Progress Circle */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="6" fill="transparent" />
                      <circle cx="48" cy="48" r="40" stroke="currentColor" 
                        className={`${atsScore > 90 ? 'text-emerald-500' : atsScore > 60 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000`} 
                        strokeWidth="6" 
                        fill="transparent" 
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * atsScore) / 100}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-extrabold text-slate-900 dark:text-white transition-all duration-1000">{atsScore}%</span>
                      <span className="text-[8px] font-bold uppercase text-slate-400">Match Rate</span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      atsScore > 90 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 
                      atsScore > 60 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 
                      'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                    }`}>
                      {atsScore > 90 ? 'Optimized' : atsScore > 60 ? 'Warning' : 'Deficient'}
                    </span>
                  </div>
                </div>

                {/* Simulation Screen */}
                <div className="md:col-span-8 space-y-3.5">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3 min-h-[140px] flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400 font-bold mb-1 uppercase">Resume Bullet Optimization</div>
                      
                      {simulatorStep === 'idle' && (
                        <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                          "I was responsible for coding the react front-end elements, fixing rendering bugs, and making sure the styles looked nice."
                        </p>
                      )}

                      {simulatorStep === 'scanning' && (
                        <div className="space-y-1.5">
                          <p className="text-xs text-slate-400 dark:text-slate-500 line-through">
                            "I was responsible for coding the react front-end elements, fixing rendering bugs..."
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                            <span>Scanning keywords for React, DOM, Tailwind CSS, API hooks...</span>
                          </div>
                        </div>
                      )}

                      {simulatorStep === 'optimizing' && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 line-through">
                            "I was responsible for coding the react front-end elements, fixing rendering bugs..."
                          </p>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                            Applying metric amplification & core technology density alignment...
                          </p>
                        </div>
                      )}

                      {simulatorStep === 'done' && (
                        <div className="space-y-2.5 animate-fade-in">
                          <p className="text-xs text-slate-400 dark:text-slate-600 line-through italic">
                            "I was responsible for coding the react front-end elements, fixing rendering bugs..."
                          </p>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold leading-relaxed bg-emerald-500/5 dark:bg-emerald-500/10 p-2 rounded-lg border border-emerald-100 dark:border-emerald-950">
                            "Engineered responsive front-end visual modules using <strong>React 19, TypeScript, and Tailwind CSS</strong>, boosting browser frame-rendering speeds by <strong>34%</strong> and resolving <strong>90+ legacy rendering layout bugs</strong>."
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 dark:text-slate-550 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 font-mono">
                      <span>Status: {
                        simulatorStep === 'idle' ? 'Ready to Simulate' : 
                        simulatorStep === 'scanning' ? 'Running Semantic NLP Parser' : 
                        simulatorStep === 'optimizing' ? 'Synthesizing CAR Metric Vectors' : 
                        'ATS-Optimized CV Achievement Approved'
                      }</span>
                      {simulatorStep === 'done' && <span className="text-emerald-500 font-bold">✓ Approved</span>}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {simulatorStep === 'idle' ? (
                      <button
                        onClick={runSimulator}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                      >
                        Run Live Simulation <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onNavigate('editor')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                      >
                        Try with My Own Resume <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Bento Grid Features Section */}
      <section className="py-16 md:py-24 px-4 max-w-7xl mx-auto" id="features">
        <div className="text-center space-y-3 mb-16">
          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg font-extrabold uppercase tracking-widest">
            The Job Seeker's Cockpit
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-sans">
            Six advanced modules. One unified workflow.
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium">
            Everything you need to apply for careers with extreme confidence, precision, and efficiency.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Master Resume Wizard */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Master Resume Portfolio</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Create a robust central portfolio structure. Drop in PDF/DOCX resumes to auto-import existing experience in seconds with smart AI parsing.
                </p>
              </div>
            </div>
            <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 mt-6 flex items-center justify-between">
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wide">Multi-Section Drag & Drop</span>
              <button onClick={() => onNavigate('editor')} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 2: ATS Score & Audits */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Gauge className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Deep ATS Audit & Keyword Match</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Get structural feedback and critical keyword gap disclosures. Scan job descriptions to find exact matching parameters needed to score above 90%.
                </p>
              </div>
            </div>
            <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 mt-6 flex items-center justify-between">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wide">English & French Support</span>
              <button onClick={() => onNavigate('ats')} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 3: AI Job Search */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Search className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Career Intelligence & Search</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Scan active career boards. Filter for location parameters, salary limits, remote indicators, and options including relocation sponsorship queries.
                </p>
              </div>
            </div>
            <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 mt-6 flex items-center justify-between">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wide">Google Grounding Search</span>
              <button onClick={() => onNavigate('search')} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 4: ATS Cover Letter */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Bespoke Cover Letters</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Synthesize high-fidelity cover letters matched specifically to targeted vacancies. Direct DOCX and PDF export with full visual styling controls.
                </p>
              </div>
            </div>
            <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 mt-6 flex items-center justify-between">
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wide">DOCX & PDF Visual Export</span>
              <button onClick={() => onNavigate('cover-letter')} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 5: Interview Prep Coach */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Brain className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Interactive Mock Prep Coach</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Practice with tailored mock questions. Talk directly with integrated Speech-to-Text mic support and get detailed performance critiques.
                </p>
              </div>
            </div>
            <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 mt-6 flex items-center justify-between">
              <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold uppercase tracking-wide">Integrated Speech-To-Text</span>
              <button onClick={() => onNavigate('interview')} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 cursor-pointer">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 6: Outreach & Tracking */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Trello className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Outreach Hub & Job Tracker</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Connect Gmail and LinkedIn to draft networking outreach. Record activities and manage interviews automatically with a Kanban dashboard.
                </p>
              </div>
            </div>
            <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 mt-6 flex items-center justify-between">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wide">Kanban Tracking Board</span>
              <button onClick={() => onNavigate('tracker')} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* Visual Workspace Process Guide */}
      <section className="bg-slate-100/50 dark:bg-slate-900/40 border-y border-slate-200/80 dark:border-slate-800 py-16 px-4" id="workflow">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-lg font-extrabold uppercase tracking-widest">
              Automated Pipeline
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white font-sans">
              Tailoring in four simple steps.
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto font-medium">
              A highly optimized feedback loop that turns raw skills into hyper-targeted success.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Horizontal Line connector on desktop */}
            <div className="hidden md:block absolute top-12 left-1/8 right-1/8 h-0.5 bg-slate-200 dark:bg-slate-800 -z-10" />

            {[
              {
                step: '01',
                title: 'Onboard Master CV',
                desc: 'Upload any existing PDF, DOCX or JSON file. The system parses structural milestones into your workspace portfolio.',
                icon: FileText
              },
              {
                step: '02',
                title: 'Add Job Vacancy',
                desc: 'Search active listings via carrier search, or paste custom specifications directly into the alignment audit.',
                icon: Search
              },
              {
                step: '03',
                title: 'Align & Regenerate',
                desc: 'Run the match analysis. Optimize resume and cover letter drafts in real-time, matching bilingual targets.',
                icon: Sparkles
              },
              {
                step: '04',
                title: 'Track & Win',
                desc: 'Organize applications using the Kanban planner, draft outbound outreach, and prepare for interviews live.',
                icon: CheckCircle
              }
            ].map((item, index) => {
              const ItemIcon = item.icon;
              return (
                <div key={index} className="space-y-4 text-center md:text-left bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-250/50 dark:border-slate-800 shadow-3xs hover:translate-y-[-2px] transition-transform">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-mono font-extrabold text-indigo-600 dark:text-indigo-400">{item.step}</span>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-slate-850 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <ItemIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">{item.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 px-4 max-w-7xl mx-auto" id="testimonials">
        <div className="text-center space-y-3 mb-16">
          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg font-extrabold uppercase tracking-widest">
            Success Stories
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white font-sans">
            Hear from candidates who landed jobs.
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto font-medium">
            Helping developers, managers, and designers break through automated applicant screening barriers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              quote: "Updating my resume for 20 applications used to take an entire weekend. With this cockpit, I tailor it to precise keywords, export DOCX, and draft a cover letter in less than 5 minutes. Got 4 callbacks last week!",
              name: "Amélie Dubois",
              role: "Senior React Developer",
              company: "Paris Tech Corp",
              initials: "AD"
            },
            {
              quote: "The ATS Score & Audit tool is scary accurate. It highlighted three crucial cloud-architecture keywords I left out of my master CV. After correcting it, my callback rates jumped from practically zero to 40%.",
              name: "Marc-André Moreau",
              role: "DevOps Architect",
              company: "Innovate Financial",
              initials: "MM"
            },
            {
              quote: "I absolutely love the Speech-to-Text mock prep coach. Practicing answers orally and getting direct critical assessments on STAR methods completely removed my interview anxiety. Highly recommended!",
              name: "Sarah Jenkins",
              role: "Product Lead",
              company: "SaaS Rocket",
              initials: "SJ"
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-3xs flex flex-col justify-between">
              <p className="text-xs text-slate-600 dark:text-slate-350 italic leading-relaxed">
                "{item.quote}"
              </p>
              <div className="flex items-center gap-3 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/80">
                <div className="w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold font-mono">
                  {item.initials}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.name}</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.role} @ <span className="font-semibold text-slate-700 dark:text-slate-300">{item.company}</span></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Large CTA Section */}
      <section className="py-16 px-4 max-w-5xl mx-auto text-center">
        <div className="bg-indigo-600 text-white rounded-3xl p-8 md:p-14 space-y-6 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl md:text-4xl font-extrabold font-sans">
              Ready to land your next dream career?
            </h2>
            <p className="text-xs md:text-sm text-indigo-100 leading-relaxed font-medium">
              Start building your master resume now or upload your current CV. Get precise ATS score alignments, generate cover letters, and track applications.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => onNavigate('editor')}
              className="w-full sm:w-auto text-xs font-extrabold px-8 py-3.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer shadow-sm transform active:scale-98 flex items-center justify-center gap-1.5"
            >
              Start For Free <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                onLoadSample();
                onNavigate('editor');
              }}
              className="w-full sm:w-auto text-xs font-bold px-8 py-3.5 bg-indigo-700 text-white hover:bg-indigo-650 rounded-xl transition-all cursor-pointer border border-indigo-550 flex items-center justify-center"
            >
              Load Demo Resume
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 py-12 px-4 transition-colors">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">ATS Resume Tailor</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Bilingual (EN / FR) automated portfolio customizer, cover letter generator, application tracker, and interactive interview preparation coach.
            </p>
          </div>

          <div className="md:col-span-7 flex flex-wrap items-center justify-center md:justify-end gap-x-8 gap-y-4">
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              <span>Built with React 19, Vite, Tailwind & Gemini 2.5/3.5 API</span>
            </div>
            
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              &copy; {new Date().getFullYear()} ATS Resume Tailor. No rights reserved.
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
