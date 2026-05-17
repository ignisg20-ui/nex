/* ---------- Custom skins & marketplace ----------
   Players design their own piece palette ("texture") from 6 base
   colours. The result is saved into `state.customSkins.owned` and
   shows up in the skin shop next to the catalogue skins.

   Each custom skin can be put up for sale on the local marketplace
   for a HEX price. To prevent spam, regular players can only post
   ONE listing per rolling 24 hours; admins are exempt and can post
   as many as they like, as often as they like.

   The marketplace is local-only (this app has no backend yet) but
   the API surface is shaped so a real network can be wired in
   later — `state.marketplace.listings` is just an array of
   listings, identical to what a server would return. We seed a
   handful of curated admin listings the first time the marketplace
   is opened so it's not empty for fresh installs. */

const CUSTOM_LISTING_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const CUSTOM_LISTING_MIN_PRICE   = 100;
const CUSTOM_LISTING_MAX_PRICE   = 1000000;
const CUSTOM_SKIN_TEXTURES = 6;

/* Curated seed listings — only added the very first time the
   marketplace state is empty AND no purchases have been recorded.
   They look like community-uploaded textures so the marketplace
   has something to browse on day one. */
const MARKETPLACE_SEED = [
  {
    id: "seed-volcano", sellerId: "ADMIN", sellerName: "ADMIN",
    name: "Volcano Forge", price: 1500,
    palette: ["#ff3d00","#ff7a3d","#ffb347","#ffe0b3","#7c1f1f","#3b0a0a"],
    accent: "#ff7a3d", listedAt: 0,
  },
  {
    id: "seed-deepsea", sellerId: "ADMIN", sellerName: "ADMIN",
    name: "Deep Sea", price: 1500,
    palette: ["#053e6e","#0a5a99","#1d8acb","#5cb8e6","#a9d6ef","#dff0fa"],
    accent: "#1d8acb", listedAt: 0,
  },
  {
    id: "seed-candy", sellerId: "ADMIN", sellerName: "ADMIN",
    name: "Candy Pop", price: 1800,
    palette: ["#ff5a8c","#ffa1c3","#ffe0eb","#ffd86b","#9be1d5","#9b8df7"],
    accent: "#ff5a8c", listedAt: 0,
  },
  {
    id: "seed-shadow", sellerId: "ADMIN", sellerName: "ADMIN",
    name: "Shadow Pulse", price: 2400,
    palette: ["#0b0f1a","#1f2937","#374151","#7c5cff","#a766ff","#22d3ee"],
    accent: "#7c5cff", listedAt: 0,
  },
  {
    id: "seed-meadow", sellerId: "ADMIN", sellerName: "ADMIN",
    name: "Meadow", price: 2000,
    palette: ["#1d6c3a","#2da25b","#7fd09f","#c1f0c1","#fff6c1","#fff299"],
    accent: "#2da25b", listedAt: 0,
  },
];

function ensureMarketplace(){
  if (!state.marketplace) state.marketplace = { listings: [], purchased: [] };
  if (!Array.isArray(state.marketplace.listings))  state.marketplace.listings  = [];
  if (!Array.isArray(state.marketplace.purchased)) state.marketplace.purchased = [];
  if (state.marketplace.listings.length === 0 && state.marketplace.purchased.length === 0){
    /* First open — seed the curated listings. */
    state.marketplace.listings = MARKETPLACE_SEED.map(s => ({ ...s, listedAt: Date.now() }));
    saveState();
  }
}

function ensureCustomInv(){
  if (!state.customSkins) state.customSkins = { owned: [], equipped: "", lastListedAt: 0 };
  if (!Array.isArray(state.customSkins.owned)) state.customSkins.owned = [];
}

function customSkinById(id){
  ensureCustomInv();
  return state.customSkins.owned.find(s => s.id === id) || null;
}

function isCustomSkinId(id){
  return typeof id === "string" && id.indexOf("custom_") === 0;
}

function newCustomId(){
  return "custom_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7);
}

