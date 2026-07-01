"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { tenantApi } from "@/lib/api";
import { TenantLayout } from "@/components/TenantLayout";
import { useAppDialog } from "@/components/AppDialogProvider";

interface StaffMessage {
    id: string;
    recipientId: string | null;
    recipientType: string | null;
    subject: string | null;
    body: string;
    isPinned: boolean;
    readBy: string[];
    createdAt: string;
}

interface Employee {
    id: string;
    name: string;
    email: string;
}

export default function MessagesPage() {
    const dialog = useAppDialog();
    const params = useParams();
    const locale = (params?.locale as string) || "ar";
    const isRTL = locale === "ar";

    const [messages, setMessages] = useState<StaffMessage[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Compose form
    const [recipientId, setRecipientId] = useState<string>("all");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [isPinned, setIsPinned] = useState(false);

    const t = useCallback(
        (key: string) => {
            const translations: Record<string, Record<string, string>> = {
                en: {
                    title: "Staff Messages",
                    subtitle: "Send messages and announcements to your employees",
                    compose: "Compose Message",
                    sendTo: "Send To",
                    allEmployees: "📢 All Employees (Broadcast)",
                    subject: "Subject (Optional)",
                    subjectPlaceholder: "e.g. Schedule change this week",
                    message: "Message",
                    messagePlaceholder: "Write your message here...",
                    pinMessage: "Pin this message (stays at top of inbox)",
                    send: "Send Message",
                    sending: "Sending...",
                    cancel: "Cancel",
                    noMessages: "No messages sent yet",
                    noMessagesSub: "Send your first message to your staff team!",
                    sentTo: "Sent to",
                    allStaff: "All Staff",
                    pinned: "📌 Pinned",
                    readBy: "Read by",
                    of: "of",
                    employees: "employees",
                    delete: "Delete",
                    deleting: "Deleting...",
                    confirmDelete: "Are you sure you want to delete this message?",
                    messageSent: "Message sent successfully!",
                    messageDeleted: "Message deleted.",
                    errorSend: "Failed to send message",
                    errorLoad: "Failed to load messages",
                },
                ar: {
                    title: "رسائل الموظفين",
                    subtitle: "أرسل رسائل وإعلانات لموظفيك",
                    compose: "إنشاء رسالة",
                    sendTo: "إرسال إلى",
                    allEmployees: "📢 جميع الموظفين (بث)",
                    subject: "الموضوع (اختياري)",
                    subjectPlaceholder: "مثال: تغيير في الجدول هذا الأسبوع",
                    message: "الرسالة",
                    messagePlaceholder: "اكتب رسالتك هنا...",
                    pinMessage: "تثبيت هذه الرسالة (تبقى في أعلى صندوق الوارد)",
                    send: "إرسال الرسالة",
                    sending: "جاري الإرسال...",
                    cancel: "إلغاء",
                    noMessages: "لا توجد رسائل مرسلة بعد",
                    noMessagesSub: "أرسل أول رسالة لفريق الموظفين!",
                    sentTo: "أُرسلت إلى",
                    allStaff: "جميع الموظفين",
                    pinned: "📌 مثبتة",
                    readBy: "قرأها",
                    of: "من",
                    employees: "موظف",
                    delete: "حذف",
                    deleting: "جاري الحذف...",
                    confirmDelete: "هل أنت متأكد من حذف هذه الرسالة؟",
                    messageSent: "تم إرسال الرسالة بنجاح!",
                    messageDeleted: "تم حذف الرسالة.",
                    errorSend: "فشل إرسال الرسالة",
                    errorLoad: "فشل تحميل الرسائل",
                },
            };
            return translations[locale]?.[key] || translations["en"][key] || key;
        },
        [locale]
    );

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [msgRes, empRes] = await Promise.all([
                tenantApi.getMessages(),
                tenantApi.getEmployees(),
            ]);
            setMessages(msgRes.data || []);
            setEmployees(
                (empRes.employees || empRes.data || []).map((e: any) => ({
                    id: e.id,
                    name: e.name || `${e.firstName || ""} ${e.lastName || ""}`.trim(),
                    email: e.email,
                }))
            );
        } catch (error) {
            console.error("Error loading messages:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSend = async () => {
        if (!body.trim()) return;
        try {
            setSending(true);
            await tenantApi.sendMessage({
                recipientId: recipientId === "all" ? null : recipientId,
                subject: subject.trim() || undefined,
                body: body.trim(),
                isPinned,
            });
            // Reset form
            setRecipientId("all");
            setSubject("");
            setBody("");
            setIsPinned(false);
            setShowCompose(false);
            loadData();
        } catch (error) {
            console.error("Error sending message:", error);
            alert(t("errorSend"));
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!(await dialog.confirm(t("confirmDelete")))) return;
        try {
            setDeletingId(id);
            await tenantApi.deleteMessage(id);
            setMessages((prev) => prev.filter((m) => m.id !== id));
        } catch (error) {
            console.error("Error deleting message:", error);
        } finally {
            setDeletingId(null);
        }
    };

    const getRecipientName = (msg: StaffMessage) => {
        if (!msg.recipientId) return t("allStaff");
        const emp = employees.find((e) => e.id === msg.recipientId);
        return emp?.name || "Unknown";
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <TenantLayout>
            <div
                className="min-h-screen space-y-6 bg-slate-950 text-slate-100"
                dir={isRTL ? "rtl" : "ltr"}
            >
                <section className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 shadow-[0_28px_100px_rgba(2,6,23,0.45)]">
                    <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
                        <div className="max-w-2xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                                <span>✉️</span>
                                {t("title")}
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white lg:text-4xl">
                                {t("title")}
                            </h1>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                                {t("subtitle")}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowCompose(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
                        >
                            <span>✉️</span>
                            {t("compose")}
                        </button>
                    </div>

                    <div className="grid gap-4 border-t border-white/10 p-6 sm:grid-cols-3 lg:p-8">
                        {[
                            { label: t("noMessages"), value: messages.length.toString(), accent: "from-cyan-500/20 to-cyan-500/5" },
                            { label: t("pinned"), value: messages.filter((message) => message.isPinned).length.toString(), accent: "from-amber-500/20 to-amber-500/5" },
                            { label: t("readBy"), value: employees.length.toString(), accent: "from-emerald-500/20 to-emerald-500/5" },
                        ].map((item) => (
                            <div key={item.label} className={`rounded-3xl border border-white/10 bg-gradient-to-br ${item.accent} p-5`}>
                                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                                    {item.label}
                                </p>
                                <p className="mt-3 text-3xl font-black text-white">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {showCompose && (
                    <div
                        className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setShowCompose(false);
                        }}
                    >
                        <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_28px_100px_rgba(2,6,23,0.65)] lg:p-8">
                            <div className="mb-6 flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-white">{t("compose")}</h2>
                                    <p className="mt-2 text-sm text-slate-400">{t("subtitle")}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCompose(false)}
                                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
                                >
                                    {t("cancel")}
                                </button>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        {t("sendTo")}
                                    </label>
                                    <select
                                        value={recipientId}
                                        onChange={(e) => setRecipientId(e.target.value)}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                                    >
                                        <option value="all">{t("allEmployees")}</option>
                                        {employees.map((emp) => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} ({emp.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        {t("subject")}
                                    </label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder={t("subjectPlaceholder")}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        {t("message")} *
                                    </label>
                                    <textarea
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        placeholder={t("messagePlaceholder")}
                                        rows={6}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                                    />
                                </div>

                                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                                    <input
                                        type="checkbox"
                                        id="pin-toggle"
                                        checked={isPinned}
                                        onChange={(e) => setIsPinned(e.target.checked)}
                                        className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-500 accent-cyan-500"
                                    />
                                    <span>{t("pinMessage")}</span>
                                </label>

                                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowCompose(false)}
                                        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                                    >
                                        {t("cancel")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSend}
                                        disabled={!body.trim() || sending}
                                        className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {sending ? t("sending") : t("send")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center rounded-[28px] border border-white/10 bg-slate-900 py-20">
                        <div className="h-11 w-11 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="rounded-[28px] border border-white/10 bg-slate-900 px-6 py-16 text-center shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-4xl">
                            📬
                        </div>
                        <h3 className="text-2xl font-bold text-white">{t("noMessages")}</h3>
                        <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">{t("noMessagesSub")}</p>
                    </div>
                ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                        {messages.map((msg) => {
                            const recipientName = getRecipientName(msg);
                            const readCount = msg.readBy?.length || 0;
                            const readRatio = employees.length ? Math.round((readCount / employees.length) * 100) : 0;

                            return (
                                <article
                                    key={msg.id}
                                    className={`overflow-hidden rounded-[28px] border bg-slate-900 shadow-[0_20px_80px_rgba(2,6,23,0.35)] ${
                                        msg.isPinned ? "border-amber-400/30" : "border-white/10"
                                    }`}
                                >
                                    <div className={`h-1 ${msg.isPinned ? "bg-gradient-to-r from-amber-400 to-orange-400" : "bg-gradient-to-r from-cyan-500 to-blue-500"}`} />
                                    <div className="p-6">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                                                        {formatDate(msg.createdAt)}
                                                    </span>
                                                    {msg.isPinned && (
                                                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200">
                                                            {t("pinned")}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300">
                                                        {t("sentTo")}
                                                    </p>
                                                    <h3 className="mt-2 text-2xl font-black text-white">
                                                        {msg.subject?.trim() || t("allEmployees")}
                                                    </h3>
                                                    <p className="mt-2 text-sm text-slate-400">{recipientName}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(msg.id)}
                                                    disabled={deletingId === msg.id}
                                                    className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {deletingId === msg.id ? t("deleting") : t("delete")}
                                                </button>
                                            </div>
                                        </div>

                                        <p className="mt-6 whitespace-pre-wrap rounded-3xl border border-white/10 bg-slate-950/80 p-5 text-sm leading-7 text-slate-200">
                                            {msg.body}
                                        </p>

                                        <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("readBy")}</p>
                                                <p className="mt-2 text-xl font-bold text-white">
                                                    {readCount} <span className="text-sm font-medium text-slate-400">{t("of")} {employees.length}</span>
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("employees")}</p>
                                                <p className="mt-2 text-xl font-bold text-white">{employees.length}</p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{isRTL ? "نسبة القراءة" : "Read rate"}</p>
                                                <p className="mt-2 text-xl font-bold text-white">{readRatio}%</p>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </TenantLayout>
    );
}
