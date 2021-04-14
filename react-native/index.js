import 'react-native-get-random-values';
import statsig from './dist/statsig-react-native-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as ExpoDevice from 'expo-device';

statsig._setReactNativeDependencies(
  AsyncStorage,
  AppState,
  NativeModules,
  Platform,
  null,
  Constants,
  ExpoDevice,
);
export default statsig;
