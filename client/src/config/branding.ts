/**
 * RIFAH PLATFORM BRANDING CONFIGURATION
 * 
 * This is the single source of truth for all branding elements.
 * Change colors, logo, and platform name here to rebrand the entire application.
 */

export const BRANDING = {
    // Platform Identity
    name: "Rifah",
    tagline: "Premium Salon & Spa Booking",

    // Logo Configuration
    logo: {
        text: "RIFAH", // Text-based logo
        url: "/rifah-logo.svg", // Image logo
    },

    // Color Palette (HSL format for Tailwind CSS variables)
    colors: {
        // Primary Brand Color - Main actions, buttons, links
        primary: {
            hue: 262,        // Purple: 262, Blue: 220, Green: 142, Orange: 25
            saturation: 83,  // 0-100%
            lightness: 58,   // 0-100%
        },

        // Secondary Brand Color - Accents, highlights
        secondary: {
            hue: 340,        // Pink: 340, Teal: 180, Amber: 45
            saturation: 82,
            lightness: 52,
        },

        // Accent Color - Special highlights, badges
        accent: {
            hue: 47,         // Gold: 47, Cyan: 190
            saturation: 96,
            lightness: 53,
        },
    },

    // Typography
    fonts: {
        heading: "'Inter', sans-serif",
        body: "'Inter', sans-serif",
    },

    // Contact & Social
    contact: {
        email: "support@rifah.sa",
        phone: "+966 XX XXX XXXX",
        website: "https://rifah.sa",
    },
};

// Generate CSS variables from branding config
export const generateCSSVariables = () => {
    const { primary, secondary, accent } = BRANDING.colors;

    return {
        '--primary': `${primary.hue} ${primary.saturation}% ${primary.lightness}%`,
        '--primary-foreground': '0 0% 100%',
        '--secondary': `${secondary.hue} ${secondary.saturation}% ${secondary.lightness}%`,
        '--secondary-foreground': '0 0% 100%',
        '--accent': `${accent.hue} ${accent.saturation}% ${accent.lightness}%`,
        '--accent-foreground': '0 0% 100%',
    };
};
