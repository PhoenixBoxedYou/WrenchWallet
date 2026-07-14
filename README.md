# WrenchWallet

A simple client-side vehicle maintenance tracker built with HTML, CSS, and JavaScript.

- Save vehicle details
- Track maintenance history
- Surface service reminders based on date or mileage
- Review maintenance spending across your vehicles
- Export data as JSON or CSV
- Works entirely in the browser using localStorage

## Firebase (Auth + Firestore) setup

To enable user sign-up/sign-in and sync data across devices using Firestore:

1. Create a Firebase project at https://console.firebase.google.com
2. In Authentication, enable Email/Password and the Google provider (optional)
3. In Firestore, create a database (start in test mode while developing)
4. Copy `firebase-config.example.js` to `firebase-config.js` and fill in the config values from Project Settings -> SDK

   - Example: `firebase-config.js` should set window.FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "..." }

5. (Optional) Update Firestore rules for production. For early development you can use test rules, but for production protect user docs:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

6. Reload the app — sign up or sign in to persist your vehicles to Firestore under `users/{uid}`.

Note: This repository includes a minimal client-side integration. For production you should review Firestore rules and consider using server-side validation as necessary.
