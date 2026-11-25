const { toBengaliDigits } = require('../../public/js/ui/numbers');

describe('Bengali digit localization', () => {
  test('converts every ASCII digit and preserves punctuation', () => {
    expect(toBengaliDigits('00:42')).toBe('০০:৪২');
    expect(toBengaliDigits('A4 440.0Hz -12.5%')).toBe('A৪ ৪৪০.০Hz -১২.৫%');
    expect(toBengaliDigits('২০২৬-11-25')).toBe('২০২৬-১১-২৫');
  });

  test('leaves non-numeric text unchanged', () => {
    expect(toBengaliDigits('সুর সাধনা Pro')).toBe('সুর সাধনা Pro');
    expect(toBengaliDigits(null)).toBe('');
    expect(toBengaliDigits(undefined)).toBe('');
  });
});
