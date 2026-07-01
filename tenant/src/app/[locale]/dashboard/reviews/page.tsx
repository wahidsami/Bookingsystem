"use client";

import React, { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";

interface ReviewRecord {
    id: string;
    customerName: string | null;
    rating: number;
    comment: string | null;
    staffReply: string | null;
    staffRepliedAt: string | null;
    isVisible: boolean;
    createdAt: string;
    staff: {
        id: string;
        name: string;
    } | null;
}

type FilterTab = "all" | "visible" | "hidden";
type QuickFilter = "none" | "needs_reply" | "low_rated";

export default function ReviewsPage() {
    const t = useTranslations("Reviews");
    const params = useParams();
    const locale = (params?.locale as string) || "ar";

    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState<ReviewRecord[]>([]);
    const [avgRating, setAvgRating] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<FilterTab>("all");
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [replyDraft, setReplyDraft] = useState("");
    const [submittingReply, setSubmittingReply] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStaffId, setSelectedStaffId] = useState<string>("all");
    const [selectedRating, setSelectedRating] = useState<string>("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [quickFilter, setQuickFilter] = useState<QuickFilter>("none");

    useEffect(() => {
        loadReviews();
    }, []);

    const openReply = (r: ReviewRecord) => {
        setReplyingToId(r.id);
        setReplyDraft(r.staffReply || "");
    };

    const cancelReply = () => {
        setReplyingToId(null);
        setReplyDraft("");
    };

    const submitReply = async () => {
        if (!replyingToId) return;
        setSubmittingReply(true);
        try {
            await tenantApi.replyToReview(replyingToId, replyDraft.trim() || null);
            setReviews(prev =>
                prev.map(r => {
                    if (r.id !== replyingToId) return r;
                    return {
                        ...r,
                        staffReply: replyDraft.trim() || null,
                        staffRepliedAt: replyDraft.trim() ? new Date().toISOString() : null,
                    };
                })
            );
            cancelReply();
        } catch (err: any) {
            setError(err.message || "Failed to save reply");
        } finally {
            setSubmittingReply(false);
        }
    };

    const loadReviews = async () => {
        setLoading(true);
        try {
            const res = await tenantApi.getReviews();
            if (res.success) {
                setReviews(res.data.reviews || []);
                setAvgRating(res.data.avgRating);
                setTotalCount(res.data.total || 0);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to load reviews");
        } finally {
            setLoading(false);
        }
    };

    const toggleVisibility = async (id: string, currentlyVisible: boolean) => {
        try {
            await tenantApi.toggleReviewVisibility(id, !currentlyVisible);
            setReviews(prev =>
                prev.map(r => r.id === id ? { ...r, isVisible: !currentlyVisible } : r)
            );
        } catch (err) {
            console.error("Failed to toggle visibility:", err);
        }
    };

    const staffOptions = Array.from(
        new Map(
            reviews
                .filter((r) => r.staff?.id && r.staff?.name)
                .map((r) => [r.staff!.id, r.staff!.name])
        ).entries()
    ).map(([id, name]) => ({ id, name }));

    const filteredReviews = reviews.filter((r) => {
        if (filter === "visible" && !r.isVisible) return false;
        if (filter === "hidden" && r.isVisible) return false;

        if (selectedStaffId !== "all" && r.staff?.id !== selectedStaffId) return false;
        if (selectedRating !== "all" && String(r.rating) !== selectedRating) return false;

        if (quickFilter === "needs_reply" && !!r.staffReply) return false;
        if (quickFilter === "low_rated" && r.rating > 3) return false;

        if (dateFrom) {
            const from = new Date(`${dateFrom}T00:00:00`);
            if (new Date(r.createdAt) < from) return false;
        }
        if (dateTo) {
            const to = new Date(`${dateTo}T23:59:59`);
            if (new Date(r.createdAt) > to) return false;
        }

        if (searchTerm.trim()) {
            const needle = searchTerm.trim().toLowerCase();
            const haystack = [
                r.customerName || "",
                r.comment || "",
                r.staff?.name || "",
                r.staffReply || "",
            ]
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(needle)) return false;
        }

        return true;
    });

    const renderStars = (rating: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={`text-lg ${i < rating ? "text-yellow-400" : "text-gray-300"}`}>★</span>
        ));
    };

    const filterTabs: { key: FilterTab; label: string; count: number }[] = [
        { key: "all", label: t("all") || "All", count: reviews.length },
        { key: "visible", label: t("visible") || "Visible", count: reviews.filter(r => r.isVisible).length },
        { key: "hidden", label: t("hidden") || "Hidden", count: reviews.filter(r => !r.isVisible).length },
    ];

    const repliedCount = reviews.filter((r) => !!r.staffReply).length;
    const needsReplyCount = reviews.filter((r) => !r.staffReply).length;
    const lowRatedCount = reviews.filter((r) => r.rating <= 3).length;

    return (
        <TenantLayout>
            <div className="space-y-6 bg-slate-950 text-slate-100" dir={locale === "ar" ? "rtl" : "ltr"}>
                <section className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 shadow-[0_28px_100px_rgba(2,6,23,0.45)]">
                    <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
                        <div className="max-w-2xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                                <span>⭐</span>
                                {t("title") || "Reviews"}
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white lg:text-4xl">{t("title") || "Reviews"}</h1>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                                {t("subtitle") || "View and manage customer feedback for your team."}
                            </p>
                        </div>
                    </div>
                    <div className="grid gap-4 border-t border-white/10 p-6 sm:grid-cols-3 lg:p-8">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t("avgRating") || "Average Rating"}</p>
                            <p className="mt-3 text-3xl font-black text-white">{avgRating || "—"}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t("totalReviews") || "Total Reviews"}</p>
                            <p className="mt-3 text-3xl font-black text-white">{totalCount}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t("visibleReviews") || "Visible"}</p>
                            <p className="mt-3 text-3xl font-black text-white">{reviews.filter(r => r.isVisible).length}</p>
                        </div>
                    </div>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-slate-900 p-4 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                    <div className="flex gap-2 overflow-x-auto">
                        {filterTabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setFilter(tab.key)}
                                className={`whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                                    filter === tab.key ? "bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20" : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                                }`}
                            >
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </div>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-slate-900 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={locale === "ar" ? "بحث في الاسم أو التعليق..." : "Search name or comment..."}
                            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20 lg:col-span-2"
                        />
                        <select
                            value={selectedStaffId}
                            onChange={(e) => setSelectedStaffId(e.target.value)}
                            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                        >
                            <option value="all">{locale === "ar" ? "كل الموظفين" : "All Staff"}</option>
                            {staffOptions.map((staff) => (
                                <option key={staff.id} value={staff.id}>{staff.name}</option>
                            ))}
                        </select>
                        <select
                            value={selectedRating}
                            onChange={(e) => setSelectedRating(e.target.value)}
                            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                        >
                            <option value="all">{locale === "ar" ? "كل التقييمات" : "All Ratings"}</option>
                            {[5, 4, 3, 2, 1].map((value) => (
                                <option key={value} value={String(value)}>{value} ★</option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20 [color-scheme:dark]"
                        />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20 [color-scheme:dark]"
                        />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setQuickFilter("none")}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${quickFilter === "none" ? "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                        >
                            {locale === "ar" ? "بدون فلتر سريع" : "No quick filter"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuickFilter("needs_reply")}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${quickFilter === "needs_reply" ? "border-amber-400/30 bg-amber-500/15 text-amber-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                        >
                            {locale === "ar" ? `تحتاج رد (${needsReplyCount})` : `Needs reply (${needsReplyCount})`}
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuickFilter("low_rated")}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${quickFilter === "low_rated" ? "border-rose-400/30 bg-rose-500/15 text-rose-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                        >
                            {locale === "ar" ? `منخفضة (${lowRatedCount})` : `Low rated (${lowRatedCount})`}
                        </button>
                        <span className="ml-auto text-xs text-slate-400">
                            {locale === "ar"
                                ? `تم الرد على ${repliedCount} من أصل ${reviews.length}`
                                : `${repliedCount} / ${reviews.length} have replies`}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm("");
                                setSelectedStaffId("all");
                                setSelectedRating("all");
                                setDateFrom("");
                                setDateTo("");
                                setQuickFilter("none");
                            }}
                            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                        >
                            {locale === "ar" ? "تصفير الفلاتر" : "Reset filters"}
                        </button>
                    </div>
                </section>

                {error && (
                    <div className="rounded-[24px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
                )}

                <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                    {loading ? (
                        <div className="py-16 text-center">
                            <div className="inline-block h-11 w-11 animate-spin rounded-full border-2 border-fuchsia-400/20 border-t-fuchsia-400" />
                        </div>
                    ) : filteredReviews.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="mb-4 text-5xl">⭐</div>
                            <h3 className="text-xl font-semibold text-white mb-2">{t("noReviews") || "No reviews yet"}</h3>
                            <p className="text-slate-400">{t("noReviewsDesc") || "Customer reviews will appear here once submitted."}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                                        <th className="px-6 py-4 font-semibold">{t("customer") || "Customer"}</th>
                                        <th className="px-6 py-4 font-semibold">{t("rating") || "Rating"}</th>
                                        <th className="px-6 py-4 font-semibold">{t("employee") || "Employee"}</th>
                                        <th className="px-6 py-4 font-semibold max-w-xs">{t("comment") || "Comment"}</th>
                                        <th className="px-6 py-4 font-semibold">{t("staffReply") || "Staff Reply"}</th>
                                        <th className="px-6 py-4 font-semibold">{t("date") || "Date"}</th>
                                        <th className="px-6 py-4 font-semibold text-center">{t("visibility") || "Visibility"}</th>
                                        <th className="px-6 py-4 font-semibold">{t("reply") || "Reply"}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {filteredReviews.map((r) => (
                                        <React.Fragment key={r.id}>
                                            <tr className="hover:bg-white/5">
                                                <td className="px-6 py-4 font-medium text-white">
                                                    {r.customerName || t("anonymous") || "Anonymous"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1">
                                                        {renderStars(r.rating)}
                                                        <span className="ml-1 text-sm text-slate-400">({r.rating})</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-300">
                                                    {r.staff?.name || "—"}
                                                </td>
                                                <td className="max-w-xs px-6 py-4 text-sm text-slate-300" title={r.comment || ""}>
                                                    {r.comment || "—"}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-300">
                                                    {r.staffReply ? (
                                                        <div>
                                                            <p className="italic text-white">"{r.staffReply}"</p>
                                                            {r.staffRepliedAt && (
                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    {new Date(r.staffRepliedAt).toLocaleDateString(locale)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="italic text-slate-500">{t("noReply") || "No reply"}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-400">
                                                    {new Date(r.createdAt).toLocaleDateString(locale)}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => toggleVisibility(r.id, r.isVisible)}
                                                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                                            r.isVisible
                                                                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                                                                : "border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                                                        }`}
                                                    >
                                                        {r.isVisible ? (t("hide") || "Hide") : (t("publish") || "Publish")}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => openReply(r)}
                                                        className="text-sm font-semibold text-fuchsia-300 transition hover:text-fuchsia-200"
                                                    >
                                                        {r.staffReply ? (t("editReply") || "Edit reply") : (t("reply") || "Reply")}
                                                    </button>
                                                </td>
                                            </tr>
                                            {replyingToId === r.id && (
                                                <tr key={`${r.id}-reply-form`} className="bg-white/5">
                                                    <td colSpan={8} className="px-6 py-4">
                                                        <div className="max-w-2xl space-y-3">
                                                            <label className="block text-sm font-medium text-slate-300">
                                                                {t("yourReply") || "Your reply (public, visible to customers)"}
                                                            </label>
                                                            <textarea
                                                                value={replyDraft}
                                                                onChange={(e) => setReplyDraft(e.target.value)}
                                                                placeholder={t("replyPlaceholder") || "Thank you for your feedback..."}
                                                                rows={3}
                                                                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                                                            />
                                                            <div className="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={submitReply}
                                                                    disabled={submittingReply}
                                                                    className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    {submittingReply ? (t("saving") || "Saving...") : (t("submitReply") || "Submit reply")}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelReply}
                                                                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                                                                >
                                                                    {t("cancel") || "Cancel"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </TenantLayout>
    );
}
