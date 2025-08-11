import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

// Screen imports - will be created later
import ChatScreen from '../../screens/ChatScreen';
import MentalHealthScreen from '../../screens/MentalHealthScreen';
import FuturePathwaysScreen from '../../screens/FuturePathwaysScreen';
import SleepScreen from '../../screens/SleepScreen';
import MemoryScreen from '../../screens/MemoryScreen';

const Tab = createBottomTabNavigator();

// Simple icon component using emoji
const TabIcon = ({ route, color, size }: { route: any; color: string; size: number }) => {
  let emoji = '💬';
  
  switch (route.name) {
    case 'Chat':
      emoji = '💬';
      break;
    case 'MentalHealth':
      emoji = '🧠';
      break;
    case 'FuturePathways':
      emoji = '🚀';
      break;
    case 'Sleep':
      emoji = '😴';
      break;
    case 'Memory':
      emoji = '💭';
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
        name="Chat" 
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
      <Tab.Screen 
        name="MentalHealth" 
        component={MentalHealthScreen}
        options={{ title: 'Mental Health' }}
      />
      <Tab.Screen 
        name="FuturePathways" 
        component={FuturePathwaysScreen}
        options={{ title: 'Pathways' }}
      />
      <Tab.Screen 
        name="Sleep" 
        component={SleepScreen}
        options={{ title: 'Sleep' }}
      />
      <Tab.Screen 
        name="Memory" 
        component={MemoryScreen}
        options={{ title: 'Memory' }}
      />
    </Tab.Navigator>
  );
}