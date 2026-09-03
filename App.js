import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const ROUTE_MAP = {
  live: '/live',
  home: '/',
  profile: '/profile',
};

function resolveNotificationRoute(data) {
  if (!data || typeof data.screen !== 'string') return null;
  return ROUTE_MAP[data.screen] ?? null;
}

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null;
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token;
}

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [lastRoute, setLastRoute] = useState(null);

  const handleTap = (source, response) => {
    const data = response?.notification?.request?.content?.data;
    const route = resolveNotificationRoute(data);
    console.log(`[notif tap] source=${source} data=${JSON.stringify(data)} route=${route}`);
    if (route) setLastRoute(route);
  };

  useEffect(() => {
    console.log('[app] mounted');

    registerForPushNotificationsAsync().then((token) => {
      console.log('[app] push token:', token);
      if (token) setExpoPushToken(token);
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      console.log('[app] getLastNotificationResponseAsync:', response);
      if (response) handleTap('cold-start', response);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => handleTap('foreground/background', response)
    );

    return () => subscription.remove();
  }, []);


  useEffect(() => {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log('[app] notification RECEIVED (not necessarily tapped):', notification.request.content.data);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    handleTap('foreground/background', response);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}, []);


  return (
    <View style={styles.container}>
      <Text style={styles.title}>expo-notifications crash repro</Text>
      <Text selectable style={styles.token}>
        {expoPushToken || 'Fetching push token...'}
      </Text>
      {lastRoute && <Text style={styles.step}>Resolved route: {lastRoute}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  step: { fontSize: 14, textAlign: 'center' },
  token: { marginTop: 16, padding: 12, backgroundColor: '#eee', fontSize: 12 },
});