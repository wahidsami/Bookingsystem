import type { ComponentType } from 'react';
import type { Language } from '../../types';

export interface PublicLandingSectionProps {
  lang: Language;
  onNavigate: (path: string) => void;
}

export type PublicLandingSectionComponentKey =
  | 'b2b-hero'
  | 'platform-capabilities'
  | 'product-showcase'
  | 'partner-cta'
  | 'b2b-footer';

export interface LandingSectionConfig {
  id: string;
  componentKey: PublicLandingSectionComponentKey;
  enabled: boolean;
  order: number;
  visibility?: 'public' | 'hidden';
  analyticsId?: string;
}

export type PublicLandingSectionComponentMap = Record<
  PublicLandingSectionComponentKey,
  ComponentType<PublicLandingSectionProps>
>;
