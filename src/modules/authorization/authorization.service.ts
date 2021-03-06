import { WorkspaceUserAddedEvent } from './../../events/workspace-user-added.event';
import { UserNotInWorkspaceException } from './../../exceptions/user-not-in-workspace.exception';
import {
  UpdateWorkspaceUserPermissionsDto,
  UpdateUserPermissionsDto,
  RoleDto,
  IN_WORKSPACE_ACTIONS_DTO,
  ActionDto,
} from '@agoracloud/common';
import { UserDocument } from './../users/schemas/user.schema';
import { WorkspaceDocument } from './../workspaces/schemas/workspace.schema';
import { WorkspaceDeletedEvent } from './../../events/workspace-deleted.event';
import { WorkspaceUserRemovedEvent } from './../../events/workspace-user-removed.event';
import { WorkspaceCreatedEvent } from './../../events/workspace-created.event';
import { UserDeletedEvent } from './../../events/user-deleted.event';
import { UserCreatedEvent } from './../../events/user-created.event';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  Permission,
  PermissionDocument,
  WorkspaceRolesAndPermissions,
} from './schemas/permission.schema';
import { Model } from 'mongoose';
import { Event } from '../../events/events.enum';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkspaceNotFoundException } from '../../exceptions/workspace-not-found.exception';

@Injectable()
export class AuthorizationService {
  constructor(
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<PermissionDocument>,
  ) {}

  /**
   * Create a users permissions
   * @param permission the users permissions to create
   * @returns the created permissions document
   */
  private async create(permission: Permission): Promise<PermissionDocument> {
    const createdPermission: PermissionDocument =
      await this.permissionModel.create(permission);
    return createdPermission;
  }

  /**
   * Find all permissions for users that are members in the given workspace
   * @param workspaceId the workspace id
   * @returns an array of permission documents
   */
  private async findAll(workspaceId: string): Promise<PermissionDocument[]> {
    const retrievedPermissions: PermissionDocument[] =
      await this.permissionModel.find().exec();
    return retrievedPermissions.filter((p) => p.workspaces.has(workspaceId));
  }

  /**
   * Find a users permissions
   * @param userId the users id
   * @throws InternalServerErrorException
   * @returns the users permissions document
   */
  async findOne(userId: string): Promise<PermissionDocument> {
    const permission: PermissionDocument = await this.permissionModel
      .findOne()
      .where('user')
      .equals(userId)
      .exec();
    if (!permission) throw new InternalServerErrorException();
    return permission;
  }

