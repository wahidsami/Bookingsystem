type StaffPermissions = {
    view_earnings?: boolean;
    view_reviews?: boolean;
    reply_reviews?: boolean;
    view_clients?: boolean;
    view_booking_notes?: boolean;
    can_start_service?: boolean;
    can_mark_no_show?: boolean;
} | null | undefined;

type StaffFeatures = {
    today?: boolean;
    schedule?: boolean;
    profile?: boolean;
    messages?: boolean;
    earnings?: boolean;
    reviews?: boolean;
    timeOff?: boolean;
    clientNotes?: boolean;
    pushNotifications?: boolean;
} | null | undefined;

type StaffLike = {
    permissions?: StaffPermissions;
    features?: StaffFeatures;
} | null | undefined;

export const canViewClients = (user: StaffLike): boolean =>
    Boolean(user?.permissions?.view_clients);

export const canViewBookingNotes = (user: StaffLike): boolean =>
    Boolean(user?.permissions?.view_booking_notes && user?.features?.clientNotes !== false);

export const canViewReviews = (user: StaffLike): boolean =>
    Boolean(user?.permissions?.view_reviews && user?.features?.reviews);

export const canReplyToReviews = (user: StaffLike): boolean =>
    Boolean(user?.permissions?.reply_reviews && canViewReviews(user));

export const canViewEarnings = (user: StaffLike): boolean =>
    Boolean(user?.permissions?.view_earnings && user?.features?.earnings);

export const canViewMessages = (user: StaffLike): boolean =>
    Boolean(user?.features?.messages);

export const canViewNotifications = (user: StaffLike): boolean =>
    user?.features?.pushNotifications !== false;

export const canRequestTimeOff = (user: StaffLike): boolean =>
    Boolean(user?.features?.timeOff);

export const canStartService = (user: StaffLike): boolean =>
    user?.permissions?.can_start_service !== false;

export const canMarkNoShow = (user: StaffLike): boolean =>
    user?.permissions?.can_mark_no_show !== false;
