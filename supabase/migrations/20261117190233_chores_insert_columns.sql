-- Uue töö saab lisada ainult ilma ajaloota (#4 ülevaatus, PR #28 punkt 2).
--
-- Varem lubas insert kõiki veerge, nii et kodu liige sai API kaudu lisada töö
-- võltsitud ajalooga (last_member_id, last_done_at, prev_*) või last_done_by-ga,
-- mis on kellegi teise kasutaja id. Nüüd täidab ajaloo ainult mark_done/undo_done.
--
-- `id` on lubatud, et undoRemoveChore saaks töö sama id-ga tagasi panna.
-- Ajalugu ("viimati tegi") sellega tagasi ei tule. Kui seda on vaja, tuleb
-- teha eraldi RPC (#10).

revoke insert on public.chores from authenticated;
grant insert (id, household_id, name, current_member_id) on public.chores to authenticated;
