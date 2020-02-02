import puppeteer, { Page, Serializable, SerializableOrJSHandle } from 'puppeteer';
import { InvalidCredentialsError } from '../errors/InvalidCredentialsError';
import { ILogger } from '../logger/ILogger';
import { IUserCredentials } from './IUserCredentials';

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
    const userDataMinigResult = await this.mineUserDate(page);
    const userGroups = await this.mineUserGroups(page);
    const userEvents = await this.mineUserEvents(page);
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
    groupList.click();
    const eventLinksElements = await page.$$('.row-item > .chunk > a');
    const urls = [];
    console.log(eventLinksElements.length);
    for (const eventLinksElement of eventLinksElements) {
      const url = await eventLinksElement.evaluate((x: any) => x.getAttribute('href'));
      urls.push(url);
    }
    const userEvents = [];
    for (const eventUrl of urls) {
      await page.goto(eventUrl, { waitUntil: 'networkidle0' });
      const timeStampElement = await page.$('.eventTimeDisplay > time');
      const eventTimeStamp = await timeStampElement.evaluate((x: any) => x.getAttribute('datetime'));
      const eventNameElement = await page.$('.pageHead-headline');
      const eventName = await eventNameElement.evaluate((x: any) => x.innerText);
      const groupId = eventUrl.split('/')[3];
      const eventId = eventUrl.split('/')[5];
      userEvents.push({
        eventName,
        startDate: new Date(eventTimeStamp),
        eventId,
        groupId,
      });
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
        console.log(td);
        return td.innerText;
      }),
    );
    console.log(personalTable);
    console.log(data);
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
