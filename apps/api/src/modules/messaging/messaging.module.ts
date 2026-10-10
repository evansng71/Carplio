import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

@Controller('messaging')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class MessagingController {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureParticipant(threadId: string, userId: string) {
    await this.prisma.messageThreadParticipant.upsert({
      where: { threadId_userId: { threadId, userId } },
      create: { threadId, userId, lastReadAt: new Date() },
      update: {},
    });
  }

  @Get('users')
  @RequirePermission('messaging', 'thread', 'list')
  async listUsers(
    @CurrentUser() user: RequestUser,
    @Query('q') q?: string,
  ) {
    const s = (q || '').trim().toLowerCase();
    return this.prisma.userAccount.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ['active', 'invited'] },
        ...(s
          ? {
              OR: [
                { email: { contains: s } },
                { displayName: { contains: s } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        employeeLink: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                matricule: true,
                driver: { select: { id: true } },
              },
            },
          },
        },
      },
      orderBy: { displayName: 'asc' },
      take: 100,
    });
  }

  @Get('threads')
  @RequirePermission('messaging', 'thread', 'list')
  async listThreads(
    @CurrentUser() user: RequestUser,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    const threads = await this.prisma.messageThread.findMany({
      where: {
        companyId: user.companyId,
        ...(type ? { threadType: type } : {}),
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { subject: { contains: q } },
                {
                  driverUser: {
                    OR: [
                      { displayName: { contains: q } },
                      { email: { contains: q } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        driverUser: {
          select: {
            id: true,
            displayName: true,
            email: true,
            employeeLink: {
              include: {
                employee: {
                  select: {
                    firstName: true,
                    lastName: true,
                    matricule: true,
                    driver: { select: { id: true } },
                  },
                },
              },
            },
          },
        },
        assignedTo: {
          select: { id: true, displayName: true, email: true },
        },
        participants: {
          include: {
            user: { select: { id: true, displayName: true, email: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            author: { select: { id: true, displayName: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });

    return threads.map((t) => {
      const last = t.messages[0] || null;
      const myPart = t.participants.find((p) => p.userId === user.userId);
      const unread =
        last &&
        last.authorId !== user.userId &&
        (!myPart?.lastReadAt || last.createdAt > myPart.lastReadAt);
      return {
        ...t,
        lastMessage: last,
        unread: !!unread || t.status === 'new',
        messages: undefined,
      };
    });
  }

  @Get('threads/:id')
  @RequirePermission('messaging', 'thread', 'list')
  async getThread(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const thread = await this.prisma.messageThread.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        driverUser: {
          select: {
            id: true,
            displayName: true,
            email: true,
            employeeLink: {
              include: {
                employee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    matricule: true,
                    driver: { select: { id: true } },
                  },
                },
              },
            },
          },
        },
        assignedTo: {
          select: { id: true, displayName: true, email: true },
        },
        participants: {
          include: {
            user: { select: { id: true, displayName: true, email: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
      },
    });
    if (!thread) throw new NotFoundException('Conversation introuvable');

    // Mark as read for current user
    await this.prisma.messageThreadParticipant.upsert({
      where: { threadId_userId: { threadId: id, userId: user.userId } },
      create: { threadId: id, userId: user.userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    await this.prisma.message.updateMany({
      where: {
        threadId: id,
        authorId: { not: user.userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    if (thread.status === 'new' && thread.threadType === 'driver') {
      await this.prisma.messageThread.update({
        where: { id },
        data: { status: 'open' },
      });
      thread.status = 'open';
    }

    return thread;
  }

  @Post('threads')
  @RequirePermission('messaging', 'thread', 'create')
  async createThread(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      subject: string;
      body: string;
      /** driver | internal */
      threadType?: string;
      /** Pour message vers un conducteur (compte utilisateur) */
      driverUserId?: string;
      /** Participants internes (hors soi) */
      participantUserIds?: string[];
      missionId?: string;
      assignedToUserId?: string;
    },
  ) {
    if (!body.subject?.trim() || !body.body?.trim()) {
      throw new BadRequestException('Objet et message requis');
    }
    const threadType = body.threadType || (body.driverUserId ? 'driver' : 'internal');

    if (threadType === 'driver') {
      if (!body.driverUserId) {
        throw new BadRequestException('Conducteur requis');
      }
      const driverUser = await this.prisma.userAccount.findFirst({
        where: { id: body.driverUserId, companyId: user.companyId },
        include: { employeeLink: true },
      });
      if (!driverUser) throw new BadRequestException('Conducteur introuvable');

      const thread = await this.prisma.messageThread.create({
        data: {
          companyId: user.companyId,
          subject: body.subject.trim(),
          threadType: 'driver',
          status: 'open',
          driverUserId: body.driverUserId,
          missionId: body.missionId,
          assignedToUserId: body.assignedToUserId || user.userId,
          lastMessageAt: new Date(),
          messages: {
            create: { authorId: user.userId, body: body.body.trim() },
          },
          participants: {
            create: [
              { userId: user.userId, lastReadAt: new Date() },
              { userId: body.driverUserId, lastReadAt: null },
            ],
          },
        },
        include: {
          messages: true,
          driverUser: { select: { id: true, displayName: true, email: true } },
        },
      });
      return thread;
    }

    // Internal thread
    const ids = new Set<string>([user.userId, ...(body.participantUserIds || [])]);
    if (ids.size < 2) {
      throw new BadRequestException('Ajoutez au moins un destinataire');
    }
    for (const uid of ids) {
      const u = await this.prisma.userAccount.findFirst({
        where: { id: uid, companyId: user.companyId },
      });
      if (!u) throw new BadRequestException(`Utilisateur ${uid} invalide`);
    }

    return this.prisma.messageThread.create({
      data: {
        companyId: user.companyId,
        subject: body.subject.trim(),
        threadType: 'internal',
        status: 'open',
        assignedToUserId: body.assignedToUserId || user.userId,
        lastMessageAt: new Date(),
        messages: {
          create: { authorId: user.userId, body: body.body.trim() },
        },
        participants: {
          create: [...ids].map((uid) => ({
            userId: uid,
            lastReadAt: uid === user.userId ? new Date() : null,
          })),
        },
      },
      include: {
        messages: true,
        participants: {
          include: {
            user: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    });
  }

  @Post('threads/:id/messages')
  @RequirePermission('messaging', 'thread', 'create')
  async reply(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { body: string },
  ) {
    if (!body.body?.trim()) throw new BadRequestException('Message vide');
    const thread = await this.prisma.messageThread.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!thread) throw new NotFoundException('Conversation introuvable');

    const msg = await this.prisma.message.create({
      data: {
        threadId: id,
        authorId: user.userId,
        body: body.body.trim(),
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
    });

    await this.prisma.messageThread.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        status: thread.threadType === 'driver' ? 'open' : 'open',
        updatedAt: new Date(),
      },
    });
    await this.ensureParticipant(id, user.userId);
    await this.prisma.messageThreadParticipant.update({
      where: { threadId_userId: { threadId: id, userId: user.userId } },
      data: { lastReadAt: new Date() },
    });

    return msg;
  }

  @Patch('threads/:id')
  @RequirePermission('messaging', 'thread', 'create')
  async patchThread(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      assignedToUserId?: string | null;
      subject?: string;
    },
  ) {
    const thread = await this.prisma.messageThread.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!thread) throw new NotFoundException('Conversation introuvable');
    return this.prisma.messageThread.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.assignedToUserId !== undefined
          ? { assignedToUserId: body.assignedToUserId }
          : {}),
        ...(body.subject ? { subject: body.subject } : {}),
      },
    });
  }

  @Post('threads/:id/read')
  @RequirePermission('messaging', 'thread', 'list')
  async markRead(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const thread = await this.prisma.messageThread.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!thread) throw new NotFoundException('Conversation introuvable');
    await this.prisma.messageThreadParticipant.upsert({
      where: { threadId_userId: { threadId: id, userId: user.userId } },
      create: { threadId: id, userId: user.userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    return { ok: true };
  }
}

@Module({ imports: [AuthModule], controllers: [MessagingController] })
export class MessagingModule {}
