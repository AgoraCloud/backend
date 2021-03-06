import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  UpdateWorkspaceResourcesDto,
  AddWorkspaceUserDto,
} from '@agoracloud/common';
import { WorkspaceUserAddedEvent } from './../../events/workspace-user-added.event';
import { MinOneUserInWorkspaceException } from './../../exceptions/min-one-user-in-workspace.exception';
import { ExistingWorkspaceUserException } from './../../exceptions/existing-workspace-user.exception';
import { UsersService } from './../users/users.service';
import { WorkspaceCreatedEvent } from './../../events/workspace-created.event';
import { WorkspaceUserRemovedEvent } from './../../events/workspace-user-removed.event';
import { UserDeletedEvent } from './../../events/user-deleted.event';
import { WorkspaceDeletedEvent } from '../../events/workspace-deleted.event';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { WorkspaceNotFoundException } from './../../exceptions/workspace-not-found.exception';
import { InjectModel } from '@nestjs/mongoose';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { UserDocument } from '../users/schemas/user.schema';
import { Model, Query } from 'mongoose';
import { Event } from '../../events/events.enum';
import { WorkspaceUpdatedEvent } from '../../events/workspace-updated.event';
import { AuthorizationService } from '../authorization/authorization.service';
import { MinOneAdminUserInWorkspaceException } from '../../exceptions/min-one-admin-user-in-workspace.exception';
import { PermissionDocument } from '../authorization/schemas/permission.schema';
import { isDefined } from 'class-validator';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    private readonly usersService: UsersService,
    private readonly authorizationService: AuthorizationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a workspace
   * @param user the user
   * @param createWorkspaceDto the workspace to create
   * @returns the created workspace document
   */
  async create(
    user: UserDocument,
    createWorkspaceDto: CreateWorkspaceDto,
  ): Promise<WorkspaceDocument> {
    const workspace: Workspace = new Workspace(createWorkspaceDto);
    workspace.users = [user._id];
    const createdWorkspace: WorkspaceDocument =
      await this.workspaceModel.create(workspace);
    this.eventEmitter.emit(
      Event.WorkspaceCreated,
      new WorkspaceCreatedEvent(createdWorkspace),
    );
    return createdWorkspace;
  }

  /**
   * Find all workspaces
   * @param userId the users id
   * @returns an array of workspace documents
   */
  async findAll(userId?: string): Promise<WorkspaceDocument[]> {
    let workspacesQuery: Query<WorkspaceDocument[], WorkspaceDocument> =
      this.workspaceModel.find();
    if (userId) {
      workspacesQuery = workspacesQuery.where('users').in([userId]);
    }
    return workspacesQuery.exec();
  }

  /**
   * Find a workspace
   * @param workspaceId the workspace id
   * @param userId the users id
   * @throws WorkspaceNotFoundException
   * @returns the workspace document
   */
  async findOne(
    workspaceId: string,
    userId?: string,
  ): Promise<WorkspaceDocument> {
    let workspaceQuery: Query<WorkspaceDocument, WorkspaceDocument> =
      this.workspaceModel.findOne().where('_id').equals(workspaceId);
    if (userId) {
      workspaceQuery = workspaceQuery.where('users').in([userId]);
    }
    const workspace: WorkspaceDocument = await workspaceQuery.exec();
    if (!workspace) throw new WorkspaceNotFoundException(workspaceId);
    return workspace;
  }

  /**
   * Find the users in a workspace
   * @param workspaceId the workspace id
   * @throws WorkspaceNotFoundException
   * @returns the workspace document
   */
  async findOneUsers(workspaceId: string): Promise<WorkspaceDocument> {
    const workspace: WorkspaceDocument = await this.workspaceModel
      .findOne()
      .where('_id')
      .equals(workspaceId)
      .select('users')
      .populate('users')
      .exec();
    if (!workspace) throw new WorkspaceNotFoundException(workspaceId);
    return workspace;
  }

  /**
   * Update a workspace
   * @param workspaceId the workspace id
   * @param updateWorkspaceDto the updated workspace
   * @param userId the users id
   * @returns the updated workspace
   */
  async update(
    workspaceId: string,
    updateWorkspaceDto: UpdateWorkspaceDto,
    userId?: string,
  ): Promise<WorkspaceDocument> {
    const workspace: WorkspaceDocument = await this.findOne(
      workspaceId,
      userId,
    );

    // Change the updated fields only
    workspace.name = updateWorkspaceDto.name || workspace.name;
    const updateWorkspaceResourcesDto: UpdateWorkspaceResourcesDto =
      updateWorkspaceDto.properties?.resources;
    if (!workspace.properties) {
      workspace.properties = {};
    }
    if (!workspace.properties.resources) {
      workspace.properties.resources = {};
    }
    if (updateWorkspaceResourcesDto?.cpuCount === 0) {
      workspace.properties.resources.cpuCount = null;
    } else {
      workspace.properties.resources.cpuCount =
        updateWorkspaceResourcesDto?.cpuCount ||
        workspace.properties.resources.cpuCount;
    }
    if (updateWorkspaceResourcesDto?.memoryCount === 0) {
      workspace.properties.resources.memoryCount = null;
    } else {
      workspace.properties.resources.memoryCount =
        updateWorkspaceResourcesDto?.memoryCount ||
        workspace.properties.resources.memoryCount;
    }
    if (updateWorkspaceResourcesDto?.storageCount === 0) {
      workspace.properties.resources.storageCount = null;
    } else {
      workspace.properties.resources.storageCount =
        updateWorkspaceResourcesDto?.storageCount ||
        workspace.properties.resources.storageCount;
    }

    let workspaceQuery: Query<
      { ok: number; n: number; nModified: number },
      WorkspaceDocument
    > = this.workspaceModel
      .updateOne(null, workspace)
      .where('_id')
      .equals(workspaceId);
    if (userId) {
      workspaceQuery = workspaceQuery.where('users').in([userId]);
    }
    await workspaceQuery.exec();

    /**
     * Send the workspace.updated event only if cpuCount, memoryCount
     *  and/or storageCount have been updated
     */
    if (
      isDefined(updateWorkspaceResourcesDto?.cpuCount) ||
      isDefined(updateWorkspaceResourcesDto?.memoryCount) ||
      isDefined(updateWorkspaceResourcesDto?.storageCount)
    ) {
      this.eventEmitter.emit(
        Event.WorkspaceUpdated,
        new WorkspaceUpdatedEvent(workspace),
      );
    }
    return workspace;
  }

  /**
   * Delete a workspace
   * @param workspaceId the workspace id
   * @param userId the users id
   * @throws WorkspaceNotFoundException
   */
  async remove(workspaceId: string, userId?: string): Promise<void> {
    let workspaceQuery: Query<WorkspaceDocument, WorkspaceDocument> =
      this.workspaceModel.findOneAndDelete().where('_id').equals(workspaceId);
    if (userId) {
      workspaceQuery = workspaceQuery.where('users').in([userId]);
    }
    const workspace = await workspaceQuery.exec();
    if (!workspace) throw new WorkspaceNotFoundException(workspaceId);
    this.eventEmitter.emit(
      Event.WorkspaceDeleted,
      new WorkspaceDeletedEvent(workspaceId),
    );
  }

  /**
   * Add a user to a workspace
   * @param workspace the workspace
   * @param addWorkspaceUserDto the user to add
   * @throws ExistingWorkspaceUserException
   * @returns the updated workspace document
   */
  async addUser(
    workspace: WorkspaceDocument,
    addWorkspaceUserDto: AddWorkspaceUserDto,
  ): Promise<WorkspaceDocument> {
    const workspaceId: string = workspace._id;
    const userEmail: string = addWorkspaceUserDto.email;
    // Get the workspace with the users information populated
    const retrievedWorkspace: WorkspaceDocument = await this.findOneUsers(
      workspaceId,
    );
    // Check if the user is already a member
    if (
      retrievedWorkspace.users.findIndex((u) => u.email === userEmail) !== -1
    ) {
      throw new ExistingWorkspaceUserException(workspaceId, userEmail);
    }
    let user: UserDocument;
    try {
      user = await this.usersService.findByEmail(userEmail, false);
    } catch (err) {
      // Do nothing
      return workspace;
    }
    workspace.users.push(user);
    await this.updateUsers(workspaceId, workspace.users);
    this.eventEmitter.emit(
      Event.WorkspaceUserAdded,
      new WorkspaceUserAddedEvent(workspaceId, user.id),
    );
    return workspace;
  }

  /**
   * Remove a user from a workspace
   * @param workspace the workspace
   * @param userId the id of the user to remove
   * @throws MinOneUserInWorkspaceException
   * @throws MinOneAdminUserInWorkspaceException
   * @returns the updated workspace document
   */
  async removeUser(
    workspace: WorkspaceDocument,
    userId: string,
  ): Promise<WorkspaceDocument> {
    const workspaceId: string = workspace._id;
    // Remove the user from the workspace
    const workspaceUsers: UserDocument[] = workspace.users.filter(
      (u) => u._id.toString() != userId,
    );
    // Check if the workspace has at-least one member after removing the user
    if (workspaceUsers.length === 0) {
      throw new MinOneUserInWorkspaceException(workspaceId);
    }
    // Check if the workspace has at-least one admin member left after removing the user
    const workspaceAdminPermissions: PermissionDocument[] =
      await this.authorizationService.findAllWorkspaceAdminPermissions(
        workspace._id,
      );
    if (
      !workspaceAdminPermissions.filter((p) => p.user._id.toString() != userId)
        .length
    ) {
      throw new MinOneAdminUserInWorkspaceException(workspace._id);
    }
    await this.updateUsers(workspaceId, workspaceUsers);
    workspace.users = workspaceUsers;
    this.eventEmitter.emit(
      Event.WorkspaceUserRemoved,
      new WorkspaceUserRemovedEvent(workspaceId, userId),
    );
    return workspace;
  }

  /**
   * Update the users in a workspace
   * @param workspaceId the workspace id
   * @param users the users
   */
  private async updateUsers(
    workspaceId: string,
    users: UserDocument[],
  ): Promise<void> {
    await this.workspaceModel
      .updateOne(null, { users })
      .where('_id')
      .equals(workspaceId)
      .exec();
  }

  /**
   * Handles the user.deleted event
   * @param payload the user.deleted event payload
   */
  @OnEvent(Event.UserDeleted)
  private async handleUserDeletedEvent(
    payload: UserDeletedEvent,
  ): Promise<void> {
    const userId: string = payload.id;
    const workspaces: WorkspaceDocument[] = await this.findAll(userId);
    for (const workspace of workspaces) {
      const workspaceId: string = workspace._id;
      // The user is the only user in the workspace, delete the workspace
      if (workspace.users.length === 1) {
        await this.remove(workspaceId, userId);
      } else {
        // Remove the user from the workspace users
        workspace.users = workspace.users.filter((u) => u._id !== userId);
        await this.workspaceModel
          .updateOne({ _id: workspaceId }, { users: workspace.users })
          .exec();
        this.eventEmitter.emit(
          Event.WorkspaceUserRemoved,
          new WorkspaceUserRemovedEvent(workspaceId, userId),
        );
      }
    }
  }
}
