import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { PurchasesScreen } from '../screens/PurchasesScreen';
import { PaymentScreen } from '../screens/PaymentScreen';
import { TenantScreen } from '../screens/TenantScreen';
import { BookingFlow } from '../screens/BookingFlow';
import { HotDealDetailScreen } from '../screens/HotDealDetailScreen';
import { CartScreen } from '../screens/CartScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { BrowseScreen } from '../screens/BrowseScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { InfoPageScreen } from '../screens/InfoPageScreen';

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
            <Stack.Screen name="Booking" component={BookingFlow} />
            <Stack.Screen name="MyPurchases" component={PurchasesScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="HotDealDetail" component={HotDealDetailScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="Browse" component={BrowseScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="InfoPage" component={InfoPageScreen} />
        </Stack.Navigator>
    );
}
