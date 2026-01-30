
export interface Country {
  name: string;
  code: string;
  region: string;
}

export interface CountryVisit {
  visited: boolean;
  date?: string;
  photos: string[]; // Base64 strings for simplicity in local persistence demo
}

export interface UserData {
  [countryCode: string]: CountryVisit;
}
