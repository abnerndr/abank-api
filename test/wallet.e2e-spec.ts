import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Wallet } from '../src/shared/entities/wallet.entity';
import { createAuthenticatedUser } from './utils/create-authenticated-user';

describe('Wallet (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/wallet/me', () => {
    it('creates a wallet with zero balance on first access', async () => {
      const { accessToken } = await createAuthenticatedUser(app);

      const response = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.balance).toBe('0.0000');
      expect(response.body.currency).toBe('BRL');
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/api/wallet/me').expect(401);
    });
  });

  describe('POST /api/wallet/deposit', () => {
    it('credits the wallet and returns the transaction', async () => {
      const { accessToken } = await createAuthenticatedUser(app);

      const response = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: '150.00' })
        .expect(201);

      expect(response.body.type).toBe('DEPOSIT');
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.amount).toBe('150.0000');

      const wallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(wallet.body.balance).toBe('150.0000');
    });

    it('adds on top of a negative balance without clamping to zero', async () => {
      const { accessToken, userId } = await createAuthenticatedUser(app);
      // Wallets are created lazily (see WalletService.getOrCreateWallet), so touch the wallet
      // once via the API first — otherwise the update below would target a non-existent row.
      await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const walletRepository = app.get(getRepositoryToken(Wallet));
      await walletRepository.update({ userId }, { balance: new Decimal('-40') as never });

      const response = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: '25.00' })
        .expect(201);

      expect(response.body.amount).toBe('25.0000');

      const wallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(wallet.body.balance).toBe('-15.0000');
    });

    it('replays the same transaction when called twice with the same idempotency key', async () => {
      const { accessToken } = await createAuthenticatedUser(app);
      const idempotencyKey = 'deposit-retry-key';

      const first = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: '10.00', idempotencyKey })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: '10.00', idempotencyKey })
        .expect(201);

      expect(second.body.id).toBe(first.body.id);

      const wallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(wallet.body.balance).toBe('10.0000');
    });

    it('replays correctly when two deposits with the same idempotency key race each other', async () => {
      const { accessToken } = await createAuthenticatedUser(app);
      const idempotencyKey = 'deposit-race-key';

      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/wallet/deposit')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ amount: '10.00', idempotencyKey }),
        request(app.getHttpServer())
          .post('/api/wallet/deposit')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ amount: '10.00', idempotencyKey }),
      ]);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);

      const wallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(wallet.body.balance).toBe('10.0000');
    });

    it('rejects a non-positive amount', async () => {
      const { accessToken } = await createAuthenticatedUser(app);

      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: '0.00' })
        .expect(400);
    });
  });

  describe('POST /api/wallet/transfer', () => {
    it('moves balance from sender to recipient', async () => {
      const sender = await createAuthenticatedUser(app);
      const recipient = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ amount: '100.00' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ toEmail: recipient.email, amount: '40.00' })
        .expect(201);

      expect(response.body.type).toBe('TRANSFER');
      expect(response.body.amount).toBe('40.0000');

      const senderWallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .expect(200);
      expect(senderWallet.body.balance).toBe('60.0000');

      const recipientWallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${recipient.accessToken}`)
        .expect(200);
      expect(recipientWallet.body.balance).toBe('40.0000');
    });

    it('rejects a transfer larger than the sender balance', async () => {
      const sender = await createAuthenticatedUser(app);
      const recipient = await createAuthenticatedUser(app);

      await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ toEmail: recipient.email, amount: '1.00' })
        .expect(400);
    });

    it('rejects transferring to yourself', async () => {
      const sender = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ amount: '10.00' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ toEmail: sender.email, amount: '1.00' })
        .expect(400);
    });

    it('rejects an unknown recipient', async () => {
      const sender = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ amount: '10.00' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ toEmail: 'nobody@example.com', amount: '1.00' })
        .expect(404);
    });

    it('keeps the sender balance correct under two concurrent transfers for the same amount', async () => {
      const sender = await createAuthenticatedUser(app);
      const recipientA = await createAuthenticatedUser(app);
      const recipientB = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ amount: '100.00' })
        .expect(201);

      const results = await Promise.all([
        request(app.getHttpServer())
          .post('/api/wallet/transfer')
          .set('Authorization', `Bearer ${sender.accessToken}`)
          .send({ toEmail: recipientA.email, amount: '80.00' }),
        request(app.getHttpServer())
          .post('/api/wallet/transfer')
          .set('Authorization', `Bearer ${sender.accessToken}`)
          .send({ toEmail: recipientB.email, amount: '80.00' }),
      ]);

      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 400]);

      const senderWallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .expect(200);
      expect(senderWallet.body.balance).toBe('20.0000');
    });

    it('does not deadlock when two transfers run concurrently in opposite directions between the same pair of wallets', async () => {
      const userA = await createAuthenticatedUser(app);
      const userB = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ amount: '100.00' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ amount: '100.00' })
        .expect(201);

      const [aToB, bToA] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/wallet/transfer')
          .set('Authorization', `Bearer ${userA.accessToken}`)
          .send({ toEmail: userB.email, amount: '30.00' }),
        request(app.getHttpServer())
          .post('/api/wallet/transfer')
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .send({ toEmail: userA.email, amount: '20.00' }),
      ]);

      expect(aToB.status).toBe(201);
      expect(bToA.status).toBe(201);

      const walletA = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(200);
      expect(walletA.body.balance).toBe('90.0000');

      const walletB = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);
      expect(walletB.body.balance).toBe('110.0000');
    });

    it('replays correctly when two transfers with the same idempotency key race each other', async () => {
      const sender = await createAuthenticatedUser(app);
      const recipient = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ amount: '100.00' })
        .expect(201);
      const idempotencyKey = 'transfer-race-key';

      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/wallet/transfer')
          .set('Authorization', `Bearer ${sender.accessToken}`)
          .send({ toEmail: recipient.email, amount: '30.00', idempotencyKey }),
        request(app.getHttpServer())
          .post('/api/wallet/transfer')
          .set('Authorization', `Bearer ${sender.accessToken}`)
          .send({ toEmail: recipient.email, amount: '30.00', idempotencyKey }),
      ]);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);

      const senderWallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .expect(200);
      expect(senderWallet.body.balance).toBe('70.0000');
    });
  });

  describe('POST /api/wallet/transactions/:id/reverse', () => {
    it('rejects a non-admin user with 403', async () => {
      const user = await createAuthenticatedUser(app);
      const deposit = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ amount: '10.00' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/wallet/transactions/${deposit.body.id}/reverse`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);
    });

    it('reverses a deposit, debiting the wallet back', async () => {
      const admin = await createAuthenticatedUser(app, { roles: ['admin'] });
      const user = await createAuthenticatedUser(app);
      const deposit = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ amount: '30.00' })
        .expect(201);

      const reversal = await request(app.getHttpServer())
        .post(`/api/wallet/transactions/${deposit.body.id}/reverse`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      expect(reversal.body.type).toBe('REVERSAL');
      expect(reversal.body.reversalOfId).toBe(deposit.body.id);

      const wallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(wallet.body.balance).toBe('0.0000');
    });

    it('reverses a transfer even if the recipient already spent the money, going negative', async () => {
      const admin = await createAuthenticatedUser(app, { roles: ['admin'] });
      const a = await createAuthenticatedUser(app);
      const b = await createAuthenticatedUser(app);
      const c = await createAuthenticatedUser(app);

      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ amount: '100.00' })
        .expect(201);

      const transfer = await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ toEmail: b.email, amount: '100.00' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .send({ toEmail: c.email, amount: '100.00' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/wallet/transactions/${transfer.body.id}/reverse`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      const bWallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .expect(200);
      expect(bWallet.body.balance).toBe('-100.0000');

      const aWallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .expect(200);
      expect(aWallet.body.balance).toBe('100.0000');

      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .send({ amount: '30.00' })
        .expect(201);

      const bWalletAfterDeposit = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .expect(200);
      expect(bWalletAfterDeposit.body.balance).toBe('-70.0000');
    });

    it('rejects reversing the same transaction twice', async () => {
      const admin = await createAuthenticatedUser(app, { roles: ['admin'] });
      const user = await createAuthenticatedUser(app);
      const deposit = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ amount: '10.00' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/wallet/transactions/${deposit.body.id}/reverse`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/wallet/transactions/${deposit.body.id}/reverse`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(409);
    });

    it('returns one success and one conflict when two reversal requests race on the same transaction', async () => {
      const admin = await createAuthenticatedUser(app, { roles: ['admin'] });
      const user = await createAuthenticatedUser(app);
      const deposit = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ amount: '10.00' })
        .expect(201);

      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/wallet/transactions/${deposit.body.id}/reverse`)
          .set('Authorization', `Bearer ${admin.accessToken}`),
        request(app.getHttpServer())
          .post(`/api/wallet/transactions/${deposit.body.id}/reverse`)
          .set('Authorization', `Bearer ${admin.accessToken}`),
      ]);

      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([200, 409]);

      const wallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(wallet.body.balance).toBe('0.0000');
    });
  });

  describe('GET /api/wallet/transactions', () => {
    it('lists only transactions the caller participated in, newest first', async () => {
      const a = await createAuthenticatedUser(app);
      const b = await createAuthenticatedUser(app);

      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ amount: '50.00' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ toEmail: b.email, amount: '20.00' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/wallet/transactions')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .expect(200);

      expect(response.body.total).toBe(2);
      expect(response.body.transactions[0].type).toBe('TRANSFER');
      expect(response.body.transactions[1].type).toBe('DEPOSIT');

      const recipientResponse = await request(app.getHttpServer())
        .get('/api/wallet/transactions')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .expect(200);
      expect(recipientResponse.body.total).toBe(1);
    });
  });

  describe('GET /api/wallet/transactions/:id', () => {
    it('lets a participant see the transaction', async () => {
      const a = await createAuthenticatedUser(app);
      const b = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ amount: '50.00' })
        .expect(201);
      const transfer = await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ toEmail: b.email, amount: '20.00' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/wallet/transactions/${transfer.body.id}`)
        .set('Authorization', `Bearer ${b.accessToken}`)
        .expect(200);
    });

    it('forbids a non-participant, non-admin user', async () => {
      const a = await createAuthenticatedUser(app);
      const outsider = await createAuthenticatedUser(app);
      const deposit = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ amount: '50.00' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/wallet/transactions/${deposit.body.id}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .expect(403);
    });

    it('lets an admin see any transaction', async () => {
      const admin = await createAuthenticatedUser(app, { roles: ['admin'] });
      const a = await createAuthenticatedUser(app);
      const deposit = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ amount: '50.00' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/wallet/transactions/${deposit.body.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
    });

    it('returns 404 for an unknown transaction id', async () => {
      const a = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .get('/api/wallet/transactions/00000000-0000-7000-8000-000000000000')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .expect(404);
    });
  });
});
