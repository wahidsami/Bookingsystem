export type AppointmentDraftState = {
  createMode: string;
  createStep: number;
  custMode: string;
  selectedCustId: string;
  customerSearch: string;
  walkinFullName: string;
  walkinPhone: string;
  walkinEmail: string;
  walkinDob: string;
  walkinIsVip: boolean;
  includeGroupGuests: boolean;
  guestCount: number;
  guestNames: string;
  currentServiceId: string;
  currentStaffId: string;
  currentStartTime: number;
  currentDuration: number;
  currentDiscountType: 'none' | 'flat' | 'percent';
  currentDiscountValue: number;
  currentServiceNotes: string;
  sessionNotes: string;
  notifyWhatsApp: boolean;
  createSplitActive: boolean;
  createSplitAmounts: { card: number; cash: number; online: number; bank_transfer: number; wallet: number; gift_card: number };
  giftCardCodeInput: string;
  blockTitleAr: string;
  blockTitleEn: string;
  blockStaffId: string;
  blockStartTime: number;
  blockDuration: number;
  blockType: 'Break' | 'Lunch' | 'Meeting';
  blockIsRecurring: boolean;
  blockEndDate: string;
};

export const buildEmptyAppointmentDraftSnapshot = (): AppointmentDraftState => ({
  createMode: 'appointment',
  createStep: 1,
  custMode: 'existing',
  selectedCustId: '',
  customerSearch: '',
  walkinFullName: '',
  walkinPhone: '',
  walkinEmail: '',
  walkinDob: '',
  walkinIsVip: false,
  includeGroupGuests: false,
  guestCount: 1,
  guestNames: '',
  currentServiceId: '',
  currentStaffId: '',
  currentStartTime: 120,
  currentDuration: 60,
  currentDiscountType: 'none',
  currentDiscountValue: 0,
  currentServiceNotes: '',
  sessionNotes: '',
  notifyWhatsApp: true,
  createSplitActive: false,
  createSplitAmounts: { card: 0, cash: 0, online: 0, bank_transfer: 0, wallet: 0, gift_card: 0 },
  giftCardCodeInput: '',
  blockTitleAr: 'استراحة قهوة الموظفين',
  blockTitleEn: 'Staff Espresso Recess',
  blockStaffId: '',
  blockStartTime: 180,
  blockDuration: 45,
  blockType: 'Break',
  blockIsRecurring: false,
  blockEndDate: ''
});

export const isAppointmentDraftContent = (draft: Partial<AppointmentDraftState> & { stagedServices?: Array<{ id: string }> | null; createMode?: string; createStep?: number; custMode?: string; }) => {
  const stagedServices = Array.isArray(draft.stagedServices) ? draft.stagedServices : [];

  return draft.createMode !== 'appointment'
    || draft.createStep !== 1
    || draft.custMode !== 'existing'
    || Boolean(
      draft.selectedCustId
      || draft.customerSearch?.trim()
      || draft.walkinFullName?.trim()
      || draft.walkinPhone?.trim()
      || draft.walkinEmail?.trim()
      || draft.walkinDob?.trim()
      || draft.walkinIsVip
      || draft.includeGroupGuests
      || draft.guestCount !== 1
      || draft.guestNames?.trim()
      || draft.currentServiceId
      || draft.currentStaffId
      || draft.currentStartTime !== 120
      || draft.currentDuration !== 60
      || draft.currentDiscountType !== 'none'
      || draft.currentDiscountValue !== 0
      || draft.currentServiceNotes?.trim()
      || stagedServices.length > 0
      || draft.sessionNotes?.trim()
      || !draft.notifyWhatsApp
      || draft.createSplitActive
      || Object.values(draft.createSplitAmounts || {}).some((amount) => Number(amount) > 0)
      || draft.giftCardCodeInput?.trim()
      || draft.blockTitleAr?.trim() !== 'استراحة قهوة الموظفين'
      || draft.blockTitleEn?.trim() !== 'Staff Espresso Recess'
      || draft.blockStaffId
      || draft.blockStartTime !== 180
      || draft.blockDuration !== 45
      || draft.blockType !== 'Break'
      || draft.blockIsRecurring
      || draft.blockEndDate?.trim()
    );
};
