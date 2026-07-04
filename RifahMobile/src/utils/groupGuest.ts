export interface GroupGuestPayload {
    fullName: string;
    email?: string | null;
    phone?: string | null;
    birthDate?: string | null;
    serviceId?: string | null;
    serviceIds?: string[] | null;
    serviceName?: string | null;
    isFree?: boolean;
}

const GROUP_GUEST_MARKER = '[GROUP_GUEST]';

const normalizeText = (value: unknown): string => `${value || ''}`.trim();

export const buildGroupGuestPayload = (input: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    birthDate?: string;
    serviceId?: string;
    serviceName?: string;
    serviceIds?: string[];
    isFree?: boolean;
}): GroupGuestPayload | null => {
    const firstName = normalizeText(input.firstName);
    const lastName = normalizeText(input.lastName);
    const fullName = `${firstName} ${lastName}`.trim();

    if (!fullName) {
        return null;
    }

    const serviceId = normalizeText(input.serviceId);
    const serviceIds = Array.isArray(input.serviceIds)
        ? input.serviceIds.map((entry) => normalizeText(entry)).filter(Boolean)
        : serviceId
            ? [serviceId]
            : [];

    return {
        fullName,
        email: normalizeText(input.email) || null,
        phone: normalizeText(input.phone) || null,
        birthDate: normalizeText(input.birthDate) || null,
        serviceId: serviceId || null,
        serviceIds: serviceIds.length > 0 ? serviceIds : null,
        serviceName: normalizeText(input.serviceName) || null,
        isFree: input.isFree === true,
    };
};

export const parseGroupGuestFromNotes = (notes?: string | null): GroupGuestPayload | null => {
    if (!notes) return null;

    const lines = `${notes}`
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const markerLine = lines.find((line) => line.startsWith(GROUP_GUEST_MARKER));
    if (!markerLine) return null;

    const jsonPart = markerLine.slice(GROUP_GUEST_MARKER.length).trim();
    if (!jsonPart) return null;

    try {
        const parsed = JSON.parse(jsonPart) as Partial<GroupGuestPayload>;
        if (!parsed?.fullName || !normalizeText(parsed.fullName)) return null;

        const normalizedServiceIds = Array.isArray(parsed.serviceIds)
            ? parsed.serviceIds.map((entry) => normalizeText(entry)).filter(Boolean)
            : [];

        return {
            fullName: normalizeText(parsed.fullName),
            email: normalizeText(parsed.email) || null,
            phone: normalizeText(parsed.phone) || null,
            birthDate: normalizeText(parsed.birthDate) || null,
            serviceId: normalizeText(parsed.serviceId) || null,
            serviceIds: normalizedServiceIds.length > 0 ? normalizedServiceIds : null,
            serviceName: normalizeText(parsed.serviceName) || null,
            isFree: parsed.isFree === true,
        };
    } catch {
        return null;
    }
};

