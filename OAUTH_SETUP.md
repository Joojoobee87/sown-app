# OAuth Setup Guide for Sown App

## Overview
This guide shows how to configure Google and Apple OAuth providers in Supabase for social authentication.

## Prerequisites
- Supabase project URL and anon key configured
- Google Cloud Console account
- Apple Developer account (for Apple sign-in)

## Step 1: Google OAuth Setup

### 1.1 Create Google OAuth App
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Go to "APIs & Services" → "Credentials"
4. Click "Create Credentials" → "OAuth client ID"
5. Select "Web application"
6. Add authorized redirect URI:
   ```
   https://mrxdejyqoohstpradhkc.supabase.co/auth/v1/callback
   ```
7. Copy the Client ID and Client Secret

### 1.2 Configure in Supabase
1. Go to your Supabase project dashboard
2. Navigate to "Authentication" → "Providers"
3. Find Google in the list and click to expand
4. Enable the Google provider
5. Enter your Google Client ID and Client Secret
6. Save the configuration

## Step 2: Apple OAuth Setup

### 2.1 Create Apple App ID
1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Go to "Certificates, Identifiers & Profiles"
3. Create a new App ID with "Sign In with Apple" capability
4. Note your App ID (bundle identifier)

### 2.2 Create Service ID
1. In Apple Developer Portal, go to "Identifiers"
2. Click "+" to create new identifier
3. Select "Services ID"
4. Enter description and identifier
5. Configure "Sign In with Apple"
6. Add return URL:
   ```
   https://mrxdejyqoohstpradhkc.supabase.co/auth/v1/callback
   ```

### 2.3 Generate Private Key
1. Go to "Keys" in Apple Developer Portal
2. Create a new private key for "Sign In with Apple"
3. Download the .p8 file and note the Key ID
4. Note your Team ID from developer account

### 2.4 Configure in Supabase
1. Go to your Supabase project dashboard
2. Navigate to "Authentication" → "Providers"
3. Find Apple in the list and click to expand
4. Enable the Apple provider
5. Enter:
   - Client ID (your Service ID)
   - Client Secret (generated from Apple Developer Portal)
   - Private Key (content of .p8 file)
   - Key ID
   - Team ID
6. Save the configuration

## Step 3: Test the Implementation

### 3.1 Frontend Testing
1. Start your app locally
2. Go to `/auth` page
3. Click "Continue with Google" or "Continue with Apple"
4. Should redirect to OAuth provider
5. Complete authentication flow
6. Should redirect back to your app

### 3.2 Troubleshooting
- **Invalid redirect URI**: Ensure the exact URL matches in both Google/Apple and Supabase
- **Client not found**: Double-check Client ID and secrets
- **Scope issues**: Ensure proper OAuth scopes are configured

## Security Notes
- Never expose client secrets in frontend code
- Use environment variables for sensitive configuration
- Enable HTTPS in production
- Regularly rotate OAuth secrets

## Production Deployment
1. Update redirect URIs to your production domain
2. Test OAuth flow in production environment
3. Monitor authentication logs for issues
4. Set up proper error handling for OAuth failures

## Current Implementation Status
✅ UI components added (Google and Apple buttons)
✅ Supabase OAuth integration implemented
✅ Google OAuth configured in Supabase dashboard
⏳ Google OAuth testing required
⏳ Apple OAuth configuration deferred (cost consideration)
⏳ End-to-end testing for Google auth

## Next Steps
1. ✅ Complete Google OAuth setup
2. Test Google authentication flow
3. Deploy to production with Google auth
4. Configure Apple OAuth when ready for launch (£79/year)
5. Monitor and maintain

## Testing Instructions (Current Status)
Since Node.js has installation issues, you can test Google OAuth by:
1. Deploying to Vercel and testing in production
2. Using the deployed app URL to test Google sign-in
3. Checking browser console for OAuth flow errors
4. Verifying user creation in Supabase auth users table
