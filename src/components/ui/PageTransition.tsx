// FR-UX: Page Transition Wrapper
// Smooth animated transitions for page/stage changes

import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export function PageTransition({ children, direction = 'right' }: PageTransitionProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const transitionClass = {
    left: isVisible ? 'translate-x-0' : '-translate-x-full',
    right: isVisible ? 'translate-x-0' : 'translate-x-full',
    up: isVisible ? 'translate-y-0' : '-translate-y-full',
    down: isVisible ? 'translate-y-0' : 'translate-y-full',
  };

  return (
    <div
      className={cn(
        'transition-all duration-500 ease-out',
        transitionClass[direction],
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
    >
      {children}
    </div>
  );
}
