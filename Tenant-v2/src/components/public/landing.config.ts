import type { Language } from '../../types';
import type { LandingSectionConfig } from './landing.types';

export interface LandingPageConfiguration {
  variant: string;
  sections: LandingSectionConfig[];
}

const DEFAULT_LANDING_CONFIGURATION: Record<Language, LandingPageConfiguration> = {
  ar: {
    variant: 'default',
    sections: [
      { id: 'hero', componentKey: 'hero', enabled: true, order: 10, visibility: 'public', analyticsId: 'landing.hero' },
      { id: 'trust', componentKey: 'trust', enabled: true, order: 20, visibility: 'public', analyticsId: 'landing.trust' },
      { id: 'capabilities', componentKey: 'capabilities', enabled: true, order: 30, visibility: 'public', analyticsId: 'landing.capabilities' },
      { id: 'value-props', componentKey: 'value-props', enabled: true, order: 40, visibility: 'public', analyticsId: 'landing.value-props' },
      { id: 'experience-flow', componentKey: 'experience-flow', enabled: true, order: 50, visibility: 'public', analyticsId: 'landing.experience-flow' },
      { id: 'cta-banner', componentKey: 'cta-banner', enabled: true, order: 60, visibility: 'public', analyticsId: 'landing.cta-banner' },
      { id: 'footer', componentKey: 'footer', enabled: true, order: 70, visibility: 'public', analyticsId: 'landing.footer' }
    ]
  },
  en: {
    variant: 'default',
    sections: [
      { id: 'hero', componentKey: 'hero', enabled: true, order: 10, visibility: 'public', analyticsId: 'landing.hero' },
      { id: 'trust', componentKey: 'trust', enabled: true, order: 20, visibility: 'public', analyticsId: 'landing.trust' },
      { id: 'capabilities', componentKey: 'capabilities', enabled: true, order: 30, visibility: 'public', analyticsId: 'landing.capabilities' },
      { id: 'value-props', componentKey: 'value-props', enabled: true, order: 40, visibility: 'public', analyticsId: 'landing.value-props' },
      { id: 'experience-flow', componentKey: 'experience-flow', enabled: true, order: 50, visibility: 'public', analyticsId: 'landing.experience-flow' },
      { id: 'cta-banner', componentKey: 'cta-banner', enabled: true, order: 60, visibility: 'public', analyticsId: 'landing.cta-banner' },
      { id: 'footer', componentKey: 'footer', enabled: true, order: 70, visibility: 'public', analyticsId: 'landing.footer' }
    ]
  }
};

export function loadLandingConfiguration(lang: Language): LandingPageConfiguration {
  const configuration = DEFAULT_LANDING_CONFIGURATION[lang] || DEFAULT_LANDING_CONFIGURATION.en;
  return {
    ...configuration,
    sections: [...configuration.sections].sort((left, right) => left.order - right.order)
  };
}

export const landingSections = DEFAULT_LANDING_CONFIGURATION.en.sections;
