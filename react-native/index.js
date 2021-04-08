import 'react-native-get-random-values';
import statsig from './lib/statsig-react-native-sdk';
import asyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

statsig._setAsyncStorage(asyncStorage);
statsig._setAppState(AppState);

export default statsig;
