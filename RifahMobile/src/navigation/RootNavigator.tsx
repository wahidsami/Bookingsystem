import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { PurchasesScreen } from '../screens/PurchasesScreen';
import { PaymentScreen } from '../screens/PaymentScreen';
import { PaymentSuccessScreen } from '../screens/PaymentSuccessScreen';
import { TenantScreen } from '../screens/TenantScreen';
import { BookingJourneyScreen } from '../screens/BookingJourneyScreen';
import { HotDealDetailScreen } from '../screens/HotDealDetailScreen';
import { CartScreen } from '../screens/CartScreen';
import { ServiceBookingCartScreen } from '../screens/ServiceBookingCartScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { BrowseScreen } from '../screens/BrowseScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { InfoPageScreen } from '../screens/InfoPageScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { NotificationDetailScreen } from '../screens/NotificationDetailScreen';
import { AppointmentInviteScreen } from '../screens/AppointmentInviteScreen';
import { EmployeeProfileScreen } from '../screens/EmployeeProfileScreen';
import { ReviewScreen } from '../screens/ReviewScreen';
import { GiftsScreen } from '../screens/GiftsScreen';
import { ServiceDetailsScreen } from '../screens/ServiceDetailsScreen';
import { ServiceBrowserScreen } from '../screens/ServiceBrowserScreen';
import { ProductDetailsScreen } from '../screens/ProductDetailsScreen';
import { WalletBalanceDetailsScreen } from '../screens/WalletBalanceDetailsScreen';
import { CentersBalanceScreen } from '../screens/CentersBalanceScreen';
import { AppointmentDetailsScreen } from '../screens/AppointmentDetailsScreen';
import { BookingStaffSelectionScreen } from '../screens/BookingStaffSelectionScreen';
import { BookingStaffPerServiceScreen } from '../screens/BookingStaffPerServiceScreen';
import { BookingDateTimeSelectionScreen } from '../screens/BookingDateTimeSelectionScreen';
import { BookingReviewScreen } from '../screens/BookingReviewScreen';
import { BookingPaymentMethodScreen } from '../screens/BookingPaymentMethodScreen';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="Tabs" component={TabNavigator} />
            <Stack.Screen name="Tenant" component={TenantScreen} />
            <Stack.Screen name="Booking" component={BookingJourneyScreen} />
            <Stack.Screen name="MyPurchases" component={PurchasesScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
            <Stack.Screen name="HotDealDetail" component={HotDealDetailScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="ServiceBookingCart" component={ServiceBookingCartScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="Browse" component={BrowseScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="InfoPage" component={InfoPageScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} />
            <Stack.Screen name="AppointmentInvite" component={AppointmentInviteScreen} />
            <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} />
            <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
            <Stack.Screen name="ServiceBrowser" component={ServiceBrowserScreen} />
            <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
            <Stack.Screen name="Review" component={ReviewScreen} />
            <Stack.Screen name="Gifts" component={GiftsScreen} />
            <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
            <Stack.Screen name="BookingStaffSelection" component={BookingStaffSelectionScreen} />
            <Stack.Screen name="BookingStaffPerServiceScreen" component={BookingStaffPerServiceScreen} />
            <Stack.Screen name="BookingDateTimeSelection" component={BookingDateTimeSelectionScreen} />
            <Stack.Screen name="BookingReviewScreen" component={BookingReviewScreen} />
            <Stack.Screen name="BookingPaymentMethodScreen" component={BookingPaymentMethodScreen} />
            <Stack.Screen name="WalletBalanceDetails" component={WalletBalanceDetailsScreen} />
            <Stack.Screen name="CentersBalance" component={CentersBalanceScreen} />
        </Stack.Navigator>
    );
}
