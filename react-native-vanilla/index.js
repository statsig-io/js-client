import 'react-native-get-random-values';
import statsig from './dist/statsig-react-native-vanilla-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, NativeModules, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

statsig._setReactNativeDependencies(
  AsyncStorage,
  AppState,
  NativeModules,
  Platform,
  DeviceInfo,
  null,
  null,
);

export default statsig;
