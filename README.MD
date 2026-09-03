# expo-notifications: Foreground Tap Bug Repro (Android)

Minimal repro for [expo/expo#49638](https://github.com/expo/expo/issues/49638) —
`addNotificationResponseReceivedListener` does not fire (and navigation does not
occur) when a push notification is tapped **while the app is in the foreground**
on Android.

## Summary

- `addNotificationReceivedListener` fires correctly in all app states.
- `addNotificationResponseReceivedListener` fires correctly when the app is
  **backgrounded or killed** and the notification is tapped.
- `addNotificationResponseReceivedListener` **does not fire at all** — no
  console output, not even a fallback log — when the notification is tapped
  while the app is **already in the foreground**.

## Prerequisites

- Expo SDK 54 / 55 / 57 (confirmed reproducible on all three)
- `expo-notifications: "~57.0.14"`
- A physical Android device (tested on Android 12)
- A dev build (`eas build --profile development --platform android`) — push
  notifications and this bug do not reproduce reliably in Expo Go
- Your own Firebase project configured for the app:
  - Add your `google-services.json` to the project root
  - Set `googleServicesFile` in `app.json` / `app.config.js`:
    ```json
    {
      "expo": {
        "android": {
          "googleServicesFile": "./google-services.json"
        }
      }
    }
    ```
  - Add the `expo-notifications` plugin and `eas.projectId` under `extra.eas`
    in your Expo config (required for `getExpoPushTokenAsync`)

## Setup

1. Install dependencies and create a dev build:
   ```bash
   npx expo install expo-notifications expo-device expo-constants
   eas build --profile development --platform android
   ```
2. Install the build on your device and launch it.
3. Grant notification permission when prompted.
4. Copy the Expo push token printed in the app / logs
   (`[app] push token: ExponentPushToken[...]`).

## Test Steps

### 1. Foreground tap (bug)

1. Open the app and leave it in the foreground.
2. Send a push notification using the curl command below (replace the token
   with your own).
3. Wait for the notification banner to appear at the top of the screen and
   tap it.
4. **Expected:** navigation to `/live`, and a `[notif tap] ...` log.
5. **Actual:** nothing happens — no navigation, no `[notif tap]` log. Only
   the `notification RECEIVED` log appears.

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "<YOUR_EXPO_PUSH_TOKEN>",
    "title": "Foreground tap test",
    "body": "Tap me while the app is open",
    "sound": "default",
    "data": {
      "url": "/live"
    }
  }'
```

### 2. Background / killed tap (works)

1. Send a notification while the app is open (or already sent), then press
   the home button to background the app (or swipe it away to kill it).
2. Tap the notification from the system tray.
3. **Expected and actual:** navigation to `/profile`, and a
   `[notif tap] ... route=/profile` log once the app resumes.

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "<YOUR_EXPO_PUSH_TOKEN>",
    "title": "Background tap test",
    "body": "Tap me from the system tray",
    "sound": "default",
    "data": {
      "url": "/profile"
    }
  }'
```

## Observed Logs

**Foreground tap:**

```
LOG  [app] mounted
LOG  [app] getLastNotificationResponseAsync: null
LOG  [app] push token: ExponentPushToken[3Ohfo3DDRXBtMRAbawS70y]
LOG  [app] notification RECEIVED: {"url": "/profile"}
```

(no `[notif tap]` log — the response listener never fires)

**Background/killed tap:**

```
LOG  [app] mounted
LOG  [app] getLastNotificationResponseAsync: null
LOG  [app] push token: ExponentPushToken[3Ohfo3DDRXBtMRAbawS70y]
LOG  [notif tap] source=foreground/background data={"url":"/profile"} route=/profile
```

## Notes

- This is not a payload-shape or duplicate-listener issue — `data.url` is
  read and mapped correctly in the code, as shown by the successful
  background-tap case above.
- Tracking issue: https://github.com/expo/expo/issues/49638
