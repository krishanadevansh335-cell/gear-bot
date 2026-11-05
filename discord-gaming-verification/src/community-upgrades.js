import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';

// ── Milestone Roles Map ────────────────────────────────────────────────────────
export const RANK_ROLES = {
  5: '1567997372431204502',  // 🥉 Casual Grinder
  15: '1567997374968631450', // 🥈 Sweaty Gamer
  30: '1567997377837797507', // 🥇 Esports Elite
  50: '1567997379972694056'  // 💎 Immortal Legend
};

// Cooldown map: userId -> lastTimestamp (60s cooldown for XP)
const xpCooldowns = new Map();

/**
 * Handle XP reward on message creation
 */
export async function handleChatXp(message, db) {
  if (message.author.bot || !message.guild) return;
  const userId = message.author.id;
  const now = Date.now();
  const last = xpCooldowns.get(userId) || 0;
  if (now - last < 60 * 1000) return; // 60s cooldown

  xpCooldowns.set(userId, now);

  // Random XP between 15 and 25
  const xpEarned = Math.floor(Math.random() * 11) + 15;
  const result = db.addXp(userId, xpEarned);

  if (result.leveledUp) {
    try {
      // Check milestone roles
      const member = message.member || await message.guild.members.fetch(userId).catch(() => null);
      if (member) {
        for (const [lvlReq, roleId] of Object.entries(RANK_ROLES)) {
          if (result.level >= Number(lvlReq) && !member.roles.cache.has(roleId)) {
            await member.roles.add(roleId).catch(() => {});
          }
        }
      }

      // Send Level Up embed
      const levelEmbed = new EmbedBuilder()
        .setColor(0x00F0FF)
        .setAuthor({ name: 'LEVEL UP! • GAMING SHAMING STANDING', iconURL: message.author.displayAvatarURL() })
        .setDescription(`🎉 GG <@${userId}>! You've advanced to **Level ${result.level}**!\nTotal XP: \`${result.xp.toLocaleString()}\` XP`)
        .setFooter({ text: 'Keep chatting, sharing clips & squadding up to reach 💎 Immortal Legend!' });

      await message.channel.send({ embeds: [levelEmbed] }).catch(() => {});
    } catch (e) {
      console.warn('[XP_LEVELUP_WARN]', e.message);
    }
  }
}

/**
 * Build /rank embed card
 */
export function buildRankCard(user, profile, rankIndex, totalMembers) {
  const xpCurrent = profile ? profile.xp : 0;
  const level = profile ? profile.level : 1;
  const rep = profile ? profile.reputation : 0;
  const xpNext = Math.pow(level, 2) * 100;
  const progressRatio = Math.min(1, Math.max(0, xpCurrent / xpNext));
  const percent = Math.round(progressRatio * 100);
  const barBlocks = Math.round(progressRatio * 12);
  const progressBar = '█'.repeat(barBlocks) + '░'.repeat(12 - barBlocks);

  let rankTitle = 'Recruit';
  if (level >= 50) rankTitle = '💎 Immortal Legend';
  else if (level >= 30) rankTitle = '🥇 Esports Elite';
  else if (level >= 15) rankTitle = '🥈 Sweaty Gamer';
  else if (level >= 5) rankTitle = '🥉 Casual Grinder';

  const embed = new EmbedBuilder()
    .setColor(0xFFB703)
    .setAuthor({ name: `GAMING SHAMING // OPERATIVE DOSSIER`, iconURL: user.displayAvatarURL() })
    .setTitle(`📈 ${user.displayName || user.username}'s Standing`)
    .setDescription([
      `**Title:** **${rankTitle}** (Level ${level})`,
      `\`[${progressBar}] ${percent}%\``,
      `**XP:** \`${xpCurrent.toLocaleString()}\` / \`${xpNext.toLocaleString()}\` XP`
    ].join('\n'))
    .addFields(
      {
        name: '🏆 Server Rank',
        value: `#${rankIndex} of ${totalMembers} members`,
        inline: true
      },
      {
        name: '🌟 Reputation',
        value: `+${rep} REP points`,
        inline: true
      },
      {
        name: '💡 How to Earn More XP',
        value: [
          '• Chat actively in <#1567553526429913241> *(game-chat)*',
          '• Drop gameplay clips in <#1567553530254983248> *(clips-highlights)*',
          '• Play / participate in daily trivia drops & voice channels',
          '• Win weekly Battlestation King in <#1567632407803330581>'
        ].join('\n'),
        inline: false
      }
    )
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: 'Power by GAMING SHAMING • SQLite Native Level Engine' })
    .setTimestamp();

  return embed;
}

