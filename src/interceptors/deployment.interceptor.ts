import { DeploymentNotRunningException } from './../exceptions/deployment-not-running.exception';
import {
  DeploymentDocument,
  DeploymentStatus,
} from './../modules/deployments/schemas/deployment.schema';
import { InvalidMongoIdException } from './../exceptions/invalid-mongo-id.exception';
import { WorkspaceDocument } from './../modules/workspaces/schemas/workspace.schema';
import { UserDocument } from './../modules/users/schemas/user.schema';
import { isMongoId } from 'class-validator';
import { RequestWithWorkspaceAndUser } from './../utils/requests.interface';
import { DeploymentsService } from './../modules/deployments/deployments.service';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class DeploymentInterceptor implements NestInterceptor {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request: RequestWithWorkspaceAndUser = context
      .switchToHttp()
      .getRequest();
    const deploymentId: string = request.params.deploymentId;
    if (!isMongoId(deploymentId)) {
      throw new InvalidMongoIdException('deploymentId');
    }

    const user: UserDocument = request.user;
    const workspace: WorkspaceDocument = request.workspace;
    const deployment: DeploymentDocument = await this.deploymentsService.findOne(
      user._id,
      deploymentId,
      workspace?._id,
    );
    if (deployment.status !== DeploymentStatus.Running) {
      throw new DeploymentNotRunningException(deploymentId);
    }
    return next.handle();
  }
}
