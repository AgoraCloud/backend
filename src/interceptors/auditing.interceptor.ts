import { AuditLog } from '../modules/auditing/schemas/audit-log.schema';
import { AuditingService } from './../modules/auditing/auditing.service';
import { PERMISSIONS_KEY } from './../decorators/permissions.decorator';
import { Reflector } from '@nestjs/core';
import { Action } from './../modules/authorization/schemas/permission.schema';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { RequestWithWorkspaceUserAndIsAdmin } from '../utils/requests.interface';
import { tap } from 'rxjs/operators';

@Injectable()
export class AuditingInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditingService: AuditingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const permissions: Action[] =
      this.reflector.getAllAndMerge<Action[]>(PERMISSIONS_KEY, [
        context.getClass(),
        context.getHandler(),
      ]) || [];
    const request: RequestWithWorkspaceUserAndIsAdmin = context
      .switchToHttp()
      .getRequest();
    const response: Response = context.switchToHttp().getResponse();
    return next.handle().pipe(
      tap(() => {
        const auditLog: AuditLog = new AuditLog({
          isSuccessful:
            response.statusCode >= 200 && response.statusCode <= 299,
          actions: permissions,
          userAgent: request.get('user-agent') || '',
          ip: request.ip,
          user: request.user,
          workspace: request.workspace,
        });
        this.auditingService.create(auditLog);
      }),
    );
  }
}