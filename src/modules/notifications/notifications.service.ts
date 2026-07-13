import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Notification, TransferNotificationMetadata } from '../../shared/entities/notification.entity';
import { NotificationType } from '../../shared/enums/notification.enum';
import {
  NotificationListResponseDTO,
  NotificationResponseDTO,
  UnreadCountResponseDTO,
} from './dto/notification-response.dto';

const RETENTION_DAYS = 45;

export interface CreateTransferNotificationPayload {
  fromUserEmail: string;
  amount: string;
  transactionId: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async createTransferNotification(
    recipientUserId: string,
    payload: CreateTransferNotificationPayload,
  ): Promise<NotificationResponseDTO | null> {
    const existing = await this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId: recipientUserId })
      .andWhere("notification.metadata->>'transactionId' = :transactionId", {
        transactionId: payload.transactionId,
      })
      .getOne();

    if (existing) {
      return this.toResponse(existing);
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS);

    const formattedAmount = this.formatAmount(payload.amount);
    const notification = this.notificationRepository.create({
      userId: recipientUserId,
      type: NotificationType.TRANSFER_RECEIVED,
      title: 'Transferência recebida',
      message: `Você recebeu ${formattedAmount} de ${payload.fromUserEmail}`,
      metadata: {
        fromUserEmail: payload.fromUserEmail,
        amount: payload.amount,
        transactionId: payload.transactionId,
      },
      readAt: null,
      expiresAt,
    });

    const saved = await this.notificationRepository.save(notification);
    return this.toResponse(saved);
  }

  async findByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<NotificationListResponseDTO> {
    const now = new Date();
    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: {
        userId,
        expiresAt: MoreThan(now),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      notifications: notifications.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
    };
  }

  async getUnreadCount(userId: string): Promise<UnreadCountResponseDTO> {
    const now = new Date();
    const count = await this.notificationRepository.count({
      where: {
        userId,
        readAt: IsNull(),
        expiresAt: MoreThan(now),
      },
    });

    return { count };
  }

  async markAsRead(id: string, userId: string): Promise<NotificationResponseDTO> {
    const notification = await this.findActiveByIdAndUser(id, userId);
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepository.save(notification);
    }
    return this.toResponse(notification);
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const now = new Date();
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: now })
      .where('user_id = :userId', { userId })
      .andWhere('read_at IS NULL')
      .andWhere('expires_at > :now', { now })
      .execute();

    return { updated: result.affected ?? 0 };
  }

  private async findActiveByIdAndUser(id: string, userId: string): Promise<Notification> {
    const now = new Date();
    const notification = await this.notificationRepository.findOne({
      where: {
        id,
        userId,
        expiresAt: MoreThan(now),
      },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada');
    }

    return notification;
  }

  private formatAmount(amount: string): string {
    const value = Number.parseFloat(amount);
    if (Number.isNaN(value)) {
      return amount;
    }
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private toResponse(notification: Notification): NotificationResponseDTO {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata as TransferNotificationMetadata,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      expiresAt: notification.expiresAt,
    };
  }
}
