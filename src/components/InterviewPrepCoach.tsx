import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  HelpCircle, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Send, 
  RefreshCw, 
  ChevronRight, 
  BookOpen, 
  Play, 
  Award, 
  AlertTriangle, 
  FileText,
  Bookmark,
  MessageSquare,
  ThumbsUp,
  Brain,
  Volume2,
  VolumeX,
  Mic,
  MicOff
} from 'lucide-react';
import { ResumeData } from '../types';
import { useToast } from './Toast';
import { apiFetch } from '../utils/apiClient';

interface InterviewQuestion {
  question: string;
  type: 'behavioral' | 'technical' | 'situational';
  intent: string;
  starStrategy: string;
  sampleAnswer: string;
  prepTips: string;
}

interface AnswerFeedback {
  score: number;
  strongPoints: string[];
  areasToImprove: string[];
  suggestedRefinement: string;
}

interface InterviewPrepCoachProps {
  resumeData: ResumeData;
  initialJobDescription?: string;
  aiConfig?: any;
}

export default function InterviewPrepCoach({
  resumeData,
  initialJobDescription = '',
  aiConfig,
}: InterviewPrepCoachProps) {
  const { showError, showToast } = useToast();
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected active question state
  const [activeIdx, setActiveIdx] = useState<number>(0);

  // Practice draft state
  const [userAnswer, setUserAnswer] = useState('');
  const [analyzingAnswer, setAnalyzingAnswer] = useState(false);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Speech Synthesis (TTS) State
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Speech Recognition (STT) State
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Stop active speech or listening on unmount or question change
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeakQuestion = () => {
    if (!questions || !questions[activeIdx]) return;
    
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = questions[activeIdx].question;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel(); // Cancel any current utterances first
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Speech Recognition (STT) is not supported by your current browser. Try Google Chrome or Microsoft Edge.", "warning", 8000);
      return;
    }

    if (isListening) {
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          console.error(e);
        }
      }
      setIsListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        setUserAnswer(prev => (prev ? prev + ' ' : '') + finalTranscript.trim());
      }
    };

    rec.onerror = (err: any) => {
      console.error("Speech recognition error:", err);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    setRecognition(rec);
    try {
      rec.start();
    } catch (e) {
      console.error(e);
    }
  };

  // Generate customized questions
  const handleGenerateQuestions = async () => {
    if (!jobDescription.trim()) {
      setError('Please provide a job description to extract context-rich interview questions.');
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);
    setUserAnswer('');
    try {
      const savedModel = localStorage.getItem('ats_selected_model') || 'gemini-3.5-flash';
      const data = await apiFetch(
        '/api/interview-prep',
        { resumeData, jobDescription, model: savedModel, aiConfig },
        { apiKey: aiConfig?.apiKey }
      );
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setActiveIdx(0);
      } else {
        throw new Error('No questions returned in the payload.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred while generating prep questions. Make sure your Gemini API key is configured.');
      showError('Failed to generate interview prep questions', err);
    } finally {
      setLoading(false);
    }
  };

  // Submit draft answer for AI Coach Feedback
  const handleAnalyzeAnswer = async () => {
    if (!questions || !questions[activeIdx]) return;
    if (!userAnswer.trim()) {
      setFeedbackError('Please draft an answer before submitting it for coach review.');
      return;
    }

    setAnalyzingAnswer(true);
    setFeedbackError(null);
    setFeedback(null);

    try {
      const savedModel = localStorage.getItem('ats_selected_model') || 'gemini-3.5-flash';
      const feedbackData = await apiFetch<AnswerFeedback>(
        '/api/interview-feedback',
        {
          question: questions[activeIdx].question,
          userAnswer: userAnswer,
          jobDescription: jobDescription,
          model: savedModel,
          aiConfig
        },
        { apiKey: aiConfig?.apiKey }
      );
      setFeedback(feedbackData);
    } catch (err: any) {
      console.error(err);
      setFeedbackError(err.message || 'Failed to analyze answer. Please check connection and try again.');
      showError('Failed to analyze your answer', err);
    } finally {
      setAnalyzingAnswer(false);
    }
  };

  const getQuestionTypeBadge = (type: string) => {
    switch (type) {
      case 'behavioral':
        return <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Behavioral (STAR)</span>;
      case 'technical':
        return <span className="bg-sky-100 text-sky-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Technical (Hard Skills)</span>;
      default:
        return <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Situational (Role Fit)</span>;
    }
  };

  return (
    <div className="space-y-6" id="interview-prep-coach-root">
      {/* 1. ONBOARDING / SETUP VIEW */}
      {!questions && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm" id="prep-onboarding-panel">
          <div className="flex flex-col md:flex-row gap-6 md:items-center">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0" id="prep-header-icon">
              <Brain className="w-8 h-8 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">AI Interview Preparation Coach</h2>
              <p className="text-sm text-slate-500">
                Unlock fully customized, role-specific interview prep. Our expert coach builds tough behavioral, technical, and situational questions mapped directly back to **your master resume** and **target job requirements**.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100" id="prep-form">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <FileText className="w-4 h-4 text-slate-400" />
                Provide Target Job Requirements & Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the target job description details, qualifications, or requirements here to let the AI Interview Coach customize your preparation guide..."
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 leading-relaxed"
                rows={7}
                id="prep-job-desc-textarea"
              />
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 text-xs text-rose-700 flex gap-2" id="prep-error">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleGenerateQuestions}
                disabled={loading}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3.5 px-8 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-100 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                id="btn-generate-questions"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI is structuring 6 customized questions...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Customized Interview Prep Guide
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACTIVE MOCK INTERVIEW INTERFACE */}
      {questions && questions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="prep-active-workspace">
          {/* Left Column: Questions Side-list Selector (4 columns) */}
          <div className="lg:col-span-4 space-y-4" id="prep-questions-sidebar">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Bookmark className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Interview Guide</h3>
                </div>
                <button
                  onClick={handleGenerateQuestions}
                  disabled={loading}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                  title="Re-generate questions"
                >
                  <RefreshCw className="w-3 h-3" /> Re-gen
                </button>
              </div>

              {loading && (
                <div className="py-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-[11px] text-slate-400">Updating Questions...</p>
                </div>
              )}

              {!loading && (
                <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1" id="questions-list-selector">
                  {questions.map((q, idx) => {
                    const isActive = activeIdx === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setActiveIdx(idx);
                          setUserAnswer('');
                          setFeedback(null);
                          setFeedbackError(null);
                        }}
                        className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex flex-col gap-1.5 ${
                          isActive
                            ? 'border-indigo-500 bg-indigo-50/20 shadow-xs'
                            : 'border-slate-100 hover:border-slate-200 bg-white'
                        }`}
                        id={`btn-select-question-${idx}`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="text-[10px] font-bold text-slate-400">QUESTION {idx + 1}</span>
                          {getQuestionTypeBadge(q.type)}
                        </div>
                        <p className={`font-semibold line-clamp-2 ${isActive ? 'text-indigo-950' : 'text-slate-700'}`}>
                          {q.question}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick coaching notice */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-xs text-slate-500 flex items-start gap-2.5">
              <BookOpen className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="font-bold text-slate-700">Interview Coach Tip</h4>
                <p className="leading-relaxed">
                  For behavioral questions, always stick to the <strong>STAR</strong> format: describe the Situation, Task, your direct Action, and the quantifiable Result.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Question & Answer Playground (8 columns) */}
          <div className="lg:col-span-8 space-y-6" id="prep-playground-column">
            {/* Active Question Spotlight card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-sm" id="active-question-card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Play className="w-4 h-4 text-emerald-500 fill-emerald-500" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Spotlight Practice</span>
                </div>
                {getQuestionTypeBadge(questions[activeIdx].type)}
              </div>

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-extrabold text-slate-900 leading-snug flex-1">
                    {questions[activeIdx].question}
                  </h3>
                  <button
                    onClick={handleSpeakQuestion}
                    className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex-shrink-0 ${
                      isSpeaking
                        ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100'
                    }`}
                    title="Speak question aloud"
                    type="button"
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5" /> Stop Reading
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" /> Read Question
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-indigo-50/40 rounded-xl p-3 border border-indigo-100/40 text-xs text-indigo-950 flex items-start gap-2" id="question-intent-box">
                  <HelpCircle className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Underlying Recruiter Intent:</strong> {questions[activeIdx].intent}
                  </div>
                </div>
              </div>

              {/* Collapsible Guidance & Sample Answers Accordion style */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2" id="coaching-columns">
                <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 border border-slate-100 text-xs">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1 uppercase tracking-wide text-[10px]">
                    <Award className="w-3.5 h-3.5 text-slate-500" /> STAR Strategy Guide
                  </h4>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                    {questions[activeIdx].starStrategy}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 border border-slate-100 text-xs">
                  <h4 className="font-bold text-indigo-700 flex items-center gap-1 uppercase tracking-wide text-[10px]">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Customized Model Answer
                  </h4>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line font-medium italic">
                    "{questions[activeIdx].sampleAnswer}"
                  </p>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 leading-tight">
                    💡 <strong>Pro Tip:</strong> {questions[activeIdx].prepTips}
                  </p>
                </div>
              </div>
            </div>

            {/* Answer Draft & Real-time AI Grading Sandbox */}
            <div className="bg-white border border-indigo-100 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm" id="answer-sandbox-card">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare className="w-4.5 h-4.5 text-indigo-600" />
                  Coaching Sandbox: Practice Drafting Your Response
                </h3>
                <p className="text-xs text-slate-500">
                  Type your real draft response here. Click the evaluation button to get immediate scoring, STAR audits, and professional phrasings!
                </p>
              </div>

              <div className="space-y-2">
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="e.g. In my past role at Google, I spearheaded a team of 4 to design and deploy a microservice that resolved API latency by 45%. I did this by introducing Redis cache layers..."
                  className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 leading-relaxed min-h-[110px]"
                  rows={4}
                  id="sandbox-response-textarea"
                />

                {feedbackError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-xs text-rose-700 flex gap-1.5" id="feedback-error">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{feedbackError}</span>
                  </div>
                )}

                 <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 font-medium">
                      Word count: {userAnswer.trim().split(/\s+/).filter(Boolean).length} words
                    </span>
                    <button
                      onClick={handleToggleListening}
                      className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        isListening
                          ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100'
                      }`}
                      title={isListening ? 'Stop recording voice dictation' : 'Start dictating your answer using microphone'}
                      type="button"
                    >
                      {isListening ? (
                        <>
                          <MicOff className="w-3.5 h-3.5 text-red-500" /> Stop Dictation
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-indigo-500" /> Dictate Response
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={handleAnalyzeAnswer}
                    disabled={analyzingAnswer || !userAnswer.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 text-white disabled:text-slate-400 font-bold text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    id="btn-analyze-sandbox-answer"
                  >
                    {analyzingAnswer ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Analyze & Score My Answer
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Sandbox AI Grading Report */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border border-indigo-100 rounded-xl p-4 bg-slate-50/40 space-y-4"
                    id="sandbox-feedback-report"
                  >
                    {/* Header Score Circle */}
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3" id="feedback-report-header">
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="w-5 h-5 text-emerald-500" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">Mock Answer Grading Report</h4>
                          <p className="text-[10px] text-slate-400">Based on executive communication criteria</p>
                        </div>
                      </div>

                      {/* Score Value badge */}
                      <div className="flex items-center gap-2 bg-white border border-slate-100 px-3 py-1.5 rounded-full" id="feedback-report-score-pill">
                        <span className="text-[10px] font-bold text-slate-500">GRADE</span>
                        <span className={`text-sm font-black ${
                          feedback.score >= 80 
                            ? 'text-emerald-600' 
                            : feedback.score >= 60 
                            ? 'text-amber-600' 
                            : 'text-rose-500'
                        }`}>
                          {feedback.score}/100
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar score visualizer */}
                    <div className="space-y-1" id="score-bar-visualizer">
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${
                            feedback.score >= 80 
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                              : feedback.score >= 60 
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-500' 
                              : 'bg-gradient-to-r from-rose-500 to-orange-500'
                          }`}
                          style={{ width: `${feedback.score}%` }}
                        />
                      </div>
                    </div>

                    {/* Breakdown Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="feedback-breakdown-grid">
                      {/* Strong points list */}
                      <div className="space-y-2 text-xs" id="feedback-strong-points">
                        <h5 className="font-bold text-emerald-700 flex items-center gap-1 uppercase tracking-wide text-[9px]">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Strong Points
                        </h5>
                        <ul className="space-y-1 text-slate-600 list-none pl-0">
                          {(feedback.strongPoints || []).map((pt, idx) => (
                            <li key={idx} className="flex items-start gap-1.5" id={`strong-pt-${idx}`}>
                              <span className="text-emerald-500 font-bold">•</span>
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Areas to improve */}
                      <div className="space-y-2 text-xs" id="feedback-improve-points">
                        <h5 className="font-bold text-amber-700 flex items-center gap-1 uppercase tracking-wide text-[9px]">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Areas to Refine
                        </h5>
                        <ul className="space-y-1 text-slate-600 list-none pl-0">
                          {(feedback.areasToImprove || []).map((pt, idx) => (
                            <li key={idx} className="flex items-start gap-1.5" id={`improve-pt-${idx}`}>
                              <span className="text-amber-500 font-bold">•</span>
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Suggested Refined STAR answer */}
                    <div className="bg-white border border-indigo-50/60 rounded-xl p-3.5 space-y-2 text-xs" id="suggested-refinement-box">
                      <h5 className="font-bold text-indigo-700 flex items-center gap-1 uppercase tracking-wide text-[9px]">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Coach's Suggested STAR Refinement
                      </h5>
                      <p className="text-slate-600 leading-relaxed italic whitespace-pre-line bg-slate-50/40 p-2.5 rounded-lg border border-slate-100">
                        "{feedback.suggestedRefinement}"
                      </p>
                      <button
                        onClick={() => setUserAnswer(feedback.suggestedRefinement)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 mt-2"
                        type="button"
                      >
                        <RefreshCw className="w-3 h-3" /> Apply Refined Answer to Sandbox
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