/* Default palette used when opening the editor for the first
   time — visually distinct from the base skins so it's obvious
   the user can start customising. */
const CUSTOM_DEFAULT_PALETTE = [
  "#ff5a3d","#ffb454","#3ddc97","#24bdff","#7c5cff","#f472b6",
];

/* Author a new (or edited) custom skin. Returns the saved record. */
function saveCustomSkin({ id, name, palette, accent }){
  ensureCustomInv();
  if (!Array.isArray(palette) || palette.length !== CUSTOM_SKIN_TEXTURES) return null;
  /* Sanitize the 6 textures into safe hex colours; reject anything
     that's not a #rrggbb string so the renderer can't be poisoned
     by free-form input. */
  const clean = [];
  for (const c of palette){
    if (!/^#[0-9a-fA-F]{6}$/.test(String(c))) return null;
    clean.push(String(c).toLowerCase());
  }
  const safeAccent = /^#[0-9a-fA-F]{6}$/.test(String(accent)) ? String(accent).toLowerCase() : clean[0];
  const safeName = String(name || "Custom").trim().slice(0, 24) || "Custom";
  let rec;
  if (id){
    rec = customSkinById(id);
    if (rec){
      rec.name = safeName;
      rec.palette = clean;
      rec.accent = safeAccent;
    }
  }
  if (!rec){
    rec = {
      id: newCustomId(),
      name: safeName,
      palette: clean,
      accent: safeAccent,
      createdAt: Date.now(),
    };
    state.customSkins.owned.push(rec);
  }
  /* Make sure SKINS knows about this id so renderTray etc. can
     resolve the palette. */
  if (typeof SKINS !== "undefined"){
    SKINS[rec.id] = {
      name: rec.name,
      price: 0,
      accent: rec.accent,
      palette: rec.palette,
      custom: true,
    };
  }
  /* Custom skins are always "owned" — also add to skins.unlocked
     for back-compat with isSkinUnlocked(). */
  if (state.skins && Array.isArray(state.skins.unlocked) && state.skins.unlocked.indexOf(rec.id) < 0){
    state.skins.unlocked.push(rec.id);
  }
  saveState();
  return rec;
}

function deleteCustomSkin(id){
  ensureCustomInv();
  state.customSkins.owned = state.customSkins.owned.filter(s => s.id !== id);
  if (state.skins){
    state.skins.unlocked = (state.skins.unlocked || []).filter(x => x !== id);
    if (state.skins.equipped === id) state.skins.equipped = "default";
  }
  if (typeof SKINS !== "undefined") delete SKINS[id];
  saveState();
}

function listingsCooldownLeftMs(){
  ensureCustomInv();
  if ((typeof isAdminUser === "function") && isAdminUser()) return 0;
  const last = state.customSkins.lastListedAt | 0;
  const now = Date.now();
  const left = (last + CUSTOM_LISTING_COOLDOWN_MS) - now;
  return Math.max(0, left);
}

function canListNow(){
  return listingsCooldownLeftMs() === 0;
}

function listCustomSkin(skinId, priceRaw){
  ensureCustomInv();
  ensureMarketplace();
  const rec = customSkinById(skinId);
  if (!rec){
    toast(t("custom.toast.notFound") || "Custom skin not found", "info");
    return false;
  }
  const price = Math.max(CUSTOM_LISTING_MIN_PRICE, Math.min(CUSTOM_LISTING_MAX_PRICE, parseInt(priceRaw, 10) || 0));
  if (price <= 0){
    toast(t("custom.toast.badPrice") || "Set a price first", "info");
    return false;
  }
  if (!canListNow()){
    const hLeft = Math.ceil(listingsCooldownLeftMs() / 3600000);
    toast(((t("custom.toast.cooldown") || "Wait {n}h to list again").replace("{n}", hLeft)), "info");
    return false;
  }
  const listing = {
    id: "list_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7),
    sellerId:   state.profile.id || "—",
    sellerName: state.profile.nickname || "Player",
    name: rec.name,
    price: price,
    palette: rec.palette.slice(),
    accent: rec.accent,
    listedAt: Date.now(),
    /* keep a reference back to the source skin id so duplicates
       can be deduped client-side. */
    source: skinId,
  };
  state.marketplace.listings.unshift(listing);
  /* Cap the marketplace at a reasonable size to keep render snappy. */
  if (state.marketplace.listings.length > 100){
    state.marketplace.listings = state.marketplace.listings.slice(0, 100);
  }
  const admin = (typeof isAdminUser === "function") && isAdminUser();
  if (!admin) state.customSkins.lastListedAt = Date.now();
  saveState();
  toast(t("custom.toast.listed") || "Listing posted", "success");
  return true;
}

function unlistCustomSkin(listingId){
  ensureMarketplace();
  state.marketplace.listings = state.marketplace.listings.filter(l => l.id !== listingId);
  saveState();
}

function buyMarketplaceListing(listingId){
  ensureMarketplace();
  ensureCustomInv();
  const idx = state.marketplace.listings.findIndex(l => l.id === listingId);
  if (idx < 0) return false;
  const listing = state.marketplace.listings[idx];
  /* Can't buy your own listing. */
  if (listing.sellerId === state.profile.id){
    toast(t("custom.toast.ownListing") || "That's your listing", "info");
    return false;
  }
  if (typeof spendCoins !== "function" || !spendCoins(listing.price)){
    toast(t("shop.skin.poor") || "Not enough HEX", "info");
    return false;
  }
  /* Copy the listing into the buyer's owned customs and remove
     it from the marketplace pool. */
  const rec = saveCustomSkin({
    name: listing.name + " · " + listing.sellerName,
    palette: listing.palette,
    accent: listing.accent,
  });
  state.marketplace.purchased.push({
    listingId: listing.id, at: Date.now(), price: listing.price,
    sellerId: listing.sellerId, sellerName: listing.sellerName,
    skinId: rec ? rec.id : "",
  });
  state.marketplace.listings.splice(idx, 1);
  saveState();
  toast(t("custom.toast.bought") || "Skin purchased", "success");
  return rec;
}

/* ---------- Rendering ---------- */
function renderCustomEditor(){
  const panel = document.getElementById("shop-pane-custom");
  if (!panel) return;
  ensureCustomInv();
  /* Pick a working draft: either the last-edited custom skin, or
     a blank one with the default palette. We stash the draft on
     the panel element so re-renders preserve the in-progress
     state without persisting it. */
  if (!panel.dataset.draftInited){
    panel.dataset.draftInited = "1";
    panel._draft = {
      id: "",
      name: "Custom #" + ((state.customSkins.owned.length || 0) + 1),
      palette: CUSTOM_DEFAULT_PALETTE.slice(),
      accent: CUSTOM_DEFAULT_PALETTE[0],
    };
  }
  const draft = panel._draft;

  let html = '';
  html += '<div class="shop-pane-hint">'+ (t("custom.editor.hint") || "Design 6 textures for your figures. Save to your collection, then list it on the market.") +'</div>';
  html += '<div class="custom-editor glass">';
  html += '  <div class="custom-editor-name">';
  html += '    <label data-i18n="custom.editor.name">Name</label>';
  html += '    <input type="text" id="custom-name" maxlength="24" value="'+ String(draft.name).replace(/"/g,"&quot;") +'">';
  html += '  </div>';
  html += '  <div class="custom-editor-row">';
  for (let i = 0; i < CUSTOM_SKIN_TEXTURES; i++){
    html += '<label class="custom-cell" data-idx="'+ i +'">';
    html += '  <input class="custom-cell-input" type="color" value="'+ draft.palette[i] +'" data-idx="'+ i +'">';
    html += '  <span class="custom-cell-swatch" style="background:'+ draft.palette[i] +'"></span>';
    html += '  <b class="custom-cell-num">'+ (i+1) +'</b>';
    html += '</label>';
  }
  html += '  </div>';
  html += '  <div class="custom-editor-preview"><b data-i18n="custom.editor.preview">Preview</b>';
  /* Mini preview: 3 pieces using the new palette so the user sees
     what their textures look like on real figures. */
  html += '    <div class="custom-preview-pieces" id="custom-preview"></div>';
  html += '  </div>';
  html += '  <div class="custom-editor-actions">';
  html += '    <button class="btn btn-primary" id="custom-save">'+ (t("custom.editor.save") || "Save to my skins") +'</button>';
  html += '    <button class="btn" id="custom-reset">'+ (t("custom.editor.reset") || "Reset") +'</button>';
  html += '  </div>';
  html += '</div>';

  /* My customs list */
  html += '<div class="custom-list">';
  html += '  <h3 class="custom-list-title">'+ (t("custom.list.title") || "Your custom skins") +'</h3>';
  if (state.customSkins.owned.length === 0){
    html += '<div class="custom-empty">'+ (t("custom.list.empty") || "No custom skins yet.") +'</div>';
  } else {
    state.customSkins.owned.forEach(s => {
      const equipped = (typeof currentSkinId === "function") && currentSkinId() === s.id;
      html += '<div class="custom-card" data-id="'+ s.id +'">';
      html += '  <div class="custom-card-strip">';
      for (let i = 0; i < CUSTOM_SKIN_TEXTURES; i++){
        html += '<i style="background:'+ (s.palette[i] || s.accent) +'"></i>';
      }
      html += '  </div>';
      html += '  <div class="custom-card-name">'+ s.name +'</div>';
      html += '  <div class="custom-card-actions">';
      if (equipped){
        html += '<span class="custom-card-on">'+ (t("shop.skin.active") || "Active") +'</span>';
      } else {
        html += '<button class="btn btn-primary" data-equip="'+ s.id +'">'+ (t("shop.skin.equip") || "Equip") +'</button>';
      }
      html += '<button class="btn" data-edit="'+ s.id +'">'+ (t("custom.card.edit") || "Edit") +'</button>';
      html += '<button class="btn btn-ghost" data-list="'+ s.id +'">'+ (t("custom.card.list") || "List on market") +'</button>';
      html += '<button class="btn btn-ghost" data-del="'+ s.id +'">'+ (t("custom.card.delete") || "Delete") +'</button>';
      html += '  </div>';
      html += '</div>';
    });
  }
  html += '</div>';

  panel.innerHTML = html;
  if (typeof applyI18n === "function") applyI18n();
  customRenderPreview(draft);
  customWireEditor(panel, draft);
}

function customRenderPreview(draft){
  const wrap = document.getElementById("custom-preview");
  if (!wrap) return;
  /* 3 sample shapes painted with consecutive draft palette slots. */
  const shapes = [
    [[1,1,1],[0,1,0]],
    [[1,1],[1,1]],
    [[1,1,1,1]],
  ];
  wrap.innerHTML = "";
  shapes.forEach((shape, sIdx) => {
    const color = draft.palette[(sIdx*2) % draft.palette.length];
    const fl = document.createElement("div");
    fl.className = "custom-preview-piece";
    fl.style.gridTemplateColumns = "repeat("+ shape[0].length +", 14px)";
    for (let r = 0; r < shape.length; r++){
      for (let c = 0; c < shape[0].length; c++){
        const cell = document.createElement("div");
        cell.className = "custom-preview-cell" + (shape[r][c] ? "" : " gap");
        cell.style.setProperty("--cell-color", color);
        fl.appendChild(cell);
      }
    }
    wrap.appendChild(fl);
  });
}

function customWireEditor(panel, draft){
  const nameInput = panel.querySelector("#custom-name");
  if (nameInput) nameInput.addEventListener("input", () => { draft.name = nameInput.value; });

  panel.querySelectorAll(".custom-cell-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const i = parseInt(inp.dataset.idx, 10) || 0;
      const v = String(inp.value).toLowerCase();
      if (/^#[0-9a-f]{6}$/.test(v)){
        draft.palette[i] = v;
        const sw = panel.querySelectorAll(".custom-cell-swatch")[i];
        if (sw) sw.style.background = v;
        if (i === 0) draft.accent = v;
        customRenderPreview(draft);
      }
    });
  });

  panel.querySelector("#custom-save").addEventListener("click", () => {
    const rec = saveCustomSkin(draft);
    if (rec){
      toast(t("custom.toast.saved") || "Custom skin saved", "success");
      /* Reset the draft so subsequent saves create new entries. */
      delete panel.dataset.draftInited;
      renderCustomEditor();
      if (typeof renderShop === "function") renderShop();
    }
  });
  panel.querySelector("#custom-reset").addEventListener("click", () => {
    delete panel.dataset.draftInited;
    renderCustomEditor();
  });

  panel.querySelectorAll("[data-equip]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.equip;
    /* Make sure SKINS map is up to date for legacy save imports
       (they wouldn't have re-registered on this session). */
    const rec = customSkinById(id);
    if (rec && typeof SKINS !== "undefined" && !SKINS[id]){
      SKINS[id] = { name: rec.name, price: 0, accent: rec.accent, palette: rec.palette, custom: true };
    }
    if (typeof equipSkin === "function" && equipSkin(id)){
      renderCustomEditor();
    }
  }));
  panel.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.edit;
    const rec = customSkinById(id);
    if (!rec) return;
    delete panel.dataset.draftInited;
    panel._draft = { id: rec.id, name: rec.name, palette: rec.palette.slice(), accent: rec.accent };
    panel.dataset.draftInited = "1";
    renderCustomEditor();
  }));
  panel.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.del;
    deleteCustomSkin(id);
    renderCustomEditor();
    if (typeof renderShop === "function") renderShop();
  }));
  panel.querySelectorAll("[data-list]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.list;
    openListingModal(id);
  }));
}

