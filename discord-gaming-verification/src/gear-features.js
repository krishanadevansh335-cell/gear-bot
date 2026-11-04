import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle
} from 'discord.js';

export const IDS = {
  DEAL_HUNTER_ROLE_ID: '1567637664981590188',
  BATTLESTATION_KING_ROLE_ID: '1567637666974007397',
  MARKETPLACE_CHANNEL_ID: '1567637669373153290',
  BUILD_ADVICE_CHANNEL_ID: '1567637672326078494',
  RATE_SETUP_CHANNEL_ID: '1567632407803330581'
};

export const BUILD_PRESETS = {
  '30k': {
    title: '₹30K - ₹35K Esports APU Starter',
    tier: 'Budget 1080p Esports',
    color: 0x3B82F6, // Blue
    target: '1080p Competitive (CS2, Valorant, GTA 5, Rocket League)',
    price: '~₹31,500',
    parts: [
      '• **Processor (CPU):** AMD Ryzen 5 5600G (6C/12T, Vega 7 iGPU) — `₹10,800`',
      '• **Motherboard:** MSI B450M-A PRO MAX II — `₹4,600`',
      '• **RAM:** 16GB (2x8GB) Corsair Vengeance LPX DDR4 3200MHz — `₹3,200`',
      '• **Storage:** Crucial P3 500GB M.2 PCIe 3.0 NVMe SSD — `₹2,900`',
      '• **Power Supply (PSU):** Cooler Master MWE 450W 80+ Bronze — `₹2,600`',
      '• **Cabinet:** Ant Esports ICE-100 Auto RGB with Mesh Front — `₹2,400`'
    ],
    fps: [
      '• **Valorant (1080p Low):** 160 - 220 FPS',
      '• **CS2 (1080p Low):** 90 - 130 FPS',
      '• **GTA 5 (1080p Normal):** 60 - 75 FPS',
      '• **Dota 2 / LoL (1080p High):** 110+ FPS'
    ],
    upgradePath: 'Add an RX 6600 or RTX 3060 down the road for triple the gaming performance without changing CPU!'
  },

  '50k': {
    title: '₹50K - ₹55K 1080p Ultra High-FPS Beast',
    tier: 'Best Value 1080p Dedicated GPU',
    color: 0x10B981, // Emerald
    target: '1080p Max Settings on modern AAA games & High-Refresh Esports',
    price: '~₹51,800',
    parts: [
      '• **Processor (CPU):** Intel Core i3-12100F (4C/8T, 4.3GHz Boost) — `₹7,200`',
      '• **Graphics Card (GPU):** AMD Radeon RX 6600 8GB GDDR6 (ASRock / Sapphire) — `₹19,800`',
      '• **Motherboard:** MSI PRO H610M-E DDR4 — `₹5,800`',
      '• **RAM:** 16GB (2x8GB) G.Skill Ripjaws V DDR4 3200MHz CL16 — `₹3,300`',
      '• **Storage:** Kingston NV2 1TB Gen 4x4 M.2 NVMe (3500 MB/s) — `₹5,400`',
      '• **Power Supply (PSU):** Deepcool PK550D 550W 80+ Bronze — `₹3,400`',
      '• **Cabinet:** Galax Revolution-05 (4x 120mm Fans Included) — `₹3,200`'
    ],
    fps: [
      '• **Cyberpunk 2077 (1080p Ultra/FSR):** 65 - 80 FPS',
      '• **Valorant / CS2 (1080p High):** 280+ FPS',
      '• **Warzone / Apex Legends (1080p Balanced):** 95 - 120 FPS',
      '• **Forza Horizon 5 (1080p Ultra):** 85 - 100 FPS'
    ],
    upgradePath: 'Swap CPU to i5-13400F or Ryzen 5600 for heavy streaming/video editing workloads.'
  },

  '80k': {
    title: '₹80K - ₹85K 1440p Sweet Spot (AM5 Platform)',
    tier: 'Next-Gen DDR5 1440p Gaming',
    color: 0xF59E0B, // Amber
    target: '1440p High/Ultra Gaming with DLSS / Ray Tracing & Future Proofing',
    price: '~₹82,500',
    parts: [
      '• **Processor (CPU):** AMD Ryzen 5 7600 (AM5, 6C/12T, Zen 4 5.1GHz) — `₹17,800`',
      '• **Graphics Card (GPU):** NVIDIA GeForce RTX 4060 8GB (Zotac / MSI) — `₹28,500`',
      '• **Motherboard:** MSI PRO B650M-P DDR5 — `₹9,800`',
      '• **RAM:** 32GB (2x16GB) G.Skill Flare X5 DDR5 6000MHz CL30 (EXPO) — `₹8,900`',
      '• **Storage:** WD Black SN770 1TB PCIe Gen4 NVMe (5150 MB/s) — `₹6,400`',
      '• **Power Supply (PSU):** Cooler Master MWE 650W V2 80+ Bronze — `₹4,900`',
      '• **Cabinet:** Deepcool CC560 V2 High-Airflow Mesh — `₹4,200`'
    ],
    fps: [
      '• **Black Myth Wukong (1440p DLSS Quality):** 65 - 75 FPS',
      '• **Cyberpunk 2077 (1440p DLSS Ultra):** 75 - 90 FPS',
      '• **Valorant (1440p Competitive):** 400+ FPS',
      '• **Apex Legends (1440p High):** 140 - 175 FPS'
    ],
    upgradePath: 'AM5 platform supports future AMD Ryzen 9000 & X3D chips until 2027+ without a new motherboard!'
  },

  '120k': {
    title: '₹1.2L - ₹1.35L 1440p Esports Monster',
    tier: 'High-End 1440p 165Hz+ Max Settings',
    color: 0x8B5CF6, // Purple
    target: 'Maxed-out 1440p Ray Tracing & Frame Generation in all current AAA titles',
    price: '~₹1,26,000',
    parts: [
      '• **Processor (CPU):** AMD Ryzen 5 7600X (AM5, 5.3GHz Boost) — `₹19,800`',
      '• **CPU Cooler:** Deepcool AK400 Digital / AG620 Dual Tower — `₹3,400`',
      '• **Graphics Card (GPU):** NVIDIA GeForce RTX 4070 Super 12GB GDDR6X — `₹58,500`',
      '• **Motherboard:** MSI B650 Gaming Plus WiFi — `₹15,200`',
      '• **RAM:** 32GB (2x16GB) G.Skill Trident Z5 Neo RGB DDR5 6000MHz CL30 — `₹9,800`',
      '• **Storage:** Crucial T500 1TB PCIe 4.0 NVMe (7300 MB/s) — `₹7,800`',
      '• **Power Supply (PSU):** Corsair RM750e 750W 80+ Gold ATX 3.0 Modular — `₹8,500`',
      '• **Cabinet:** Lian Li Lancool 216 ARGB Dual 160mm Airflow — `₹7,500`'
    ],
    fps: [
      '• **Cyberpunk 2077 (1440p Ray Tracing Overdrive + Frame Gen):** 90 - 110 FPS',
      '• **Black Myth Wukong (1440p Cinematic DLSS 3):** 85 - 105 FPS',
      '• **Warzone 3 (1440p Ultra):** 150 - 180 FPS',
      '• **CS2 / Valorant (1440p):** 500+ FPS'
    ],
    upgradePath: 'Drop in a Ryzen 7 7800X3D for ultimate esports minimum frame stability.'
  },

  '200k': {
    title: '₹2 Lakh+ 4K God Tier Enthusiast Rig',
    tier: 'Top 1% Enthusiast 4K Battlestation',
    color: 0xEC4899, // Pink / Magenta
    target: 'Native 4K Path Tracing, Ultra High FPS Streaming & Heavy 3D Workloads',
    price: '~₹2,15,000',
    parts: [
      '• **Processor (CPU):** AMD Ryzen 7 7800X3D (World\'s Best Gaming CPU) — `₹39,800`',
      '• **Liquid Cooler (AIO):** Arctic Liquid Freezer III 360 A-RGB — `₹9,900`',
      '• **Graphics Card (GPU):** NVIDIA GeForce RTX 4080 Super 16GB GDDR6X — `₹98,500`',
      '• **Motherboard:** ASUS TUF Gaming B650-PLUS WiFi — `₹18,500`',
      '• **RAM:** 32GB (2x16GB) G.Skill Trident Z5 Neo RGB DDR5 6000MHz CL30 — `₹10,500`',
      '• **Storage:** Kingston KC3000 2TB PCIe 4.0 NVMe (7000 MB/s) — `₹14,200`',
      '• **Power Supply (PSU):** Corsair RM850x Shift 850W 80+ Gold PCIe 5.0 — `₹12,800`',
      '• **Cabinet:** NZXT H9 Flow / Lian Li O11 Dynamic EVO Dual Chamber — `₹13,800`'
    ],
    fps: [
      '• **Cyberpunk 2077 (4K Path Tracing + DLSS 3.5):** 80 - 95 FPS',
      '• **Black Myth Wukong (4K Cinematic DLSS):** 75 - 90 FPS',
      '• **Forza Horizon 5 (4K Extreme):** 140+ FPS',
      '• **Valorant / CS2 (4K Native):** 600+ FPS'
    ],
    upgradePath: 'Enthusiast platform with PCIe 5.0 and ATX 3.0 ready for RTX 50-series next-gen.'
  }
};

