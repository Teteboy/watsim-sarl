import { describe, it, expect } from 'vitest';
import { calculateInstalmentPlan, isValidCount } from '../src/modules/bnpl/bnpl.calculator';

describe('BNPL calculator', () => {
  it('charges 0% interest for 1 instalment', () => {
    const p = calculateInstalmentPlan(100_000, 1);
    expect(p.rate).toBe(0);
    expect(p.total).toBe(100_000);
    expect(p.monthly).toBe(100_000);
    expect(p.schedule).toHaveLength(1);
  });

  it('charges 2% flat for 2 instalments', () => {
    const p = calculateInstalmentPlan(100_000, 2);
    expect(p.rate).toBe(0.02);
    expect(p.total).toBe(102_000);
    expect(p.monthly).toBe(51_000);
    expect(p.schedule).toHaveLength(2);
  });

  it('charges 4% flat for 3 instalments', () => {
    const p = calculateInstalmentPlan(150_000, 3);
    expect(p.rate).toBe(0.04);
    expect(p.total).toBe(156_000);
    expect(p.monthly).toBe(Math.ceil(156_000 / 3));
  });

  it('charges 8% flat for 6 instalments', () => {
    const p = calculateInstalmentPlan(300_000, 6);
    expect(p.rate).toBe(0.08);
    expect(p.total).toBe(324_000);
    expect(p.monthly).toBe(Math.ceil(324_000 / 6));
    expect(p.schedule).toHaveLength(6);
  });

  it('generates schedule 30 days apart from start date', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const p = calculateInstalmentPlan(100_000, 3, start);
    const day0 = p.schedule[0].dueDate.getTime();
    const day1 = p.schedule[1].dueDate.getTime();
    const diffDays = (day1 - day0) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(30);
  });

  it('validates counts 1-60 correctly', () => {
    expect(isValidCount(0)).toBe(false);
    expect(isValidCount(1)).toBe(true);
    expect(isValidCount(4)).toBe(true);
    expect(isValidCount(6)).toBe(true);
    expect(isValidCount(7)).toBe(true);
    expect(isValidCount(12)).toBe(true);
    expect(isValidCount(60)).toBe(true);
    expect(isValidCount(61)).toBe(false);
  });

  it('charges progressive rate for 12 instalments', () => {
    const p = calculateInstalmentPlan(100_000, 12);
    expect(p.rate).toBe(0.14);
    expect(p.total).toBe(114_000);
    expect(p.monthly).toBe(Math.ceil(114_000 / 12));
    expect(p.schedule).toHaveLength(12);
  });

  it('charges progressive rate for 24 instalments', () => {
    const p = calculateInstalmentPlan(200_000, 24);
    expect(p.rate).toBe(0.20);
    expect(p.total).toBe(240_000);
    expect(p.monthly).toBe(Math.ceil(240_000 / 24));
    expect(p.schedule).toHaveLength(24);
  });

  it('charges progressive rate for 60 instalments (5 years)', () => {
    const p = calculateInstalmentPlan(500_000, 60);
    expect(p.rate).toBeCloseTo(0.308, 3);
    expect(p.schedule).toHaveLength(60);
  });
});
