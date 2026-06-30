"use client";

import type { ReactNode } from "react";

type SalesReportFiltersPanelProps = {
  locale: string;
  filters: {
    location: string;
    teamMember: string;
    status: string;
    type: string;
    customerSegment: string;
    customerGender: string;
    customerRetention: string;
    channel: string;
  };
  onChange: (key: keyof SalesReportFiltersPanelProps["filters"], value: string) => void;
  locationOptions?: string[];
  teamMemberOptions?: string[];
  statusOptions?: string[];
  typeOptions?: string[];
  customerSegmentOptions?: string[];
  customerGenderOptions?: string[];
  customerRetentionOptions?: string[];
  channelOptions?: string[];
  note?: ReactNode;
};

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SalesReportFiltersPanel({
  locale,
  filters,
  onChange,
  locationOptions = [],
  teamMemberOptions = [],
  statusOptions = [],
  typeOptions = [],
  customerSegmentOptions = [],
  customerGenderOptions = [],
  customerRetentionOptions = [],
  channelOptions = [],
  note
}: SalesReportFiltersPanelProps) {
  const allLabel = locale === "ar" ? "الكل" : "All";
  const isRTL = locale === "ar";

  const normalize = (items: string[], placeholder: string) =>
    items.length ? items : [placeholder];

  return (
    <div className="space-y-4">
      {note ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {note}
        </div>
      ) : null}

      <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${isRTL ? "md:[direction:rtl]" : ""}`}>
        <SelectField
          label={locale === "ar" ? "الموقع" : "Location"}
          value={filters.location}
          onChange={(value) => onChange("location", value)}
          options={[
            { value: "all", label: allLabel },
            ...normalize(locationOptions, locale === "ar" ? "كل المواقع" : "All locations").map((value) => ({
              value,
              label: value
            }))
          ]}
        />

        <SelectField
          label={locale === "ar" ? "عضو الفريق" : "Team member"}
          value={filters.teamMember}
          onChange={(value) => onChange("teamMember", value)}
          options={[
            { value: "all", label: allLabel },
            ...normalize(teamMemberOptions, locale === "ar" ? "غير محدد" : "Unassigned").map((value) => ({
              value,
              label: value
            }))
          ]}
        />

        <SelectField
          label={locale === "ar" ? "الحالة" : "Status"}
          value={filters.status}
          onChange={(value) => onChange("status", value)}
          options={[
            { value: "all", label: allLabel },
            ...normalize(statusOptions, locale === "ar" ? "مكتمل" : "Completed").map((value) => ({
              value,
              label: value
            }))
          ]}
        />

        <SelectField
          label={locale === "ar" ? "النوع" : "Type"}
          value={filters.type}
          onChange={(value) => onChange("type", value)}
          options={[
            { value: "all", label: allLabel },
            ...normalize(typeOptions, locale === "ar" ? "بيع" : "Sale").map((value) => ({
              value,
              label: value
            }))
          ]}
        />

        <SelectField
          label={locale === "ar" ? "شريحة العميل" : "Client segment"}
          value={filters.customerSegment}
          onChange={(value) => onChange("customerSegment", value)}
          options={[
            { value: "all", label: allLabel },
            ...normalize(customerSegmentOptions, locale === "ar" ? "منتظم" : "Regular").map((value) => ({
              value,
              label: value
            }))
          ]}
        />

        <SelectField
          label={locale === "ar" ? "جنس العميل" : "Client gender"}
          value={filters.customerGender}
          onChange={(value) => onChange("customerGender", value)}
          options={[
            { value: "all", label: allLabel },
            ...normalize(customerGenderOptions, locale === "ar" ? "غير محدد" : "Unknown").map((value) => ({
              value,
              label: value
            }))
          ]}
        />

        <SelectField
          label={locale === "ar" ? "الاحتفاظ" : "Client retention"}
          value={filters.customerRetention}
          onChange={(value) => onChange("customerRetention", value)}
          options={[
            { value: "all", label: allLabel },
            ...normalize(customerRetentionOptions, locale === "ar" ? "وفي" : "Loyal").map((value) => ({
              value,
              label: value
            }))
          ]}
        />

        <SelectField
          label={locale === "ar" ? "القناة" : "Channel"}
          value={filters.channel}
          onChange={(value) => onChange("channel", value)}
          options={[
            { value: "all", label: allLabel },
            ...normalize(channelOptions, locale === "ar" ? "نقدًا" : "Cash").map((value) => ({
              value,
              label: value
            }))
          ]}
        />
      </div>
    </div>
  );
}
