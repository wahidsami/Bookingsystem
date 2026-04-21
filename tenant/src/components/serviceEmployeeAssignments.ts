export type ServiceEmployeeAssignment = {
  employeeId: string;
  isAssigned: boolean;
  hasCommission: boolean;
  commissionType: "fixed" | "percentage";
  commissionValue: string;
  isPrimary?: boolean;
};

export type ServiceAssignmentEmployee = {
  id: string;
  position?: string | null;
};

const SERVICE_PROVIDER_ROLE = "service provider";
const COMMISSION_TYPES = new Set(["fixed", "percentage"]);

export function isServiceProviderEmployee(employee?: ServiceAssignmentEmployee | null) {
  const position = `${employee?.position ?? ""}`.trim().toLowerCase();
  return position === SERVICE_PROVIDER_ROLE || position.includes(SERVICE_PROVIDER_ROLE);
}

export function createDefaultServiceEmployeeAssignment(employeeId: string, isPrimary = false): ServiceEmployeeAssignment {
  return {
    employeeId,
    isAssigned: false,
    hasCommission: false,
    commissionType: "percentage",
    commissionValue: "",
    isPrimary
  };
}

export function normalizeServiceEmployeeAssignment(input: unknown, index = 0): ServiceEmployeeAssignment | null {
  if (typeof input === "string") {
    const employeeId = input.trim();
    if (!employeeId) {
      return null;
    }

    return {
      ...createDefaultServiceEmployeeAssignment(employeeId, index === 0),
      isAssigned: true
    };
  }

  if (!input || typeof input !== "object") {
    return null;
  }

  const value = input as Record<string, unknown>;
  const employeeId = `${value.employeeId ?? value.staffId ?? ""}`.trim();
  if (!employeeId) {
    return null;
  }

  const commissionTypeRaw = `${value.commissionType ?? "percentage"}`.trim().toLowerCase();
  const commissionType = COMMISSION_TYPES.has(commissionTypeRaw) ? (commissionTypeRaw as "fixed" | "percentage") : "percentage";
  const commissionValue = `${value.commissionValue ?? value.commissionRate ?? ""}`.trim();
  const isAssigned = value.isAssigned === undefined ? true : value.isAssigned === true || value.isAssigned === "true";
  const hasCommission = value.hasCommission === true || value.hasCommission === "true" || commissionValue !== "";

  return {
    employeeId,
    isAssigned,
    hasCommission,
    commissionType,
    commissionValue,
    isPrimary: value.isPrimary === true || value.isPrimary === "true"
  };
}

export function normalizeServiceEmployeeAssignments(input: unknown): ServiceEmployeeAssignment[] {
  if (!input) {
    return [];
  }

  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item, index) => normalizeServiceEmployeeAssignment(item, index))
    .filter((item): item is ServiceEmployeeAssignment => Boolean(item));
}

export function buildServiceEmployeeAssignments(
  employees: ServiceAssignmentEmployee[],
  existingAssignments: ServiceEmployeeAssignment[] = []
) {
  const existingMap = new Map(existingAssignments.map((assignment) => [assignment.employeeId, assignment]));
  return employees
    .filter(isServiceProviderEmployee)
    .map((employee, index) => {
      const existing = existingMap.get(employee.id);
      if (existing) {
        return {
          ...createDefaultServiceEmployeeAssignment(employee.id, index === 0),
          ...existing,
          employeeId: employee.id,
          isPrimary: existing.isPrimary ?? index === 0
        };
      }

      return createDefaultServiceEmployeeAssignment(employee.id, index === 0);
    });
}

export function getSelectedServiceEmployeeIds(assignments: ServiceEmployeeAssignment[]) {
  return assignments.filter((assignment) => assignment.isAssigned).map((assignment) => assignment.employeeId);
}

export function calculateServiceEmployeeCommissionAmount(
  price: number,
  assignment: ServiceEmployeeAssignment
) {
  if (!assignment.isAssigned || !assignment.hasCommission) {
    return 0;
  }

  const value = parseFloat(assignment.commissionValue || "0");
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  if (assignment.commissionType === "percentage") {
    return price * (value / 100);
  }

  return value;
}

export function calculateServiceTeamCommission(
  price: number,
  assignments: ServiceEmployeeAssignment[]
) {
  return assignments.reduce((total, assignment) => {
    return total + calculateServiceEmployeeCommissionAmount(price, assignment);
  }, 0);
}
