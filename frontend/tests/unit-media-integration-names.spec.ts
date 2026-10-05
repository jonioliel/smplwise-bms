import { test, expect } from '@playwright/test';
import { INTEGRATION_NAMES, hasIntegrationName, integrationName, integrationTitle } from '../src/screens/media-integration-names';

// 0.1.164 (board MS3): the one table of friendly integration names for the multimedia settings lists. Pure, no browser page.

test.describe('integration names', () => {
  test('the common media integrations get a recognisable name', () => {
    expect(integrationName('sonos')).toBe('Sonos');
    expect(integrationName('spotify')).toBe('Spotify');
    expect(integrationName('music_assistant')).toBe('Music Assistant');
    expect(integrationName('cast')).toBe('Google Cast (Chromecast)');
    expect(integrationName('apple_tv')).toBe('Apple TV');
    expect(integrationName('samsungtv')).toContain('Samsung');
    expect(integrationName('webostv')).toContain('LG');
    expect(integrationName('dlna_dmr')).toContain('DLNA');
    expect(integrationName('roku')).toBe('Roku');
    expect(integrationName('kodi')).toBe('Kodi');
    expect(integrationName('plex')).toBe('Plex');
    expect(integrationName('squeezebox')).toContain('Squeezebox');
  });

  test('an id that is not in the table is shown exactly as it is', () => {
    expect(integrationName('some_new_platform')).toBe('some_new_platform');
    expect(integrationName('Weird-Id.2')).toBe('Weird-Id.2');
    expect(hasIntegrationName('some_new_platform')).toBe(false);
  });

  test('the lookup ignores case and blanks; empty and missing values never throw', () => {
    expect(integrationName('  SONOS ')).toBe('Sonos');
    expect(integrationName('Cast')).toBe('Google Cast (Chromecast)');
    expect(integrationName('')).toBe('');
    expect(integrationName('   ')).toBe('');
    expect(integrationName(undefined)).toBe('');
    expect(integrationName(null)).toBe('');
  });

  test('object prototype names are not mistaken for integrations', () => {
    for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(integrationName(id)).toBe(id);
      expect(hasIntegrationName(id)).toBe(false);
    }
  });

  test('the title carries the raw id behind a friendly name, and is the id alone otherwise', () => {
    expect(integrationTitle('sonos')).toBe('Sonos (sonos)');
    expect(integrationTitle('cast')).toBe('Google Cast (Chromecast) (cast)');
    expect(integrationTitle('some_new_platform')).toBe('some_new_platform');
  });

  test('the table is clean: lower-case keys, no blank names, no Home Assistant branding, and the brand-only entries are not Philips Hue', () => {
    for (const [id, name] of Object.entries(INTEGRATION_NAMES)) {
      expect(id).toBe(id.trim().toLowerCase());
      expect(name.trim().length).toBeGreaterThan(1);
      expect(name).not.toMatch(/home assistant|\bHA\b|ingress/i);
    }
    expect(INTEGRATION_NAMES).not.toHaveProperty('hue');
  });
});
