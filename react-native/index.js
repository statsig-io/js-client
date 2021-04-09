import 'react-native-get-random-values';
import statsig from './lib/statsig-react-native-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Localization from 'expo-localization';

statsig._setReactNativeDependencies(
  AsyncStorage,
  AppState,
  Constants,
  Device,
  Localization,
);

export default statsig;