export function buildPresetEmbed(presetKey) {
  const p = BUILD_PRESETS[presetKey];
  if (!p) return null;

  return new EmbedBuilder()
    .setColor(p.color)
    .setAuthor({ name: `GAMING SHAMING // INDIAN PC RIG ARCHITECT`, iconURL: 'https://cdn-icons-png.flaticon.com/512/879/879757.png' })
    .setTitle(`🖥️ ${p.title} (${p.price})`)
    .setDescription([
      `**Category:** \`${p.tier}\``,
      `**Target Resolution & Workload:** ${p.target}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '### 🛠️ Balanced Component Breakdown (India Retail):',
      p.parts.join('\n'),
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '### 🎮 Realistic In-Game Performance:',
      p.fps.join('\n'),
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `💡 **Upgrade Path:** *${p.upgradePath}*`
    ].join('\n'))
    .setFooter({ text: 'Prices verified across MDComputers, Vedant, EliteHubs & Amazon.in • GAMING SHAMING' })
    .setTimestamp();
}

export function buildMarketModal() {
  const modal = new ModalBuilder()
    .setCustomId('market_sell_modal')
    .setTitle('Create Hardware Market Listing');

  const typeInput = new TextInputBuilder()
    .setCustomId('market_type')
    .setLabel('Listing Type:')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Type [WTS] for Selling or [WTB] for Buying')
    .setValue('[WTS] Selling')
    .setRequired(true);

  const itemInput = new TextInputBuilder()
    .setCustomId('market_item')
    .setLabel('Item Name & Exact Model:')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Keychron K2 V2 Wireless / Zotac RTX 3060 12GB')
    .setRequired(true);

  const priceInput = new TextInputBuilder()
    .setCustomId('market_price')
    .setLabel('Expected Price in INR (₹):')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. ₹3,500 (Firm) or ₹18,000 (Slightly Negotiable)')
    .setRequired(true);

  const conditionInput = new TextInputBuilder()
    .setCustomId('market_condition')
    .setLabel('Condition, Age & Warranty:')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('e.g. 9/10 condition, 7 months used. Original box & bill available. Warranty valid till 2026.')
    .setRequired(true);

  const locationInput = new TextInputBuilder()
    .setCustomId('market_location')
    .setLabel('Location & Shipping Preference:')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Delhi NCR (Local pickup preferred, All-India shipping possible)')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(typeInput),
    new ActionRowBuilder().addComponents(itemInput),
    new ActionRowBuilder().addComponents(priceInput),
    new ActionRowBuilder().addComponents(conditionInput),
    new ActionRowBuilder().addComponents(locationInput)
  );

  return modal;
}

export function formatMarketEmbed(data, author) {
  const isSelling = data.type.toUpperCase().includes('WTS') || data.type.toUpperCase().includes('SELL');
  const typeTag = isSelling ? '🔴 [WTS - FOR SALE]' : '🟢 [WTB - LOOKING TO BUY]';
  const color = isSelling ? 0xEF4444 : 0x10B981;

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ 
      name: `${author.displayName} (${author.tag})`, 
      iconURL: author.displayAvatarURL() 
    })
    .setTitle(`${typeTag} ${data.item}`)
    .setDescription([
      'Verified community hardware marketplace listing:',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `• 💰 **Price:** \`${data.price}\``,
      `• 📍 **Location:** **${data.location}**`,
      `• 🏷️ **Listing Type:** **${isSelling ? 'Want To Sell (WTS)' : 'Want To Buy (WTB)'}**`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '### 📦 Item Condition & Warranty Details:',
      data.condition,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '⚠️ **Scam Prevention Reminder:**',
      '• Seller must post a handwritten timestamp photo in the discussion thread below (`Username` + `GAMING SHAMING` + `Date`).',
      '• Never transfer funds via UPI advance before verifying working proof & identity!'
    ].join('\n'))
    .setFooter({ text: 'GAMING SHAMING • Verified Indian Gamer Marketplace' })
    .setTimestamp();
}
