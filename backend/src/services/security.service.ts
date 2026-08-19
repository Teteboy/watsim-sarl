import { prisma } from '../config/db';

export interface SecuritySettings {
  fingerprintEnabled: boolean;
  faceIdEnabled: boolean;
  irisEnabled: boolean;
  twoFAEnabled: boolean;
  loginAlertsEnabled: boolean;
  transactionAlertsEnabled: boolean;
  accountFrozen: boolean;
  frozenAt: Date | null;
  frozenReason: string | null;
}

export async function getSecuritySettings(userId: string): Promise<SecuritySettings> {
  const settings = await prisma.userSecuritySettings.upsert({
    where: { userId },
    create: {
      userId,
      fingerprintEnabled: false,
      faceIdEnabled: false,
      irisEnabled: false,
      twoFAEnabled: false,
      loginAlertsEnabled: true,
      transactionAlertsEnabled: true,
      accountFrozen: false,
    },
    update: {},
  });

  return {
    fingerprintEnabled: settings.fingerprintEnabled,
    faceIdEnabled: settings.faceIdEnabled,
    irisEnabled: settings.irisEnabled,
    twoFAEnabled: settings.twoFAEnabled,
    loginAlertsEnabled: settings.loginAlertsEnabled,
    transactionAlertsEnabled: settings.transactionAlertsEnabled,
    accountFrozen: settings.accountFrozen,
    frozenAt: settings.frozenAt,
    frozenReason: settings.frozenReason,
  };
}

export async function updateSecuritySettings(
  userId: string,
  settings: Partial<Omit<SecuritySettings, 'frozenAt' | 'frozenReason'>>
): Promise<SecuritySettings> {
  const updated = await prisma.userSecuritySettings.upsert({
    where: { userId },
    create: {
      userId,
      fingerprintEnabled: settings.fingerprintEnabled ?? false,
      faceIdEnabled: settings.faceIdEnabled ?? false,
      irisEnabled: settings.irisEnabled ?? false,
      twoFAEnabled: settings.twoFAEnabled ?? false,
      loginAlertsEnabled: settings.loginAlertsEnabled ?? true,
      transactionAlertsEnabled: settings.transactionAlertsEnabled ?? true,
      accountFrozen: settings.accountFrozen ?? false,
    },
    update: {
      ...(settings.fingerprintEnabled !== undefined && { fingerprintEnabled: settings.fingerprintEnabled }),
      ...(settings.faceIdEnabled !== undefined && { faceIdEnabled: settings.faceIdEnabled }),
      ...(settings.irisEnabled !== undefined && { irisEnabled: settings.irisEnabled }),
      ...(settings.twoFAEnabled !== undefined && { twoFAEnabled: settings.twoFAEnabled }),
      ...(settings.loginAlertsEnabled !== undefined && { loginAlertsEnabled: settings.loginAlertsEnabled }),
      ...(settings.transactionAlertsEnabled !== undefined && { transactionAlertsEnabled: settings.transactionAlertsEnabled }),
      ...(settings.accountFrozen !== undefined && { accountFrozen: settings.accountFrozen }),
    },
  });

  // Log security setting changes
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'SECURITY_SETTINGS_UPDATED',
      metadata: settings as never,
    },
  });

  return {
    fingerprintEnabled: updated.fingerprintEnabled,
    faceIdEnabled: updated.faceIdEnabled,
    irisEnabled: updated.irisEnabled,
    twoFAEnabled: updated.twoFAEnabled,
    loginAlertsEnabled: updated.loginAlertsEnabled,
    transactionAlertsEnabled: updated.transactionAlertsEnabled,
    accountFrozen: updated.accountFrozen,
    frozenAt: updated.frozenAt,
    frozenReason: updated.frozenReason,
  };
}

export async function freezeAccount(userId: string, reason?: string): Promise<boolean> {
  await prisma.userSecuritySettings.upsert({
    where: { userId },
    create: {
      userId,
      accountFrozen: true,
      frozenAt: new Date(),
      frozenReason: reason || 'User requested',
    },
    update: {
      accountFrozen: true,
      frozenAt: new Date(),
      frozenReason: reason || 'User requested',
    },
  });

  // Log account freeze
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'ACCOUNT_FROZEN',
      metadata: { reason: reason || 'User requested' } as never,
    },
  });

  return true;
}

export async function unfreezeAccount(userId: string): Promise<boolean> {
  await prisma.userSecuritySettings.update({
    where: { userId },
    data: {
      accountFrozen: false,
      frozenAt: null,
      frozenReason: null,
    },
  });

  // Log account unfreeze
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'ACCOUNT_UNFROZEN',
    },
  });

  return true;
}

export async function isAccountFrozen(userId: string): Promise<boolean> {
  const settings = await prisma.userSecuritySettings.findUnique({
    where: { userId },
    select: { accountFrozen: true },
  });
  return settings?.accountFrozen ?? false;
}
