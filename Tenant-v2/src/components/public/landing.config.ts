import type { Language } from '../../types';
import type { LandingSectionConfig } from './landing.types';

export interface LandingPageConfiguration {
  variant: string;
  sections: LandingSectionConfig[];
}

const DEFAULT_LANDING_CONFIGURATION: Record<Language, LandingPageConfiguration> = {
  ar: {
    variant: 'b2b-saas',
    sections: [
      { id: 'b2b-hero', componentKey: 'b2b-hero', enabled: true, order: 10, visibility: 'public', analyticsId: 'landing.b2b-hero' },
      { id: 'platform-capabilities', componentKey: 'platform-capabilities', enabled: true, order: 20, visibility: 'public', analyticsId: 'landing.platform-capabilities' },
      { id: 'product-showcase', componentKey: 'product-showcase', enabled: true, order: 30, visibility: 'public', analyticsId: 'landing.product-showcase' },
      { id: 'partner-cta', componentKey: 'partner-cta', enabled: true, order: 40, visibility: 'public', analyticsId: 'landing.partner-cta' },
      { id: 'b2b-footer', componentKey: 'b2b-footer', enabled: true, order: 50, visibility: 'public', analyticsId: 'landing.b2b-footer' }
    ]
  },
  en: {
    variant: 'b2b-saas',
    sections: [
      { id: 'b2b-hero', componentKey: 'b2b-hero', enabled: true, order: 10, visibility: 'public', analyticsId: 'landing.b2b-hero' },
      { id: 'platform-capabilities', componentKey: 'platform-capabilities', enabled: true, order: 20, visibility: 'public', analyticsId: 'landing.platform-capabilities' },
      { id: 'product-showcase', componentKey: 'product-showcase', enabled: true, order: 30, visibility: 'public', analyticsId: 'landing.product-showcase' },
      { id: 'partner-cta', componentKey: 'partner-cta', enabled: true, order: 40, visibility: 'public', analyticsId: 'landing.partner-cta' },
      { id: 'b2b-footer', componentKey: 'b2b-footer', enabled: true, order: 50, visibility: 'public', analyticsId: 'landing.b2b-footer' }
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
