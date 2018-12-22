import StatusJS from "status-js-api";
import Channel from './channel';

interface ConfigOptions {
  pingFrequency: number;
};

interface WhisperProvider {
  send: Function;
  sendAasync: Function;
}

class StatusJSClient {
  private status: any;
  private userPubKey: string;
  private userName: string;
  private channels: any;

  constructor(options?: ConfigOptions) {
    this.status = new StatusJS();
    this.userPubKey = "";
    this.userName = "";
    this.channels = {};
  }

  public async connectToNode(url: string) {
    await this.status.connect(url);
    this.init();
  }

  public connectToProvider(provider: WhisperProvider) {
    this.init();
  }

  private async init() {
    this.userPubKey = await this.status.getPublicKey();
    this.userName = await this.status.getUserName();
  }

  public async getPublicKey() {
    const userPubKey = await this.status.getPublicKey();
    return userPubKey;
  }

  public joinChannel(channelName: string) {
    const channel = new Channel(channelName, this.status);
    this.channels[channelName] = channel;
    return new Promise((resolve: any, reject?: any) => {
      channel.joinChannel(() => {
         resolve(channel);
      });
    })
  }

}

export default StatusJSClient;
