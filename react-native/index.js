import 'react-native-get-random-values';
import statsig from './lib/statsig-react-native-sdk';
import asyncStorage from '@react-native-async-storage/async-storage';

statsig._setAsyncStorage(asyncStorage);

export default statsig;
