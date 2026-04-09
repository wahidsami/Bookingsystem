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
    const response = await api.get('/staff/earnings');
    const payload = response.data?.data;

    return {
        payrolls: Array.isArray(payload?.payrolls)
            ? payload.payrolls.map((payroll: any) => ({
                ...payroll,
                baseSalary: Number(payroll.baseSalary || 0),
                commission: Number(payroll.commission || 0),
                tipsTotal: Number(payroll.tipsTotal || 0),
                bonuses: Number(payroll.bonuses || 0),
                deductions: Number(payroll.deductions || 0),
                totalNet: Number(payroll.totalNet || (
                    Number(payroll.baseSalary || 0) +
                    Number(payroll.commission || 0) +
                    Number(payroll.tipsTotal || 0) +
                    Number(payroll.bonuses || 0) -
                    Number(payroll.deductions || 0)
                )),
            }))
            : [],
        totals: {
            totalBase: Number(payload?.totals?.totalBase || 0),
            totalCommission: Number(payload?.totals?.totalCommission || 0),
            totalTips: Number(payload?.totals?.totalTips || 0),
            totalBonuses: Number(payload?.totals?.totalBonuses || 0),
            totalDeductions: Number(payload?.totals?.totalDeductions || 0),
            totalNet: Number(payload?.totals?.totalNet || 0),
        },
        currentMonth: payload?.currentMonth
            ? {
                ...payload.currentMonth,
                baseSalary: Number(payload.currentMonth.baseSalary || 0),
                commission: Number(payload.currentMonth.commission || 0),
                tipsTotal: Number(payload.currentMonth.tipsTotal || 0),
                bonuses: Number(payload.currentMonth.bonuses || 0),
                deductions: Number(payload.currentMonth.deductions || 0),
                totalNet: Number(payload.currentMonth.totalNet || (
                    Number(payload.currentMonth.baseSalary || 0) +
                    Number(payload.currentMonth.commission || 0) +
                    Number(payload.currentMonth.tipsTotal || 0) +
                    Number(payload.currentMonth.bonuses || 0) -
                    Number(payload.currentMonth.deductions || 0)
                )),
            }
            : null,
    };
};

export const getMyReviews = async (): Promise<ReviewsSummary> => {
    const response = await api.get('/staff/reviews');
    const payload = response.data?.data;

    return {
        reviews: Array.isArray(payload?.reviews) ? payload.reviews : [],
        avgRating: payload?.avgRating || null,
        distribution: payload?.distribution || {},
        total: Number(payload?.total || 0),
    };
};

export const replyToReview = async (id: string, reply: string): Promise<boolean> => {
    const response = await api.patch(`/staff/reviews/${id}`, {
        staffReply: reply,
    });

    return Boolean(response.data?.success);
};
