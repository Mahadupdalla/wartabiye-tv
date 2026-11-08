-- One row per day, advert and placement. No visitor data of any kind.
CREATE TABLE IF NOT EXISTS ad_stats (
  day    TEXT NOT NULL,              -- YYYY-MM-DD (UTC)
  ad     TEXT NOT NULL,              -- advert id = file name in data/ads/ (without .json)
  pos    TEXT NOT NULL,              -- home, sidebar, card, article, mobile, spotlight, video
  views  INTEGER NOT NULL DEFAULT 0, -- at least half of the advert on screen for one second
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, ad, pos)
);