/**
 * Build /leaderboard embed
 */
export function buildLeaderboardCard(entries, requesterId) {
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  const lines = entries.slice(0, 10).map((entry, idx) => {
    const medal = medals[idx] || `#${entry.rank}`;
    const isMe = entry.user_id === requesterId ? ' 👈 *(You)*' : '';
    let tierBadge = '🥉';
    if (entry.level >= 50) tierBadge = '💎';
    else if (entry.level >= 30) tierBadge = '🥇';
    else if (entry.level >= 15) tierBadge = '🥈';

    return `${medal} <@${entry.user_id}> — **Lvl ${entry.level}** ${tierBadge} • \`${entry.xp.toLocaleString()} XP\`${isMe}`;
  });

  return new EmbedBuilder()
    .setColor(0x00F0FF)
    .setAuthor({ name: 'GAMING SHAMING // HALL OF FAME', iconURL: 'https://cdn-icons-png.flaticon.com/512/3176/3176396.png' })
    .setTitle('🏆 TOP COMMUNITY ESPORTS LEADERBOARD')
    .setDescription(
      lines.length > 0
        ? lines.join('\n\n')
        : '*No ranked activity recorded yet. Start chatting in gaming channels to claim #1!*'
    )
    .setFooter({ text: 'Ranks update dynamically in real time • GAMING SHAMING' })
    .setTimestamp();
}

// ── Feature 2: Hardware Bottleneck & PSU Advisor (/check-rig) ───────────────────

const CPU_DB = [
  { match: /5600g/i, name: 'AMD Ryzen 5 5600G', tdp: 65, tier: 2 },
  { match: /5600x?/i, name: 'AMD Ryzen 5 5600 / 5600X', tdp: 65, tier: 3 },
  { match: /5700x3d/i, name: 'AMD Ryzen 7 5700X3D', tdp: 105, tier: 4 },
  { match: /5800x3d/i, name: 'AMD Ryzen 7 5800X3D', tdp: 105, tier: 5 },
  { match: /7600x?/i, name: 'AMD Ryzen 5 7600 / 7600X', tdp: 85, tier: 4 },
  { match: /7700x?/i, name: 'AMD Ryzen 7 7700 / 7700X', tdp: 105, tier: 5 },
  { match: /7800x3d/i, name: 'AMD Ryzen 7 7800X3D', tdp: 120, tier: 6 },
  { match: /9800x3d/i, name: 'AMD Ryzen 7 9800X3D', tdp: 120, tier: 6 },
  { match: /12100f?/i, name: 'Intel Core i3-12100F', tdp: 60, tier: 2 },
  { match: /12400f?/i, name: 'Intel Core i5-12400F', tdp: 65, tier: 3 },
  { match: /13400f?/i, name: 'Intel Core i5-13400F', tdp: 65, tier: 4 },
  { match: /13600k?/i, name: 'Intel Core i5-13600K', tdp: 125, tier: 5 },
  { match: /14600k?/i, name: 'Intel Core i5-14600K', tdp: 125, tier: 5 },
  { match: /14700k?/i, name: 'Intel Core i7-14700K', tdp: 150, tier: 6 }
];

