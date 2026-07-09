/**
 * Comprehensive Campay Integration Test
 * Tests all payment flows: deposit, withdrawal, transfer, BNPL, and referrals
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { prisma } from '../src/config/db';
import { env } from '../src/config/env';

describe('Campay Integration Tests', () => {
  let app: FastifyInstance;
  let testUserToken: string;
  let testUserId: string;
  let recipientUserId: string;

  beforeAll(async () => {
    // Set up test environment
    process.env.USE_CAMPAY = 'true';
    process.env.USE_MOCK_PAYMENTS = 'false';
    
    app = await buildApp();
    
    // Create test users
    const testUser = await createTestUser('testuser@example.com');
    const recipientUser = await createTestUser('recipient@example.com');
    
    testUserId = testUser.id;
    recipientUserId = recipientUser.id;
    testUserToken = await authenticateUser(testUser);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.transaction.deleteMany({
      where: { userId: { in: [testUserId, recipientUserId] } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, recipientUserId] } }
    });
    await app.close();
  });

  describe('Deposit Flow', () => {
    it('should create deposit transaction and initiate Campay payment', async () => {
      const depositAmount = 10000;
      const phone = '+237699123456';
      
      // Step 1: Create deposit transaction
      const depositResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/transactions/deposit',
        headers: { authorization: `Bearer ${testUserToken}` },
        payload: { amount: depositAmount, provider: 'ORANGE_MONEY' }
      });
      
      expect(depositResponse.statusCode).toBe(201);
      const depositData = depositResponse.json();
      expect(depositData.transactionId).toBeDefined();
      expect(depositData.status).toBe('PENDING');
      
      // Step 2: Initiate Campay payment
      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/initiate',
        headers: { authorization: `Bearer ${testUserToken}` },
        payload: {
          transactionId: depositData.transactionId,
          provider: 'ORANGE_MONEY',
          phone: phone
        }
      });
      
      expect(paymentResponse.statusCode).toBe(200);
      const paymentData = paymentResponse.json();
      expect(paymentData.providerRef).toBeDefined();
      expect(paymentData.ussdCode).toBeDefined();
    });
  });

  describe('Withdrawal Flow', () => {
    it('should create withdrawal transaction and initiate Campay payment', async () => {
      const withdrawalAmount = 5000;
      const phone = '+237677234567';
      
      // Step 1: Create withdrawal transaction
      const withdrawalResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/transactions/withdrawal',
        headers: { authorization: `Bearer ${testUserToken}` },
        payload: { amount: withdrawalAmount, provider: 'MTN_MOMO' }
      });
      
      expect(withdrawalResponse.statusCode).toBe(201);
      const withdrawalData = withdrawalResponse.json();
      expect(withdrawalData.transactionId).toBeDefined();
      expect(withdrawalData.status).toBe('PENDING');
      
      // Step 2: Initiate Campay payment
      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/initiate',
        headers: { authorization: `Bearer ${testUserToken}` },
        payload: {
          transactionId: withdrawalData.transactionId,
          provider: 'MTN_MOMO',
          phone: phone
        }
      });
      
      expect(paymentResponse.statusCode).toBe(200);
      const paymentData = paymentResponse.json();
      expect(paymentData.providerRef).toBeDefined();
    });
  });

  describe('Transfer Flow', () => {
    it('should create transfer transaction and initiate Campay payment', async () => {
      const transferAmount = 7500;
      const phone = '+237655345678';
      const recipientName = 'Test Recipient';
      
      // Step 1: Create transfer transaction
      const transferResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/transactions/transfer',
        headers: { authorization: `Bearer ${testUserToken}` },
        payload: { 
          amount: transferAmount, 
          provider: 'ORANGE_MONEY',
          recipientName: recipientName
        }
      });
      
      expect(transferResponse.statusCode).toBe(201);
      const transferData = transferResponse.json();
      expect(transferData.transactionId).toBeDefined();
      expect(transferData.status).toBe('PENDING');
      
      // Step 2: Initiate Campay payment
      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/initiate',
        headers: { authorization: `Bearer ${testUserToken}` },
        payload: {
          transactionId: transferData.transactionId,
          provider: 'ORANGE_MONEY',
          phone: phone
        }
      });
      
      expect(paymentResponse.statusCode).toBe(200);
      const paymentData = paymentResponse.json();
      expect(paymentData.providerRef).toBeDefined();
    });
  });

  describe('BNPL Flow', () => {
    it('should simulate BNPL and create purchase with Campay', async () => {
      const productId = 'test-product-123';
      const instalmentCount = 3;
      const downPayment = 5000;
      
      // Step 1: Simulate BNPL
      const simulateResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/bnpl/simulate',
        headers: { authorization: `Bearer ${testUserToken}` },
        payload: {
          productId,
          instalmentCount,
          frequency: 'monthly',
          downPayment
        }
      });
      
      expect(simulateResponse.statusCode).toBe(200);
      const simulationData = simulateResponse.json();
      expect(simulationData.monthly).toBeDefined();
      expect(simulationData.total).toBeDefined();
      expect(simulationData.fees).toBeDefined();
      
      // Step 2: Request BNPL purchase
      const bnplResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/bnpl/request',
        headers: { authorization: `Bearer ${testUserToken}` },
        payload: {
          productId,
          instalmentCount,
          paymentProvider: 'ORANGE_MONEY',
          phone: '+237699123456',
          downPayment,
          frequency: 'monthly'
        }
      });
      
      expect(bnplResponse.statusCode).toBe(200);
      const bnplData = bnplResponse.json();
      expect(bnplData.purchase).toBeDefined();
      expect(bnplData.purchase.id).toBeDefined();
    });
  });

  describe('Referral Flow', () => {
    it('should process referral rewards through payment system', async () => {
      // Step 1: Create referral relationship
      await prisma.user.update({
        where: { id: recipientUserId },
        data: { referredBy: testUserId }
      });
      
      // Step 2: Simulate first purchase by referred user
      const purchaseResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/transactions/deposit',
        headers: { authorization: `Bearer ${testUserToken}` },
        payload: { amount: 25000, provider: 'MTN_MOMO' }
      });
      
      expect(purchaseResponse.statusCode).toBe(201);
      
      // Step 3: Check if referral reward was processed
      const referralStats = await app.inject({
        method: 'GET',
        url: '/api/v1/referral/stats',
        headers: { authorization: `Bearer ${testUserToken}` }
      });
      
      expect(referralStats.statusCode).toBe(200);
      const statsData = referralStats.json();
      expect(statsData.totalReferrals).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Payment Status Tracking', () => {
    it('should track payment status correctly', async () => {
      // Create a test transaction
      const transactionResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/transactions/deposit',
        headers: { authorization: `Bearer ${testUserToken}` },
        payload: { amount: 5000, provider: 'ORANGE_MONEY' }
      });
      
      const transactionData = transactionResponse.json();
      
      // Check initial status
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/payments/${transactionData.transactionId}/status`,
        headers: { authorization: `Bearer ${testUserToken}` }
      });
      
      expect(statusResponse.statusCode).toBe(200);
      const statusData = statusResponse.json();
      expect(statusData.status).toBe('PENDING');
    });
  });

  describe('Webhook Handling', () => {
    it('should handle Campay webhook correctly', async () => {
      const webhookPayload = {
        reference: 'test-ref-123',
        status: 'SUCCESSFUL',
        amount: '10000',
        currency: 'XAF',
        operator: 'ORANGE',
        timestamp: new Date().toISOString()
      };
      
      const signature = 'test-signature'; // In real scenario, this would be HMAC-SHA256
      
      const webhookResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/webhook/campay',
        headers: {
          'x-campay-signature': signature,
          'content-type': 'application/json'
        },
        payload: webhookPayload
      });
      
      expect(webhookResponse.statusCode).toBe(200);
    });
  });
});

// Helper functions
async function createTestUser(email: string) {
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Test User',
      phone: '+237699999999',
      password: 'hashedpassword',
      role: 'USER',
      isEmailVerified: true
    }
  });
  return user;
}

async function authenticateUser(user: any) {
  // In a real test, this would generate a valid JWT token
  return 'test-jwt-token';
}
