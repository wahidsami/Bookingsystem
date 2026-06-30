"use client";

type FinancialReportFilters = {
  location: string;
  teamMember: string;
  paymentMethod: string;
  amountMin: string;
  amountMax: string;
  excludeGiftCards: boolean;
  excludeDeposits: boolean;
};

type FinancialReportFiltersPanelProps = {
  locale: string;
  filters: FinancialReportFilters;
  onChange: <K extends keyof FinancialReportFilters>(key: K, value: FinancialReportFilters[K]) => void;
  locationOptions?: string[];
  teamMemberOptions?: string[];
  paymentMethodOptions?: string[];
  note?: string;
};

function SelectField({
  label,
  value,
  onChange,
  options,
  locale
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  locale: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <option value="all">{locale === "ar" ? "الكل" : "All"}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  locale,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locale: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        placeholder={locale === "ar" ? "اختياري" : "Optional"}
      />
    </label>
  );
}

export function FinancialReportFiltersPanel({
  locale,
  filters,
  onChange,
  locationOptions = [],
  teamMemberOptions = [],
  paymentMethodOptions = [],
  note
}: FinancialReportFiltersPanelProps) {
  const isRTL = locale === "ar";

  return (
    <div className={`space-y-4 ${isRTL ? "text-right" : "text-left"}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          locale={locale}
          label={locale === "ar" ? "الموقع" : "Location"}
          value={filters.location}
          onChange={(value) => onChange("location", value)}
          options={locationOptions}
        />
        <SelectField
          locale={locale}
          label={locale === "ar" ? "عضو الفريق" : "Team member"}
          value={filters.teamMember}
          onChange={(value) => onChange("teamMember", value)}
          options={teamMemberOptions}
        />
        <SelectField
          locale={locale}
          label={locale === "ar" ? "طريقة الدفع" : "Payment method"}
          value={filters.paymentMethod}
          onChange={(value) => onChange("paymentMethod", value)}
          options={paymentMethodOptions}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            locale={locale}
            label={locale === "ar" ? "أدنى مبلغ" : "Min amount"}
            value={filters.amountMin}
            onChange={(value) => onChange("amountMin", value)}
            type="number"
          />
          <TextField
            locale={locale}
            label={locale === "ar" ? "أعلى مبلغ" : "Max amount"}
            value={filters.amountMax}
            onChange={(value) => onChange("amountMax", value)}
            type="number"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <input
            type="checkbox"
            checked={filters.excludeGiftCards}
            onChange={(event) => onChange("excludeGiftCards", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "استبعاد بطاقات الهدايا" : "Exclude gift cards"}</p>
            <p className="mt-1 text-xs text-gray-500">{locale === "ar" ? "إخفاء معاملات بطاقات الهدايا من الجدول." : "Hide gift card transactions from the table."}</p>
          </div>
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <input
            type="checkbox"
            checked={filters.excludeDeposits}
            onChange={(event) => onChange("excludeDeposits", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "استبعاد الدفعات المقدمة" : "Exclude deposits"}</p>
            <p className="mt-1 text-xs text-gray-500">{locale === "ar" ? "إخفاء دفعات الحجز المقدمة." : "Hide deposit-based payments."}</p>
          </div>
        </label>
      </div>

      {note ? <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">{note}</p> : null}
    </div>
  );
}
