-- MULTIBUILDING-HOME-2330: a building may be the site's shared building ("משותף": parking, main electrical room, garden). The home
-- screen lists it last with its own icon and colour, and "כבה הכל באתר" leaves it unchecked by default (installation setting
-- home.screen.site_off_shared). Presentation and a default only: no permission depends on it. Settable in the building edit dialog.
-- Number 0188 is provisional (the next free after 0187 on the 2.31.0 train): renumber at train integration if another branch took it.
ALTER TABLE buildings ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0;
