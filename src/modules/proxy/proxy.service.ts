import { HttpAdapterHost } from '@nestjs/core';
import { Request, Response } from 'express';
import {
  Inject,
  Injectable,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import * as HttpProxy from 'http-proxy';
import { Server } from 'http';
import { Socket } from 'net';

@Injectable()
export class ProxyService implements OnModuleInit {
  private readonly servicePrefix: string = 'agoracloud';

  constructor(
    @Inject(HttpProxy) private readonly httpProxy: HttpProxy,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit(): void {
    this.onProxyError();
    this.proxyWebsockets();
  }

  /**
   * Handle proxy errors
   */
  private onProxyError(): void {
    this.httpProxy.on(
      'error',
      (err: Error, req: Request, res: Response, target: any) => {
        const exception: InternalServerErrorException = new InternalServerErrorException(
          `Error proxying ${target.host}`,
        );
        res.status(exception.getStatus()).json(exception.getResponse());
      },
    );
  }

  /**
   * Proxy all deployment websockets
   */
  private proxyWebsockets(): void {
    const httpServer: Server = this.httpAdapterHost.httpAdapter.getHttpServer();
    httpServer.on('upgrade', (req: Request, socket: Socket, head: any) => {
      const deploymentId: string = req.url.split('/')[2];
      req.url = this.removeProxyUrlPrefix(req.url, deploymentId);
      this.httpProxy.ws(req, socket, head, this.makeProxyOptions(deploymentId));
    });
  }

  /**
   * Proxy all deployment requests
   * @param deploymentId the deployment id
   * @param req the request
   * @param res the response
   */
  proxy(deploymentId: string, req: Request, res: Response): void {
    req.url = this.removeProxyUrlPrefix(req.url, deploymentId);
    this.httpProxy.web(req, res, this.makeProxyOptions(deploymentId));
  }

  /**
   * Dynamically creates configuration options for the proxy
   * @param deploymentId the deployment id
   */
  private makeProxyOptions(deploymentId: string): HttpProxy.ServerOptions {
    return {
      target: `http://${this.servicePrefix}-${deploymentId}`,
      changeOrigin: true,
    };
  }

  /**
   * Removes the /proxy/:deploymentId prefix from request urls
   * @param requestUrl the request url
   * @param deploymentId the deployment id
   */
  private removeProxyUrlPrefix(
    requestUrl: string,
    deploymentId: string,
  ): string {
    return requestUrl.replace(`/proxy/${deploymentId}`, '');
  }
}