const GPU_DB = [
  { match: /6600\b/i, name: 'AMD Radeon RX 6600 8GB', tdp: 132, recPsu: 450, tier: 2, res: '1080p High-FPS' },
  { match: /6700\s*xt/i, name: 'AMD Radeon RX 6700 XT 12GB', tdp: 230, recPsu: 650, tier: 4, res: '1440p High-FPS' },
  { match: /7600\s*xt/i, name: 'AMD Radeon RX 7600 XT 16GB', tdp: 190, recPsu: 600, tier: 3, res: '1080p Ultra / 1440p' },
  { match: /7700\s*xt/i, name: 'AMD Radeon RX 7700 XT 12GB', tdp: 245, recPsu: 700, tier: 4, res: '1440p Ultra' },
  { match: /7800\s*xt/i, name: 'AMD Radeon RX 7800 XT 16GB', tdp: 263, recPsu: 750, tier: 5, res: '1440p Max / 4K Entry' },
  { match: /3060\b/i, name: 'NVIDIA GeForce RTX 3060 12GB', tdp: 170, recPsu: 550, tier: 3, res: '1080p Ultra / DLSS' },
  { match: /4060\s*ti/i, name: 'NVIDIA GeForce RTX 4060 Ti 8GB/16GB', tdp: 165, recPsu: 550, tier: 4, res: '1440p Balanced' },
  { match: /4060\b/i, name: 'NVIDIA GeForce RTX 4060 8GB', tdp: 115, recPsu: 550, tier: 3, res: '1080p Ultra / 1440p DLSS' },
  { match: /4070\s*super/i, name: 'NVIDIA GeForce RTX 4070 Super 12GB', tdp: 220, recPsu: 650, tier: 5, res: '1440p Maxed-Out / RT' },
  { match: /4070\b/i, name: 'NVIDIA GeForce RTX 4070 12GB', tdp: 200, recPsu: 650, tier: 5, res: '1440p Ultra' },
  { match: /4070\s*ti\s*super/i, name: 'NVIDIA GeForce RTX 4070 Ti Super 16GB', tdp: 285, recPsu: 750, tier: 5, res: '1440p 240Hz / 4K' },
  { match: /4080\s*super/i, name: 'NVIDIA GeForce RTX 4080 Super 16GB', tdp: 320, recPsu: 850, tier: 6, res: 'Native 4K Path Tracing' },
  { match: /4090\b/i, name: 'NVIDIA GeForce RTX 4090 24GB', tdp: 450, recPsu: 1000, tier: 7, res: 'Uncompromised 4K 144Hz+' }
];

