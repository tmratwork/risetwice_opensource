import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

// Screen imports - simplified for mental health focus
import MentalHealthScreen from '../../screens/MentalHealthScreen';
import AdminScreen from '../../screens/AdminScreen';

const Tab = createBottomTabNavigator();

// Simple icon component using emoji
const TabIcon = ({ route, color, size }: { route: any; color: string; size: number }) => {
  let emoji = '🧠';
  
  switch (route.name) {
    case 'MentalHealth':
      emoji = '🧠';
      break;
    case 'Admin':
      emoji = '⚙️';
      break;
  }

  return (
    <Text style={{ fontSize: size * 0.8, color }}>{emoji}</Text>
  );
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => (
          <TabIcon route={route} color={color} size={size} />
        ),
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="MentalHealth" 
        component={MentalHealthScreen}
        options={{ title: 'Mental Health' }}
      />
      <Tab.Screen 
        name="Admin" 
        component={AdminScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}