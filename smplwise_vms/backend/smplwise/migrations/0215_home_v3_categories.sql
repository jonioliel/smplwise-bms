-- HOME-V3-FOLLOWUP-A-2431 (owner answers 2026-11-11, round 27 follow-up): the home interface's new categories reach the people whose
-- home administrator already set an explicit category list ("מה מופיע בממשק הביתי").
--
-- home_interface_policy.modules_json: NULL = every category (nothing to do: a new category is on for them already); a JSON array =
--   the administrator's explicit list, which would otherwise hide every category added after it was saved. Owner answer 3: "add them
--   to everyone". This migration appends, once, to every stored list that lacks them:
--   * phase 3 (HOME-V3-P3-2432, the six hub categories): media, announce, bills, water, systems, map
--   * phase 2 (HOME-V3-P2-2431, the family and building categories): presence, calendar, notices, tickets, schedules
--   * this follow-up (owner answer 1, ON by default): recordings, log (the house log)
--   * intercom (owner answer 1): only where the list already holds "doors" - until now the intercom was shown under the doors
--     category ("דלתות ואינטרקום"), so a person whose administrator hid the doors keeps the intercom hidden too (no newly shown screen).
-- Every category is still shown only where its own module is on and the person holds its own permission (checked by its own route):
-- the list restricts, it never grants. A list that is not a valid JSON array is left untouched (services/home_interface reads it as
-- "every category"). The previous version refuses no stored value it does not know (it only validates on write), so rollback = leave
-- the rows; an administrator who saves a person's policy on the previous version simply drops the names that version does not know.
UPDATE home_interface_policy SET modules_json = (
    SELECT json_group_array(value) FROM (
        SELECT j.value AS value, 0 AS grp, CAST(j.key AS INTEGER) AS ord FROM json_each(home_interface_policy.modules_json) AS j
        UNION ALL
        SELECT n.name, 1, n.ord FROM (
            SELECT 'presence' AS name, 1 AS ord UNION ALL SELECT 'calendar', 2 UNION ALL SELECT 'notices', 3 UNION ALL SELECT 'tickets', 4
            UNION ALL SELECT 'schedules', 5 UNION ALL SELECT 'media', 6 UNION ALL SELECT 'announce', 7 UNION ALL SELECT 'bills', 8
            UNION ALL SELECT 'water', 9 UNION ALL SELECT 'systems', 10 UNION ALL SELECT 'map', 11 UNION ALL SELECT 'recordings', 12
            UNION ALL SELECT 'log', 13 UNION ALL SELECT 'intercom', 14
        ) AS n
        WHERE NOT EXISTS (SELECT 1 FROM json_each(home_interface_policy.modules_json) AS x WHERE x.value = n.name)
          AND (n.name != 'intercom' OR EXISTS (SELECT 1 FROM json_each(home_interface_policy.modules_json) AS d WHERE d.value = 'doors'))
        ORDER BY grp, ord
    )
)
WHERE modules_json IS NOT NULL AND json_valid(modules_json) AND json_type(modules_json) = 'array';
