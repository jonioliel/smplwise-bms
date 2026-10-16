-- CR-038 deep security review 2026-10-15, finding B3: a reply button's nonce is bound to the link GENERATION its message
-- carried, not only to the link row. PROVISIONAL NUMBER: the lead renumbers at integration (contiguous sequence rule).
--
-- `link_generation` is written when the row is queued (the link's generation at enqueue) and again when the worker claims the
-- row to send it (the URL is derived from the link at send time, so the claim records the generation the message really
-- carried). The inbound matcher acts on a button only while this equals the link's current generation; after "new link"
-- (generation + 1) the old message's buttons are ignored (reason `link_superseded`).
--
-- Rows written before this migration (documented safe rule): the row gets the link's CURRENT generation only when it was
-- sent (or last moved, for a row never sent) at or after that generation began (`generation_at`, falling back to the link's
-- `created_at`); compared to the second, so a row sent in the same second as the new generation counts as current. Every
-- other old row stays NULL and its buttons are ignored from now on - a text reply still matches by sender. Queued / held
-- rows are refreshed at their claim anyway.
ALTER TABLE ticket_outbox ADD COLUMN link_generation INTEGER CHECK (link_generation IS NULL OR link_generation >= 1);

UPDATE ticket_outbox SET link_generation = (
  SELECT l.generation FROM ticket_links l
  WHERE l.id = ticket_outbox.link_id
    AND substr(COALESCE(ticket_outbox.sent_at, ticket_outbox.updated_at), 1, 19) >= substr(COALESCE(l.generation_at, l.created_at), 1, 19)
) WHERE link_id IS NOT NULL;
