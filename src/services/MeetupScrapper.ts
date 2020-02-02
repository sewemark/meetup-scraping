import puppeteer, { Page, Serializable, SerializableOrJSHandle } from 'puppeteer';
import { InvalidCredentialsError } from '../errors/InvalidCredentialsError';
import { ILogger } from '../logger/ILogger';
import { IUserCredentials } from './IUserCredentials';
import { X_OK } from 'constants';

export interface IUserBasicInfo {
  fullName: string;
  email: string;
  meetupUserId: number;
}
export interface IMiningResult {
  page: any;
}

export interface IUserBasicInfoMiningResult extends IMiningResult {
  user: IUserBasicInfo;
}
export interface IUserGroupInfo {
  id: string;
  name: string;
}
export interface IUserGroupMiningResult extends IMiningResult {
  userGroups: IUserGroupInfo[];
}
export interface IUserEventInfo {
  startDate: Date;
  groupId: string;
  eventId: number;
  eventName: string;
}
export interface IUserEventsMiningResult extends IMiningResult {
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
  private HOME_URL = 'https://www.meetup.com/';

  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  public async scrap(userCredentials: IUserCredentials): Promise<IUserMiningResult> {
    const page = await this.login(userCredentials);
    const userEvents = await this.mineUserEvents(page);
    const userDataMinigResult = await this.mineUserDate(page);
    const userGroups = await this.mineUserGroups(page);
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
    await page.goto(this.HOME_URL, { waitUntil: 'networkidle0' });
    const groupList = await page.$('#simple-event-filter > li');
    await groupList.click();
    const toggleEventRadius = await page.$$('#searchForm > .dropdown > .dropdown-toggle');
    await toggleEventRadius[1].click();
    const smallestRadius = await page.$('#simple-radius > li > a');
    await smallestRadius.click();
    const userEvents = [];
    const rows = await page.$$('li.event-listing');
    console.log(rows.length);
    for (const row of rows) {
      try {
        const debug = await row.evaluate(x => x.innerText);
        const timeElement = await row.$('.row-item > a:first-child ');
        const eventTimeStamp = await timeElement.evaluate((x: any) => x.getAttribute('datetime'));
        const rowsItems = await row.$$('.row-item');
        const chunkElement = await rowsItems[1].$('.chunk > a');
        const linkElement = await chunkElement.$('a');
        const link = await linkElement.evaluate(x => x.getAttribute('href'));
        const nameElement = await chunkElement.$('a:first-child');
        const eventName = await nameElement.evaluate(x => x.innerText);
        const groupId = link.split('/')[3];
        const eventId = Number(link.split('/')[5]);
        userEvents.push({
          eventName,
          startDate: eventTimeStamp,
          eventId,
          groupId,
        });
      } catch (err) {
        console.log(err);
      }
    }
    return {
      page,
      userEvents,
    };
  }

  private async mineUserGroups(page: Page): Promise<IUserGroupMiningResult> {
    const userGroups = [];
    await this.goToProfilePage(page);
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
      page,
      userGroups,
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
      page,
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
      return page;
    } catch (err) {
      this.logger.error('MeetupScrapper', 'login', err, 'Cannot login with provided credentials');
      throw new InvalidCredentialsError();
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
