type StaffPermissions = {
    view_earnings?: boolean;
    view_reviews?: boolean;
    reply_reviews?: boolean;
    view_clients?: boolean;
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

export const canViewClientNotes = (user: StaffLike): boolean =>
    Boolean(user?.permissions?.view_clients && user?.features?.clientNotes !== false);

export const canViewReviews = (user: StaffLike): boolean =>
    Boolean(user?.permissions?.view_reviews && user?.features?.reviews);

export const canReplyToReviews = (user: StaffLike): boolean =>
    Boolean(user?.permissions?.reply_reviews && canViewReviews(user));

export const canViewEarnings = (user: StaffLike): boolean =>
    Boolean(user?.permissions?.view_earnings && user?.features?.earnings);

export const canViewMessages = (user: StaffLike): boolean =>
    Boolean(user?.features?.messages);

export const canRequestTimeOff = (user: StaffLike): boolean =>
    Boolean(user?.features?.timeOff);
