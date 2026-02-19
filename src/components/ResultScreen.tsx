// FR-003.2: Mega-Prompt result screen with all output actions
import { useState } from 'react';
import { cn } from '../lib/utils';

interface ResultScreenProps {
  megaPrompt: string;
  originalTopic: string;
  isDark: boolean;
  onReplace: () => void;
  onAppend: () => void;
  onCopy: () => void;
  onStartOver: () => void;
  onClose: () => void;
}

export function ResultScreen({
  megaPrompt,
  originalTopic,
  isDark,
  onReplace,
  onAppend,
  onCopy,
  onStartOver,
  onClose,
}: ResultScreenProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(megaPrompt);
  const [showUndo, setShowUndo] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    onCopy();
  };

  const handleReplace = () => {
    onReplace();
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  const base = isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900';
  const subtle = isDark ? 'text-gray-400' : 'text-gray-500';
  const codeBg = isDark ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-gray-50 border-gray-200 text-gray-800';
  const secondaryBtn = isDark
    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600'
    : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300';

  const topicPreview =
    originalTopic.length > 55 ? originalTopic.slice(0, 55) + '...' : originalTopic;

  return (
    <div className={cn('flex flex-col h-full', base)}>
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-5 pb-3">
        <div className="flex-1">
          <h2 className="text-base font-bold text-green-500">Your Mega-Prompt is Ready!</h2>
          <p className={cn('text-xs mt-1 truncate', subtle)}>
            Refined: "{topicPreview}"
          </p>
        </div>
        <button
          onClick={onClose}
          className={cn(
            'ml-3 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none transition-colors',
            isDark ? 'hover:bg-red-600 text-gray-400' : 'hover:bg-red-500 hover:text-white text-gray-400'
          )}
        >
          ×
        </button>
      </div>

      {/* Prompt Display / Editor */}
      <div className="flex-1 overflow-hidden flex flex-col px-6 gap-3">
        {/* Toggle edit */}
        <div className="flex items-center justify-between">
          <span className={cn('text-xs font-medium', subtle)}>CO-STAR Mega-Prompt</span>
          <button
            onClick={() => setIsEditing((v) => !v)}
            className={cn('text-xs px-2 py-1 rounded-md transition-colors', secondaryBtn)}
          >
            {isEditing ? 'Preview' : 'Edit'}
          </button>
        </div>

        <div className={cn('max-h-60 overflow-y-auto rounded-xl border text-xs leading-relaxed', codeBg)}>
          {isEditing ? (
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className={cn(
                'w-full h-full min-h-[200px] p-4 resize-none outline-none bg-transparent font-mono',
                isDark ? 'text-gray-100' : 'text-gray-800'
              )}
            />
          ) : (
            <pre className="p-4 whitespace-pre-wrap font-mono">{editedPrompt}</pre>
          )}
        </div>
      </div>

      {/* Primary Actions */}
      <div className="px-6 pt-3 pb-2 flex flex-col gap-2">
        <button
          onClick={handleReplace}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Replace Text in Chat
        </button>

        <div className="flex gap-2">
          <button
            onClick={onAppend}
            className={cn('flex-1 py-2 rounded-xl text-sm font-medium transition-colors', secondaryBtn)}
          >
            + Append
          </button>
          <button
            onClick={handleCopy}
            className={cn('flex-1 py-2 rounded-xl text-sm font-medium transition-colors', secondaryBtn)}
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>

      {/* Tertiary Actions */}
      <div className={cn('flex items-center justify-center gap-4 px-6 pb-4 pt-1 text-xs', subtle)}>
        <button
          onClick={onStartOver}
          className="hover:underline transition-opacity hover:opacity-100 opacity-70"
        >
          Start Over
        </button>
        <span>•</span>
        <button className="hover:underline transition-opacity hover:opacity-100 opacity-70">
          Save to History
        </button>
      </div>

      {/* Undo toast */}
      {showUndo && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-3 whitespace-nowrap animate-in slide-in-from-bottom-2">
          Prompt replaced
          <button
            onClick={() => {
              setShowUndo(false);
            }}
            className="underline opacity-80 hover:opacity-100"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
