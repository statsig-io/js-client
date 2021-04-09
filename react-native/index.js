import 'react-native-get-random-values';
import statsig from './lib/statsig-react-native-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Device from 'expo-device';
import * as Localization from 'expo-localization';

statsig._setReactNativeDependencies(
  AsyncStorage,
  AppState,
  Device,
  Localization,
);

export default statsig;
