import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Service, ServiceVariant, Staff, Tenant } from '../api/client';

export type ServiceBookingPaymentMethod = 'at-center' | 'online-full' | 'booking-fee';

export interface ServiceBookingCartItem {
    id: string;
    tenantId: string;
    tenant?: Pick<Tenant, 'id' | 'name' | 'name_en' | 'name_ar' | 'slug' | 'logo'>;
    service: Service;
    variant?: ServiceVariant | null;
    staff?: Staff | null;
    requestedStaffId?: string | null;
    staffId?: string | null;
    startTime: string;
    notes?: string;
    paymentMethod: ServiceBookingPaymentMethod;
    totalPrice: number;
    payableNowAmount: number;
}

interface CartAddResult {
    success: boolean;
    reason?: 'different_tenant';
}

interface ServiceBookingCartContextType {
    items: ServiceBookingCartItem[];
    itemCount: number;
    cartTenantId: string | null;
    cartTenant: ServiceBookingCartItem['tenant'] | null;
    totalPrice: number;
    payableNowTotal: number;
    paymentGroups: Array<{
        paymentMethod: ServiceBookingPaymentMethod;
        count: number;
        totalPrice: number;
        payableNowTotal: number;
    }>;
    addItem: (item: ServiceBookingCartItem) => CartAddResult;
    updateItem: (id: string, updates: Partial<ServiceBookingCartItem>) => void;
    removeItem: (id: string) => void;
    clearCart: () => void;
}

const STORAGE_KEY = '@rifah_service_booking_cart';
const ServiceBookingCartContext = createContext<ServiceBookingCartContextType | undefined>(undefined);

export const ServiceBookingCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<ServiceBookingCartItem[]>([]);

    useEffect(() => {
        void loadCart();
    }, []);

    const loadCart = async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                setItems(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to load service booking cart:', error);
        }
    };

    const saveCart = async (nextItems: ServiceBookingCartItem[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
        } catch (error) {
            console.error('Failed to save service booking cart:', error);
        }
    };

    const addItem = (item: ServiceBookingCartItem): CartAddResult => {
        const currentTenantId = items[0]?.tenantId || null;
        if (currentTenantId && currentTenantId !== item.tenantId) {
            return { success: false, reason: 'different_tenant' };
        }

        const nextItems = [...items, item];
        setItems(nextItems);
        void saveCart(nextItems);
        return { success: true };
    };

    const removeItem = (id: string) => {
        setItems((prev) => {
            const nextItems = prev.filter((item) => item.id !== id);
            void saveCart(nextItems);
            return nextItems;
        });
    };

    const updateItem = (id: string, updates: Partial<ServiceBookingCartItem>) => {
        setItems((prev) => {
            const original = prev.find((item) => item.id === id);
            if (original && updates.tenantId && updates.tenantId !== original.tenantId) {
                return prev;
            }
            const nextItems = prev.map((item) => (
                item.id === id ? { ...item, ...updates, id: item.id } : item
            ));
            void saveCart(nextItems);
            return nextItems;
        });
    };

    const clearCart = () => {
        setItems([]);
        void saveCart([]);
    };

    const totalPrice = useMemo(
        () => items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
        [items]
    );

    const payableNowTotal = useMemo(
        () => items.reduce((sum, item) => sum + Number(item.payableNowAmount || 0), 0),
        [items]
    );

    const paymentGroups = useMemo(() => {
        const groups = new Map<ServiceBookingPaymentMethod, { paymentMethod: ServiceBookingPaymentMethod; count: number; totalPrice: number; payableNowTotal: number }>();

        items.forEach((item) => {
            const group = groups.get(item.paymentMethod) || {
                paymentMethod: item.paymentMethod,
                count: 0,
                totalPrice: 0,
                payableNowTotal: 0,
            };

            group.count += 1;
            group.totalPrice += Number(item.totalPrice || 0);
            group.payableNowTotal += Number(item.payableNowAmount || 0);
            groups.set(item.paymentMethod, group);
        });

        return Array.from(groups.values());
    }, [items]);

    const cartTenantId = items[0]?.tenantId || null;
    const cartTenant = items[0]?.tenant || null;

    return (
        <ServiceBookingCartContext.Provider
            value={{
                items,
                itemCount: items.length,
                cartTenantId,
                cartTenant,
                totalPrice,
                payableNowTotal,
                paymentGroups,
                addItem,
                updateItem,
                removeItem,
                clearCart,
            }}
        >
            {children}
        </ServiceBookingCartContext.Provider>
    );
};

export const useServiceBookingCart = () => {
    const context = useContext(ServiceBookingCartContext);
    if (!context) {
        throw new Error('useServiceBookingCart must be used within a ServiceBookingCartProvider');
    }
    return context;
};
