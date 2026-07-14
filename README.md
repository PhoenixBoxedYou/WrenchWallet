# WrenchWallet

A simple client-side vehicle maintenance tracker built with HTML, CSS, and JavaScript.

- Save vehicle details
- Track maintenance history
- Surface service reminders based on date or mileage
- Review maintenance spending across your vehicles
- Export data as JSON or CSV
- Works entirely in the browser using localStorage

## Optional: Firebase sync (Auth + Firestore)

WrenchWallet can optionally sync data to Firebase Firestore and use Firebase Authentication to keep each user's vehicles in the cloud.

Quick setup
1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Authentication → Sign-in methods: enable Email/Password and (optionally) Google
3. Enable Firestore in your project (start in test mode while developing, then tighten rules)
4. Copy `firebase-config.example.js` to `firebase-config.js` in the project root and paste your project's config as `window.FIREBASE_CONFIG`.
   - Example file is provided in the repo; it must define window.FIREBASE_CONFIG.
5. Open the app in a browser. When signed in, your vehicles will sync to Firestore under `users/{uid}/vehicles` (one document per vehicle).

What the client does when signed in
- Real-time listener: the app attaches an onSnapshot listener to `users/{uid}/vehicles` and keeps localStorage/UI in sync.
- Writes: save operations batch-set each vehicle document and remove any remote docs that no longer exist locally.
- Sign-up flow: a verification email is sent after a successful sign-up.
- Password reset: use the "Forgot password" button in the auth UI to send a reset email.

Firestore security rules (recommended)
- Use rules to restrict access to each user's own documents. Example rule snippet for production (adapt and test first):

    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /users/{userId} {
          allow read, write: if false; // block direct access to the parent doc
          match /vehicles/{vehicleId} {
            allow read, write: if request.auth != null && request.auth.uid == userId;
          }
        }
      }
    }

Migration from legacy users/{uid}.vehicles array
- Older versions stored all vehicles as a single array field on `users/{uid}` (users/{uid}.vehicles). The app includes a migration helper that converts that array into per-vehicle documents in the subcollection `users/{uid}/vehicles`.
- To run migration manually in the browser console after signing in as the affected user:

    await window.migrateVehiclesToSubcollection();

- The migration helper will:
  - Copy each vehicle in the legacy array into an individual document in `users/{uid}/vehicles` (preserving/creating ids).
  - Remove the legacy `vehicles` field from the user document.
- IMPORTANT: Run migration only once per user and verify results in the Firebase console before deleting or overwriting data.

Testing & verification
- After setting up firebase-config.js and enabling Auth/Firestore:
  1. Sign up using an email address — you should receive a verification email.
  2. Sign in and confirm the UI shows "Loaded X vehicles from cloud" and that the dashboard shows synced data.
  3. Add a vehicle and/or maintenance record; check the Firestore console to confirm a new document appears under `users/{uid}/vehicles`.
  4. Test password reset by entering your email and clicking "Forgot password".

Notes & caveats
- The app keeps a localStorage copy at all times — it will still work without Firebase config, but cloud sync features require firebase-config.js and a configured Firebase project.
- Batch write limits: for very large numbers of vehicles a single batch may exceed Firestore limits; the client assumes normal personal use. If you have large datasets, migrate in chunks or contact for assistance.

If you'd like, I can:
- Add a migration button to the UI (so migration can be run without the console). (Already added)
- Create a step-by-step screenshot guide.
- Help push these changes to your GitHub repo or create a PR.
