import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OfficesModule } from './offices/offices.module';
import { DocumentsModule } from './documents/documents.module';
import { RoutingModule } from './routing/routing.module';
import { RolesModule } from './roles/roles.module';
import { OrganizationUnitsModule } from './organization-units/organization-units.module';
import { DocumentTypesModule } from './document-types/document-types.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    OfficesModule,
    DocumentsModule,
    RoutingModule,
    RolesModule,
    OrganizationUnitsModule,
    DocumentTypesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
