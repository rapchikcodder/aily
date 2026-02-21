// V3: Custom Tabs component (no external dependency needed)
// Simplified implementation for V3 tabbed question UI

import { useState, createContext, useContext, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextType>({
  activeTab: '',
  setActiveTab: () => {},
});

interface TabsProps {
  defaultValue: string;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg',
        className
      )}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md transition-all',
        isActive
          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
        className
      )}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab } = useContext(TabsContext);

  if (activeTab !== value) return null;

  return <div className={cn('mt-4', className)}>{children}</div>;
}
