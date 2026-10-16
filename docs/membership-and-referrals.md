# Membership and referral rollout

The original `/signup` bot setup, every label and validator, `wallet-store.ts`,
`admin.functions.ts`, and `/admin` are unchanged. Accounts live separately at
`/account`; referral links use `/account?ref=<code>`. The original Supabase
scaffold is untouched and is not used by the new membership features.

## Services

- GitHub holds the application code and migrations.
- Netlify Identity handles passwords, sessions, email confirmation and recovery.
- Netlify Database holds the private member, referral and SOL reward ledger.
- The original bot setup continues using its existing Netlify Blobs store.

User data and credentials are not committed into this public repository.

## Deploy and enable accounts

1. Use Node 22.12 or newer. `.nvmrc` selects the latest Node 22 release.
   The existing Netlify build and Nitro settings are unchanged.
2. On Netlify, open the **limryx** project and enable **Identity**. Enable public
   email/password registration and leave email confirmation enabled. Configure
   Site URL as `https://limryx.netlify.app`. Use production and deploy-preview
   redirect URLs deliberately when testing confirmation and recovery emails.
3. `@netlify/database` and the migration in
   `netlify/database/migrations/20261016023000_membership.sql` let Netlify provision
   the database and apply its schema during deployment. This requires a supported
   Netlify Credit-based plan. The database consumes normal Netlify usage credits;
   check your plan and budget before enabling it.
4. Netlify discovers `netlify/functions/membership.ts` and `identity.mts`.
   The Identity function subscribes to `identity_validate` and `identity_signup`.
   The membership function accepts only code validation, an authenticated
   dashboard read, and an authenticated claim request.
5. Verify signup, email confirmation, sign-in, password recovery, referral
   attribution, and the unchanged bot signup on a deploy preview first.

There are no new Supabase settings or separate database credentials to copy.
Do not expose `NETLIFY_DB_URL`, Identity operator tokens or payout secrets through
`VITE_*` variables. The browser talks to authenticated Functions, never directly
to the database. Authenticated responses disable browser and CDN caching.

Local testing uses `netlify dev` with the project linked to Netlify. Plain
`npm run dev` serves the visual frontend but does not emulate Identity and
database functions. The code handles unavailable services without affecting the
existing bot signup.

## Referral attribution

Identity signup events persist the initial inviter and stamp a server-owned
`limeryx_referral_code` in app metadata. Client changes to user metadata cannot
rewrite an existing referral. Authenticated server operations re-read the
canonical Identity account; a request cannot choose another member's ID.

Confirmed referrals generate pending rewards once, using the policy active at
the first confirmed sync. Existing Identity users receive a code when they first
open referrals. Their mutable metadata is not used to invent a past inviter.
Identity events are idempotent, so retries do not duplicate rewards.

## Reward rules and funding

The program starts **disabled**, with zero reward amounts and zero funded budget.
No amounts were supplied. Referrals are tracked while disabled and are not
retroactively credited when the program opens. Set the rules before launch.

Use the Netlify Database SQL console, or `netlify database connect`, for trusted
operator actions. All values below are placeholders, in integer lamports
(1 SOL = 1,000,000,000 lamports):

```sql
update public.member_referral_policy
set inviter_lamports = <inviter_reward_lamports>,
    invitee_lamports = <new_member_reward_lamports>,
    minimum_claim_lamports = <minimum_claim_lamports>,
    unallocated_lamports = <actual_funded_unallocated_lamports>,
    enabled = true
where id = true;
```

Either beneficiary amount can be zero. Review referrals for duplicate and abusive
signups before approving them: email verification alone does not prove unique
identity. Configure Netlify Identity's signup protections for a public launch.

Fund a dedicated Solana mainnet payout wallet before recording a funded budget.
The budget is operator accounting, not an on-chain balance check. Avoid spending
reserved SOL elsewhere. Add only new funding to the unallocated amount rather
than resetting it to the wallet's full balance, which can already cover rewards.

Approve a reviewed reward:

```sql
select public.member_approve_reward('<reward_uuid>');
```

Approval checks verification and sufficient unallocated funding, reserves that
budget, and makes the reward claimable. No browser endpoint can approve rewards,
change amounts, or mark transfers paid.

## Claim processing

1. A verified member confirms a public Solana payout address and requests a claim.
   The server derives their identity from the authenticated session. PostgreSQL
   checks the minimum and atomically reserves their available balance. Repeated
   requests cannot claim the same rewards twice.
2. The operator reviews the request and transfers exactly the recorded amount to
   its recorded address. This release does not store signing secrets or send SOL.
3. Verify a successful finalized Solana mainnet transaction, including destination,
   amount and signature. Then record payment:

```sql
select public.member_resolve_claim('<claim_uuid>', '<verified_mainnet_signature>');
```

The UI shows the paid amount and a Solscan transaction link. Signature format and
uniqueness are checked by the database; on-chain verification is the operator's
responsibility. A signature cannot be reused for another claim.

Reject an **unpaid** request to restore its reserved rewards:

```sql
select public.member_resolve_claim('<claim_uuid>', null);
```

Never reject after sending SOL. Reconcile in-flight transfers before retrying a
payout and use a single payout operator until a coordinated worker is added.
Disabling the policy stops new approvals and claims while retaining existing ones.

## Checks

```sh
npm ci
npm test
npx tsc --noEmit
npm run build
netlify functions:build --src netlify/functions --functions .netlify/membership-bundles
```

The tests run the actual Netlify SQL migration in isolated PGlite PostgreSQL and
exercise the server request handler with injected service boundaries. They cover
immutable attribution, one-time reward qualification, funded approvals, exact
lamport aggregates, duplicate claims, claim rejection and payment, disabled
programs, authentication, origin checks, identity/amount tampering, and cache
privacy. They never create production accounts or transactions. PGlite uses one
connection; verify true multi-connection locking on a staging database as well.
