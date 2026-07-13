import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { NotificationQueryDTO } from './dto/notification-query.dto';
import {
  NotificationListResponseDTO,
  NotificationResponseDTO,
  UnreadCountResponseDTO,
} from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('api/notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificações do usuário logado' })
  @ApiResponse({
    status: 200,
    description: 'Lista de notificações',
    type: NotificationListResponseDTO,
  })
  async listNotifications(
    @CurrentUser() user: CurrentUserData,
    @Query() query: NotificationQueryDTO,
  ): Promise<NotificationListResponseDTO> {
    return this.notificationsService.findByUser(user.id, query.page, query.limit);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Contagem de notificações não lidas' })
  @ApiResponse({
    status: 200,
    description: 'Contagem retornada com sucesso',
    type: UnreadCountResponseDTO,
  })
  async getUnreadCount(
    @CurrentUser() user: CurrentUserData,
  ): Promise<UnreadCountResponseDTO> {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas as notificações como lidas' })
  @ApiResponse({ status: 200, description: 'Notificações marcadas como lidas' })
  async markAllAsRead(
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ updated: number }> {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar notificação como lida' })
  @ApiResponse({
    status: 200,
    description: 'Notificação marcada como lida',
    type: NotificationResponseDTO,
  })
  @ApiResponse({ status: 404, description: 'Notificação não encontrada' })
  async markAsRead(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<NotificationResponseDTO> {
    return this.notificationsService.markAsRead(id, user.id);
  }
}
