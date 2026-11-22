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

## 4. Scheduled reminders (daily "log your day" and the Sunday review)
The app cannot wake itself up, so a free GitHub schedule asks it every 10 minutes whether a reminder is due.
1. Make a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Vercel -> Environment Variables: `CRON_SECRET` = that value, **Production only**. Redeploy.
3. GitHub -> repository **Settings -> Secrets and variables -> Actions**: a **secret** `CRON_SECRET` with the same value, and (if you do not already have `E2E_PROD_URL`) a **variable** `LIFEOS_PROD_URL` = your production address, for example `https://your-app.vercel.app`.
4. Actions -> **send-reminders** -> **Run workflow** once. A green run that prints `{"ok":true,...}` means it works. (Green with "not set up yet" means a variable or secret is missing.)
5. In the app: Reminders -> turn on "Daily reminder to log my day", pick a time, and turn on phone notifications on your phone.

GitHub can start a run a few minutes late, so a reminder may arrive 10-15 minutes after the chosen time. GitHub also pauses schedules in a repository with no activity for 60 days; any commit or a manual run restarts it.

## Notes
- The private key never leaves the server. The public key is shown to the browser (that is normal).
- Each device registers an address that only the real browser push services can have; anything else is refused.
