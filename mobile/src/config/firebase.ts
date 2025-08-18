// React Native Firebase imports
import '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';

// Debug log to confirm React Native Firebase is loaded
console.log('React Native Firebase auth loaded:', auth);
console.log('Auth object type:', typeof auth);

export { auth };