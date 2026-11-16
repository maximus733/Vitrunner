# CampusCart VITC — V-Mart Peer-to-Peer Hostel Runner

A mobile-first Progressive Web App (PWA) built for **VIT Chennai** students to request everyday snacks, beverages, and stationery from the campus **V-Mart** store and have them delivered to their hostel block main gate by verified fellow students.

---

## Key Features

* **VIT Student Authentication:** Restricted exclusively to verified `@vitstudent.ac.in` Google accounts via Firebase Auth.
* **Same-Gender Hostel Zone Matching:** Automatically maps users to their campus hostel zone and enforces same-zone delivery both in the UI and Firestore Security Rules:
  * **Boys Hostel Zone:** A-Block, D-Block, E-Block, F-Block
  * **Ladies Hostel Zone:** B-Block, C-Block
* **Distance-Based Runner Payouts (₹5 – ₹15):** Delivery fees scale fairly by walking distance from V-Mart:
  * **A-Block & B-Block** (Nearest): `₹5`
  * **C-Block** (Medium Walk): `₹8`
  * **D-Block** (Medium Walk): `₹9`
  * **E-Block** (Far Walk): `₹12`
  * **F-Block** (Farthest Block): `₹15`
* **Transparent V-Mart MRP + Receipt Proof:** Runners upload a compressed photo of the printed V-Mart bill before marking an order `AT_GATE`. Buyers verify the exact printed MRP and pay the runner directly via UPI at handoff.
* **4-Digit Gate Handoff OTP:** Orders close only when the buyer shares their unique 4-digit OTP at the hostel gate.
* **Prepaid Runner Credit System:** Zero payment gateway fees—runners top up delivery credits (`₹20 = 20 credits` or `₹50 = 55 credits`) via UPI + 12-digit UTR verification.
* **Installable Android PWA:** Supports one-tap **"Add to Home Screen"** in Chrome and can be packaged into a standalone Android `.apk` via PWABuilder.

---

## Project Structure

```text
Vitrunner/
├── index.html          # Main PWA shell (Auth, Buyer Basket, Runner Feed, Tracker, Wallet, Admin)
├── styles.css          # Jet Black, Cerulean Blue & Neon Rose responsive theme
├── app.js              # Firebase v13.3.0 modular logic, atomic claim transactions, receipt compressor
├── manifest.json       # PWA manifest for Android/iOS home screen installation
├── sw.js               # Service Worker for offline shell caching and instant updates
├── firestore.rules     # Backend security rules enforcing @vitstudent.ac.in & same-gender claims
└── README.md           # Project documentation
