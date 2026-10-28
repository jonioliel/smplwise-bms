# R5 2.27.1 assembly

Branch: release/2271-assembly. Base: release/2270-r5-fixes @ 658e9eb1d.

## Merges (real --no-ff)
1. pilot/R5-SECURITY-WISKEY-297 (299af8209): clean, no conflicts. 16 files (security-alarm, system-alarm,
   system-presence, system-security-wiskey, wiskey-* screens, r5-security-shoot spec).
2. pilot/USERMENU-FIX-2271 (43ba53c59): clean, no conflicts. sw-user-menu.ts and unit-user-menu-sections.spec.ts.

## Shared-file decisions
No file was touched by more than one side, so no conflict and no manual resolution was needed. The two
branches share no files with each other; both merged onto the R5 base unchanged. R5 look and the frozen UI
structure (menus, tabs, logos, titles, order of controls) are therefore exactly as each approved branch
left them. No snapshots were updated.
