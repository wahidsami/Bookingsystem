"use client";

import { useEffect, useMemo, useState } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { getImageUrl, tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAppDialog } from "@/components/AppDialogProvider";
import {
  EMPLOYEE_GENDERS,
  getEmployeeGenderLabel,
  getEmployeePositionLabel
} from "@/lib/employeePositions";

interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  nationality?: string;
  gender?: string;
  position?: string;
  photo?: string;
  isActive: boolean;
  createdAt: string;
}

const PAGE_SIZE = 10;

export default function EmployeesPage() {
  const dialog = useAppDialog();
  const t = useTranslations("Employees");
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [listFilter, setListFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [limits, setLimits] = useState<any>(null);

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listFilter, searchTerm, currentPage]);

  useEffect(() => {
    setSelectedIds([]);
  }, [listFilter, searchTerm, currentPage]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError("");

      const params: any = {
        page: currentPage,
        limit: PAGE_SIZE,
      };

      if (listFilter === "active") {
        params.isActive = true;
      } else if (listFilter === "inactive") {
        params.isActive = false;
      }

      if (listFilter === "male" || listFilter === "female") {
        params.gender = listFilter;
      }

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      if (listFilter === "az") {
        params.sortBy = "alphabetical";
      } else if (listFilter === "za") {
        params.sortBy = "alphabetical_desc";
      } else if (listFilter === "created") {
        params.sortBy = "created_at";
      } else if (listFilter === "gender-sort") {
        params.sortBy = "gender";
      }

      const [response, limitsData] = await Promise.all([
        tenantApi.getEmployees(params),
        tenantApi.getSubscriptionLimits().catch(() => null)
      ]);

      if (limitsData?.staff) {
        setLimits(limitsData.staff);
      }

      const data = response.data || response;

      if (data.success !== false) {
        const employeesList = data.employees || data.data?.employees || [];
        const totalValue = Number(data.totalItems ?? data.count ?? employeesList.length ?? 0);
        setEmployees(employeesList);
        setTotalItems(totalValue || 0);
        setTotalPages(Math.max(1, Number(data.totalPages ?? Math.ceil(totalValue / PAGE_SIZE)) || 1));
      } else {
        setError(data.message || t("loadError"));
        setEmployees([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (err: any) {
      console.error("Failed to load employees:", err);
      setError(err.message || t("loadError"));
      setEmployees([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    setCurrentPage(safePage);
  };

  const pageNumbers = useMemo(() => {
    const total = Math.max(totalPages, 1);
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(total, currentPage + 2);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [currentPage, totalPages]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(employees.map((employee) => employee.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, id]));
      }
      return current.filter((item) => item !== id);
    });
  };

  const handleDelete = async (employee: Employee) => {
    const confirmed = await dialog.confirm(
      locale === "ar"
        ? `هل أنت متأكد من حذف العضو "${employee.name}"؟`
        : `Are you sure you want to delete "${employee.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await tenantApi.deleteEmployee(employee.id);
      if (response.success) {
        await dialog.alert({
          title: locale === "ar" ? "تم الحذف" : "Deleted",
          message: locale === "ar" ? "تم حذف العضو بنجاح." : "The team member was deleted successfully.",
          tone: "success"
        });
        await loadEmployees();
      } else {
        await dialog.alert({
          title: locale === "ar" ? "تعذر الحذف" : "Delete failed",
          message: response.message || t("deleteError"),
          tone: "danger"
        });
      }
    } catch (err: any) {
      console.error("Failed to delete employee:", err);
      await dialog.alert({
        title: locale === "ar" ? "تعذر الحذف" : "Delete failed",
        message: err.message || t("deleteError"),
        tone: "danger"
      });
    }
  };

  const handleToggleActive = async (employee: Employee) => {
    try {
      const confirmed = await dialog.confirm(
        locale === "ar"
          ? `هل تريد ${employee.isActive ? "تعطيل" : "تفعيل"} "${employee.name}"؟`
          : `Do you want to ${employee.isActive ? "disable" : "enable"} "${employee.name}"?`
      );

      if (!confirmed) {
        return;
      }

      const submitData = new FormData();
      submitData.append("isActive", String(!employee.isActive));
      const response = await tenantApi.updateEmployee(employee.id, submitData);

      if (response.success) {
        await loadEmployees();
      } else {
        throw new Error(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to update employee status:", err);
      await dialog.alert({
        title: locale === "ar" ? "تعذر التحديث" : "Update failed",
        message: err.message || t("updateError"),
        tone: "danger"
      });
    }
  };

  const employeeCountLabel = locale === "ar"
    ? `${totalItems} عضو`
    : `${totalItems} member(s)`;

  const listFilterOptions = [
    { value: "all", label: locale === "ar" ? "الكل" : "All" },
    { value: "active", label: locale === "ar" ? "نشط" : "Active" },
    { value: "inactive", label: locale === "ar" ? "غير نشط" : "Inactive" },
    { value: "male", label: locale === "ar" ? "ذكر" : "Male" },
    { value: "female", label: locale === "ar" ? "أنثى" : "Female" },
    { value: "az", label: locale === "ar" ? "أبجديًا أ-ي" : "Alphabetical A-Z" },
    { value: "za", label: locale === "ar" ? "أبجديًا ي-أ" : "Alphabetical Z-A" },
    { value: "created", label: locale === "ar" ? "تاريخ الإضافة" : "Date created" }
  ];

  const formatCreatedAt = (value: string) => new Intl.DateTimeFormat(
    locale === "ar" ? "ar-SA" : "en-GB",
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  ).format(new Date(value));

  return (
    <TenantLayout>
      <div className="relative space-y-8 pb-8" dir={isRTL ? "rtl" : "ltr"}>
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[240px] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.10),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.02),_transparent_60%)]" />

        <section className="card overflow-hidden border border-slate-200/80 bg-slate-950 text-white shadow-2xl shadow-slate-950/10">
          <div className="grid gap-6 p-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                {locale === "ar" ? "إدارة الفريق" : "Team management"}
              </p>
              <h1 className="text-4xl font-black tracking-tight" style={{ textAlign: isRTL ? "right" : "left" }}>
                {t("title")}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300" style={{ textAlign: isRTL ? "right" : "left" }}>
                {t("subtitle")}
              </p>
            </div>

            <div className={`flex flex-wrap gap-3 ${isRTL ? "justify-start xl:justify-end" : "justify-start xl:justify-end"}`}>
              {limits && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
                    {isRTL ? "الحد المسموح" : "Limit"}
                  </span>
                  <span className={`mt-1 block font-semibold ${!limits.allowed ? "text-rose-300" : "text-white"}`}>
                    {limits.current} / {limits.limit}
                  </span>
                </div>
              )}

              <Link
                href={limits && !limits.allowed ? "#" : `/${locale}/dashboard/employees/new`}
                className={`inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/20 transition hover:opacity-95 ${limits && !limits.allowed ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
                style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
                onClick={(event) => {
                  if (limits && !limits.allowed) {
                    event.preventDefault();
                    dialog.alert({
                      title: isRTL ? "الحد الأقصى" : "Limit reached",
                      message: isRTL
                        ? "لقد وصلت إلى الحد الأقصى لموظفي باقتك."
                        : "You have reached your subscription staff limit.",
                      tone: "danger"
                    });
                  }
                }}
              >
                <span className="text-lg leading-none">+</span>
                <span>{locale === "ar" ? "إضافة عضو" : "Add member"}</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="card border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-950/5">
          <div className={`grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)_auto_auto] xl:items-center ${isRTL ? "xl:[direction:rtl]" : ""}`}>
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
              style={{ textAlign: isRTL ? "right" : "left" }}
            />

            <select
              value={listFilter}
              onChange={(event) => {
                setListFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
              style={{ textAlign: isRTL ? "right" : "left" }}
            >
              {listFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-3 whitespace-nowrap">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {employeeCountLabel}
              </div>
              {selectedIds.length > 0 && (
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-700">
                  {locale === "ar" ? `${selectedIds.length} محدد` : `${selectedIds.length} selected`}
                </div>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 shadow-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="card overflow-hidden border border-slate-200/80 bg-white shadow-xl shadow-slate-950/5">
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        ) : employees.length === 0 ? (
          <div className="card border border-slate-200/80 bg-white py-16 text-center shadow-xl shadow-slate-950/5">
            <div className="mb-4 text-6xl">👥</div>
            <h3 className="mb-2 text-xl font-semibold text-slate-950">{t("noEmployees")}</h3>
            <p className="mb-6 text-slate-600">{t("noEmployeesDesc")}</p>
            <Link href={`/${locale}/dashboard/employees/new`} className="btn-primary inline-flex items-center gap-2">
              {t("addFirstEmployee")}
            </Link>
          </div>
        ) : (
          <section className="card overflow-hidden border border-slate-200/80 bg-white shadow-xl shadow-slate-950/5">
            <div className="overflow-x-auto">
              <table
                className="min-w-[1120px] w-full table-fixed border-separate border-spacing-0"
                dir={isRTL ? "rtl" : "ltr"}
              >
                <colgroup>
                  <col className="w-14" />
                  <col className="w-[340px]" />
                  <col className="w-[220px]" />
                  <col className="w-[140px]" />
                  <col className="w-[160px]" />
                  <col className="w-[240px]" />
                </colgroup>
                <thead className="bg-slate-950 text-white">
                  <tr className="text-sm text-white/90">
                    <th className="border-b border-white/10 px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={employees.length > 0 && selectedIds.length === employees.length}
                        onChange={(event) => toggleSelectAll(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      />
                    </th>
                    <th className="border-b border-white/10 px-4 py-4 font-medium text-start">
                      {locale === "ar" ? "العضو" : "Team member"}
                    </th>
                    <th className="border-b border-white/10 px-4 py-4 font-medium text-start">
                      {locale === "ar" ? "المسمى الوظيفي" : "Job title"}
                    </th>
                    <th className="border-b border-white/10 px-4 py-4 font-medium text-start">
                      {locale === "ar" ? "الحالة" : "Status"}
                    </th>
                    <th className="border-b border-white/10 px-4 py-4 font-medium text-start">
                      {locale === "ar" ? "تاريخ الإنشاء" : "Date created"}
                    </th>
                    <th className="border-b border-white/10 px-4 py-4 font-medium text-start">
                      {locale === "ar" ? "الإجراءات" : "Actions"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => {
                    const checked = selectedIds.includes(employee.id);

                    return (
                      <tr
                        key={employee.id}
                        className={`border-b border-slate-100 transition-colors ${checked ? "bg-cyan-50/60" : "hover:bg-slate-50"}`}
                      >
                        <td className="px-4 py-4 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => toggleSelectOne(employee.id, event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                        </td>
                        <td className="px-4 py-4 align-middle overflow-hidden">
                          <div className={`flex min-w-0 items-center gap-3 ${isRTL ? "text-right" : "text-left"}`}>
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-cyan-50 text-cyan-700">
                              {employee.photo ? (
                                <img
                                  src={getImageUrl(employee.photo)}
                                  alt={employee.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-lg font-semibold text-cyan-700">
                                  {employee.name?.charAt(0)?.toUpperCase() || "?"}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "justify-end" : "justify-start"}`}>
                                <span className="min-w-0 truncate font-semibold text-slate-950">{employee.name}</span>
                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${employee.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                                  {employee.isActive ? (locale === "ar" ? "نشط" : "Active") : (locale === "ar" ? "غير نشط" : "Inactive")}
                                </span>
                              </div>
                              <div className={`mt-1 break-all text-sm text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>{employee.email || "-"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-middle text-start">
                          <div className="font-medium text-slate-950">
                            {employee.position
                              ? getEmployeePositionLabel(employee.position, locale as "ar" | "en")
                              : (locale === "ar" ? "غير محدد" : "Unassigned")}
                          </div>
                          {employee.gender && (
                            <div className="mt-1 text-sm text-slate-500">
                              {locale === "ar" ? "الجنس" : "Gender"}: {getEmployeeGenderLabel(employee.gender, locale as "ar" | "en")}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 align-middle text-start">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${employee.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {employee.isActive ? (locale === "ar" ? "مفعل" : "Enabled") : (locale === "ar" ? "معطل" : "Disabled")}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-middle text-sm text-slate-600 text-start">
                          {formatCreatedAt(employee.createdAt)}
                        </td>
                        <td className="px-4 py-4 align-middle text-start">
                          <div className={`flex flex-wrap gap-2 ${isRTL ? "justify-end" : "justify-start"}`}>
                            <Link
                              href={`/${locale}/dashboard/employees/${employee.id}`}
                              className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-700 hover:bg-cyan-100"
                            >
                              {locale === "ar" ? "عرض" : "View"}
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(employee)}
                              className={`rounded-2xl px-3 py-2 text-xs font-medium ${
                                employee.isActive
                                  ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {employee.isActive ? (locale === "ar" ? "تعطيل" : "Deactivate") : (locale === "ar" ? "تفعيل" : "Activate")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(employee)}
                              className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
                            >
                              {t("delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={`flex flex-col gap-3 border-t border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between ${isRTL ? "lg:flex-row-reverse" : ""}`}>
              <div className="text-sm text-slate-600">
                {locale === "ar"
                  ? `عرض ${employees.length} من أصل ${totalItems}`
                  : `Showing ${employees.length} of ${totalItems}`}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {locale === "ar" ? "السابق" : "Previous"}
                  </button>

                  {pageNumbers.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => goToPage(page)}
                      className={`min-w-10 rounded-2xl px-3 py-2 text-sm font-medium ${
                        page === currentPage
                          ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {locale === "ar" ? "التالي" : "Next"}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </TenantLayout>
  );
}
