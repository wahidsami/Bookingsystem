import api from './api';

export interface PayrollRecord {
    id: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    commission: number;
    tipsTotal: number;
    bonuses: number;
    deductions: number;
    totalNet: number;
    status: 'draft' | 'processed' | 'paid';
    paidAt?: string;
    createdAt: string;
}

export interface EarningsSummary {
    payrolls: PayrollRecord[];
    totals: {
        totalBase: number;
        totalCommission: number;
        totalTips: number;
        totalBonuses: number;
        totalDeductions: number;
        totalNet: number;
    };
    currentMonth: PayrollRecord | null;
}

export interface Review {
    id: string;
    rating: number;
    comment?: string;
    customerName?: string;
    staffReply?: string;
    staffRepliedAt?: string;
    createdAt: string;
}

export interface ReviewsSummary {
    reviews: Review[];
    avgRating: string | null;
    distribution: { [key: number]: number };
    total: number;
}

export const getEarnings = async (): Promise<EarningsSummary> => {
    const response = await api.get('/staff/me/earnings');
    if (response.data.success) return response.data.data;
    throw new Error('Failed to fetch earnings');
};

export const getMyReviews = async (): Promise<ReviewsSummary> => {
    const response = await api.get('/staff/me/reviews');
    if (response.data.success) return response.data.data;
    throw new Error('Failed to fetch reviews');
};

export const replyToReview = async (id: string, reply: string): Promise<boolean> => {
    const response = await api.post(`/staff/me/reviews/${id}/reply`, { reply });
    return response.data.success;
};
