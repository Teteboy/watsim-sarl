import type { Prisma } from '@prisma/client';

export function phoneVariants(input: string): string[] {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, '');
  const variants = new Set<string>([raw]);

  if (!digits) {
    return Array.from(variants);
  }

  variants.add(digits);

  // Local Cameroon mobile numbers are 9 digits starting with 6/7
  if (digits.length === 9 && /^[67]/.test(digits)) {
    variants.add(`+237${digits}`);
    variants.add(`237${digits}`);
  }

  // 12-digit international without plus
  if (digits.length === 12 && digits.startsWith('237')) {
    variants.add(`+${digits}`);
    variants.add(digits.slice(3));
  }

  // 13-digit international with plus
  if (digits.length === 13 && digits.startsWith('+237')) {
    variants.add(digits.slice(1));
    variants.add(digits.slice(4));
  }

  return Array.from(variants);
}

export function recipientWhere(identifier: string): Prisma.UserWhereInput {
  const raw = identifier.trim();
  const phones = phoneVariants(raw);

  const or: Prisma.UserWhereInput[] = [
    { id: raw },
    { email: { equals: raw.toLowerCase(), mode: 'insensitive' as any } },
  ];

  if (phones.length > 0) {
    or.push({ phone: { in: phones } });
  }

  return { OR: or };
}
