import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';

import AuthScreen from '../../screens/AuthScreen';
import TabNavigator from './TabNavigator';
import AdminScreen from '../../screens/AdminScreen';

const Stack = createStackNavigator();

interface StackNavigatorProps {
  isAuthenticated: boolean;
}

export default function StackNavigator({ isAuthenticated }: StackNavigatorProps) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen 
              name="Admin" 
              component={AdminScreen}
              options={{ 
                headerShown: true,
                title: 'Admin Panel',
                headerBackTitle: 'Back'
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}