/* ---------- State ---------- */
const state = {
  /* `passwordHash` is the sha-256 hex of the plaintext password the
     player chose at registration. We never store the plaintext. */
  profile: { nickname:"", id:"", passwordHash:"", registeredAt:0, lastLoginDay:0, loginDays:[] },
  /* Activation-code nonces that have been fully consumed (used up to
     their cap) on this device. Kept around for back-compat with older
     code paths that just want to know "have I seen this nonce?". */
  usedActivationCodes: [],
  /* Per-nonce usage counter for the activation-code system. A code is
     accepted while `activationUsage[nonce] < maxUses` and rejected on
     the redemption that would push it past the cap. Older saves that
     only have `usedActivationCodes` are migrated lazily on first use. */
  activationUsage: {},
  /* Aggregate counters for the activation-code system. `redeemed` and
     `totalReceived` track codes this player has cashed in on this
     device; `generated` tracks codes this admin has produced.
     `history` is the admin's last 10 generated codes (newest first),
     each `{ code, id, amount, maxUses, at }`. All four fields are read
     by the Activate-code shop tab and the Admin screen. */
  activations: { redeemed: 0, totalReceived: 0, generated: 0, history: [] },
  stats: { games:0, best:0, bestRun:0, totalScore:0, totalTimeMs:0, lines:0, bestCombo:0, placedTotal:0, xp:0 },
  settings: {
    lang: "uk",
    sound: true,
    vibration: true,
    theme: "dark",
    /* "auto" detects from screen width on each launch.
       "pc" / "laptop" / "tablet" / "phone" pin a specific layout density. */
    device: "auto",
    /* When true the chosen device is restored on every future login.
       When false the user is asked again on the next login screen. */
    rememberDevice: true,
  },
  achievements: new Set(), // ids
  hidden: { firstPlace:false, tripleClear:false, quadClear:false, speedrun:false, pacifist:false, survivor:false, cleaner:false },
  dailyTasks: { date:"", tasks:[] },
  leaderboards: [], // simulated global pool
  /* HEX coin wallet. `coins` is the spendable balance; `lastDailyClaim`
     is the unix ms at which the daily reward was last claimed. The
     reward is gated to "today after 11:00 local" and a single claim
     per calendar day — see scripts/wallet.js. */
  wallet: { coins: 0, lastDailyClaim: 0 },
  /* Piece-skin inventory. `equipped` is the active palette id; the
     definitions live in scripts/skins.js. Every player starts with
     the default skin already unlocked. */
  skins:  { equipped: "default", unlocked: ["default"] },
  /* ----- Battle Pass -----
     Seasonal progression track. `season` is the season id the player
     is currently on (e.g. "2026-01"); changing season resets XP and
     claim ledgers (the wallet/skins are kept). `xp` is current-season
     XP; `claimedFree` / `claimedPremium` are arrays of tier indexes the
     player has already claimed; `premium` flips on after the player
     buys the premium track (or admin grants it). */
  battlepass: {
    season: "",
    xp: 0,
    claimedFree: [],
    claimedPremium: [],
    premium: false,
  },
  /* ----- Seasonal event -----
     Tracks which seasonal cosmetic packs the player has already
     unlocked. The list of available seasonal skins is defined in
     scripts/season.js and rotates with `seasonId()`. */
  seasonal: {
    unlocked: [],
  },
  /* ----- Mastery per skin -----
     Per-skin XP plus the highest claimed tier (so we can show "Lvl X"
     badges in the shop). Keyed by skin id. */
  mastery: {},
  /* ----- Custom skin inventory -----
     `owned` is the player's catalogue of self-made skins
     (each: { id, name, palette[6], accent, createdAt }).
     `equipped` mirrors skins.equipped when a custom skin is active
     so the renderer can resolve the palette. `lastListedAt` is the
     unix ms of the last marketplace listing — used to enforce the
     once-per-24h rule for non-admin players. */
  customSkins: {
    owned: [],
    equipped: "",
    lastListedAt: 0,
  },
  /* ----- Marketplace -----
     Local-device pool of listings created by this player + admin
     curated listings seeded on first run. Buyers can purchase any
     listing for HEX; once purchased the entry is removed and the
     skin is copied into `customSkins.owned`. */
  marketplace: {
    listings: [],
    purchased: [],
  },
  // live, not persisted
  run: null,
};

/* ---------- XP / Level ---------- */
function levelInfo(totalXp){
  // levels grow: need(level) = 80 + level*40
  let lvl = 1, remaining = totalXp;
  while(true){
    const need = 80 + (lvl-1)*40;
    if(remaining < need) return { lvl, into: remaining, need };
    remaining -= need;
    lvl++;
    if(lvl > 999) return { lvl, into: 0, need: 80 + (lvl-1)*40 };
  }
}
function addXP(n){
  const before = levelInfo(state.stats.xp).lvl;
  state.stats.xp = (state.stats.xp||0) + n;
  const after = levelInfo(state.stats.xp).lvl;
  if(after > before){
    toast(t("toast.lvlup",{n:after}), "success");
    if(window.fx) fx.celebrateLevelUp(after);
    else { if(typeof sfx !== "undefined") sfx.lvlup(); vibrate(30); }
  }
}

