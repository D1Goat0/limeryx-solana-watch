-- Private Netlify Database membership ledger. Existing bot signup is untouched.
-- All access goes through authenticated server functions; there is no browser DB API.
begin;

create table public.member_accounts (
  user_id uuid primary key,
  confirmed_at timestamptz,
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  created_at timestamptz not null default now()
);
create table public.member_referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.member_accounts(user_id) on delete restrict,
  invitee_id uuid not null unique references public.member_accounts(user_id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (inviter_id <> invitee_id)
);
create index member_referrals_inviter_idx on public.member_referrals(inviter_id);

create table public.member_referral_policy (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  inviter_lamports bigint not null default 0 check (inviter_lamports between 0 and 1000000000000),
  invitee_lamports bigint not null default 0 check (invitee_lamports between 0 and 1000000000000),
  minimum_claim_lamports bigint not null default 10000000 check (minimum_claim_lamports between 1 and 1000000000000),
  -- Operator accounting for SOL already funded and set aside for this program.
  unallocated_lamports bigint not null default 0 check (unallocated_lamports >= 0)
);
insert into public.member_referral_policy(id) values (true);

create table public.member_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.member_accounts(user_id) on delete restrict,
  payout_wallet text not null check (payout_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  amount_lamports bigint not null check (amount_lamports > 0),
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  tx_signature text unique,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((status = 'paid' and tx_signature is not null and tx_signature ~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$') or (status <> 'paid' and tx_signature is null))
);
create index member_claims_user_idx on public.member_claims(user_id);

create table public.member_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.member_accounts(user_id) on delete restrict,
  referral_id uuid not null references public.member_referrals(id) on delete restrict,
  amount_lamports bigint not null check (amount_lamports between 1 and 1000000000000),
  status text not null default 'pending' check (status in ('pending', 'available', 'claimed', 'paid', 'rejected')),
  claim_id uuid references public.member_claims(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(user_id, referral_id),
  check ((status in ('claimed', 'paid') and claim_id is not null) or (status not in ('claimed', 'paid') and claim_id is null))
);
create index member_rewards_user_idx on public.member_rewards(user_id);
create index member_rewards_claim_idx on public.member_rewards(claim_id);


-- Called only by the trusted Identity event handler / authenticated server API.
-- Initial attribution is immutable; repeated syncs cannot change an inviter.
create function public.member_sync_account(member_id uuid, referral_code text, verified boolean) returns void
language plpgsql security invoker set search_path = '' as $$
declare account public.member_accounts; inviter uuid; referral public.member_referrals; policy public.member_referral_policy; inserted boolean;
begin
  if member_id is null then raise exception 'Missing member'; end if;
  insert into public.member_accounts(user_id) values(member_id) on conflict do nothing;
  inserted := found;
  select * into account from public.member_accounts where user_id = member_id for update;
  if inserted and coalesce(referral_code, '') <> '' then
    select user_id into inviter from public.member_accounts where code = lower(referral_code);
    if inviter is null or inviter = member_id then raise exception 'Invalid referral code'; end if;
    insert into public.member_referrals(inviter_id, invitee_id) values(inviter, member_id);
  end if;
  if verified then
    update public.member_accounts set confirmed_at = coalesce(confirmed_at, now()) where user_id = member_id;
    update public.member_referrals set confirmed_at = now() where invitee_id = member_id and confirmed_at is null returning * into referral;
    if referral.id is null then return; end if;
    select * into policy from public.member_referral_policy where id = true;
    if policy.enabled then
      if policy.inviter_lamports > 0 then
        insert into public.member_rewards(user_id, referral_id, amount_lamports) values(referral.inviter_id, referral.id, policy.inviter_lamports) on conflict do nothing;
      end if;
      if policy.invitee_lamports > 0 then
        insert into public.member_rewards(user_id, referral_id, amount_lamports) values(referral.invitee_id, referral.id, policy.invitee_lamports) on conflict do nothing;
      end if;
    end if;
  end if;
end;
$$;

create function public.member_referral_valid(referral_code text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.member_accounts where code = lower(referral_code));
$$;
create function public.member_referral_program()
returns table(enabled boolean, inviter_lamports bigint, invitee_lamports bigint, minimum_claim_lamports bigint)
language sql stable security invoker set search_path = '' as $$
  select enabled, inviter_lamports, invitee_lamports, minimum_claim_lamports from public.member_referral_policy where id = true;
$$;

-- Aggregate in Postgres so balances remain correct beyond the REST row limit.
create function public.member_referral_summary(member_id uuid)
returns table(invited_count bigint, verified_count bigint, pending_lamports text, available_lamports text, claimed_lamports text, paid_lamports text)
language sql stable security invoker set search_path = '' as $$
  select
    (select count(*) from public.member_referrals where inviter_id = member_id),
    (select count(*) from public.member_referrals where inviter_id = member_id and confirmed_at is not null),
    coalesce(sum(amount_lamports) filter (where status = 'pending'), 0)::text,
    coalesce(sum(amount_lamports) filter (where status = 'available'), 0)::text,
    coalesce(sum(amount_lamports) filter (where status = 'claimed'), 0)::text,
    coalesce(sum(amount_lamports) filter (where status = 'paid'), 0)::text
  from public.member_rewards where user_id = member_id;
$$;

-- Approval reserves actual operator-funded budget. Browser clients cannot approve rewards.
create function public.member_approve_reward(reward_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare reward public.member_rewards;
begin
  select * into reward from public.member_rewards where id = reward_id;
  if reward.id is null then raise exception 'Reward is not pending'; end if;
  perform 1 from public.member_accounts where user_id = reward.user_id for update;
  select * into reward from public.member_rewards where id = reward_id for update;
  if reward.id is null or reward.status <> 'pending' then raise exception 'Reward is not pending'; end if;
  if not exists(select 1 from public.member_referrals where id = reward.referral_id and confirmed_at is not null) then raise exception 'Referral is not verified'; end if;
  if not exists(select 1 from public.member_accounts where user_id = reward.user_id and confirmed_at is not null) then raise exception 'Member email is not verified'; end if;
  update public.member_referral_policy set unallocated_lamports = unallocated_lamports - reward.amount_lamports
    where id = true and enabled and unallocated_lamports >= reward.amount_lamports;
  if not found then raise exception 'Reward approval requires an active program with sufficient funded budget'; end if;
  update public.member_rewards set status = 'available' where id = reward_id;
end;
$$;

create function public.member_request_claim(member_id uuid, payout_wallet text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare total bigint; claim uuid; minimum_amount bigint;
begin
  if member_id is null then raise exception 'Sign in before requesting a claim'; end if;
  if payout_wallet is null or payout_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'Enter a valid public Solana address'; end if;
  if not exists(select 1 from public.member_accounts where user_id = member_id and confirmed_at is not null) then raise exception 'Verify your email before requesting a claim'; end if;
  -- Serialize all requests for this member, including double-clicks and concurrent tabs.
  perform 1 from public.member_accounts where user_id = member_id for update;
  if not found then raise exception 'Member account is not ready'; end if;
  select minimum_claim_lamports into minimum_amount from public.member_referral_policy where id = true and enabled;
  if minimum_amount is null then raise exception 'Claims are not open yet'; end if;
  perform 1 from public.member_rewards where user_id = member_id and status = 'available' order by id for update;
  select coalesce(sum(amount_lamports), 0) into total from public.member_rewards where user_id = member_id and status = 'available';
  if total < minimum_amount then raise exception 'Claimable balance is below the minimum'; end if;
  if total > 9007199254740991 then raise exception 'Contact support to claim this balance'; end if;
  insert into public.member_claims(user_id, payout_wallet, amount_lamports) values(member_id, payout_wallet, total) returning id into claim;
  update public.member_rewards set status = 'claimed', claim_id = claim where user_id = member_id and status = 'available';
  return claim;
end;
$$;

-- Called only by a trusted payout operator after verifying a mainnet transfer.
create function public.member_resolve_claim(claim_id uuid, transaction_signature text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare claim public.member_claims;
begin
  select * into claim from public.member_claims where id = claim_id;
  if claim.id is null then raise exception 'Claim is not pending'; end if;
  perform 1 from public.member_accounts where user_id = claim.user_id for update;
  select * into claim from public.member_claims where id = claim_id for update;
  if claim.id is null or claim.status <> 'requested' then raise exception 'Claim is not pending'; end if;
  if transaction_signature is null then
    update public.member_claims set status = 'rejected', resolved_at = now() where id = claim.id;
    update public.member_rewards set status = 'available', claim_id = null where member_rewards.claim_id = claim.id and status = 'claimed';
  else
    if transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$' then raise exception 'Invalid transaction signature'; end if;
    update public.member_claims set status = 'paid', tx_signature = transaction_signature, resolved_at = now() where id = claim.id;
    update public.member_rewards set status = 'paid' where member_rewards.claim_id = claim.id and status = 'claimed';
  end if;
end;
$$;

commit;
