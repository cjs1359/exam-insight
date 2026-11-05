import { describe, it, expect } from 'vitest';
import { parseCSV, parseInput, analyze, suggestions, toCSV, reviewPayload, encodePayload, decodePayload, parseRate } from '../src/analysis.js';
import { demoData } from '../src/demo.js';
const csv = `題號,題目,正確答案,詳解,學習內容,題型,選項,答對率,座號1,座號2
1,"水, 台羅?",B,"tsuí",聲調,選擇,"A. tsui|B. tsuí",,1,0
2,歹勢,O,不好意思,語詞,是非,,,0,0`;
describe('parse', () => {
  it('handles quotes and commas', () => { expect(parseCSV('a,"b,""c"""\n1,2')).toEqual([['a', 'b,"c"'], ['1', '2']]); });
  it('parses app CSV', () => { const d = parseInput(csv); expect(d.questions).toHaveLength(2); expect(d.questions[0].q).toBe('水, 台羅?'); expect(d.questions[0].options).toEqual(['A. tsui', 'B. tsuí']); expect(d.results['1']).toEqual({ 1: 1, 2: 0 }); });
  it('strips code fences', () => { expect(parseInput('```csv\n' + csv + '\n```').questions).toHaveLength(2); });
  it('parses JSON', () => { const d = parseInput(JSON.stringify({ questions: [{ id: 1, q: 'x', answer: 'A' }], results: { 3: { 1: 0 } } })); expect(d.results['3']['1']).toBe(0); });
  it('rate only', () => { const d = parseInput('題號,答對率\n1,40%\n2,0.9'); const a = analyze(d); expect(a.questions[0].err).toBeCloseTo(0.6); expect(a.questions[1].level).toBe('low'); });
  it('parseRate', () => { expect(parseRate('65%')).toBeCloseTo(0.65); expect(parseRate('x')).toBe(null); });
  it('errors on empty', () => { expect(() => parseInput('')).toThrow(); });
});
describe('analyze', () => {
  it('error rates, units, seats', () => { const a = analyze(parseInput(csv)); expect(a.questions[0].err).toBe(0.5); expect(a.questions[1].err).toBe(1); expect(a.units[0].unit).toBe('語詞'); expect(a.perSeat.find(p => p.seat === '2').score).toBe(0); expect(a.perSeat[0].wrong).toEqual(['2']); });
  it('thresholds adjustable', () => { const d = parseInput(csv); expect(analyze(d, { high: 0.6, mid: 0.4 }).questions[0].level).toBe('mid'); });
  it('suggestions template', () => { const s = suggestions(analyze(parseInput(csv))); expect(s[0].grasp).toContain('掌握全班弱點'); expect(s[0].adjust).toContain('調整教學重點'); expect(s[0].plan).toContain('規劃補強練習'); });
  it('demo is deterministic', () => { expect(analyze(demoData()).avg).toBe(analyze(demoData()).avg); expect(analyze(demoData()).seatCount).toBe(28); });
});
describe('roundtrip', () => {
  it('CSV', () => { const d = demoData(); const d2 = parseInput(toCSV(d)); expect(d2.questions.length).toBe(10); expect(d2.results).toEqual(Object.fromEntries(Object.entries(d.results).map(([k, v]) => [k, Object.fromEntries(Object.entries(v))]))); });
  it('payload has no results and survives unicode', () => { const p = reviewPayload(demoData()); expect(JSON.stringify(p)).not.toContain('results'); expect(decodePayload(encodePayload(p))).toEqual(p); });
});
