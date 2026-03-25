export interface Track {
  id: string;
  name: string;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  loop: boolean;
}
