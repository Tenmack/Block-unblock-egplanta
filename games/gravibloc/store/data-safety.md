# Play Console answers: App content

## Data safety

- **Does your app collect or share any of the required user data types?** Yes
  (through the Google Mobile Ads SDK).
- **Is all of the user data encrypted in transit?** Yes.
- **Do you provide a way for users to request that their data is deleted?** No
  (the game has no accounts, and progress is only on the device).

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Device or other IDs (advertising ID) | Yes | Yes | Advertising or marketing, Analytics | No |
| Approximate location (from IP) | Yes | Yes | Advertising or marketing | No |
| App interactions | Yes | Yes | Advertising or marketing, Analytics | No |
| Crash logs, Diagnostics | Yes | No | App functionality | No |

Data is processed ephemerally: **No**.

## Other App content sections

- **Privacy policy URL:** the public link to `privacy-policy.md` (or a hosted copy).
- **Ads:** Yes, the app contains ads.
- **App access:** All functionality is available without special access.
- **Content rating:** see `listing.md`.
- **Target audience:** 13+ only, see `listing.md`.
- **News app:** No. **Government app:** No. **Financial features:** None.
- **Health:** No. **COVID-19 contact tracing:** No.
- **Advertising ID:** Yes, the app uses the advertising ID, for Advertising and
  Analytics. The Google Mobile Ads SDK adds the `AD_ID` permission to the app automatically.
