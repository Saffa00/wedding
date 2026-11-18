# Test checklist

Work through this before the wedding, on real devices and over HTTPS. Tick each box. Where a test says "expect", anything else is a bug.

Test devices: one Android phone (Chrome), one iPhone (Safari), one laptop. Use two phones for the two-usher tests.

## 1. First-time setup order
- [ ] Supabase: 3 Auth users created, `schema.sql` run, 3 `profiles` rows inserted (1 admin, 2 ushers).
- [ ] `server/.env` filled in; `GET /health` returns `{"ok":true}`.
- [ ] Frontend `.env` filled in; `npm run build` succeeds.
- [ ] Sign in as admin, then fill in: Settings, Tables, Guests, Invitations (in that order).

## 2. Security (do these on a laptop first)
- [ ] Search the built app for secrets: `grep -r "service_role" dist` and `grep -r "SERVICE_ROLE" dist` return nothing.
- [ ] Signed in as an usher, open `/admin`. Expect: redirected to `/usher`.
- [ ] Signed out, open `/admin` and `/usher/scan`. Expect: redirected to login.
- [ ] Usher token against admin endpoints, e.g. `GET /api/guests` with an usher's token. Expect: 403.
- [ ] In the Supabase SQL editor, run as an usher (`set role authenticated` with their JWT claims) and try `select * from invitations` and `insert into check_ins ...`. Expect: no rows and a permission error. This confirms Row Level Security.
- [ ] Disable an usher in the app. Expect: they cannot sign in, and an already-open session gets "This account has been disabled" on the next request.
- [ ] Open a guest link with one character changed. Expect: "Invitation not found".

## 3. Invitations
- [ ] Create an invitation for a guest with a phone number. WhatsApp opens with their number and the link.
- [ ] Open the link in a private browser window with no login. Expect: names, date and time at the venue's time zone, venue, guest name, side, table, QR code.
- [ ] Print or save as PDF. Expect: one A5 page, no buttons.
- [ ] Create a new link for the same guest. Expect: the old link now shows "Invitation not found".
- [ ] Cancel an invitation. Expect: its QR is refused at the door and the guest page shows "not found".

## 4. Scanning (usher phones)
- [ ] First scan: camera permission prompt appears, then the frame shows.
- [ ] Scan a valid QR. Expect: name, side, table, reference, status, **Confirm attendance** button.
- [ ] Confirm. Expect: success animation, and the admin dashboard count rises within about 20 seconds.
- [ ] Scan the same QR again. Expect: "already checked in" with the time, and no confirm button.
- [ ] Scan a cancelled invitation. Expect: red warning, no confirm button.
- [ ] Scan a random QR code (e.g. a website). Expect: "not a valid invitation".
- [ ] Hold the camera on one QR for 10 seconds. Expect: only one verification screen (no repeats).
- [ ] Manual lookup: type 2 letters of a name, pick the guest, confirm. Expect: same result as scanning.
- [ ] Table full: in the admin Guests screen, try to seat a guest at a full table. Expect: the table is greyed out; if forced through the API, "That table is full".
- [ ] Undo a check-in from admin Attendance. Expect: the guest can be scanned in again.

## 5. Two ushers at once (the duplicate test)
- [ ] Put the same invitation on two screens. Scan and confirm on both phones at the same moment. Expect: one success and one "already checked in". Check Attendance shows exactly one record.

## 6. Camera edge cases
- [ ] Deny camera permission. Expect: the "Camera access is blocked" screen with steps, and "Find guest by name" still works.
- [ ] Re-allow in phone settings and tap Try again. Expect: the camera starts.
- [ ] Open the camera in another app, then the scanner. Expect: "Camera is in use" (Android) or a failure message.
- [ ] Torch button appears only on phones that support it. Toggle it on and off.
- [ ] Switch camera button appears on phones with more than one camera.
- [ ] Leave the scanner with the X button, and with the phone's back gesture. Expect: the camera light turns off both times.
- [ ] iPhone: test in Safari **and** from the home-screen app. Camera behaviour can differ between the two.

## 7. Installing
- [ ] Android: Install button on the usher and admin home screens works. App opens full screen with no browser bar, with the ring icon and green loading screen.
- [ ] iPhone: the banner shows Add to Home Screen steps. After adding, the app opens full screen, the status bar is light, nothing is hidden under the notch or home bar.
- [ ] Dismiss the install banner. Expect: it stays hidden for 14 days.
- [ ] Long-press the Android app icon. Expect: "Scan invitation" shortcut.
- [ ] Portrait only: rotate the phone and check nothing breaks.

## 8. Offline and caching
- [ ] Load the app, then switch on airplane mode and reopen it. Expect: the interface opens, the Offline pill shows, no crash.
- [ ] While offline, scan a QR. Expect: an offline message, and **no** success screen.
- [ ] Open a guest link while offline. Expect: "Could not load your invitation" with Try again.
- [ ] Chrome DevTools > Application > Cache Storage: Expect only the 16 public app files (JS, CSS, font, icons, `index.html`, `offline.html`). No API responses, no tokens.
- [ ] Application > Local Storage: Expect only the sign-in session and the `onboarding_completed` and `install_dismissed_at` keys.

## 9. Updates
- [ ] Build and deploy a small visible change. Reopen the installed app. Expect: "A new version is ready", and tapping Update now loads it.
- [ ] Open the scanner while an update is waiting. Expect: no banner covers the camera.

## 10. Layouts
- [ ] iPhone and Android: bottom navigation, safe areas, keyboard does not hide the Confirm or Save buttons.
- [ ] Laptop and tablet: admin sidebar appears; sheets appear as centred panels.
- [ ] No sideways scrolling on any screen.

## 11. Before the day
- [ ] Do a full dress rehearsal with 5 test guests and both ushers.
- [ ] Charge phones, and keep a printed guest list as a backup if the venue has weak signal.
- [ ] Test mobile data at the venue itself. Check-ins need a connection.
- [ ] Delete the test guests, or reset check-ins, before the real list goes in.

## Known limits
- Check-in needs internet. There is no offline queue by design, so nobody is falsely marked as arrived.
- iPhone has no custom startup images; it shows the green loading screen instead.
- Only one administrator password change path exists: through Supabase Authentication.
- Guest invitation links are shown once when created; creating a new link replaces the old one.
