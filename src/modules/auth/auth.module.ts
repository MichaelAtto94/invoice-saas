import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../../database/prisma.service';
import { AccessTokenStrategy } from './strategies/access-token.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, AccessTokenStrategy],
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}
