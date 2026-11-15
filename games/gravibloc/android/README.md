# Gravibloc for Android (Google Play)

A Capacitor app that wraps the HTML5 game in `..` and shows ads through
Google AdMob.

## Build

Needs Node 20+, JDK 21 and the Android SDK (`ANDROID_HOME`).

```bash
npm install
npm run sync                          # copies ../index.html, game.js, ads.js into the app
cd android && ./gradlew bundleRelease # -> app/build/outputs/bundle/release/app-release.aab
```

Release signing reads `android/keystore.properties` (git-ignored, never commit it):

```
storeFile=/absolute/path/gravibloc-upload.keystore
storePassword=...
keyAlias=upload
keyPassword=...
```

Before each new upload, raise `versionCode` (and `versionName`) in
`android/app/build.gradle`.

## Switching from test ads to real ads

The app uses Google's public **test** ad units until you change these:

1. `android/app/src/main/res/values/strings.xml` → `admob_app_id` = your AdMob
   app id (`ca-app-pub-XXXX~YYYY`).
2. `npm run sync` with the real unit ids on the page. Add them to the `web`
   script's sed in `package.json`, for example
   `-e 's/data-portal="none"/data-portal="admob" data-admob-interstitial="ca-app-pub-XXXX\/111" data-admob-rewarded="ca-app-pub-XXXX\/222"/'`.

Also host an `app-ads.txt` on the developer website listed in Play Console,
with the line AdMob shows you. Without it, ad revenue drops.
