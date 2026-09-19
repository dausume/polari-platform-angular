/**
 * Unit tests for SecurityAdvisoryService — the dedupe/count contract, the
 * cap, the STOMP half and the summary line the notice bar renders.
 */
import { TestBed } from '@angular/core/testing';
import {
  MAX_ADVISORY_ENTRIES, SecurityAdvisoryService, pathOf
} from './security-advisory.service';

/** The two methods of HttpHeaders this service actually uses. */
function headers(map: { [key: string]: string }) {
  return { get: (name: string) => (name in map ? map[name] : null) };
}

describe('SecurityAdvisoryService', () => {
  let service: SecurityAdvisoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SecurityAdvisoryService] });
    service = TestBed.inject(SecurityAdvisoryService);
  });

  it('starts empty and says nothing', () => {
    expect(service.entries.length).toBe(0);
    expect(service.summary().entries).toBe(0);
  });

  it('reads all four headers off one response', () => {
    service.recordResponse(headers({
      'X-Polari-Permission-Advisory': 'would-deny MealEntry:read',
      'X-Polari-Owner-Advisory': 'would-project MealEntry:abc123',
      'X-Polari-Traffic-Advisory': 'would-refuse outbound example-peer',
      'X-Polari-Auth': 'invalid-or-expired',
    }), 'https://host.example/api/MealEntry?x=1');

    expect(service.entries.length).toBe(4);
    const kinds = service.entries.map(e => e.kind).sort();
    expect(kinds).toEqual(['auth', 'owner', 'permission', 'traffic']);
    expect(service.entries.every(e => e.path === '/api/MealEntry')).toBeTrue();
  });

  it('splits the value into outcome and subject', () => {
    service.recordResponse(
      headers({ 'X-Polari-Permission-Advisory': 'would-deny MealEntry:read' }), '/MealEntry');
    const entry = service.entries[0];
    expect(entry.outcome).toBe('would-deny');
    expect(entry.subject).toBe('MealEntry:read');
  });

  it('dedupes by header x value and COUNTS, rather than repeating', () => {
    for (let i = 0; i < 40; i++) {
      service.recordResponse(
        headers({ 'X-Polari-Permission-Advisory': 'would-deny MealEntry:read' }), '/MealEntry');
    }
    expect(service.entries.length).toBe(1);
    expect(service.entries[0].count).toBe(40);
    expect(service.summary().occurrences).toBe(40);
  });

  it('keeps different values apart', () => {
    service.recordResponse(
      headers({ 'X-Polari-Permission-Advisory': 'would-deny A:read' }), '/A');
    service.recordResponse(
      headers({ 'X-Polari-Permission-Advisory': 'would-deny B:read' }), '/B');
    expect(service.entries.length).toBe(2);
  });

  it('is capped, dropping the least recently seen', () => {
    for (let i = 0; i < MAX_ADVISORY_ENTRIES + 25; i++) {
      service.record('permission', 'X-Polari-Permission-Advisory',
                     `would-deny Class${i}:read`, '/x');
    }
    expect(service.entries.length).toBe(MAX_ADVISORY_ENTRIES);
    // The first ones recorded are the ones gone.
    expect(service.entries.some(e => e.subject === 'Class0:read')).toBeFalse();
    expect(service.entries.some(e => e.subject.startsWith('Class224'))).toBeTrue();
  });

  it('records a STOMP gate notice, marking a refusal', () => {
    service.recordStompNotice('would-deny MealEntry:read', '/topic/MealEntry', false);
    service.recordStompNotice('would-deny Other:read', '/topic/Other', true);
    expect(service.entries.length).toBe(2);
    expect(service.entries.some(e => e.header === 'STOMP SUBSCRIBE (refused)')).toBeTrue();
    expect(service.entries.every(e => e.kind === 'subscribe')).toBeTrue();
  });

  it('summarises by outcome, and would-project alone is only informational', () => {
    service.record('owner', 'X-Polari-Owner-Advisory', 'would-project A:1', '/A');
    service.record('owner', 'X-Polari-Owner-Advisory', 'would-project A:2', '/A');
    let summary = service.summary();
    expect(summary.byOutcome['would-project']).toBe(2);
    expect(summary.level).toBe('info');

    service.record('permission', 'X-Polari-Permission-Advisory', 'would-deny A:read', '/A');
    summary = service.summary();
    expect(summary.byOutcome['would-deny']).toBe(1);
    expect(summary.level).toBe('warning');
  });

  it('ignores blanks and survives a headers object that throws', () => {
    service.recordResponse(headers({ 'X-Polari-Auth': '' }), '/x');
    service.recordResponse({ get: () => { throw new Error('detached'); } }, '/x');
    expect(service.entries.length).toBe(0);
  });

  it('clear() empties the list', () => {
    service.record('auth', 'X-Polari-Auth', 'invalid-or-expired', '/x');
    service.clear();
    expect(service.entries.length).toBe(0);
  });

  it('pathOf() strips origin, query and fragment', () => {
    expect(pathOf('https://host.example/api/x?y=1#z')).toBe('/api/x');
    expect(pathOf('/api/x?y=1')).toBe('/api/x');
    expect(pathOf('https://host.example')).toBe('/');
  });
});
