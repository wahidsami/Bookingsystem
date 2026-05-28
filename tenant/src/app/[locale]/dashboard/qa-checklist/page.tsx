"use client";

import { useEffect, useMemo, useState } from "react";
import { qaExitCriteria, qaPreconditions, qaSections } from "@/lib/qaChecklistData";

type TestStatus = "not-run" | "passed" | "failed" | "blocked";
type RowState = {
  status: TestStatus;
  comment: string;
  tester: string;
};

type ChecklistState = Record<string, RowState>;
type RunMetadata = {
  testerLead: string;
  environment: string;
  buildVersion: string;
  startDate: string;
  endDate: string;
};

const STORAGE_KEY = "tenant.qa-checklist.v1";
const META_STORAGE_KEY = "tenant.qa-checklist.meta.v1";

const defaultRow = (): RowState => ({ status: "not-run", comment: "", tester: "" });
const defaultMeta = (): RunMetadata => ({
  testerLead: "",
  environment: "Staging",
  buildVersion: "",
  startDate: "",
  endDate: "",
});

export default function QAChecklistPage() {
  const [state, setState] = useState<ChecklistState>({});
  const [metadata, setMetadata] = useState<RunMetadata>(defaultMeta());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | TestStatus>("all");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      setState({});
    }
    try {
      const rawMeta = localStorage.getItem(META_STORAGE_KEY);
      if (rawMeta) setMetadata({ ...defaultMeta(), ...JSON.parse(rawMeta) });
    } catch {
      setMetadata(defaultMeta());
    }
    const initExpanded: Record<string, boolean> = {};
    for (const section of qaSections) initExpanded[section.key] = true;
    setExpanded(initExpanded);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setLastSavedAt(Date.now());
    } catch {}
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(metadata));
      setLastSavedAt(Date.now());
    } catch {}
  }, [metadata]);

  const totals = useMemo(() => {
    const allIds = qaSections.flatMap((section) => section.cases.map((testCase) => testCase.id));
    const summary = { total: allIds.length, passed: 0, failed: 0, blocked: 0, notRun: 0 };
    for (const id of allIds) {
      const status = state[id]?.status ?? "not-run";
      if (status === "passed") summary.passed += 1;
      else if (status === "failed") summary.failed += 1;
      else if (status === "blocked") summary.blocked += 1;
      else summary.notRun += 1;
    }
    return summary;
  }, [state]);

  const setRow = (id: string, patch: Partial<RowState>) => {
    setState((prev) => ({ ...prev, [id]: { ...(prev[id] ?? defaultRow()), ...patch } }));
  };

  const exportJson = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      runMetadata: metadata,
      totals,
      preconditions: qaPreconditions,
      exitCriteria: qaExitCriteria,
      sections: qaSections.map((section) => ({
        key: section.key,
        title: section.title,
        cases: section.cases.map((testCase) => ({
          ...testCase,
          result: state[testCase.id] ?? defaultRow(),
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tenant-dashboard-qa-results-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw);
        const incomingSections = parsed?.sections;
        if (!Array.isArray(incomingSections)) {
          window.alert("Invalid QA file format.");
          return;
        }

        const next: ChecklistState = {};
        for (const section of incomingSections) {
          if (!Array.isArray(section?.cases)) continue;
          for (const testCase of section.cases) {
            const id = testCase?.id;
            const result = testCase?.result;
            if (!id || !result) continue;
            const status = result.status as TestStatus;
            next[id] = {
              status: status === "passed" || status === "failed" || status === "blocked" || status === "not-run" ? status : "not-run",
              comment: typeof result.comment === "string" ? result.comment : "",
              tester: typeof result.tester === "string" ? result.tester : "",
            };
          }
        }
        setState((prev) => ({ ...prev, ...next }));
      } catch {
        window.alert("Could not import file.");
      }
    };
    input.click();
  };

  const clearAll = () => {
    if (!window.confirm("Clear all QA results?")) return;
    setState({});
    setMetadata(defaultMeta());
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_STORAGE_KEY);
  };

  const matchesFilter = (id: string) => {
    if (statusFilter === "all") return true;
    return (state[id]?.status ?? "not-run") === statusFilter;
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">QA Checklist</h1>
        <p className="mt-1 text-sm text-gray-600">Temporary test workspace for tenant dashboard end-to-end validation.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Total" value={totals.total} />
          <Stat label="Passed" value={totals.passed} color="text-emerald-600" />
          <Stat label="Failed" value={totals.failed} color="text-rose-600" />
          <Stat label="Blocked" value={totals.blocked} color="text-amber-600" />
          <Stat label="Not Run" value={totals.notRun} color="text-gray-600" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={exportJson} className="btn btn-primary">Export JSON</button>
          <button onClick={importJson} className="btn btn-secondary">Import JSON</button>
          <button onClick={clearAll} className="btn btn-secondary">Clear All</button>
          <span className="self-center text-xs text-gray-500">
            {lastSavedAt ? `Auto-saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "Autosave enabled"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-600">Quick filter:</span>
          <FilterButton label="All" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
          <FilterButton label="Failed" active={statusFilter === "failed"} onClick={() => setStatusFilter("failed")} />
          <FilterButton label="Blocked" active={statusFilter === "blocked"} onClick={() => setStatusFilter("blocked")} />
          <FilterButton label="Not Run" active={statusFilter === "not-run"} onClick={() => setStatusFilter("not-run")} />
          <FilterButton label="Passed" active={statusFilter === "passed"} onClick={() => setStatusFilter("passed")} />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Run Metadata</h2>
        <p className="mt-1 text-xs text-gray-500">Included in exported JSON for audit-ready QA handoff.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <InputField label="Tester Lead" value={metadata.testerLead} onChange={(value) => setMetadata((prev) => ({ ...prev, testerLead: value }))} />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Environment</label>
            <select
              value={metadata.environment}
              onChange={(event) => setMetadata((prev) => ({ ...prev, environment: event.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="Development">Development</option>
              <option value="Staging">Staging</option>
              <option value="Production">Production</option>
            </select>
          </div>
          <InputField label="Build Version" value={metadata.buildVersion} onChange={(value) => setMetadata((prev) => ({ ...prev, buildVersion: value }))} />
          <InputField label="Start Date" type="date" value={metadata.startDate} onChange={(value) => setMetadata((prev) => ({ ...prev, startDate: value }))} />
          <InputField label="End Date" type="date" value={metadata.endDate} onChange={(value) => setMetadata((prev) => ({ ...prev, endDate: value }))} />
        </div>
      </div>

      <SectionCard title="Test Data / Preconditions" items={qaPreconditions} />
      <SectionCard title="QA Exit Criteria" items={qaExitCriteria} />

      {qaSections.map((section) => (
        <div key={section.key} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          {(() => {
            const sectionTotal = section.cases.length;
            const sectionPassed = section.cases.filter((testCase) => (state[testCase.id]?.status ?? "not-run") === "passed").length;
            const sectionVisible = section.cases.filter((testCase) => matchesFilter(testCase.id)).length;
            return (
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            onClick={() => setExpanded((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
              <p className="text-xs text-gray-500">{sectionVisible} visible · {sectionPassed}/{sectionTotal} passed</p>
            </div>
            <span className="text-sm text-gray-500">{expanded[section.key] ? "Hide" : "Show"}</span>
          </button>
            );
          })()}

          {expanded[section.key] && (
            <div className="space-y-4 border-t border-gray-100 p-4">
              {section.cases.filter((testCase) => matchesFilter(testCase.id)).map((testCase) => {
                const row = state[testCase.id] ?? defaultRow();
                return (
                  <div key={testCase.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{testCase.id}</span>
                      <h3 className="text-sm font-semibold text-gray-900">{testCase.title}</h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Steps</p>
                        <ul className="list-disc space-y-1 ps-5 text-sm text-gray-700">
                          {testCase.steps.map((step, index) => <li key={`${testCase.id}-s-${index}`}>{step}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Expected</p>
                        <ul className="list-disc space-y-1 ps-5 text-sm text-gray-700">
                          {testCase.expected.map((item, index) => <li key={`${testCase.id}-e-${index}`}>{item}</li>)}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                        <select
                          value={row.status}
                          onChange={(event) => setRow(testCase.id, { status: event.target.value as TestStatus })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="not-run">Not Run</option>
                          <option value="passed">Passed</option>
                          <option value="failed">Failed</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Tester</label>
                        <input
                          value={row.tester}
                          onChange={(event) => setRow(testCase.id, { tester: event.target.value })}
                          placeholder="QA name"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Comments</label>
                        <textarea
                          value={row.comment}
                          onChange={(event) => setRow(testCase.id, { comment: event.target.value })}
                          placeholder="Result notes, API errors, links to screenshots..."
                          rows={3}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {section.cases.filter((testCase) => matchesFilter(testCase.id)).length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                  No test cases match this filter in this section.
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

function Stat({ label, value, color = "text-gray-900" }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function SectionCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-gray-700">
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}
