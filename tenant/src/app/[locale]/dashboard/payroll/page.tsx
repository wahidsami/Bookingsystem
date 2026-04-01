"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Currency } from "@/components/Currency";

interface PayrollRecord {
    id: string;
    staffId: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    commission: number;
    tipsTotal: number;
    bonuses: number;
    deductions: number;
    totalNet: number;
    status: "draft" | "processed" | "paid";
    staff: {
        id: string;
        name: string;
    };
}

interface EmployeeRevenue {
    id: string;
    name: string;
    baseSalary: number;
    totalCommission: number;
    totalEarnings: number;
}

export default function PayrollPage() {
    const t = useTranslations("Payroll");
    const params = useParams();
    const locale = (params?.locale as string) || "ar";
    const isRTL = locale === "ar";

    const [loading, setLoading] = useState(true);
    const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
    const [error, setError] = useState("");

    // Filter state
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });

    // Modal generation state
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [employeesData, setEmployeesData] = useState<EmployeeRevenue[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string>("");

    // Input fields for generation
    const [baseSalary, setBaseSalary] = useState<number>(0);
    const [commission, setCommission] = useState<number>(0);
    const [tips, setTips] = useState<number>(0);
    const [bonuses, setBonuses] = useState<number>(0);
    const [deductions, setDeductions] = useState<number>(0);
    const [notes, setNotes] = useState("");

    useEffect(() => {
        loadPayrolls();
    }, [selectedMonth]);

    const loadPayrolls = async () => {
        setLoading(true);
        try {
            const res = await tenantApi.getPayrollRecords({ startDate: `${selectedMonth}-01`, endDate: `${selectedMonth}-31` });
            if (res.success) {
                setPayrolls(res.data);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to load payroll records");
        } finally {
            setLoading(false);
        }
    };

    const openGenerateModal = async () => {
        setShowGenerateModal(true);
        setGenerating(true);
        try {
            // Calculate start and end dates of the selected month
            const [year, month] = selectedMonth.split("-");
            const startDate = `${selectedMonth}-01`;
            const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];

            // Fetch employee revenue for that month to auto-fill commissions
            const res = await tenantApi.getEmployeeRevenue({ startDate, endDate });
            if (res.success) {
                setEmployeesData(res.employees);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    const handleStaffSelect = (staffId: string) => {
        setSelectedStaffId(staffId);
        if (!staffId) return;

        const emp = employeesData.find((e) => e.id === staffId);
        if (emp) {
            setBaseSalary(Number(emp.baseSalary) || 0);
            setCommission(Number(emp.totalCommission) || 0);
            setTips(0);
            setBonuses(0);
            setDeductions(0);
            setNotes("");
        }
    };

    const handleGenerateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStaffId) return;

        setGenerating(true);
        try {
            const [year, month] = selectedMonth.split("-");
            const startDate = `${selectedMonth}-01`;
            const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];

            await tenantApi.generatePayroll({
                staffId: selectedStaffId,
                periodStart: startDate,
                periodEnd: endDate,
                baseSalary,
                commission,
                tipsTotal: tips,
                bonuses,
                deductions,
                notes,
            });

            setShowGenerateModal(false);
            setSelectedStaffId("");
            loadPayrolls();
        } catch (err) {
            console.error("Failed to generate payroll:", err);
            alert("Error generating payroll.");
        } finally {
            setGenerating(false);
        }
    };

    const updateStatus = async (id: string, status: "draft" | "processed" | "paid") => {
        try {
            await tenantApi.updatePayrollStatus(id, status);
            loadPayrolls();
        } catch (err) {
            console.error("Failed to update status:", err);
            alert("Error updating status.");
        }
    };

    const statusColors = {
        draft: "bg-gray-100 text-gray-800 border-gray-200",
        processed: "bg-blue-100 text-blue-800 border-blue-200",
        paid: "bg-green-100 text-green-800 border-green-200",
    };

    return (
        <TenantLayout>
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{t("title") || "Payroll"}</h2>
                    <p className="text-gray-600">{t("subtitle") || "Manage staff salaries, commissions, and pay slips."}</p>
                </div>
                <button onClick={openGenerateModal} className="btn btn-primary px-6 py-2 rounded-lg font-medium text-white shadow-sm hover:shadow-md transition-all">
                    + {t("generatePayroll") || "Generate Payroll"}
                </button>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t("selectMonth") || "Select Month"}</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
            )}

            {/* Payroll List */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : payrolls.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-5xl mb-4">💰</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noPayrollData") || "No Payroll generated"}</h3>
                        <p className="text-gray-600">{t("noPayrollDataDesc") || "Click Generate Payroll to run payroll for this month."}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 font-semibold text-gray-700">{t("employee") || "Employee"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">{t("period") || "Period"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">{t("base") || "Base"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">{t("commission") || "Commission"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">{t("netPay") || "Net Pay"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700 text-center">{t("status") || "Status"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700 text-right">{t("actions") || "Actions"}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {payrolls.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {p.staff ? p.staff.name : "Unknown"}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {p.periodStart} - {p.periodEnd}
                                        </td>
                                        <td className="px-6 py-4"><Currency amount={p.baseSalary} /></td>
                                        <td className="px-6 py-4 text-orange-600"><Currency amount={p.commission} /></td>
                                        <td className="px-6 py-4 font-bold text-primary"><Currency amount={p.totalNet} /></td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusColors[p.status]}`}>
                                                {p.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2 flex justify-end gap-2">
                                            {p.status === "draft" && (
                                                <button onClick={() => updateStatus(p.id, "processed")} className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors">
                                                    {t("markProcessed") || "Mark Processed"}
                                                </button>
                                            )}
                                            {p.status === "processed" && (
                                                <button onClick={() => updateStatus(p.id, "paid")} className="px-3 py-1 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors">
                                                    {t("markPaid") || "Mark Paid"}
                                                </button>
                                            )}
                                            {p.status === "paid" && (
                                                <span className="text-green-500 text-sm font-medium pr-2">✓ Paid</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Generate Modal */}
            {showGenerateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">{t("generatePayroll") || "Generate Payroll"}</h3>
                            <button onClick={() => setShowGenerateModal(false)} className="text-gray-400 hover:text-gray-600 p-2">
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleGenerateSubmit} className="p-6 space-y-4">
                            {generating && employeesData.length === 0 ? (
                                <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t("selectEmployee") || "Select Employee"}</label>
                                        <select
                                            required
                                            value={selectedStaffId}
                                            onChange={(e) => handleStaffSelect(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                        >
                                            <option value="">{t("chooseEmployee") || "Choose..."}</option>
                                            {employeesData.map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {selectedStaffId && (
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("baseSalary") || "Base Salary"}</label>
                                                <input type="number" step="0.01" value={baseSalary} onChange={e => setBaseSalary(Number(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("commission") || "Commission"}</label>
                                                <input type="number" step="0.01" value={commission} onChange={e => setCommission(Number(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-orange-50" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("tips") || "Tips"}</label>
                                                <input type="number" step="0.01" value={tips} onChange={e => setTips(Number(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("bonuses") || "Bonuses"}</label>
                                                <input type="number" step="0.01" value={bonuses} onChange={e => setBonuses(Number(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-green-50" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("deductions") || "Deductions"}</label>
                                                <input type="number" step="0.01" value={deductions} onChange={e => setDeductions(Number(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-red-50" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t("notes") || "Notes (Optional)"}</label>
                                        <textarea
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                                            rows={2}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowGenerateModal(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                                    {t("cancel") || "Cancel"}
                                </button>
                                <button type="submit" disabled={generating || !selectedStaffId} className="btn btn-primary px-5 py-2 rounded-lg font-medium text-white shadow-sm disabled:opacity-50 transition-colors">
                                    {generating ? "..." : (t("generate") || "Generate Drop")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </TenantLayout>
    );
}
