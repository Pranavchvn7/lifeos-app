# Phone push notifications: one-time setup

Push notifications need a pair of VAPID keys (they identify your server to the browsers' push services).
Until the three variables below are set, LifeOS shows "Push notifications aren't set up on this server yet" and nothing else changes.

## 1. Generate the keys (on your own computer, never paste the private key anywhere public)
```bash
npx web-push generate-vapid-keys
```
It prints a **Public Key** and a **Private Key**. Generate a separate pair for Production and for Staging (Preview).

## 2. Add them in Vercel -> your project -> Settings -> Environment Variables
| Name | Value | Environments |
|---|---|---|
| `VAPID_PUBLIC_KEY` | the Public Key | Production (and, with the staging pair, Preview) |
| `VAPID_PRIVATE_KEY` | the Private Key (mark as Sensitive) | same as above |
| `VAPID_SUBJECT` | `mailto:you@example.com` (an email you own) | same as above |

Then **redeploy** (Deployments -> the latest -> Redeploy), because variables are read when the server starts.

## 3. Turn it on (each phone or browser)
Account & settings -> Reminders -> **Turn on phone notifications** -> allow -> **Send a test push**.
- Android Chrome: works in the browser or the installed app.
- iPhone (iOS 16.4+): first Share -> **Add to Home Screen**, open LifeOS from the new icon, then do the steps above.
- If you replace the keys later, every device must turn notifications off and on again.

## Notes
- The private key never leaves the server. The public key is shown to the browser (that is normal).
- Each device registers an address that only the real browser push services can have; anything else is refused.
