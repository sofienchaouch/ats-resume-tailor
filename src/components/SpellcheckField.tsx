import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { getSpellingErrors } from '../utils/spellcheck';

interface SpellcheckFieldProps {
  value: string;
  onChange: (val: string) => void;
  type?: 'input' | 'textarea';
  className?: string;
  placeholder?: string;
  rows?: number;
  ignoredWords: string[];
  onIgnoreWord: (word: string) => void;
  enableSpellcheck?: boolean;
}

export default function SpellcheckField({
  value,
  onChange,
  type = 'input',
  className = '',
  placeholder,
  rows = 3,
  ignoredWords,
  onIgnoreWord,
  enableSpellcheck = true
}: SpellcheckFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const typos = enableSpellcheck ? getSpellingErrors(value, ignoredWords) : [];
  const hasTypos = typos.length > 0;

  return (
    <div className="relative w-full group/spellcheck flex flex-col gap-1">
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
          className={`${className} transition-all duration-200 ${
            hasTypos && enableSpellcheck
              ? 'border-rose-400 dark:border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/10'
              : ''
          }`}
          rows={rows}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
          className={`${className} transition-all duration-200 ${
            hasTypos && enableSpellcheck
              ? 'border-rose-400 dark:border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/10'
              : ''
          }`}
        />
      )}

      {/* Real-time spellcheck feedback indicator */}
      {enableSpellcheck && hasTypos && (
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1 text-[10px] bg-rose-50 dark:bg-rose-950/25 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-300 rounded-lg animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
          <span className="font-semibold">Possible typos:</span>
          <div className="flex flex-wrap gap-1 items-center">
            {typos.map((typo) => (
              <span
                key={typo}
                className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/60 font-mono text-[9px] hover:bg-rose-100/50 transition-colors"
              >
                <span className="underline decoration-wavy decoration-rose-500 underline-offset-2">{typo}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onIgnoreWord(typo);
                  }}
                  className="text-[8px] text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer pl-1 border-l border-slate-200 dark:border-slate-800 ml-1 font-bold"
                  title={`Add "${typo}" to dictionary`}
                >
                  Ignore
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
