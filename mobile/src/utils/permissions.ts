import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { PERMISSIONS, request, RESULTS, check } from 'react-native-permissions';

export class PermissionsManager {
  static async requestMicrophonePermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'RiseTwice needs access to your microphone for voice conversations.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const result = await request(PERMISSIONS.IOS.MICROPHONE);
        return result === RESULTS.GRANTED;
      }
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  }

  static async checkMicrophonePermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        return result;
      } else {
        const result = await check(PERMISSIONS.IOS.MICROPHONE);
        return result === RESULTS.GRANTED;
      }
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return false;
    }
  }

  static showPermissionAlert() {
    Alert.alert(
      'Microphone Permission Required',
      'Please enable microphone access in your device settings to use voice features.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => {
          // Open device settings - implementation depends on specific requirements
        }}
      ]
    );
  }
}