
class User {
  public pubkey: string;
  public username: string;
  public online: boolean;
  public lastSeen: number;

  constructor(pubkey: string, username: string) {
    this.pubkey = pubkey;
    this.username = username;
    this.online = false;
    this.lastSeen = 0;
  }
}

export default User;
