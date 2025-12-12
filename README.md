# 智守 / WiseKeep

<p align="center">
  <img src="assets/images/icon.png" alt="WiseKeep Logo" width="120" height="120">
</p>

<p align="center">
  <strong>錄音、筆記、記住</strong><br>
  <em>Record, Notes, Remember</em>
</p>

A mobile app designed specifically for senior citizens to effortlessly record meetings, lectures, and conversations. WiseKeep provides both detailed notes (text version of what was said) and intelligent summarization (key points).

## Features

### Recording
- **ONE large button** - covers 40% of screen width for easy tapping
- **Visual feedback** - pulsing indicator and audio waveform
- **Large timer display** - always know how long you've been recording
- **Supports long recordings** - 2+ hours no problem

### Notes (筆記)
- **Automatic transcription** - we take notes for you
- **Speaker identification** - "Speaker 1", "Speaker 2"
- **Timestamps** - tap any line to hear that moment
- **Editable** - make corrections easily

### Summary (重點摘要)
- **Key points extraction** - 3-7 bullet points
- **Context-aware** - medical instructions, meeting decisions, etc.
- **Regenerate** - if you want a fresh summary

### Senior-Friendly Design
- **Extra large touch targets** (56dp+ buttons)
- **High contrast colors**
- **Large, readable text** (20pt minimum)
- **Adjustable text size** (Small/Medium/Large)
- **Bilingual support** (繁體中文 / English)
- **Simple navigation** - maximum 2 levels deep
- **Confirmation dialogs** - prevents accidental deletions

## Tech Stack

- **React Native** with **Expo SDK 54**
- **Expo Router** - file-based routing
- **TypeScript** - type safety
- **Zustand** - state management
- **expo-av** - audio recording and playback
- **Supabase** - backend (optional, works offline)

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo Go app on your phone

### Installation

```bash
# Clone the repository
git clone https://github.com/RodimusGPT/wisekeep.git
cd wisekeep

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Environment Variables (Optional)

For cloud sync with Supabase, create a `.env` file:

```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Project Structure

```
wisekeep/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Home/Record screen
│   │   ├── library.tsx    # Recordings library
│   │   └── settings.tsx   # App settings
│   ├── recording/[id].tsx # Recording detail screen
│   └── onboarding.tsx     # First-time setup
├── components/ui/         # Reusable UI components
├── hooks/                 # Custom React hooks
├── i18n/                  # Internationalization
├── lib/                   # Utilities and API clients
├── store/                 # Zustand state management
├── types/                 # TypeScript types
└── supabase/             # Database migrations
```

## Key Components

| Component | Purpose |
|-----------|---------|
| `RecordButton` | Large, animated record/stop button |
| `AudioWaveform` | Visual feedback during recording |
| `Timer` | Large, readable recording duration |
| `NotesView` | Scrollable notes with tap-to-play |
| `SummaryView` | Bulleted summary points |
| `TabToggle` | Notes/Summary switcher |
| `BigButton` | Senior-friendly buttons throughout |

## Accessibility Features

- Minimum 48dp touch targets (56dp+ for primary actions)
- High contrast color scheme (WCAG AA compliant)
- Large text with adjustable sizing
- Screen reader support
- Haptic feedback on interactions
- Clear visual states (recording, processing, ready)

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## License

MIT License - feel free to use this for your own projects!

## Acknowledgments

- Designed with love for seniors
- Built with Claude Code
- Powered by Expo and React Native

---

<p align="center">
  <strong>智守幫你記住重要的事</strong><br>
  <em>WiseKeep helps you remember what matters</em>
</p>
