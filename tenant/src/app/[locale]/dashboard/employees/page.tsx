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
      <div className="mb-8 animate-fade-in">
        <div className={`flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between ${isRTL ? "xl:flex-row-reverse" : ""}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? "right" : "left" }}>
              {t("title")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? "right" : "left" }}>
              {t("subtitle")}
            </p>
          </div>

          <div className={`flex flex-wrap items-center gap-3 ${isRTL ? "justify-start xl:justify-end" : "justify-start xl:justify-end"}`}>
            {limits && (
              <div className="text-sm px-3 py-2 bg-gray-100 rounded-xl whitespace-nowrap">
                <span className="text-gray-500">{isRTL ? "الحد المسموح:" : "Limit:"} </span>
                <span className={`font-medium ${!limits.allowed ? "text-red-600" : "text-gray-900"}`}>
                  {limits.current} / {limits.limit}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`card mb-6 ${isRTL ? "text-right" : ""}`}>
        <div className={`flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between ${isRTL ? "xl:flex-row-reverse" : ""}`}>
          <div className={`grid w-full grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)_auto_auto] xl:items-center ${isRTL ? "xl:[direction:rtl]" : ""}`}>
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              className="w-full min-w-0 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? "right" : "left" }}
            />

            <select
              value={listFilter}
              onChange={(event) => {
                setListFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="w-full min-w-0 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
              style={{ textAlign: isRTL ? "right" : "left" }}
            >
              {listFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <Link
              href={limits && !limits.allowed ? "#" : `/${locale}/dashboard/employees/new`}
              className={`btn btn-primary inline-flex items-center gap-2 ${limits && !limits.allowed ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
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
              <span>{locale === "ar" ? "إضافة" : "Add"}</span>
            </Link>

            <div className="flex items-center gap-3 whitespace-nowrap">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
                {employeeCountLabel}
              </div>
              {selectedIds.length > 0 && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary">
                  {locale === "ar" ? `${selectedIds.length} محدد` : `${selectedIds.length} selected`}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card overflow-hidden">
          <div className="p-6">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          </div>
        </div>
      ) : employees.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noEmployees")}</h3>
          <p className="text-gray-600 mb-6">{t("noEmployeesDesc")}</p>
          <Link href={`/${locale}/dashboard/employees/new`} className="btn btn-primary">
            {t("addFirstEmployee")}
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full border-separate border-spacing-0">
              <thead className="bg-gray-50">
                <tr className="text-sm text-gray-600">
                  <th className="border-b border-gray-200 px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={employees.length > 0 && selectedIds.length === employees.length}
                      onChange={(event) => toggleSelectAll(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                  <th className={`border-b border-gray-200 px-4 py-4 font-medium ${isRTL ? "text-right" : "text-left"}`}>
                    {locale === "ar" ? "العضو" : "Team member"}
                  </th>
                  <th className={`border-b border-gray-200 px-4 py-4 font-medium ${isRTL ? "text-right" : "text-left"}`}>
                    {locale === "ar" ? "المسمى الوظيفي" : "Job title"}
                  </th>
                  <th className={`border-b border-gray-200 px-4 py-4 font-medium ${isRTL ? "text-right" : "text-left"}`}>
                    {locale === "ar" ? "الحالة" : "Status"}
                  </th>
                  <th className={`border-b border-gray-200 px-4 py-4 font-medium ${isRTL ? "text-right" : "text-left"}`}>
                    {locale === "ar" ? "تاريخ الإنشاء" : "Date created"}
                  </th>
                  <th className={`border-b border-gray-200 px-4 py-4 font-medium ${isRTL ? "text-left" : "text-right"}`}>
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
                      className={`border-b border-gray-100 transition-colors ${checked ? "bg-primary/5" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-4 py-4 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleSelectOne(employee.id, event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                          <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {employee.photo ? (
                              <img
                                src={getImageUrl(employee.photo)}
                                alt={employee.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-lg font-semibold text-gray-600">
                                {employee.name?.charAt(0)?.toUpperCase() || "?"}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-gray-900">{employee.name}</span>
                              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${employee.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                                {employee.isActive ? (locale === "ar" ? "نشط" : "Active") : (locale === "ar" ? "غير نشط" : "Inactive")}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-500 break-all">{employee.email || "-"}</div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-4 align-middle ${isRTL ? "text-right" : "text-left"}`}>
                        <div className="font-medium text-gray-900">
                          {employee.position
                            ? getEmployeePositionLabel(employee.position, locale as "ar" | "en")
                            : (locale === "ar" ? "غير محدد" : "Unassigned")}
                        </div>
                        {employee.gender && (
                          <div className="mt-1 text-sm text-gray-500">
                            {locale === "ar" ? "الجنس" : "Gender"}: {getEmployeeGenderLabel(employee.gender, locale as "ar" | "en")}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-4 align-middle ${isRTL ? "text-right" : "text-left"}`}>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${employee.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {employee.isActive ? (locale === "ar" ? "مفعل" : "Enabled") : (locale === "ar" ? "معطل" : "Disabled")}
                        </span>
                      </td>
                      <td className={`px-4 py-4 align-middle text-sm text-gray-600 ${isRTL ? "text-right" : "text-left"}`}>
                        {formatCreatedAt(employee.createdAt)}
                      </td>
                      <td className={`px-4 py-4 align-middle ${isRTL ? "text-left" : "text-right"}`}>
                        <div className={`flex flex-wrap gap-2 ${isRTL ? "justify-start" : "justify-end"}`}>
                          <Link
                            href={`/${locale}/dashboard/employees/${employee.id}`}
                            className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
                          >
                            {locale === "ar" ? "عرض" : "View"}
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(employee)}
                            className={`rounded-xl px-3 py-2 text-xs font-medium ${
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
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
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

          <div className={`flex flex-col gap-3 border-t border-gray-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between ${isRTL ? "lg:flex-row-reverse" : ""}`}>
            <div className="text-sm text-gray-600">
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
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {locale === "ar" ? "السابق" : "Previous"}
                </button>

                {pageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => goToPage(page)}
                    className={`min-w-10 rounded-xl px-3 py-2 text-sm font-medium ${
                      page === currentPage
                        ? "bg-primary text-white"
                        : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {locale === "ar" ? "التالي" : "Next"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </TenantLayout>
  );
}
