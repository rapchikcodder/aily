// FR-005.2: The floating "Refine" button that triggers the overlay
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

interface RefineButtonProps {
  onClick: () => void;
  isDark: boolean;
  hasText: boolean; // true when the watched text area contains text
}

export function RefineButton({ onClick, isDark, hasText }: RefineButtonProps) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Fade-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Tooltip delay (FR-005.2 spec: 500ms)
  useEffect(() => {
    if (hovered) {
      const t = setTimeout(() => setShowTooltip(true), 500);
      return () => clearTimeout(t);
    } else {
      setShowTooltip(false);
    }
  }, [hovered]);

  return (
    <div className="relative inline-flex items-center group">
      {/* Clean tooltip */}
      {showTooltip && (
        <div
          className={cn(
            'absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none',
            'border shadow-md',
            'animate-in fade-in slide-in-from-bottom-2 duration-200',
            isDark
              ? 'bg-white text-gray-900 border-gray-200'
              : 'bg-gray-900 text-white border-gray-700'
          )}
        >
          Refine this prompt
          {/* Arrow */}
          <span
            className={cn(
              'absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent',
              isDark ? 'border-t-white' : 'border-t-gray-900'
            )}
          />
        </div>
      )}

      {/* Clean button */}
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          opacity: visible ? (hasText ? 1 : 0.6) : 0,
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
          transition: 'opacity 0.3s ease, transform 0.2s ease',
        }}
        className={cn(
          'relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer',
          'bg-blue-500 hover:bg-blue-600',
          'shadow-md hover:shadow-lg',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2'
        )}
        aria-label="Refine this prompt with Prompt Architect"
        title="Refine this prompt"
      >
        {/* Magic wand icon */}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5 text-white"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.707.293l.828.829A1 1 0 0114 4.828l3.536 3.535a1 1 0 010 1.415L14 13.31a1 1 0 01-.707.293H11a1 1 0 01-.707-.293L6.757 9.775a1 1 0 010-1.414l3.536-3.536A1 1 0 0111 4.532V2a1 1 0 011-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
