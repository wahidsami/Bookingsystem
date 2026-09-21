import React from 'react';
import { PopupProvider } from '../contexts/PopupContext';

export function ThemedAlertProvider({ children }: { children: React.ReactNode }) {
    return <PopupProvider>{children}</PopupProvider>;
}

export { usePopup, popup } from '../contexts/PopupContext';
export type { ConfirmOptions, DialogOptions, ToastOptions } from '../contexts/PopupContext';
