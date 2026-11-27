
-- CQA integration: only operator may activate answering; browser may disable.
revoke update (enabled) on public.receptionist_settings from authenticated;
-- Explicitly restrict service grants to CallHand tables (isolated database only).
create unique index callhand_one_membership_per_user on public.business_members(user_id);
