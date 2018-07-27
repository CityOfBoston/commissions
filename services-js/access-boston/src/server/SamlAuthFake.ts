import SamlAuth, { SamlLoginResult } from './SamlAuth';

export default class SamlAuthFake implements Required<SamlAuth> {
  private assertUrl: string;

  constructor(assertUrl: string) {
    this.assertUrl = assertUrl;
  }

  getMetadata(): string {
    return '<EntityDescriptor></EntityDescriptor>';
  }

  makeLoginUrl(): Promise<string> {
    return Promise.resolve(this.assertUrl);
  }

  makeLogoutUrl(): Promise<string> {
    return Promise.resolve(this.assertUrl);
  }

  handlePostAssert(): Promise<SamlLoginResult> {
    const result: SamlLoginResult = {
      type: 'login',
      nameId: 'CON01234',
      sessionIndex: 'session',
      groups: [
        'COB-Group-TestGrp01',
        'SG_AB_IAM_TEAM',
        'SG_AB_SERVICEDESK_USERS',
      ],
    };
    return Promise.resolve(result);
  }
}
