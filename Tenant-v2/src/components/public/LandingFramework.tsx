import { landingSectionRegistry } from './landing.sections';
import { loadLandingConfiguration } from './landing.config';
import type { PublicLandingSectionProps } from './landing.types';

export { landingSections } from './landing.config';

export function PublicLandingFramework(props: PublicLandingSectionProps) {
  const configuration = loadLandingConfiguration(props.lang);

  return (
    <div className="space-y-6">
      {configuration.sections
        .filter((section) => section.enabled && section.visibility !== 'hidden')
        .map((section) => {
          const Component = landingSectionRegistry[section.componentKey];
          if (!Component) {
            return null;
          }

          return <Component key={section.id} {...props} />;
        })}
    </div>
  );
}
