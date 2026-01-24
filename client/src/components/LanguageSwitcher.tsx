"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { locales, localeNames, Locale } from "@/i18n/config";
import { useState, useRef, useEffect } from "react";

interface LanguageSwitcherProps {
    variant?: 'dropdown' | 'toggle' | 'minimal';
    className?: string;
}

export function LanguageSwitcher({ variant = 'dropdown', className = '' }: LanguageSwitcherProps) {
    const { locale, setLocale, isRTL } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (newLocale: Locale) => {
        setLocale(newLocale);
        setIsOpen(false);
    };

    // Toggle variant - simple switch between two languages
    if (variant === 'toggle') {
        const otherLocale = locale === 'en' ? 'ar' : 'en';
        return (
            <button
                onClick={() => setLocale(otherLocale)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors ${className}`}
                aria-label={`Switch to ${localeNames[otherLocale]}`}
            >
                <span className="text-lg">{locale === 'en' ? '🇸🇦' : '🇺🇸'}</span>
                <span className="text-sm font-medium">{localeNames[otherLocale]}</span>
            </button>
        );
    }

    // Minimal variant - just flags
    if (variant === 'minimal') {
        return (
            <div className={`flex items-center gap-1 ${className}`}>
                {locales.map((loc) => (
                    <button
                        key={loc}
                        onClick={() => setLocale(loc)}
                        className={`p-2 rounded-lg transition-all ${
                            locale === loc 
                                ? 'bg-primary/10 ring-2 ring-primary' 
                                : 'hover:bg-gray-100'
                        }`}
                        aria-label={`Switch to ${localeNames[loc]}`}
                    >
                        <span className="text-xl">{loc === 'en' ? '🇺🇸' : '🇸🇦'}</span>
                    </button>
                ))}
            </div>
        );
    }

    // Dropdown variant (default)
    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:border-gray-300 shadow-sm transition-all"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <span className="text-lg">{locale === 'en' ? '🇺🇸' : '🇸🇦'}</span>
                <span className="text-sm font-medium">{localeNames[locale]}</span>
                <svg 
                    className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div 
                    className={`absolute top-full mt-2 ${isRTL ? 'left-0' : 'right-0'} w-40 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50`}
                    role="listbox"
                >
                    {locales.map((loc) => (
                        <button
                            key={loc}
                            onClick={() => handleSelect(loc)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-start hover:bg-gray-50 transition-colors ${
                                locale === loc ? 'bg-primary/5 text-primary' : ''
                            }`}
                            role="option"
                            aria-selected={locale === loc}
                        >
                            <span className="text-lg">{loc === 'en' ? '🇺🇸' : '🇸🇦'}</span>
                            <span className="text-sm font-medium">{localeNames[loc]}</span>
                            {locale === loc && (
                                <svg className="w-4 h-4 ms-auto text-primary" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

