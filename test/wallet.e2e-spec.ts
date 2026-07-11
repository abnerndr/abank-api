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
});