export function evaluateRig(cpuInput, gpuInput, targetRes = '1440p') {
  const cpuMatch = CPU_DB.find(c => c.match.test(cpuInput)) || { name: cpuInput.trim(), tdp: 90, tier: 4 };
  const gpuMatch = GPU_DB.find(g => g.match.test(gpuInput)) || { name: gpuInput.trim(), tdp: 220, recPsu: 650, tier: 4, res: '1440p Gaming' };

  // System base power (Mobo, RAM, SSD, AIO/Fans): ~100W
  const systemPeakWattage = cpuMatch.tdp + gpuMatch.tdp + 100;
  // PSU Headroom 30-40%
  const recommendedPsu = Math.max(gpuMatch.recPsu || 550, Math.ceil((systemPeakWattage * 1.35) / 50) * 50);

  // Bottleneck analysis
  let verdict = 'Balanced Pair';
  let verdictColor = 0x10B981; // Emerald
  let verdictIcon = '✅';
  let explanation = `Your **${cpuMatch.name}** and **${gpuMatch.name}** are a well-calibrated pairing for modern AAA titles.`;

  if (cpuMatch.tier < gpuMatch.tier - 1) {
    verdict = 'CPU Bottleneck Detected';
    verdictColor = 0xF59E0B; // Amber
    verdictIcon = '⚠️';
    explanation = `The GPU (**${gpuMatch.name}**) is significantly faster than the CPU (**${cpuMatch.name}**). In CPU-heavy esports (Valorant, CS2, Warzone), frame drops or lower 1% lows may occur.`;
  } else if (gpuMatch.tier < cpuMatch.tier - 1) {
    verdict = 'GPU Bottleneck (Healthy)';
    verdictColor = 0x3B82F6; // Blue
    verdictIcon = 'ℹ️';
    explanation = `The CPU has plenty of thermal and core headroom. The GPU will run at 99-100% utilization, which is ideal for maximum graphics Fidelity.`;
  }

  const embed = new EmbedBuilder()
    .setColor(verdictColor)
    .setAuthor({ name: 'GAMER GEAR // HARDWARE ARCHITECT & BOTTLENECK ADVISOR', iconURL: 'https://cdn-icons-png.flaticon.com/512/879/879757.png' })
    .setTitle(`${verdictIcon} RIG EVALUATION: ${cpuMatch.name} + ${gpuMatch.name}`)
    .setDescription([
      `**Target Resolution:** \`${targetRes.toUpperCase()}\``,
      `**Bottleneck Verdict:** **${verdict}**`,
      explanation,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '### ⚡ Power Supply & Electrical Requirements:',
      `• **Estimated Peak System Draw:** \`~${systemPeakWattage}W\` (under 100% gaming load)`,
      `• **Minimum Recommended PSU:** **${recommendedPsu}W** *(80+ Bronze or 80+ Gold)*`,
      `• **Recommended Models:** Cooler Master MWE ${recommendedPsu}W / Deepcool PK${recommendedPsu}D / Corsair RM${recommendedPsu}e`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '### 🎯 Resolution & Performance Profile:',
      `• **Optimal Target Resolution:** **${gpuMatch.res}**`,
      `• **Recommended RAM Pairing:** 32GB (2x16GB) DDR5 6000MHz or DDR4 3200MHz`,
      `• **Indian Retail Headroom:** Safe for hot Indian summer ambient temperatures (35°C–42°C)`
    ].join('\n'))
    .setFooter({ text: 'Verified calculation based on real power spikes and GPU architecture tests • GAMING SHAMING' })
    .setTimestamp();

  return embed;
}

// ── Feature 3: Clips Highlights Auto-Voting & Thread Generator ─────────────────

const CLIP_DOMAINS = [
  'youtube.com', 'youtu.be', 'clips.twitch.tv', 'twitch.tv',
  'medal.tv', 'streamable.com', 'twitter.com', 'x.com', 'tiktok.com'
];

export async function handleClipPost(message) {
  if (message.author.bot || !message.guild) return;

  // Check if message has video attachment or clip link
  const hasVideoAttachment = message.attachments.some(a => 
    a.contentType?.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(a.name || '')
  );

  const hasClipLink = CLIP_DOMAINS.some(d => message.content.toLowerCase().includes(d));

  if (!hasVideoAttachment && !hasClipLink) return;

  try {
    // 1. Auto-react with rating emojis
    await message.react('🔥').catch(() => {});
    await message.react('⚡').catch(() => {});
    await message.react('🎯').catch(() => {});

    // 2. Open dedicated discussion thread
    const cleanAuthor = message.author.displayName.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Gamer';
    await message.startThread({
      name: `🎬 ${cleanAuthor}'s Highlight Clip`,
      autoArchiveDuration: 1440
    }).catch(() => {});
  } catch (err) {
    console.warn('[CLIP_HIGHLIGHT_WARN]', err.message);
  }
}

// ── Feature 4: Gaming Trivia & Guess The Game ───────────────────────────────────

