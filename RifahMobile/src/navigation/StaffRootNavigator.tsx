import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BookingsScreen } from '../screens/BookingsScreen';
import { AppointmentDetailsScreen } from '../screens/AppointmentDetailsScreen';

const Stack = createNativeStackNavigator();

export function StaffRootNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="Appointments"
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="Appointments" component={BookingsScreen} />
            <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
        </Stack.Navigator>
    );
}
