import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
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
});