export const TRIVIA_QUESTIONS = [
  {
    q: 'In Counter-Strike (CS:GO / CS2), what is the exact bomb countdown time before detonation?',
    options: ['35 Seconds', '40 Seconds', '45 Seconds', '30 Seconds'],
    answer: 1, // 40 Seconds
    fact: 'The competitive CS bomb timer is strictly 40 seconds (changed from 45 seconds back in 2015).'
  },
  {
    q: 'Which agent in Valorant is an Indian Radiant with the ability to bend water and create tidal waves?',
    options: ['Phoenix', 'Harbor', 'Yoru', 'Breach'],
    answer: 1, // Harbor
    fact: 'Harbor (Varun Batra) hails from India\'s coast and controls water artifacts from realm exploration.'
  },
  {
    q: 'In GTA 5, what is the surname of the retired bank robber protagonist who lives in Rockford Hills?',
    options: ['Clinton', 'Phillips', 'De Santa', 'Vercetti'],
    answer: 2, // De Santa
    fact: 'Michael changed his legal surname from Townley to De Santa through FIB witness protection.'
  },
  {
    q: 'Which game won Game of the Year (GOTY) at The Game Awards in 2022?',
    options: ['God of War Ragnarök', 'Elden Ring', 'Horizon Forbidden West', 'Stray'],
    answer: 1, // Elden Ring
    fact: 'FromSoftware\'s Elden Ring won Game of the Year alongside Best Game Direction and Best RPG in 2022.'
  },
  {
    q: 'What is the maximum build height in Minecraft modern versions (1.18+)?',
    options: ['Y = 256', 'Y = 320', 'Y = 512', 'Y = 384'],
    answer: 1, // Y = 320
    fact: 'The Caves & Cliffs Part II update expanded Minecraft world height from Y=-64 up to Y=320.'
  },
  {
    q: 'In The Witcher 3: Wild Hunt, what are Geralt\'s two swords made of?',
    options: ['Steel & Silver', 'Iron & Gold', 'Titanium & Mythril', 'Obsidian & Glass'],
    answer: 0, // Steel & Silver
    fact: 'As Geralt says: "Steel is for humans and beasts, silver is for monsters (both are for monsters)."'
  },
  {
    q: 'What was the first commercial GPU to introduce real-time hardware Ray Tracing (RT Cores)?',
    options: ['GTX 1080 Ti', 'RTX 2080', 'Radeon RX 6800 XT', 'RTX 3080'],
    answer: 1, // RTX 2080
    fact: 'NVIDIA introduced Turing architecture and RT Cores with the GeForce RTX 20-series in September 2018.'
  },
  {
    q: 'In Apex Legends, which legend is known as the "Holographic Trickster"?',
    options: ['Octane', 'Mirage', 'Wraith', 'Pathfinder'],
    answer: 1, // Mirage
    fact: 'Elliott Witt (Mirage) uses his custom holographic tech designed with his mother to confuse enemies.'
  },
  {
    q: 'Black Myth: Wukong is based on which classic 16th-century Chinese mythological novel?',
    options: ['Romance of the Three Kingdoms', 'Water Margin', 'Journey to the West', 'Dream of the Red Chamber'],
    answer: 2, // Journey to the West
    fact: 'Game Science adapted the classic Journey to the West tale featuring Sun Wukong (The Destined One).'
  },
  {
    q: 'What does the acronym DLSS stand for in PC gaming graphics?',
    options: ['Direct Low System Shader', 'Deep Learning Super Sampling', 'Dynamic Lighting Screen Space', 'Digital Light Synced Sync'],
    answer: 1, // Deep Learning Super Sampling
    fact: 'NVIDIA DLSS uses neural network AI models running on Tensor Cores to reconstruct high-resolution frames.'
  }
];

export function getRandomTrivia() {
  const idx = Math.floor(Math.random() * TRIVIA_QUESTIONS.length);
  return { ...TRIVIA_QUESTIONS[idx], id: idx };
}