/* ---------- Marketplace pane ---------- */
function renderMarketplace(){
  const panel = document.getElementById("shop-pane-market");
  if (!panel) return;
  ensureMarketplace();
  ensureCustomInv();
  const admin = (typeof isAdminUser === "function") && isAdminUser();
  const cooldown = listingsCooldownLeftMs();
  const fmt = (typeof formatCoins === "function") ? formatCoins : String;

  let html = '';
  html += '<div class="shop-pane-hint">'+ (t("market.hint") || "Buy custom textures from other players for HEX.") +'</div>';

  html += '<div class="market-status glass">';
  if (admin){
    html += '<div class="market-status-line">'+ (t("market.admin.note") || "Admin · unlimited listings") +'</div>';
  } else if (cooldown > 0){
    const h = Math.ceil(cooldown / 3600000);
    html += '<div class="market-status-line">'+ ((t("market.cooldown") || "Next listing available in {n}h").replace("{n}", h)) +'</div>';
  } else {
    html += '<div class="market-status-line">'+ (t("market.canList") || "Ready to list one custom skin") +'</div>';
  }
  html += '</div>';

  html += '<div class="market-grid">';
  if (state.marketplace.listings.length === 0){
    html += '<div class="market-empty">'+ (t("market.empty") || "No listings yet — be the first!") +'</div>';
  } else {
    state.marketplace.listings.forEach(l => {
      const isMine = l.sellerId === state.profile.id;
      html += '<div class="market-card glass" data-id="'+ l.id +'">';
      html += '  <div class="market-card-strip">';
      for (let i = 0; i < CUSTOM_SKIN_TEXTURES; i++){
        html += '<i style="background:'+ (l.palette[i] || l.accent) +'"></i>';
      }
      html += '  </div>';
      html += '  <div class="market-card-name">'+ l.name +'</div>';
      html += '  <div class="market-card-seller">'+ (t("market.by") || "by") +' <b>'+ l.sellerName +'</b></div>';
      html += '  <div class="market-card-foot">';
      html += '    <div class="market-price mono"><svg class="ic-svg"><use href="#i-coin"/></svg> '+ fmt(l.price) +'</div>';
      if (isMine || admin){
        html += '    <button class="btn btn-ghost" data-unlist="'+ l.id +'">'+ (t("market.unlist") || "Unlist") +'</button>';
      } else {
        html += '    <button class="btn btn-primary" data-buy="'+ l.id +'">'+ (t("market.buy") || "Buy") +'</button>';
      }
      html += '  </div>';
      html += '</div>';
    });
  }
  html += '</div>';

  panel.innerHTML = html;
  if (typeof applyI18n === "function") applyI18n();
  panel.querySelectorAll("[data-buy]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.buy;
    if (buyMarketplaceListing(id)){
      renderMarketplace();
      if (typeof renderShop === "function") renderShop();
    }
  }));
  panel.querySelectorAll("[data-unlist]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.unlist;
    unlistCustomSkin(id);
    renderMarketplace();
  }));
}

