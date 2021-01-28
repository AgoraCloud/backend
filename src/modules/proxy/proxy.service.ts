import { HttpAdapterHost } from '@nestjs/core';
import { Request, Response } from 'express';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import * as HttpProxy from 'http-proxy';
import { Server } from 'http';
import { Socket } from 'net';
import * as url from 'url';

@Injectable()
export class ProxyService implements OnModuleInit {
  private readonly servicePrefix: string = 'agoracloud';

  constructor(
    @Inject(HttpProxy) private readonly httpProxy: HttpProxy,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit() {
    const httpServer: Server = this.httpAdapterHost.httpAdapter.getHttpServer();
    httpServer.on('upgrade', async (req: Request, socket: Socket, head) => {
      const deploymentId: string = req.url.split('/')[2];
      req.query = url.parse(req.url, true).query;

      this.removeProxyUrlPrefix(req.url, deploymentId);
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
    this.removeProxyUrlPrefix(req.url, deploymentId);
    this.httpProxy.web(req, res, this.makeProxyOptions(deploymentId));
  }

  /**
   * Dynamically creates configuration options for the proxy
   * @param deploymentId the deployment id
   */
  private makeProxyOptions(deploymentId: string): HttpProxy.ServerOptions {
    return { target: `http://${this.servicePrefix}-${deploymentId}` };
  }

  /**
   * Removes the /proxy/:deploymentId prefix from request urls
   * @param requestUrl the request url
   * @param deploymentId the deployment id
   */
  private removeProxyUrlPrefix(requestUrl: string, deploymentId: string): void {
    requestUrl = requestUrl.replace(`/proxy/${deploymentId}`, '');
  }
}
