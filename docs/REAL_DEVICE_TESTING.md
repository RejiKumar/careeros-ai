# CareerOS AI — Real Device Testing Checklist (Zero Dependencies)

Run the app on a physical Android device using only Expo Go. No dev build, no EAS, no Firebase, no IAP SDK needed.

---

## Prerequisites (One-Time Setup)

### On your computer
1. Install Node.js ≥ 20 (`node -v`)
2. Install pnpm: `npm i -g pnpm@11.21.0`
3. Install ADB: part of Android SDK Platform Tools (add to PATH)
4. Clone repo: `git clone https://github.com/RejiKumar/careeros-ai.git`
5. Install deps: `cd careeros-ai && pnpm install`
6. Create `apps/mobile/.env` from `.env.example` with your Supabase URL + anon key

### On your Android device
1. Enable **Developer Options** (tap Build Number 7 times)
2. Enable **USB Debugging** (or **Wireless Debugging** for WiFi)
3. Install **Expo Go** from Play Store (SDK 57 compatible)

---

## Connect & Run

```bash
# USB
adb devices                              # verify device listed
adb reverse tcp:8081 tcp:8081            # Metro bundler
adb reverse tcp:8000 tcp:8000            # Local API (if running)

# WiFi (Android 11+)
# Settings → Developer Options → Wireless Debugging → Pair
adb pair <ip:port> <code>
adb connect <ip:port>
adb reverse tcp:8081 tcp:8081

# Start the app
cd apps/mobile
npx expo start
# Press 'a' to open on Android
```

---

## Test Checklist

### Auth Flow
- [ ] Auth screen renders (logo, email fields, Google button, guest button)
- [ ] Sign up with new email → account created → lands on dashboard
- [ ] Sign in with existing email → session restored
- [ ] Sign out → returns to auth screen
- [ ] Password mismatch on sign up shows error
- [ ] Wrong password on sign in shows error
- [ ] "Continue as Google" opens Google accounts page
- [ ] "Continue as guest" → lands on guest dashboard with banner

### Guest Mode
- [ ] Guest banner visible ("Browsing as a guest")
- [ ] Dashboard loads with resume score, XP, missions
- [ ] Navigate all tabs (Home, Resume, Match, Coach, Profile)
- [ ] "Sign in to save guest data" modal works
- [ ] Sign in from guest banner → migrates guest data → shows account data

### Dashboard
- [ ] Resume score card displays
- [ ] XP and level display
- [ ] Day streak counter
- [ ] Today's missions list loads
- [ ] "View all missions" navigates to Missions tab
- [ ] Explore section: all 6 feature cards render with icons
- [ ] Tap each feature card → navigates to correct screen
- [ ] Quick actions (New resume, Job match, Coach, Roast, Wrapped, Interview)

### Resume
- [ ] Upload resume (PDF) → processing indicator → score appears
- [ ] Upload resume (DOCX) → works
- [ ] Upload resume (TXT) → works
- [ ] Resume health score displays with dimensions
- [ ] "Get rewrites" button → navigates to Rewrites
- [ ] Multiple resume versions listed
- [ ] Voice input mic button visible in text fields

### Job Match
- [ ] Paste job description → "Analyze" button
- [ ] AI match score displays after analysis
- [ ] Match strengths/weaknesses listed
- [ ] Saved job descriptions listed
- [ ] Delete a job description
- [ ] Re-run match on existing JD
- [ ] Voice mic button on title/company/JD fields

### AI Coach
- [ ] Start new conversation
- [ ] Suggested prompts display
- [ ] Send message → AI response appears
- [ ] Copy message works
- [ ] Regenerate response works
- [ ] Thread list displays past conversations
- [ ] Delete thread
- [ ] Voice mic button in composer

### Rewrites
- [ ] Generate rewrites from resume → suggestions list
- [ ] Accept a rewrite → creates new resume version
- [ ] Empty state: "No improvements" message with re-generate button

### Resume Roast
- [ ] 5 mode buttons render (Gentle, Brutal, Coach, Interviewer, Recruiter)
- [ ] Select mode → "Roast me" → content appears
- [ ] Different modes give different tone
- [ ] Requires parsed resume content (error if none)

### Career Wrapped
- [ ] Summary screen renders with stats
- [ ] Toggles to customize display
- [ ] Share button → system share sheet

### Mock Interview
- [ ] Setup screen: select mode + question count
- [ ] Start interview → questions appear one by one
- [ ] Type answer → submit → next question
- [ ] Voice input mic button works (if supported)
- [ ] Complete interview → evaluation scores display
- [ ] Per-question feedback visible
- [ ] Session history listed

### Missions
- [ ] Daily missions list loads
- [ ] Complete a mission → XP awarded
- [ ] Streak counter increments
- [ ] "View all" shows complete mission history

### Profile
- [ ] Account info displays (email, plan)
- [ ] Achievement badges display
- [ ] Sign out button works
- [ ] Delete account button → confirmation dialog
- [ ] Password reset (if email account)

### UI / UX
- [ ] Status bar color matches theme (white in light, dark in dark)
- [ ] Tab bar icons visible and tappable
- [ ] All screens scroll properly
- [ ] Loading states show spinner (not blank)
- [ ] Error states show retry button
- [ ] Dark mode toggle works (if accessible)
- [ ] No text overlap or truncation
- [ ] Voice mic icon visible on supported screens

### Network / Edge Cases
- [ ] Kill app and reopen → session restored
- [ ] Airplane mode → error state with retry
- [ ] Slow network → loading indicator persists
- [ ] Expired session → redirects to auth (token refresh)

---

## Known Limitations in Expo Go

These features require a **dev build** (`npx expo run:android`) or **production build**:

| Feature | Expo Go | Dev Build |
|---|---|---|
| Custom app icon | Shows Expo Go icon | Shows careerosai_icon |
| Custom splash screen | Shows Expo splash | Shows custom splash |
| Voice-to-text | Falls back gracefully | Full speech recognition |
| Google sign-in | May not complete callback | Works fully |
| Push notifications | Not available | Available |
| AdMob | Not available | Available |
| In-app purchases | Not available | Available |
| Status bar color | Set via runtime API | Set via config |

---

## Quick Smoke Test (5 minutes)

1. Open app → auth screen appears
2. Tap "Continue as guest" → dashboard loads
3. Scroll down → explore cards visible with white icons on gradients
4. Tap "Resume" tab → upload a PDF → score appears
5. Tap "Coach" tab → send a message → AI responds
6. Tap "Profile" tab → sign out → back to auth screen
7. Sign in with email → dashboard loads with account data
8. Kill app → reopen → still signed in