  /**
   * Find a users workspace permissions
   * @param userId the users id
   * @param workspaceId the workspace id
   * @throws UserNotInWorkspaceException
   * @returns the users workspace permissions
   */
  async findOneWorkspacePermissions(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceRolesAndPermissions> {
    const permissions: PermissionDocument = await this.findOne(userId);
    const workspaceRolesAndPermissions: WorkspaceRolesAndPermissions =
      permissions.workspaces.get(workspaceId);
    if (!workspaceRolesAndPermissions) {
      throw new UserNotInWorkspaceException(userId, workspaceId);
    }
    return workspaceRolesAndPermissions;
  }

  /**
   * Find all permissions for admins in the given workspace
   * @param workspaceId the workspace id
   * @returns an array of permission documents
   */
  async findAllWorkspaceAdminPermissions(
    workspaceId: string,
  ): Promise<PermissionDocument[]> {
    return this.permissionModel
      .find()
      .where(`workspaces.${workspaceId}`)
      .exists(true)
      .where(`workspaces.${workspaceId}.roles`)
      .in([RoleDto.WorkspaceAdmin])
      .exec();
  }

  /**
   * Update a users permissions
   * @param permission the updated users permissions
   * @returns the updated permission document
   */
  private async update(
    permission: PermissionDocument,
  ): Promise<PermissionDocument> {
    const updatedPermission: PermissionDocument = await this.permissionModel
      .findOneAndUpdate(null, permission, { new: true })
      .where('_id')
      .equals(permission._id)
      .exec();
    return updatedPermission;
  }

  /**
   * Update a users permissions (application-wide)
   * @param userId the users id
   * @param updateUserPermissionsDto the updated user permissions
   * @returns the updated permission document
   */
  async updateUserPermissions(
    userId: string,
    updateUserPermissionsDto: UpdateUserPermissionsDto,
  ): Promise<PermissionDocument> {
    let permissions: PermissionDocument = await this.findOne(userId);
    permissions.roles = updateUserPermissionsDto.roles;
    // For now, a users roles can only contain one role
    if (permissions.roles[0] === RoleDto.SuperAdmin) {
      permissions.permissions = [];
    } else {
      permissions.permissions = updateUserPermissionsDto.permissions;
    }
    permissions = await this.update(permissions);
    return permissions;
  }

  /**
   * Update a users workspace permissions
   * @param userId the users id
   * @param workspaceId the workspace id
   * @param updateWorkspaceUserPermissionsDto the updated users workspace permissions
   * @throws UserNotInWorkspaceException
   * @returns the updated workspace permissions
   */
  async updateUsersWorkspacePermissions(
    userId: string,
    workspaceId: string,
    updateWorkspaceUserPermissionsDto: UpdateWorkspaceUserPermissionsDto,
  ): Promise<WorkspaceRolesAndPermissions> {
    const permissions: PermissionDocument = await this.findOne(userId);
    const workspaceRolesAndPermissions: WorkspaceRolesAndPermissions =
      permissions.workspaces.get(workspaceId);
    if (!workspaceRolesAndPermissions) {
      throw new UserNotInWorkspaceException(userId, workspaceId);
    }

    workspaceRolesAndPermissions.roles =
      updateWorkspaceUserPermissionsDto.roles;
    // For now, a users roles can only contain one role
    if (workspaceRolesAndPermissions.roles[0] === RoleDto.WorkspaceAdmin) {
      workspaceRolesAndPermissions.permissions = [];
    } else {
      workspaceRolesAndPermissions.permissions =
        updateWorkspaceUserPermissionsDto.permissions;
    }
    permissions.workspaces.set(workspaceId, workspaceRolesAndPermissions);
    await this.update(permissions);
    return workspaceRolesAndPermissions;
  }

  /**
   * Delete a users permissions
   * @param userId the users id
   */
  private async remove(userId: string): Promise<void> {
    await this.permissionModel.deleteOne().where('user').equals(userId).exec();
  }

  /**
   * Handles the user.created event
   * @param payload the user.created event payload
   */
  @OnEvent(Event.UserCreated)
  private async handleUserCreatedEvent(
    payload: UserCreatedEvent,
  ): Promise<void> {
    const userRole: RoleDto = payload.role;
    const permission: Permission = new Permission({
      user: payload.user,
      roles: [userRole],
    });
    if (userRole === RoleDto.SuperAdmin) {
      permission.permissions = [];
    }
    await this.create(permission);
  }

  /**
   * Handles the user.deleted event
   * @param payload the user.deleted event payload
   */
  @OnEvent(Event.UserDeleted)
  private async handleUserDeletedEvent(
    payload: UserDeletedEvent,
  ): Promise<void> {
    await this.remove(payload.id);
  }

  /**
   * Handles the workspace.created event
   * @param payload the workspace.created event payload
   */
  @OnEvent(Event.WorkspaceCreated)
  private async handleWorkspaceCreatedEvent(
    payload: WorkspaceCreatedEvent,
  ): Promise<void> {
    const workspace: WorkspaceDocument = payload.workspace;
    // A workspace will only have one user (workspace admin) when created
    const user: UserDocument = workspace.users[0];
    const permission: PermissionDocument = await this.findOne(user._id);
    permission.workspaces.set(
      workspace._id,
      new WorkspaceRolesAndPermissions({
        roles: [RoleDto.WorkspaceAdmin],
        permissions: [],
      }),
    );
    await this.update(permission);
  }

  /**
   * Handles the workspace.user.added event
   * @param payload the workspace.user.added event payload
   */
  @OnEvent(Event.WorkspaceUserAdded)
  private async handleWorkspaceUserAddedEvent(
    payload: WorkspaceUserAddedEvent,
  ): Promise<void> {
    const permission: PermissionDocument = await this.findOne(payload.userId);
    if (permission.roles[0] === RoleDto.SuperAdmin) return;
    permission.workspaces.set(
      payload.workspaceId,
      new WorkspaceRolesAndPermissions({
        roles: [RoleDto.User],
        permissions: IN_WORKSPACE_ACTIONS_DTO,
      }),
    );
    await this.update(permission);
  }

  /**
   * Handles the workspace.user.removed event
   * @param payload the workspace.user.removed event payload
   */
  @OnEvent(Event.WorkspaceUserRemoved)
  private async handleWorkspaceUserRemovedEvent(
    payload: WorkspaceUserRemovedEvent,
  ): Promise<void> {
    const permission: PermissionDocument = await this.findOne(payload.userId);
    permission.workspaces.delete(payload.workspaceId);
    await this.update(permission);
  }

  /**
   * Handles the workspace.deleted event
   * @param payload the workspace.deleted event payload
   */
  @OnEvent(Event.WorkspaceDeleted)
  private async handleWorkspaceDeletedEvent(
    payload: WorkspaceDeletedEvent,
  ): Promise<void> {
    const workspaceId: string = payload.id;
    const permissions: PermissionDocument[] = await this.findAll(workspaceId);
    for (const permission of permissions) {
      permission.workspaces.delete(workspaceId);
      await this.update(permission);
    }
  }

  /**
   * Checks whether a user has the given permissions
   * @param user the user
   * @param neededPermissions the needed permissions
   * @param workspaceId the workspace id
   * @throws WorkspaceNotFoundException
   * @returns whether the user has the needed permissions
   */
  async can(
    user: UserDocument,
    neededPermissions: ActionDto[],
    workspaceId?: string,
  ): Promise<{ canActivate: boolean; isAdmin: boolean }> {
    const permission: PermissionDocument = await this.findOne(user._id);
    const grantedPermissions: ActionDto[] = permission.permissions;

    /**
     * Checks whether the users granted permissions contain the needed permissions
     * @param grantedPermissions the users granted permissions
     * @param neededPermissions the users needed permissions
     */
    const hasPermissions = (
      grantedPermissions: ActionDto[],
      neededPermissions: ActionDto[],
    ): boolean => {
      if (!grantedPermissions.length || !neededPermissions.length) return false;
      let hasPermissions = true;
      for (const action of neededPermissions) {
        hasPermissions = hasPermissions && grantedPermissions.includes(action);
        if (!hasPermissions) break;
      }
      return hasPermissions;
    };

    // A super admin can perform any action application-wide and workspace-wide
    if (permission.roles.includes(RoleDto.SuperAdmin)) {
      return { canActivate: true, isAdmin: true };
    }
    // User is not a super admin, check application-wide permissions
    if (!workspaceId) {
      return {
        canActivate: hasPermissions(grantedPermissions, neededPermissions),
        isAdmin: false,
      };
    }

    const workspaceRolesAndPermissions: WorkspaceRolesAndPermissions =
      permission.workspaces.get(workspaceId);
    if (!workspaceRolesAndPermissions) {
      throw new WorkspaceNotFoundException(workspaceId);
    }
    // A workspace admin can perform any action workspace-wide
    if (workspaceRolesAndPermissions.roles.includes(RoleDto.WorkspaceAdmin)) {
      return { canActivate: true, isAdmin: true };
    }
    // User is not a workspace admin, check workspace-wide permissions
    const workspacePermissions: ActionDto[] =
      workspaceRolesAndPermissions.permissions;
    if (workspacePermissions.includes(ActionDto.CreateWiki)) {
      workspacePermissions.push(ActionDto.CreateWikiSection);
      workspacePermissions.push(ActionDto.CreateWikiPage);
    }
    if (workspacePermissions.includes(ActionDto.ReadWiki)) {
      workspacePermissions.push(ActionDto.ReadWikiSection);
      workspacePermissions.push(ActionDto.ReadWikiPage);
    }
    if (workspacePermissions.includes(ActionDto.UpdateWiki)) {
      workspacePermissions.push(ActionDto.UpdateWikiSection);
      workspacePermissions.push(ActionDto.UpdateWikiPage);
    }
    if (workspacePermissions.includes(ActionDto.DeleteWiki)) {
      workspacePermissions.push(ActionDto.DeleteWikiSection);
      workspacePermissions.push(ActionDto.DeleteWikiPage);
    }
    return {
      canActivate: hasPermissions(
        [...grantedPermissions, ...workspacePermissions],
        neededPermissions,
      ),
      isAdmin: false,
    };
  }
}
