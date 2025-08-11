# Firebase Phone Authentication Setup

## Prerequisites

Before phone authentication will work, you need to configure Firebase:

### 1. Enable Phone Authentication in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Phone** provider
5. Toggle **Enable** switch
6. Click **Save**

### 2. Add Authorized Domains

1. In Firebase Console, go to **Authentication** → **Settings**
2. Under **Authorized domains**, add your production domain(s)
3. Localhost is already authorized by default for development

### 3. Enable reCAPTCHA (Required for Web)

Phone authentication on web requires reCAPTCHA verification to prevent abuse.

The implementation uses **invisible reCAPTCHA** which runs in the background without user interaction unless suspicious activity is detected.

### 4. Test Phone Numbers (Development)

For testing without using real SMS:

1. In Firebase Console, go to **Authentication** → **Sign-in method** → **Phone**
2. Add test phone numbers and verification codes
3. Example:
   - Phone: `+1 555-555-5555`
   - Code: `123456`

## Implementation Details

### Components

1. **PhoneAuth.tsx** - Standalone phone authentication component with:
   - Phone number input with country code
   - SMS verification code input
   - Invisible reCAPTCHA integration
   - Error handling and validation

2. **Login.tsx** - Updated to include phone sign-in option alongside Google and Apple

3. **auth-context.tsx** - Extended with:
   - `setupRecaptcha()` - Initializes invisible reCAPTCHA
   - `signInWithPhone()` - Sends verification SMS
   - `verifyPhoneCode()` - Verifies the SMS code

### User Flow

1. User clicks "Sign in with Phone"
2. Enters phone number with country code
3. Invisible reCAPTCHA verifies (happens automatically)
4. SMS with 6-digit code is sent
5. User enters verification code
6. User is signed in upon successful verification

### Phone Number Format

- Must include country code (e.g., `+1` for USA)
- Format: `+[country_code][phone_number]`
- Examples:
  - USA: `+12125551234`
  - UK: `+442071234567`
  - India: `+919876543210`

### Security Considerations

1. **Rate Limiting**: Firebase automatically rate-limits SMS sending to prevent abuse
2. **reCAPTCHA**: Protects against automated attacks
3. **Verification Codes**: Expire after a short time (typically 5 minutes)
4. **Phone Number Privacy**: Phone numbers are not exposed in the client code

### Troubleshooting

#### "auth/missing-recaptcha-token" Error
- Ensure reCAPTCHA is properly initialized
- Check that the recaptcha-container div is present in the DOM

#### "auth/invalid-phone-number" Error
- Verify phone number includes country code
- Check format matches E.164 standard

#### "auth/too-many-requests" Error
- Firebase rate limiting triggered
- Wait before retrying or use test phone numbers for development

#### SMS Not Received
- Check phone number is correct
- Verify phone authentication is enabled in Firebase Console
- Some carriers/countries may have delivery issues

### Testing Recommendations

1. Use Firebase test phone numbers during development
2. Test with real phone numbers in staging environment
3. Implement proper error handling for production
4. Consider fallback authentication methods

## Cost Considerations

Firebase charges for phone authentication:
- First 10,000 SMS verifications per month are free
- Additional verifications are charged per [Firebase pricing](https://firebase.google.com/pricing)
- Consider implementing rate limiting in your application