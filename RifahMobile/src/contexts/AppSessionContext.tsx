import React, { createContext, useContext } from 'react';
import type { StaffProfile, User } from '../api/client';

interface AppSessionContextValue {
    isAuthenticated: boolean;
    sessionReady: boolean;
    bootstrapping: boolean;
    user: User | null;
    staffProfile: StaffProfile | null;
    appMode: 'customer' | 'staff';
    login: () => void;
    logout: () => Promise<void>;
    showLogin: () => void;
    showRegister: () => void;
    showForgotPassword: () => void;
    continueAsGuest: () => void;
    ensureAuthenticated: (onAuthenticated?: () => void) => boolean;
    refreshSession: () => Promise<boolean>;
}

const AppSessionContext = createContext<AppSessionContextValue | undefined>(undefined);

export function AppSessionProvider({
    children,
    value,
}: {
    children: React.ReactNode;
    value: AppSessionContextValue;
}) {
    return (
        <AppSessionContext.Provider value={value}>
            {children}
        </AppSessionContext.Provider>
    );
}

export function useAppSession() {
    const context = useContext(AppSessionContext);
    if (!context) {
        throw new Error('useAppSession must be used within AppSessionProvider');
    }

    return context;
}
