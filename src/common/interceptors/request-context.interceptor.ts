import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  requestContext,
  RequestContextStore,
} from '../context/request-context';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Only HTTP for now
    const req = context.switchToHttp().getRequest();

    const user = req?.user; // set by Jwt strategy for protected routes
    const store: RequestContextStore = {
      userId: user?.sub,
      tenantId: user?.tenantId,
      tenantSlug: user?.tenantSlug,
      role: user?.role,
    };

    return requestContext.run(store, () => next.handle());
  }
}
