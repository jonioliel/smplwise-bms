import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ApiError } from '../src/api/client';
import type { ScheduleExecutionJob } from '../src/api/schedule-execution';
import { reviewsUnread } from '../src/access-control/schedule-execution-logic';
import { pollFailure } from '../src/components/incoming-call-logic';
import { enIncomingCallText, heIncomingCallText } from '../src/i18n/incoming-calls';
import { sed } from '../src/i18n/schedule-editor';
import { en as enSched } from '../src/i18n/lang/en/i18n/schedule-editor';

// FIX-WISKEY-2570: the 2.56 deep review of the WisKey area - WA-02 (the schedule execution row says when WisKey's approvals could not be
// read) and SCR-51 (the call banner after a failed read that is not a 403). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-fix-wiskey-2570.spec.ts
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const apiErr = (status: number, code = 'x') => new ApiError(status, { code, user_message: 'נדחה', retryable: false, correlation_id: '', details: {} });

test.describe('WA-02 schedule execution: approvals that could not be read', () => {
  test('a job whose approvals were not read in the last check is marked, and only then', () => {
    const base = { job_id: 'job-1', phase: 'review_pending', reviews_read: false } as unknown as ScheduleExecutionJob;
    expect(reviewsUnread({ ...base, reviews_unread: true })).toBe(true);
    expect(reviewsUnread({ ...base, reviews_unread: false })).toBe(false);
    expect(reviewsUnread(null)).toBe(false);
    expect(reviewsUnread({ ...base } as ScheduleExecutionJob)).toBe(false); // an older answer without the key
  });

  test('the row says it in Hebrew and English', () => {
    expect(sed('sx_reviewsUnread')).toMatch(/[֐-׿]/);
    expect(enSched.sx_reviewsUnread).toMatch(/could not be read/);
    expect(src('components/wk-schedule-exec.ts')).toMatch(/if \(reviewsUnread\(read\)\) parts\.push\(sed\('sx_reviewsUnread'\)\);/);
  });
});

test.describe('SCR-51 the call banner after a read that failed for another reason', () => {
  test('only a 403 ends the calls; anything else is "the last state read"', () => {
    expect(pollFailure(apiErr(403, 'forbidden'))).toBe('forbidden');
    expect(pollFailure(apiErr(502, 'http_502'))).toBe('unread');
    expect(pollFailure(apiErr(409, 'conflict'))).toBe('unread');
    expect(pollFailure(new TypeError('Failed to fetch'))).toBe('unread');
  });

  test('the banner keeps the last list and its talk, says so, and clears the line on the next good read', () => {
    const s = src('components/sw-incoming-call.ts');
    const refresh = s.slice(s.indexOf('protected async refresh()'), s.indexOf('protected ended(callId: string)'));
    expect(refresh).toMatch(/this\.active = await getActiveCalls\(\);\s*\n\s*this\.fetchedAt = Date\.now\(\);\s*\n\s*this\.unread = false;/);
    expect(refresh).toMatch(/const failure = pollFailure\(err\);\s*\n\s*this\.unread = failure === 'unread';/);
    // nothing is sent again and no talk session is closed outside the 403 branch
    const unreadPart = refresh.slice(refresh.indexOf('const failure'), refresh.indexOf("if (failure === 'forbidden')"));
    expect(unreadPart).not.toMatch(/ended\(|signal|release|startTalk|stopTalk/);
    expect(s).toMatch(/\$\{this\.unread \? html`<p class="line" data-tone="warn" role="status" data-call-unread>\$\{t\.unread\}<\/p>` : nothing\}/);
    expect(heIncomingCallText.banner.unread).toMatch(/[֐-׿]/);
    expect(enIncomingCallText.banner.unread).toMatch(/last state read/);
  });
});
