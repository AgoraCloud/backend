import { Request, Response, NextFunction } from 'express';
import { Inject, Injectable, Logger } from '@nestjs/common';
import * as HttpProxy from 'http-proxy';

@Injectable()
export class ProxyService {
  private readonly resourcePrefix: string = 'agoracloud';
  private readonly logger: Logger = new Logger(ProxyService.name);

  constructor(@Inject(HttpProxy) private readonly httpProxy: HttpProxy) {}

  /**
   * Proxy all deployment requests
   * @param deploymentId the deployment id
   * @param req the request
   * @param res the response
   * @param next the next function
   */
  proxy(
    deploymentId: string,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const options: HttpProxy.ServerOptions = {
      target: `http://${this.resourcePrefix}-${deploymentId}.${this.resourcePrefix}.svc.cluster.local`,
    };
    const connection: string = req.headers['connection'];
    const upgrade: string = req.headers['upgrade'];
    if (connection === 'Upgrade' && upgrade === 'websocket') {
      this.httpProxy.ws(req, req.socket, req.app.head, options);
    } else {
      this.httpProxy.web(req, res, options, next);
    }
  }
}