/* ---------- Listing modal ----------
   Built dynamically because we don't want a permanent DOM node
   for an action that's used rarely. Returns silently if the
   target skin doesn't exist. */
function openListingModal(skinId){
  ensureMarketplace();
  ensureCustomInv();
  const rec = customSkinById(skinId);
  if (!rec) return;
  const back = document.createElement("div");
  back.className = "modal-back show active";
  back.id = "modal-list-skin";
  const cd = listingsCooldownLeftMs();
  const admin = (typeof isAdminUser === "function") && isAdminUser();
  const fmt = (typeof formatCoins === "function") ? formatCoins : String;
  const strip = rec.palette.map(c => '<i style="background:'+ c +'"></i>').join("");

  back.innerHTML =
    '<div class="modal glass list-skin-modal" role="dialog" aria-modal="true">'+
    '  <h2>'+ (t("custom.list.title2") || "List on marketplace") +'</h2>'+
    '  <p>'+ (t("custom.list.sub") || "Set a HEX price for your custom texture.") +'</p>'+
    '  <div class="list-skin-strip">'+ strip +'</div>'+
    '  <div class="list-skin-row">'+
    '    <label>'+ (t("custom.list.priceLabel") || "Price (HEX)") +'</label>'+
    '    <input type="number" id="list-skin-price" min="'+ CUSTOM_LISTING_MIN_PRICE +'" max="'+ CUSTOM_LISTING_MAX_PRICE +'" value="1000">'+
    '  </div>'+
    (admin ? '' :
      (cd > 0
        ? '<div class="list-skin-cool">'+ ((t("custom.list.cooldown") || "You can list again in {n}h").replace("{n}", Math.ceil(cd/3600000))) +'</div>'
        : '<div class="list-skin-cool ok">'+ (t("custom.list.ready") || "You can list now (then wait 24h)") +'</div>'
      ))+
    '  <div class="modal-actions">'+
    '    <button class="btn btn-primary" id="list-skin-go">'+ (t("custom.list.btn") || "Post listing") +'</button>'+
    '    <button class="btn" id="list-skin-cancel">'+ (t("shop.confirm.no") || "Cancel") +'</button>'+
    '  </div>'+
    '</div>';
  document.body.appendChild(back);

  const close = () => back.remove();
  back.querySelector("#list-skin-cancel").addEventListener("click", close);
  back.addEventListener("click", (ev) => { if (ev.target === back) close(); });
  back.querySelector("#list-skin-go").addEventListener("click", () => {
    const price = parseInt(back.querySelector("#list-skin-price").value, 10) || 0;
    if (listCustomSkin(skinId, price)){
      close();
      if (typeof renderShop === "function") renderShop();
      if (typeof renderMarketplace === "function") renderMarketplace();
    }
  });
}

/* Ensure SKINS gets the customs back into its registry on every
   page boot, even before the user opens the editor. Called by
   main.js right after the saved state is loaded. */
function rehydrateCustomSkins(){
  ensureCustomInv();
  if (typeof SKINS === "undefined") return;
  state.customSkins.owned.forEach(rec => {
    SKINS[rec.id] = {
      name: rec.name,
      price: 0,
      accent: rec.accent,
      palette: rec.palette,
      custom: true,
    };
    if (state.skins && Array.isArray(state.skins.unlocked) && state.skins.unlocked.indexOf(rec.id) < 0){
      state.skins.unlocked.push(rec.id);
    }
  });
}
