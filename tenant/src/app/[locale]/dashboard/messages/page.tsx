"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { tenantApi } from "@/lib/api";
import { TenantLayout } from "@/components/TenantLayout";

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
        if (!confirm(t("confirmDelete"))) return;
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
            <div style={{ direction: isRTL ? "rtl" : "ltr" }}>
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 24,
                        flexDirection: isRTL ? "row-reverse" : "row",
                    }}
                >
                    <div style={{ textAlign: isRTL ? "right" : "left" }}>
                        <h1
                            style={{
                                fontSize: 24,
                                fontWeight: "bold",
                                color: "#1f2937",
                                margin: 0,
                            }}
                        >
                            {t("title")}
                        </h1>
                        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                            {t("subtitle")}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCompose(true)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "12px 20px",
                            backgroundColor: "#8B5ADF",
                            color: "white",
                            border: "none",
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            boxShadow: "0 4px 14px rgba(139, 90, 223, 0.3)",
                            flexDirection: isRTL ? "row-reverse" : "row",
                        }}
                    >
                        <span>✉️</span> {t("compose")}
                    </button>
                </div>

                {/* Compose Modal */}
                {showCompose && (
                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 999,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "rgba(0,0,0,0.5)",
                        }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setShowCompose(false);
                        }}
                    >
                        <div
                            style={{
                                backgroundColor: "white",
                                borderRadius: 16,
                                padding: 32,
                                width: "100%",
                                maxWidth: 560,
                                boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
                                direction: isRTL ? "rtl" : "ltr",
                            }}
                        >
                            <h2
                                style={{
                                    fontSize: 20,
                                    fontWeight: "bold",
                                    color: "#1f2937",
                                    marginBottom: 24,
                                    textAlign: isRTL ? "right" : "left",
                                }}
                            >
                                {t("compose")}
                            </h2>

                            {/* Recipient */}
                            <div style={{ marginBottom: 16 }}>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "#374151",
                                        marginBottom: 6,
                                        textAlign: isRTL ? "right" : "left",
                                    }}
                                >
                                    {t("sendTo")}
                                </label>
                                <select
                                    value={recipientId}
                                    onChange={(e) => setRecipientId(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        borderRadius: 8,
                                        border: "1px solid #d1d5db",
                                        fontSize: 14,
                                        color: "#1f2937",
                                        backgroundColor: "#f9fafb",
                                        direction: isRTL ? "rtl" : "ltr",
                                    }}
                                >
                                    <option value="all">{t("allEmployees")}</option>
                                    {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name} ({emp.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Subject */}
                            <div style={{ marginBottom: 16 }}>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "#374151",
                                        marginBottom: 6,
                                        textAlign: isRTL ? "right" : "left",
                                    }}
                                >
                                    {t("subject")}
                                </label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder={t("subjectPlaceholder")}
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        borderRadius: 8,
                                        border: "1px solid #d1d5db",
                                        fontSize: 14,
                                        color: "#1f2937",
                                        backgroundColor: "#f9fafb",
                                        direction: isRTL ? "rtl" : "ltr",
                                        textAlign: isRTL ? "right" : "left",
                                    }}
                                />
                            </div>

                            {/* Body */}
                            <div style={{ marginBottom: 16 }}>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "#374151",
                                        marginBottom: 6,
                                        textAlign: isRTL ? "right" : "left",
                                    }}
                                >
                                    {t("message")} *
                                </label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    placeholder={t("messagePlaceholder")}
                                    rows={5}
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        borderRadius: 8,
                                        border: "1px solid #d1d5db",
                                        fontSize: 14,
                                        color: "#1f2937",
                                        backgroundColor: "#f9fafb",
                                        resize: "vertical",
                                        direction: isRTL ? "rtl" : "ltr",
                                        textAlign: isRTL ? "right" : "left",
                                    }}
                                />
                            </div>

                            {/* Pin Toggle */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    marginBottom: 24,
                                    flexDirection: isRTL ? "row-reverse" : "row",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    id="pin-toggle"
                                    checked={isPinned}
                                    onChange={(e) => setIsPinned(e.target.checked)}
                                    style={{ width: 18, height: 18, accentColor: "#8B5ADF" }}
                                />
                                <label
                                    htmlFor="pin-toggle"
                                    style={{
                                        fontSize: 13,
                                        color: "#4b5563",
                                        cursor: "pointer",
                                    }}
                                >
                                    📌 {t("pinMessage")}
                                </label>
                            </div>

                            {/* Actions */}
                            <div
                                style={{
                                    display: "flex",
                                    gap: 12,
                                    justifyContent: "flex-end",
                                    flexDirection: isRTL ? "row-reverse" : "row",
                                }}
                            >
                                <button
                                    onClick={() => setShowCompose(false)}
                                    style={{
                                        padding: "10px 20px",
                                        backgroundColor: "#f3f4f6",
                                        color: "#4b5563",
                                        border: "none",
                                        borderRadius: 8,
                                        fontSize: 14,
                                        fontWeight: 500,
                                        cursor: "pointer",
                                    }}
                                >
                                    {t("cancel")}
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={!body.trim() || sending}
                                    style={{
                                        padding: "10px 24px",
                                        backgroundColor: !body.trim() || sending ? "#c4b5fd" : "#8B5ADF",
                                        color: "white",
                                        border: "none",
                                        borderRadius: 8,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: !body.trim() || sending ? "not-allowed" : "pointer",
                                    }}
                                >
                                    {sending ? t("sending") : t("send")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Messages List */}
                {loading ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: 60,
                            color: "#9ca3af",
                        }}
                    >
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                border: "3px solid #e5e7eb",
                                borderTopColor: "#8B5ADF",
                                borderRadius: "50%",
                                animation: "spin 0.8s linear infinite",
                                margin: "0 auto 16px",
                            }}
                        />
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : messages.length === 0 ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: 60,
                            backgroundColor: "white",
                            borderRadius: 16,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        }}
                    >
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
                        <h3
                            style={{
                                fontSize: 18,
                                fontWeight: "bold",
                                color: "#4b5563",
                                marginBottom: 8,
                            }}
                        >
                            {t("noMessages")}
                        </h3>
                        <p style={{ fontSize: 14, color: "#9ca3af" }}>{t("noMessagesSub")}</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                style={{
                                    backgroundColor: "white",
                                    borderRadius: 16,
                                    padding: 20,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                    borderRight: isRTL ? `4px solid ${msg.isPinned ? "#f59e0b" : "#8B5ADF"}` : "none",
                                    borderLeft: !isRTL ? `4px solid ${msg.isPinned ? "#f59e0b" : "#8B5ADF"}` : "none",
                                }}
                            >
                                {/* Header Row */}
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        marginBottom: 10,
                                        flexDirection: isRTL ? "row-reverse" : "row",
                                    }}
                                >
                                    <div style={{ textAlign: isRTL ? "right" : "left" }}>
                                        {msg.subject && (
                                            <h3
                                                style={{
                                                    fontSize: 16,
                                                    fontWeight: "bold",
                                                    color: "#1f2937",
                                                    margin: "0 0 4px",
                                                }}
                                            >
                                                {msg.subject}
                                            </h3>
                                        )}
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 8,
                                                alignItems: "center",
                                                flexDirection: isRTL ? "row-reverse" : "row",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 12,
                                                    color: "#8B5ADF",
                                                    fontWeight: 600,
                                                    backgroundColor: "#f3e8ff",
                                                    padding: "2px 8px",
                                                    borderRadius: 6,
                                                }}
                                            >
                                                {t("sentTo")}: {getRecipientName(msg)}
                                            </span>
                                            {msg.isPinned && (
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        color: "#f59e0b",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {t("pinned")}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            gap: 8,
                                            alignItems: "center",
                                            flexDirection: isRTL ? "row-reverse" : "row",
                                        }}
                                    >
                                        <span style={{ fontSize: 12, color: "#9ca3af" }}>
                                            {formatDate(msg.createdAt)}
                                        </span>
                                        <button
                                            onClick={() => handleDelete(msg.id)}
                                            disabled={deletingId === msg.id}
                                            style={{
                                                padding: "4px 10px",
                                                backgroundColor: "#fef2f2",
                                                color: "#ef4444",
                                                border: "none",
                                                borderRadius: 6,
                                                fontSize: 12,
                                                fontWeight: 500,
                                                cursor: deletingId === msg.id ? "not-allowed" : "pointer",
                                                opacity: deletingId === msg.id ? 0.5 : 1,
                                            }}
                                        >
                                            {deletingId === msg.id ? "..." : t("delete")}
                                        </button>
                                    </div>
                                </div>

                                {/* Body */}
                                <p
                                    style={{
                                        fontSize: 14,
                                        color: "#4b5563",
                                        lineHeight: 1.6,
                                        margin: "8px 0",
                                        whiteSpace: "pre-wrap",
                                        textAlign: isRTL ? "right" : "left",
                                    }}
                                >
                                    {msg.body}
                                </p>

                                {/* Read Status */}
                                {!msg.recipientId && (
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "#9ca3af",
                                            marginTop: 8,
                                            textAlign: isRTL ? "right" : "left",
                                        }}
                                    >
                                        ✅ {t("readBy")} {(msg.readBy || []).length} {t("of")}{" "}
                                        {employees.length} {t("employees")}
                                    </div>
                                )}
                                {msg.recipientId && (
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color:
                                                (msg.readBy || []).length > 0 ? "#10b981" : "#f59e0b",
                                            marginTop: 8,
                                            textAlign: isRTL ? "right" : "left",
                                        }}
                                    >
                                        {(msg.readBy || []).length > 0
                                            ? "✅ " + (locale === "ar" ? "تمت القراءة" : "Read")
                                            : "⏳ " + (locale === "ar" ? "لم تُقرأ بعد" : "Unread")}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </TenantLayout>
    );
}
