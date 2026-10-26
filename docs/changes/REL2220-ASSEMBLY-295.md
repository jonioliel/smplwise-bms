# REL2220-ASSEMBLY-295 - assembly record for release/2220

Base `origin/main` 223fff4ad (v2.20.0). Merges (all `--no-ff`, no conflicts): HOME-295 (aaee9b7e7), ANNOUNCEB-295 (283f39da1), TPLV2-295 (325abfa26).
The pilot branches sit on `release/2210` (2.21.0 candidate), so that stack arrives with them; no merge conflict occurred.
Migrations: 0178 (ANNOUNCEB) only; bus times are out of scope (2.23.0); TPLV2 and HOME have none.
Version bump 2.22.0 in Dockerfile, config.yaml, `__init__.py`. API inventory regenerated: 1584 routes.
Test results: see the lead's report; any test not listed there is NOT_RUN.
