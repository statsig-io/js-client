import 'react-native-get-random-values';
import statsig from './dist/statsig-react-native-vanilla-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

statsig._setReactNativeDependencies(AsyncStorage, AppState);

export default statsig;
