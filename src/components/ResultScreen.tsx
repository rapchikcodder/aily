// FR-003.2: Mega-Prompt result screen with all output actions
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { toast } from './ui/Toast';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(megaPrompt);

  // Success toast on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      toast.success('Your mega-prompt is ready!');
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedPrompt).then(() => {
      toast.success('Copied to clipboard!');
    });
    onCopy();
  };

  const handleReplace = () => {
    onReplace();
    toast.success('Prompt replaced in chat!');
  };

  const handleAppend = () => {
    onAppend();
    toast.success('Prompt appended to chat!');
  };

  const codeBg = isDark ? 'bg-gray-800/50 border-gray-700 text-gray-100' : 'bg-gray-50/50 border-gray-200 text-gray-800';

  const topicPreview =
    originalTopic.length > 55 ? originalTopic.slice(0, 55) + '...' : originalTopic;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-5 pb-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-green-600 dark:text-green-500">
            Your Mega-Prompt is Ready!
          </h2>
          <p className="text-xs mt-1 truncate text-gray-500 dark:text-gray-400">
            Refined: "{topicPreview}"
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-3 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xl transition-all duration-200 hover:bg-red-500 hover:text-white text-gray-400 hover:scale-110"
        >
          ×
        </button>
      </div>

      {/* Prompt Display / Editor */}
      <div className="flex-1 overflow-hidden flex flex-col px-6 gap-3">
        {/* Toggle edit */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">CO-STAR Mega-Prompt</span>
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-blue-500"
          >
            {isEditing ? 'Preview' : 'Edit'}
          </button>
        </div>

        {/* Prompt display */}
        <div className={cn('rounded-lg max-h-60 overflow-y-auto border-2 border-gray-200 dark:border-gray-700', codeBg)}>
          {isEditing ? (
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full h-full min-h-[200px] p-4 resize-none outline-none bg-transparent font-mono text-xs leading-relaxed"
            />
          ) : (
            <pre className="p-4 whitespace-pre-wrap font-mono text-xs leading-relaxed">{editedPrompt}</pre>
          )}
        </div>
      </div>

      {/* Primary Actions */}
      <div className="px-6 pt-3 pb-2 flex flex-col gap-2">
        <button
          onClick={handleReplace}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Replace Text in Chat
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleAppend}
            className="btn-secondary flex-1"
          >
            + Append
          </button>
          <button
            onClick={handleCopy}
            className="btn-secondary flex-1"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Tertiary Actions */}
      <div className="flex items-center justify-center gap-4 px-6 pb-4 pt-1 text-xs text-gray-500 dark:text-gray-400">
        <button
          onClick={onStartOver}
          className="hover:text-blue-500 transition-colors hover:underline"
        >
          Start Over
        </button>
        <span>•</span>
        <button className="hover:text-blue-500 transition-colors hover:underline">
          Save to History
        </button>
      </div>
    </div>
  );
}
