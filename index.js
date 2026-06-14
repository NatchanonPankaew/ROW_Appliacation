 /**
 * @format
 */

import { AppRegistry, Platform } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

// On web there's no native host to call runApplication for us, so mount the app
// into a #root element ourselves. This branch is stripped from native bundles.
if (Platform.OS === 'web') {
  require('@expo/metro-runtime'); // enables Fast Refresh / web runtime
  const rootTag =
    document.getElementById('root') ||
    (() => {
      const el = document.createElement('div');
      el.id = 'root';
      document.body.appendChild(el);
      return el;
    })();
  AppRegistry.runApplication(appName, { rootTag });
}
