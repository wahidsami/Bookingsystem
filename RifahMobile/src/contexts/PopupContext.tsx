import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AppDialog, DialogVariant } from '../components/ui/AppDialog';
import { AppToast, ToastType } from '../components/ui/AppToast';
import { AppIconProps } from '../components/AppIcon';
import { useLanguage } from './LanguageContext';

export interface ConfirmOptions {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'confirm' | 'destructive';
    icon?: AppIconProps['name'];
}

export interface DialogOptions {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: DialogVariant;
    icon?: AppIconProps['name'];
    showCancel?: boolean;
}

export interface ToastOptions {
    message: string;
    title?: string;
    type?: ToastType;
    duration?: number;
    position?: 'top' | 'bottom';
}

interface PopupContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    showDialog: (options: DialogOptions) => Promise<void>;
    showToast: (options: ToastOptions | string) => void;
    hideDialog: () => void;
    hideToast: () => void;
}

const PopupContext = createContext<PopupContextValue | null>(null);

// Global imperative handler reference for non-component TS modules
type ImperativeHandler = {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    showDialog: (options: DialogOptions) => Promise<void>;
    showToast: (options: ToastOptions | string) => void;
    hideDialog: () => void;
    hideToast: () => void;
};

let activeImperativeHandler: ImperativeHandler | null = null;

export const popup = {
    confirm: (options: ConfirmOptions): Promise<boolean> => {
        if (activeImperativeHandler) {
            return activeImperativeHandler.confirm(options);
        }
        return Promise.resolve(false);
    },
    showDialog: (options: DialogOptions): Promise<void> => {
        if (activeImperativeHandler) {
            return activeImperativeHandler.showDialog(options);
        }
        return Promise.resolve();
    },
    showToast: (options: ToastOptions | string): void => {
        if (activeImperativeHandler) {
            activeImperativeHandler.showToast(options);
        }
    },
    hideDialog: (): void => {
        activeImperativeHandler?.hideDialog();
    },
    hideToast: (): void => {
        activeImperativeHandler?.hideToast();
    },
};

export function PopupProvider({ children }: { children: React.ReactNode }) {
    const { language } = useLanguage();
    const isRTL = language === 'ar';

    // Dialog state
    const [dialogVisible, setDialogVisible] = useState(false);
    const [dialogProps, setDialogProps] = useState<DialogOptions>({ title: '' });
    const dialogResolverRef = useRef<((value: any) => void) | null>(null);

    // Toast state
    const [toastVisible, setToastVisible] = useState(false);
    const [toastProps, setToastProps] = useState<ToastOptions>({ message: '' });

    const hideDialog = useCallback(() => {
        setDialogVisible(false);
        if (dialogResolverRef.current) {
            dialogResolverRef.current(false);
            dialogResolverRef.current = null;
        }
    }, []);

    const hideToast = useCallback(() => {
        setToastVisible(false);
    }, []);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            dialogResolverRef.current = resolve;
            setDialogProps({
                ...options,
                variant: options.variant || 'confirm',
                showCancel: true,
            });
            setDialogVisible(true);
        });
    }, []);

    const showDialog = useCallback((options: DialogOptions): Promise<void> => {
        return new Promise<void>((resolve) => {
            dialogResolverRef.current = resolve;
            setDialogProps(options);
            setDialogVisible(true);
        });
    }, []);

    const showToast = useCallback((options: ToastOptions | string) => {
        const parsed: ToastOptions = typeof options === 'string' ? { message: options } : options;
        setToastProps(parsed);
        setToastVisible(true);
    }, []);

    const handleDialogConfirm = useCallback(() => {
        setDialogVisible(false);
        if (dialogResolverRef.current) {
            dialogResolverRef.current(true);
            dialogResolverRef.current = null;
        }
    }, []);

    const handleDialogCancel = useCallback(() => {
        setDialogVisible(false);
        if (dialogResolverRef.current) {
            dialogResolverRef.current(false);
            dialogResolverRef.current = null;
        }
    }, []);

    // Register active instance for imperative global calls
    useEffect(() => {
        activeImperativeHandler = {
            confirm,
            showDialog,
            showToast,
            hideDialog,
            hideToast,
        };

        return () => {
            if (activeImperativeHandler?.confirm === confirm) {
                activeImperativeHandler = null;
            }
        };
    }, [confirm, showDialog, showToast, hideDialog, hideToast]);

    const contextValue: PopupContextValue = {
        confirm,
        showDialog,
        showToast,
        hideDialog,
        hideToast,
    };

    return (
        <PopupContext.Provider value={contextValue}>
            {children}
            <AppDialog
                visible={dialogVisible}
                title={dialogProps.title}
                message={dialogProps.message}
                variant={dialogProps.variant}
                icon={dialogProps.icon}
                confirmText={dialogProps.confirmText}
                cancelText={dialogProps.cancelText}
                showCancel={dialogProps.showCancel}
                onConfirm={handleDialogConfirm}
                onCancel={handleDialogCancel}
                isRTL={isRTL}
            />
            <AppToast
                visible={toastVisible}
                message={toastProps.message}
                title={toastProps.title}
                type={toastProps.type}
                duration={toastProps.duration}
                position={toastProps.position}
                onDismiss={hideToast}
                isRTL={isRTL}
            />
        </PopupContext.Provider>
    );
}

export function usePopup(): PopupContextValue {
    const context = useContext(PopupContext);
    if (!context) {
        // Safe fallback so calling usePopup outside provider doesn't crash
        return {
            confirm: (options) => popup.confirm(options),
            showDialog: (options) => popup.showDialog(options),
            showToast: (options) => popup.showToast(options),
            hideDialog: () => popup.hideDialog(),
            hideToast: () => popup.hideToast(),
        };
    }
    return context;
}
