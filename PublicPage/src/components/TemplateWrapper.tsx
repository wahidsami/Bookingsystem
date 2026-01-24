/**
 * Template Wrapper
 * Applies template-specific CSS class and conditionally renders sections
 */

import React, { ReactNode } from 'react';
import { useTenant } from '../context/TenantContext';

interface TemplateWrapperProps {
  children: ReactNode;
}

export const TemplateWrapper: React.FC<TemplateWrapperProps> = ({ children }) => {
  const { template, sections } = useTenant();

  // Dynamically import template CSS
  React.useEffect(() => {
    import(`../styles/templates/${template}.css`);
  }, [template]);

  return (
    <div className={`template-${template}`}>
      {children}
    </div>
  );
};

// Export section visibility helpers
export const useSectionVisibility = () => {
  const { sections } = useTenant();
  return sections;
};

