import { groupButtonWidth, inlineGroupCount } from './header-nav-fit';

describe('header nav fit', () => {
  const labels = ['The light demo', 'Pin profiles', 'Missions', 'Approach', 'Firmware scores', 'Task plan', 'Build firmware', 'The board'];

  it('a wider label is a wider button', () => {
    expect(groupButtonWidth('Task plan')).toBeLessThan(groupButtonWidth('Profile overlays'));
  });

  it('a narrow bar (labels hidden) puts every group under More', () => {
    expect(inlineGroupCount(labels, 900, 500)).toBe(0);
  });

  it('a wide bar shows them all and no More', () => {
    expect(inlineGroupCount(labels, 2600, 1000)).toBe(labels.length);
  });

  it('a mid-width bar shows some, and what is shown plus the More button fits the room', () => {
    const n = inlineGroupCount(labels, 1400, 1000);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(labels.length);
    const used = labels.slice(0, n).reduce((s, l) => s + groupButtonWidth(l), 0);
    expect(used + 96).toBeLessThanOrEqual(400);
  });

  it('no groups, nothing to fit', () => {
    expect(inlineGroupCount([], 1400, 1000)).toBe(0);
  });
});