export function buildTriviaPayload(trivia) {
  const embed = new EmbedBuilder()
    .setColor(0x00F0FF)
    .setAuthor({ name: 'GAMING SHAMING // DAILY GAMING TRIVIA', iconURL: 'https://cdn-icons-png.flaticon.com/512/3408/3408594.png' })
    .setTitle(`🎮 GAMER QUIZ: Think you know your games?`)
    .setDescription([
      `### ❓ ${trivia.q}`,
      '',
      `🅰️ **${trivia.options[0]}**`,
      `🅱️ **${trivia.options[1]}**`,
      `🅲 **${trivia.options[2]}**`,
      `🅳 **${trivia.options[3]}**`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '*(First correct answer wins **+50 XP** on the community leaderboard!)*'
    ].join('\n'))
    .setFooter({ text: 'Answer by clicking the button below • 45s timer' })
    .setTimestamp();

  const labels = ['A', 'B', 'C', 'D'];
  const row = new ActionRowBuilder();
  trivia.options.forEach((opt, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`trivia_${trivia.id}_opt_${i}`)
        .setLabel(`Option ${labels[i]}`)
        .setStyle(ButtonStyle.Primary)
    );
  });

  return { embed, row };
}

// ── Feature 5: Marketplace Anti-Scam Shield ────────────────────────────────────

export async function handleMarketplaceMessage(message) {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const upper = content.toUpperCase();
  const hasTag = upper.includes('[WTS]') || upper.includes('[WTB]') || upper.includes('WTS') || upper.includes('WTB');

  // Check for suspicious external telegram / phishing links
  const hasSuspiciousLink = /t\.me\/|telegram\.me|bit\.ly|tinyurl\.com|shorturl/i.test(content);
  if (hasSuspiciousLink) {
    await message.delete().catch(() => {});
    await message.channel.send({
      content: `⚠️ <@${message.author.id}>, direct link shorteners and unverified Telegram sales links are strictly prohibited in the marketplace for community fraud protection.`
    }).then(m => setTimeout(() => m.delete().catch(() => {}), 10000));
    return;
  }

  // If this is a manual user post that looks like a listing, attach the scam shield checklist
  if (hasTag || message.attachments.size > 0) {
    try {
      const cleanAuthor = message.author.displayName.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Trader';
      const thread = await message.startThread({
        name: `🛒 Discussion: ${cleanAuthor}'s Listing`,
        autoArchiveDuration: 1440
      }).catch(() => null);

      if (thread) {
        const shieldEmbed = new EmbedBuilder()
          .setColor(0xEF4444)
          .setAuthor({ name: 'GAMING SHAMING // MARKETPLACE FRAUD SHIELD' })
          .setTitle('🛡️ VERIFIED HARDWARE TRADING SAFETY CHECKLIST')
          .setDescription([
            'To protect both buyers and sellers against fraud, please adhere to these rules:',
            '',
            '1. 📸 **Handwritten Timestamp Photo Required:**',
            '   Seller must post a clear photo of the item with a handwritten piece of paper showing:',
            '   `Discord Username` + `GAMING SHAMING` + `Today\'s Date`.',
            '',
            '2. ⚙️ **Working Proof Benchmarks:**',
            '   • GPUs: FurMark / 3DMark TimeSpy / GPU-Z screenshot.',
            '   • SSDs / HDDs: CrystalDiskInfo health report.',
            '   • RAM: MemTest86 / Task Manager speed & capacity validation.',
            '',
            '3. 💳 **Payment & Shipping Safety:**',
            '   • **NEVER** transfer 100% advance UPI to brand-new accounts without identity verification.',
            '   • Preferred: In-person local handover or verified escrow / packing video proof.'
          ].join('\n'))
          .setFooter({ text: 'Report any suspicious behavior immediately to @Staff' });

        await thread.send({ embeds: [shieldEmbed] }).catch(() => {});
      }
    } catch (err) {
      console.warn('[MARKET_SHIELD_WARN]', err.message);
    }
  }
}
