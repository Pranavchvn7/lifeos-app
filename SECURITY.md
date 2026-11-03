# Security policy

## Reporting a vulnerability
Please do **not** open a public issue for a security problem. Use GitHub's **Report a vulnerability** button
(Security tab → Advisories) or contact the owner privately through the email on the GitHub profile.

## What this project does to stay safe
- Passwords are stored only as hashes; sessions live in HttpOnly, Secure cookies.
- Every data request is tied to the signed-in user's session; there is no user id in any request.
- Share links are random, read-only, and never include private notes.
- Secrets live only in the hosting provider's settings, never in this repository.
- Every change is tested in a staging preview by an automated browser test suite before it can be merged.

If a secret is ever committed by mistake, **replace it** (rotate it) immediately — deleting the commit is not enough.
