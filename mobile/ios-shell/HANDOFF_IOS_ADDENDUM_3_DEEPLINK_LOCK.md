# iOS handoff - addendum 3: deep links and the app lock (XSECFIX-297, 2026-10-27)

Source: security review of the phone apps, 2026-10-27, finding M4. The Android shell implements this rule on branch
`pilot/XSECFIX-297` (`ServersActivity.openLink` / `openPending`, `WebActivity.onCreate`, `DeepLinks.asksForAction`). The iOS
shell is not in the repository; build the same rule before the deep-link code is written. It adds to `HANDOFF_IOS_CODEX.md`
and does not replace anything there.

## The rule

1. **No site loads behind the lock.** When `arx://open?url=...` (or a Universal Link, if one is ever added) arrives while the
   app lock is due - a cold start with the lock on, or a return after the lock time - the link is queued. The phone's own
   authentication (Face ID / Touch ID / passcode) runs first; only after it succeeds is the link handled. Cancelling the
   authentication drops nothing and opens nothing: the cover stays.
2. **The first page load of the site screen waits for the unlock too.** Do not call `WKWebView.load` for the start address
   while the lock is due (the page's JavaScript would run, sign in again from its stored session and act on its address
   behind the cover). Load it right after the unlock.
3. **A link that asks for an action is confirmed.** A link whose address carries a `do` parameter - in its query or in the
   query of its `#` route, the key compared after percent-decoding and case-insensitively (`?do=run`, `?DO=run`,
   `?%64o=run`, `?do=delete`) - is never opened by itself, also when the lock is off. Show "לפתוח את הקישור?" with the full
   address and the line "הקישור הגיע מאפליקציה או מאתר אחר ומבקש לבצע פעולה במערכת. פתחו אותו רק אם אתם יודעים מאיפה הגיע.",
   buttons "פתח" / "ביטול". A link without such a parameter opens directly (after the unlock, per rule 1).
4. **Unchanged:** only the entry page of a stored server opens (never an API path or a file); a link to an unknown server is
   only offered with its full address; while a site is open the app asks before replacing it (it may be an intercom call).

## Why

The site itself now opens only its run confirmation for `?do=run` (it never runs an automation or a script from an
address), so the remaining exposure was the app: a web page or a message could open the app at a stored server's
address while the phone was locked by the app lock, and the page would load and act behind the cover.

## Tests to write (XCTest)

- `asksForAction`: the seven asking and five plain addresses of the Android `DeepLinksTest.linksAskingForAnActionAreDetected`.
- Lock due + `arx://open` to a stored server: no `WKWebView` load until the authentication succeeds; cancel = nothing loads.
- Lock off + `?do=run` link: the confirmation shows; "ביטול" opens nothing; "פתח" opens the address.
