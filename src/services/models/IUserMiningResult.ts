import { IUserEventInfo } from './IUserEventInfo';
import { IUserGroupInfo } from './IUserGroupInfo';

export interface IUserMiningResult {
    customer: {
        meetupUserId: number,
        email: string;
        fullName: string;
        memberSince: string,
        groups: IUserGroupInfo[]
    };
    events: IUserEventInfo[];
}
