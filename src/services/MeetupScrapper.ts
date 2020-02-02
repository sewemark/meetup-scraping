import puppeteer, { Page, ElementHandle } from 'puppeteer';
import { InvalidCredentialsError } from '../errors/InvalidCredentialsError';
import { UnableToScrapMeetupPage } from '../errors/UnableToScrapMeetupPage';
import { DownloadUserImageEvent } from '../events/DownloadUserImageEvent';
import { ILogger } from '../logger/ILogger';
import { IMessageBus } from '../messageBus/IMessageBus';
import { IUserCredentials } from './IUserCredentials';

export interface IUserBasicInfo {
  fullName: string;
  email: string;
  meetupUserId: number;
}

export interface IUserBasicInfoMiningResult {
  user: IUserBasicInfo;
}
export interface IUserGroupInfo {
  id: string;
  name: string;
}
export interface IUserGroupMiningResult {
  userGroups: IUserGroupInfo[];
  userImageUrl: string;
}
export interface IUserEventInfo {
  startDate: Date;
  groupId: string;
  eventId: number;
  eventName: string;
}
export interface IUserEventsMiningResult {
  userEvents: IUserEventInfo[];
}

export interface IUserMiningResult {
  customer: {
    meetupUserId: number,
    email: string;
    fullName: string;
    memberSince: Date,
    groups: IUserGroupInfo[]
  };
  events: IUserEventInfo[];
}
export class MeetupScrapper {
  private LOGIN_URL = 'https://secure.meetup.com/login/';

  private logger: ILogger;
  private eventEmitter: IMessageBus;

  constructor(
    logger: ILogger,
    eventEmitter: IMessageBus,
  ) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
  }

  public async scrap(userCredentials: IUserCredentials): Promise<IUserMiningResult> {
    const page = await this.login(userCredentials);
    const userEvents = await this.mineUserEvents(page);
    const userDataMinigResult = await this.mineUserDate(page);
    const userGroups = await this.mineUserGroups(page);
    this.eventEmitter.emit(
      DownloadUserImageEvent.EVENT_NAME,
      new DownloadUserImageEvent(userGroups.userImageUrl, userDataMinigResult.user.meetupUserId.toString()));
    return {
      customer: {
        ...userDataMinigResult.user,
        groups: userGroups.userGroups,
        memberSince: new Date(),
      },
      events: userEvents.userEvents,
    };
  }

  private async mineUserEvents(page: Page): Promise<IUserEventsMiningResult> {
    const userEvents = [];
    const rows = await page.$$('li.event-listing');
    for (const row of rows) {
      const userEvent = await this.mineUserEvent(row);
      userEvents.push(userEvent);
    }
    return {
      userEvents,
    };
  }

  private async mineUserEvent(row: ElementHandle): Promise<IUserEventInfo> {
    const rowsItems = await row.$$('.row-item');

    const timeStampElement = await rowsItems[0].$('a > :first-child ');
    const startDate = await timeStampElement.evaluate((x: any) => x.getAttribute('datetime'));

    const linkElement = await rowsItems[1].$('.chunk > a');
    const link = await linkElement.evaluate((x: any) => x.getAttribute('href'));
    const nameElement = await linkElement.$(':first-child');
    const eventName = await nameElement.evaluate((x: any) => x.innerText);
    const groupId = link.split('/')[3];
    const eventId = Number(link.split('/')[5]);

    return {
      eventName,
      startDate,
      eventId,
      groupId,
    };
  }

  private async mineUserGroups(page: Page): Promise<IUserGroupMiningResult> {
    const userGroups = [];
    await this.goToProfilePage(page);
    const userImageLinkElment = await page.$('#member-profile-photo > a');
    const userImageUrl = await userImageLinkElment.evaluate(x => x.getAttribute('href'));
    const groupList = await page.$$('#my-meetup-groups-list > div');
    for (const group of groupList) {
      const descriptionLinkElement = await group.$('.figureset-description > h4 > a');
      const description = await descriptionLinkElement.evaluate((descriptionAHtml: any) => descriptionAHtml.innerText);
      const groupId = await group.evaluate((groupDivHtml) => groupDivHtml.getAttribute('data-chapterid'));
      userGroups.push({
        id: groupId,
        name: description,
      });
    }
    return {
      userGroups,
      userImageUrl,
    };
  }

  private async mineUserDate(page: Page): Promise<IUserBasicInfoMiningResult> {
    await this.goToSettingsPage(page);
    const personalTable = await page.$('.D_personalInformation');
    const data: any = await page.$$eval('.D_personalInformation tr td', tds =>
      tds.map(td => {
        return td.innerText;
      }),
    );
    const fullName = data[1].replace(' edit', '').trim();
    const meetupUserId = data[3].replace('user', '').replace('edit', '').trim();
    const email = data[5].replace('edit', '').trim();
    return {
      user: {
        fullName,
        meetupUserId,
        email,
      },
    };
  }

  private async login(userCredentials: IUserCredentials): Promise<Page> {
    try {
      const browser = await puppeteer.launch({ headless: false });
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 720 });
      await page.goto(this.LOGIN_URL, { waitUntil: 'networkidle0' });
      await page.type('#email', userCredentials.username);
      await page.type('#password', userCredentials.password);
      await Promise.all([
        page.click('#loginFormSubmit'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
      ]);
      if (page.url().includes('login')) {
        throw new InvalidCredentialsError();
      }
      return page;
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        throw err;
      }
      this.logger.error('MeetupScrapper', 'login', err, 'Cannot login with provided credentials');
      throw new UnableToScrapMeetupPage();
    }
  }

  private async goToSettingsPage(page: Page): Promise<void> {
    const profileNavigationToggleButton = await page.$('#profileNav');
    profileNavigationToggleButton.click();
    const userProfileLink = await page.$$('#nav-account-links li > a');
    const settingUrl = await userProfileLink[2].evaluate(x => x.getAttribute('href'));
    await page.goto(settingUrl, { waitUntil: 'networkidle0' });
  }

  private async goToProfilePage(page: Page): Promise<void> {
    const profileNavigationToggleButton = await page.$('#profileNav');
    profileNavigationToggleButton.click();
    const userProfileLink = await page.$$('#nav-account-links li > a');
    const profileUrl = await userProfileLink[0].evaluate(x => x.getAttribute('href'));
    await page.goto(profileUrl, { waitUntil: 'networkidle0' });
  }
}
