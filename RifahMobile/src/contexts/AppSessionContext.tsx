import React, { createContext, useContext } from 'react';

interface AppSessionContextValue {
    isAuthenticated: boolean;
    login: () => void;
    logout: () => Promise<void>;
    showLogin: () => void;
    showRegister: () => void;
    showForgotPassword: () => void;
    continueAsGuest: () => void;
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
