import { SetMetadata } from '@nestjs/common';
import { CHECK_ABILITY } from 'src/shared/constants/casl';
import { Action, Resource } from 'src/shared/enums/casl-action.enum';

export interface RequiredRule {
  action: Action;
  subject: Resource | string;
  field?: string;
}

export const CheckAbilities = (...requirements: RequiredRule[]) =>
  SetMetadata(CHECK_ABILITY, requirements);

export const ReadUsers = () => CheckAbilities({ action: Action.READ, subject: Resource.USER });

export const CreateUsers = () => CheckAbilities({ action: Action.CREATE, subject: Resource.USER });

export const UpdateUsers = () => CheckAbilities({ action: Action.UPDATE, subject: Resource.USER });

export const DeleteUsers = () => CheckAbilities({ action: Action.DELETE, subject: Resource.USER });

export const ManageUsers = () => CheckAbilities({ action: Action.MANAGE, subject: Resource.USER });

export const ReadRoles = () => CheckAbilities({ action: Action.READ, subject: Resource.ROLE });

export const CreateRoles = () => CheckAbilities({ action: Action.CREATE, subject: Resource.ROLE });

export const UpdateRoles = () => CheckAbilities({ action: Action.UPDATE, subject: Resource.ROLE });

export const DeleteRoles = () => CheckAbilities({ action: Action.DELETE, subject: Resource.ROLE });

export const ManageRoles = () => CheckAbilities({ action: Action.MANAGE, subject: Resource.ROLE });

export const ReadPermissions = () =>
  CheckAbilities({ action: Action.READ, subject: Resource.PERMISSION });

export const CreatePermissions = () =>
  CheckAbilities({ action: Action.CREATE, subject: Resource.PERMISSION });

export const UpdatePermissions = () =>
  CheckAbilities({ action: Action.UPDATE, subject: Resource.PERMISSION });

export const DeletePermissions = () =>
  CheckAbilities({ action: Action.DELETE, subject: Resource.PERMISSION });

export const ManagePermissions = () =>
  CheckAbilities({ action: Action.MANAGE, subject: Resource.PERMISSION });

export const ReadTransactions = () =>
  CheckAbilities({ action: Action.READ, subject: Resource.TRANSACTION });

export const ManageTransactions = () =>
  CheckAbilities({ action: Action.MANAGE, subject: Resource.TRANSACTION });
