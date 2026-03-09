import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtUser = {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
