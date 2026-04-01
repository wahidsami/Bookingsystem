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

    const filteredReviews = reviews.filter(r => {
        if (filter === "visible") return r.isVisible;
        if (filter === "hidden") return !r.isVisible;
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

    return (
        <TenantLayout>
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{t("title") || "Reviews"}</h2>
                <p className="text-gray-600">{t("subtitle") || "View and manage customer feedback for your team."}</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center text-2xl">⭐</div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">{t("avgRating") || "Average Rating"}</p>
                        <p className="text-2xl font-bold text-gray-900">{avgRating || "—"}</p>
                    </div>
                </div>
                <div className="card p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">💬</div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">{t("totalReviews") || "Total Reviews"}</p>
                        <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
                    </div>
                </div>
                <div className="card p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">👁️</div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">{t("visibleReviews") || "Visible"}</p>
                        <p className="text-2xl font-bold text-gray-900">{reviews.filter(r => r.isVisible).length}</p>
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="card mb-6">
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                    {filterTabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === tab.key
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
            )}

            {/* Reviews List */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : filteredReviews.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-5xl mb-4">⭐</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noReviews") || "No reviews yet"}</h3>
                        <p className="text-gray-600">{t("noReviewsDesc") || "Customer reviews will appear here once submitted."}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 font-semibold text-gray-700">{t("customer") || "Customer"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">{t("rating") || "Rating"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">{t("employee") || "Employee"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700 max-w-xs">{t("comment") || "Comment"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">{t("staffReply") || "Staff Reply"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">{t("date") || "Date"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700 text-center">{t("visibility") || "Visibility"}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">{t("reply") || "Reply"}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredReviews.map((r) => (
                                    <React.Fragment key={r.id}>
                                        <tr className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {r.customerName || t("anonymous") || "Anonymous"}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1">
                                                    {renderStars(r.rating)}
                                                    <span className="text-sm text-gray-500 ml-1">({r.rating})</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {r.staff?.name || "—"}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={r.comment || ""}>
                                                {r.comment || "—"}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {r.staffReply ? (
                                                    <div>
                                                        <p className="text-gray-700 italic">"{r.staffReply}"</p>
                                                        {r.staffRepliedAt && (
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                {new Date(r.staffRepliedAt).toLocaleDateString(locale)}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic">{t("noReply") || "No reply"}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(r.createdAt).toLocaleDateString(locale)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => toggleVisibility(r.id, r.isVisible)}
                                                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${r.isVisible
                                                            ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                                                            : "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                                                        }`}
                                                >
                                                    {r.isVisible ? (t("hide") || "Hide") : (t("publish") || "Publish")}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    type="button"
                                                    onClick={() => openReply(r)}
                                                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                                >
                                                    {r.staffReply ? (t("editReply") || "Edit reply") : (t("reply") || "Reply")}
                                                </button>
                                            </td>
                                        </tr>
                                        {replyingToId === r.id && (
                                            <tr key={`${r.id}-reply-form`} className="bg-gray-50">
                                                <td colSpan={8} className="px-6 py-4">
                                                    <div className="space-y-2 max-w-2xl">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            {t("yourReply") || "Your reply (public, visible to customers)"}
                                                        </label>
                                                        <textarea
                                                            value={replyDraft}
                                                            onChange={(e) => setReplyDraft(e.target.value)}
                                                            placeholder={t("replyPlaceholder") || "Thank you for your feedback..."}
                                                            rows={3}
                                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={submitReply}
                                                                disabled={submittingReply}
                                                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
                                                            >
                                                                {submittingReply ? (t("saving") || "Saving...") : (t("submitReply") || "Submit reply")}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelReply}
                                                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
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
            </div>
        </TenantLayout>
    );
}
