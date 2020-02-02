import puppeteer, { ElementHandle, Page } from 'puppeteer';
import { InvalidCredentialsError } from '../errors/InvalidCredentialsError';
import { UnableToScrapMeetupPage } from '../errors/UnableToScrapMeetupPage';
import { DownloadUserImageEvent } from '../events/DownloadUserImageEvent';
import { ILogger } from '../logger/ILogger';
import { IMessageBus } from '../messageBus/IMessageBus';
import { IUserBasicInfoMiningResult } from './models/IUserBasicInfoMiningResult';
import { IUserCredentials } from './models/IUserCredentials';
import { IUserEventInfo } from './models/IUserEventInfo';
import { IUserEventsMiningResult } from './models/IUserEventsMiningResult';
import { IUserGroupInfo } from './models/IUserGroupInfo';
import { IUserGroupMiningResult } from './models/IUserGroupMiningResult';
import { IUserMiningResult } from './models/IUserMiningResult';

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
    const userDataMinigResult = await this.mineUserBasicInfo(page);
    const userGroups = await this.mineUserGroups(page);

    this.eventEmitter.emit(
      DownloadUserImageEvent.EVENT_NAME,
      new DownloadUserImageEvent(userGroups.userImageUrl, userDataMinigResult.user.meetupUserId.toString()));

    return this.formatResponse(userEvents, userDataMinigResult, userGroups);
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

    const startDateElement = await rowsItems[0].$('a > :first-child ');
    const startDate = await startDateElement.evaluate((x: any) => x.getAttribute('datetime'));

    const eventUrlElement = await rowsItems[1].$('.chunk > a');
    const eventNameElement = await eventUrlElement.$(':first-child');
    const eventName = await eventNameElement.evaluate((x: any) => x.innerText);

    const eventUrl = await eventUrlElement.evaluate((x: any) => x.getAttribute('href'));
    const groupId = eventUrl.split('/')[3];
    const eventId = Number(eventUrl.split('/')[5]);

    return {
      eventName,
      startDate,
      eventId,
      groupId,
    };
  }

  private async mineUserGroups(page: Page): Promise<IUserGroupMiningResult> {
    await this.goToProfilePage(page);
    const userGroups = [];

    const userImageUrlElement = await page.$('#member-profile-photo > a');
    const userImageUrl = await userImageUrlElement.evaluate((x: any) => x.getAttribute('href'));

    const profileContactItems = await page.$$('#D_memberProfileMeta > div > div > p');
    const memberSince = await profileContactItems[1].evaluate(x => x.innerText);

    const groupList = await page.$$('#my-meetup-groups-list > div');
    for (const group of groupList) {
      userGroups.push(await this.minuUserGroup(group));
    }
    return {
      userGroups,
      userImageUrl,
      memberSince,
    };
  }

  private async minuUserGroup(group: ElementHandle): Promise<IUserGroupInfo> {
    const descriptionLinkElement = await group.$('.figureset-description > h4 > a');
    const description = await descriptionLinkElement.evaluate((descriptionAHtml: any) => descriptionAHtml.innerText);
    const groupId = await group.evaluate((groupDivHtml) => groupDivHtml.getAttribute('data-chapterid'));

    return {
      id: groupId,
      name: description,
    };
  }

  private async mineUserBasicInfo(page: Page): Promise<IUserBasicInfoMiningResult> {
    await this.goToSettingsPage(page);

    const userBasicInfoTableData: any = await page.$$eval('.D_personalInformation tr td', (tds: any) =>
      tds.map((td: any) => td.innerText));

    const fullName = userBasicInfoTableData[1].replace(' edit', '').trim();
    const meetupUserId = userBasicInfoTableData[3].replace('user', '').replace('edit', '').trim();
    const email = userBasicInfoTableData[5].replace('edit', '').trim();

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

  private formatResponse(
    userEvents: IUserEventsMiningResult,
    userDataMinigResult: IUserBasicInfoMiningResult,
    userGroups: IUserGroupMiningResult,
  ): IUserMiningResult {
    return {
      customer: {
        ...userDataMinigResult.user,
        groups: userGroups.userGroups,
        memberSince: userGroups.memberSince,
      },
      events: userEvents.userEvents,
    };
  }
}
