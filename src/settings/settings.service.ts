import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /*
  |--------------------------------------------------------------------------
  | GET MY SETTINGS
  |--------------------------------------------------------------------------
  */

  async getMySettings(userId: string) {
    return this.prisma.userSettings.upsert({
      where: {
        userId,
      },

      update: {},

      create: {
        userId,
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE MY SETTINGS
  |--------------------------------------------------------------------------
  */

  async updateMySettings(userId: string, dto: UpdateSettingsDto) {
    return this.prisma.userSettings.upsert({
      where: {
        userId,
      },

      update: {
        ...dto,
      },

      create: {
        userId,
        ...dto,
      },
    });
  }
}
