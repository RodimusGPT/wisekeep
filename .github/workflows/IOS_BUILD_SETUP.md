# iOS Native Build Setup (GitHub Actions)

This workflow builds iOS apps using Xcode on GitHub's macOS runners, **avoiding EAS Build costs entirely**.

## Required GitHub Secrets

Add these secrets to your repository (Settings > Secrets and variables > Actions):

### 1. Code Signing Certificate

**`IOS_DISTRIBUTION_CERT_P12`** - Base64 encoded .p12 certificate file

```bash
# Export from Keychain or Apple Developer portal
# Then convert to base64:
base64 -i YourDistributionCertificate.p12 | pbcopy
```

**`IOS_DISTRIBUTION_CERT_PASSWORD`** - Password for the .p12 file

### 2. Provisioning Profile

**`IOS_PROVISIONING_PROFILE`** - Base64 encoded provisioning profile

```bash
# Download from Apple Developer portal
# Then convert to base64:
base64 -i YourProfile.mobileprovision | pbcopy
```

### 3. App Store Connect API (for TestFlight upload)

**`APP_STORE_CONNECT_API_KEY_ID`** - API Key ID (e.g., `ABC123DEFG`)

**`APP_STORE_CONNECT_ISSUER_ID`** - Issuer ID (UUID format)

**`APP_STORE_CONNECT_API_KEY_CONTENT`** - Base64 encoded .p8 file

```bash
# Create API Key at: https://appstoreconnect.apple.com/access/integrations
# Download the .p8 file, then:
base64 -i AuthKey_ABC123DEFG.p8 | pbcopy
```

## How to Get Certificates & Profiles

### Option 1: Manual (via Apple Developer Portal)

1. Go to https://developer.apple.com/account/resources/certificates
2. Create **iOS Distribution** certificate
3. Download and double-click to install in Keychain
4. Export from Keychain as .p12 (set a password)
5. Go to https://developer.apple.com/account/resources/profiles
6. Create **App Store** provisioning profile for `xyz.generalize.wisekeep`
7. Download the .mobileprovision file

### Option 2: fastlane match (recommended)

```bash
# Install fastlane
gem install fastlane

# Initialize match
fastlane match init

# Generate certificates and profiles
fastlane match appstore --app_identifier xyz.generalize.wisekeep
```

## Usage

### Trigger Build via GitHub UI

1. Go to **Actions** tab in GitHub
2. Select **iOS Native Build (Xcode on macOS)**
3. Click **Run workflow**
4. Choose whether to upload to TestFlight
5. Click **Run workflow**

### Download IPA

After build completes:
1. Go to the workflow run
2. Scroll to **Artifacts** section
3. Download `wisekeep-ios` artifact
4. Extract the .ipa file

## Cost

- **Public repos**: Free unlimited minutes on macOS runners
- **Private repos**: Uses GitHub Actions minutes (macOS = 10x multiplier)
  - Free tier: 2,000 minutes/month → 200 macOS minutes
  - Each build: ~10-20 minutes = 100-200 macOS minutes consumed

## Troubleshooting

### Build fails with "No signing certificate"

- Verify `IOS_DISTRIBUTION_CERT_P12` is correctly base64 encoded
- Ensure password matches the .p12 file

### Build fails with "No provisioning profile"

- Verify `IOS_PROVISIONING_PROFILE` is correctly base64 encoded
- Ensure bundle ID matches: `xyz.generalize.wisekeep`
- Ensure provisioning profile is for **App Store** distribution

### TestFlight upload fails

- Verify API key has **Admin** or **App Manager** role
- Ensure app is created in App Store Connect
- Check API key hasn't expired
