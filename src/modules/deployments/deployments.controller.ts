import {
  DeploymentDto,
  ExceptionDto,
  CreateDeploymentDto,
  DeploymentImageDto,
  UpdateDeploymentDto,
  ActionDto,
  AuditActionDto,
  AuditResourceDto,
} from '@agoracloud/common';
import { Audit } from '../../decorators/audit.decorator';
import { Permissions } from './../../decorators/permissions.decorator';
import {
  ApiTags,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiOkResponse,
  ApiParam,
  ApiOperation,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { FindOneParams } from './../../utils/find-one-params';
import { WorkspaceInterceptor } from './../../interceptors/workspace.interceptor';
import { UserDocument } from '../users/schemas/user.schema';
import { WorkspaceDocument } from './../workspaces/schemas/workspace.schema';
import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseInterceptors,
} from '@nestjs/common';
import { Workspace } from '../../decorators/workspace.decorator';
import { DeploymentsService } from './deployments.service';
import { User } from '../../decorators/user.decorator';
import { DeploymentDocument } from './schemas/deployment.schema';
import { Auth } from '../../decorators/auth.decorator';
import { IsAdmin } from '../../decorators/is-admin.decorator';
import { Transform } from '../../decorators/transform.decorator';

@ApiCookieAuth()
@ApiTags('Deployments')
@Auth(ActionDto.ReadWorkspace)
@Controller('api/workspaces/:workspaceId/deployments')
@UseInterceptors(WorkspaceInterceptor)
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  /**
   * Create a new deployment
   * @param user the user
   * @param workspace the workspace
   * @param createDeploymentDto the deployment to create
   */
  @Post()
  @Permissions(ActionDto.CreateDeployment)
  @Audit(AuditActionDto.Create, AuditResourceDto.Deployment)
  @Transform(DeploymentDto)
  @ApiParam({ name: 'workspaceId', description: 'The workspace id' })
  @ApiOperation({ summary: 'Create a new deployment' })
  @ApiCreatedResponse({
    description: 'The deployment has been successfully created',
    type: DeploymentDto,
  })
  @ApiBadRequestResponse({
    description: 'The provided deployment or workspace id was not valid',
    type: ExceptionDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ExceptionDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ExceptionDto })
  @ApiNotFoundResponse({
    description: 'The workspace with the given id was not found',
    type: ExceptionDto,
  })
  create(
    @User() user: UserDocument,
    @Workspace() workspace: WorkspaceDocument,
    @Body() createDeploymentDto: CreateDeploymentDto,
  ): Promise<DeploymentDocument> {
    return this.deploymentsService.create(user, workspace, createDeploymentDto);
  }

  /**
   * Get all allowed deployment images
   */
  @Get('images')
  @Audit(AuditActionDto.ReadImages, AuditResourceDto.Deployment)
  @ApiParam({ name: 'workspaceId', description: 'The workspace id' })
  @ApiOperation({ summary: 'Get all allowed deployment images' })
  @ApiOkResponse({
    description: 'The deployment images have been successfully retrieved',
    type: DeploymentImageDto,
  })
  @ApiBadRequestResponse({
    description: 'The provided workspace id was not valid',
    type: ExceptionDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ExceptionDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ExceptionDto })
  @ApiNotFoundResponse({
    description: 'The workspace with the given id was not found',
    type: ExceptionDto,
  })
  findAllImages(): DeploymentImageDto[] {
    return this.deploymentsService.findAllImages();
  }

  /**
   * Get all deployments
   * @param userId the users id
   * @param workspaceId the workspace id
   */
  @Get()
  @Permissions(ActionDto.ReadDeployment)
  @Audit(AuditActionDto.Read, AuditResourceDto.Deployment)
  @Transform(DeploymentDto)
  @ApiParam({ name: 'workspaceId', description: 'The workspace id' })
  @ApiOperation({ summary: 'Get all deployments' })
  @ApiOkResponse({
    description: 'The deployments have been successfully retrieved',
    type: [DeploymentDto],
  })
  @ApiBadRequestResponse({
    description: 'The provided workspace id was not valid',
    type: ExceptionDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ExceptionDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ExceptionDto })
  @ApiNotFoundResponse({
    description: 'The workspace with the given id was not found',
    type: ExceptionDto,
  })
  findAll(
    @User('_id') userId: string,
    @IsAdmin() isAdmin: boolean,
    @Workspace('_id') workspaceId: string,
  ): Promise<DeploymentDocument[]> {
    if (isAdmin) {
      return this.deploymentsService.findAll(workspaceId);
    }
    return this.deploymentsService.findAll(workspaceId, userId);
  }

  /**
   * Get a deployment
   * @param userId the users id
   * @param workspaceId the workspace id
   * @param deploymentId the deployment id
   */
  @Get(':id')
  @Permissions(ActionDto.ReadDeployment)
  @Audit(AuditActionDto.Read, AuditResourceDto.Deployment)
  @Transform(DeploymentDto)
  @ApiParam({ name: 'workspaceId', description: 'The workspace id' })
  @ApiParam({ name: 'id', description: 'The deployment id' })
  @ApiOperation({ summary: 'Get a deployment' })
  @ApiOkResponse({
    description: 'The deployment has been successfully retrieved',
    type: DeploymentDto,
  })
  @ApiBadRequestResponse({
    description: 'The provided workspace id or deployment id was not valid',
    type: ExceptionDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ExceptionDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ExceptionDto })
  @ApiNotFoundResponse({
    description: 'The workspace or deployment with the given id was not found',
    type: ExceptionDto,
  })
  findOne(
    @User('_id') userId: string,
    @IsAdmin() isAdmin: boolean,
    @Workspace('_id') workspaceId: string,
    @Param() { id: deploymentId }: FindOneParams,
  ): Promise<DeploymentDocument> {
    if (isAdmin) {
      return this.deploymentsService.findOne(
        deploymentId,
        undefined,
        workspaceId,
      );
    }
    return this.deploymentsService.findOne(deploymentId, userId, workspaceId);
  }

  /**
   * Update a deployment
   * @param userId the users id
   * @param workspaceId the workspace id
   * @param deploymentId the deployment id
   * @param updateDeploymentDto the updated deployment
   */
  @Put(':id')
  @Permissions(ActionDto.UpdateDeployment)
  @Audit(AuditActionDto.Update, AuditResourceDto.Deployment)
  @Transform(DeploymentDto)
  @ApiParam({ name: 'workspaceId', description: 'The workspace id' })
  @ApiParam({ name: 'id', description: 'The deployment id' })
  @ApiOperation({ summary: 'Update a deployment' })
  @ApiOkResponse({
    description: 'The deployment has been successfully updated',
    type: DeploymentDto,
  })
  @ApiBadRequestResponse({
    description:
      'The provided deployment, workspace id or deployment id was not valid',
    type: ExceptionDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ExceptionDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ExceptionDto })
  @ApiNotFoundResponse({
    description: 'The workspace or deployment with the given id was not found',
    type: ExceptionDto,
  })
  update(
    @User('_id') userId: string,
    @IsAdmin() isAdmin: boolean,
    @Workspace('_id') workspaceId: string,
    @Param() { id: deploymentId }: FindOneParams,
    @Body() updateDeploymentDto: UpdateDeploymentDto,
  ): Promise<DeploymentDocument> {
    if (isAdmin) {
      return this.deploymentsService.update(
        workspaceId,
        deploymentId,
        updateDeploymentDto,
      );
    }
    return this.deploymentsService.update(
      workspaceId,
      deploymentId,
      updateDeploymentDto,
      userId,
    );
  }

  /**
   * Delete a deployment
   * @param userId the users id
   * @param workspaceId the workspace id
   * @param deploymentId the deployment id
   */
  @Delete(':id')
  @Permissions(ActionDto.DeleteDeployment)
  @Audit(AuditActionDto.Delete, AuditResourceDto.Deployment)
  @Transform(DeploymentDto)
  @ApiParam({ name: 'workspaceId', description: 'The workspace id' })
  @ApiParam({ name: 'id', description: 'The deployment id' })
  @ApiOperation({ summary: 'Delete a deployment' })
  @ApiOkResponse({
    description: 'The deployment has been successfully deleted',
  })
  @ApiBadRequestResponse({
    description: 'The provided workspace id or deployment id was not valid',
    type: ExceptionDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ExceptionDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ExceptionDto })
  @ApiNotFoundResponse({
    description: 'The workspace or deployment with the given id was not found',
    type: ExceptionDto,
  })
  remove(
    @User('_id') userId: string,
    @IsAdmin() isAdmin: boolean,
    @Workspace('_id') workspaceId: string,
    @Param() { id: deploymentId }: FindOneParams,
  ): Promise<void> {
    if (isAdmin) {
      return this.deploymentsService.remove(workspaceId, deploymentId);
    }
    return this.deploymentsService.remove(workspaceId, deploymentId, userId);
  }
}
