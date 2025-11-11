const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, ActivityType } = require('discord.js');
const fetch = require('node-fetch');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const config = {
    ticketCategories: ['General Support', 'Payment Support', 'Report Players', 'Report Bugs'],
    memeCooldown: new Set(),
    mutedRoleName: 'Muted',
    // Meme API endpoints with fallback priority
    memeAPIs: [
        {
            name: 'Reddit',
            url: (subreddit) => `https://www.reddit.com/r/${subreddit}/hot.json?limit=50`,
            processor: processRedditResponse
        },
        {
            name: 'MemeAPI',
            url: () => 'https://meme-api.com/gimme',
            processor: processMemeAPIResponse
        },
        {
            name: 'SomeRandomAPI',
            url: () => 'https://some-random-api.com/meme',
            processor: processSomeRandomAPIResponse
        }
    ]
};

const serverStats = {
    totalTickets: 0,
    memesServed: 0,
    lastActivity: Date.now(),
    apiUsage: {
        Reddit: 0,
        MemeAPI: 0,
        SomeRandomAPI: 0,
        Fallback: 0
    }
};

// Enhanced local meme database
const localMemes = [
    {
        title: "When you finally fix that bug",
        url: "https://i.imgur.com/8Wr0D8a.png",
        subreddit: "programmerhumor",
        upvotes: 42000
    },
    {
        title: "Minecraft in a nutshell",
        url: "https://i.imgur.com/3JQ1p0q.png",
        subreddit: "minecraft",
        upvotes: 69000
    },
    {
        title: "Discord mod life",
        url: "https://i.imgur.com/5X2m3b9.png",
        subreddit: "discord",
        upvotes: 35000
    },
    {
        title: "The hacker known as 4chan",
        url: "https://i.imgur.com/2m2m2m2.png",
        subreddit: "programming",
        upvotes: 78000
    },
    {
        title: "When the code works on first try",
        url: "https://i.imgur.com/9W9W9W9.png",
        subreddit: "developers",
        upvotes: 45000
    },
    {
        title: "Stack Overflow in real life",
        url: "https://i.imgur.com/1m2m3m4.png",
        subreddit: "ProgrammerHumor",
        upvotes: 52000
    },
    {
        title: "Git be like",
        url: "https://i.imgur.com/5m6m7m8.png",
        subreddit: "programmingmemes",
        upvotes: 38000
    },
    {
        title: "Debugging be like",
        url: "https://i.imgur.com/9m0m1m2.png",
        subreddit: "programming",
        upvotes: 41000
    },
    {
        title: "When the prod server crashes",
        url: "https://i.imgur.com/3m4m5m6.png",
        subreddit: "sysadmin",
        upvotes: 29000
    },
    {
        title: "AI taking over",
        url: "https://i.imgur.com/7m8m9m0.png",
        subreddit: "artificial",
        upvotes: 33000
    }
];

// Meme caching system
const memeCache = {
    data: [],
    lastUpdated: 0,
    ttl: 10 * 60 * 1000, // 10 minutes
    size: 20,
    isRefilling: false
};

// Rate limiting for API calls
let lastRequestTime = 0;
const REQUEST_DELAY = 2000; // 2 seconds between API calls

const commands = [
    {
        name: 'ip',
        description: 'Get the server IP address'
    },
    {
        name: 'meme',
        description: 'Get a random meme from various sources'
    },
    {
        name: 'ticketpanel',
        description: 'Create a ticket panel with multiple ticket types'
    },
    {
        name: 'ban',
        description: 'Ban a member from the server',
        options: [
            {
                name: 'member',
                type: 6,
                description: 'The member to ban',
                required: true
            },
            {
                name: 'duration',
                type: 3,
                description: 'Duration of the ban (e.g., 7d, 30d, permanent)',
                required: true
            },
            {
                name: 'reason',
                type: 3,
                description: 'Reason for the ban',
                required: true
            }
        ]
    },
    {
        name: 'mute',
        description: 'Mute a member in the server',
        options: [
            {
                name: 'member',
                type: 6,
                description: 'The member to mute',
                required: true
            },
            {
                name: 'duration',
                type: 3,
                description: 'Duration of the mute (e.g., 1h, 24h, 7d)',
                required: true
            },
            {
                name: 'reason',
                type: 3,
                description: 'Reason for the mute',
                required: true
            }
        ]
    },
    {
        name: 'stats',
        description: 'Show bot statistics and meme API usage'
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
const activeMutes = new Map();
const activeTickets = new Map();

const presenceStates = [
    {
        name: 'Hectus SMP',
        type: ActivityType.Playing,
        state: 'Managing the community',
        details: 'With players online',
        largeImage: 'hectussmp',
        largeText: 'Hectus SMP - Adventure Awaits!',
        smallImage: 'minecraft',
        smallText: 'Minecraft Server'
    },
    {
        name: 'Hectus SMP',
        type: ActivityType.Playing,
        state: 'Processing tickets',
        details: 'Helping players',
        largeImage: 'hectussmp',
        largeText: 'Hectus SMP Support',
        smallImage: 'support',
        smallText: 'Support System Active'
    },
    {
        name: 'Hectus SMP',
        type: ActivityType.Playing,
        state: 'Serving memes',
        details: `${serverStats.memesServed} memes delivered`,
        largeImage: 'hectussmp',
        largeText: 'Hectus SMP Community',
        smallImage: 'meme',
        smallText: 'Fun & Games'
    },
    {
        name: 'Hectus SMP',
        type: ActivityType.Watching,
        state: 'Server activity',
        details: 'Monitoring the SMP',
        largeImage: 'hectussmp',
        largeText: 'Hectus SMP Monitoring',
        smallImage: 'online',
        smallText: 'Server Online'
    }
];

let currentPresenceIndex = 0;

// Utility Functions
function updateRichPresence() {
    const presence = presenceStates[currentPresenceIndex];
    
    if (presence.state.includes('tickets')) {
        presence.details = `${serverStats.totalTickets} tickets handled`;
    } else if (presence.state.includes('memes')) {
        presence.details = `${serverStats.memesServed} memes delivered`;
    }
    
    client.user.setPresence({
        activities: [{
            name: presence.name,
            type: presence.type,
            state: presence.state,
            details: presence.details,
            assets: {
                largeImage: presence.largeImage,
                largeText: presence.largeText,
                smallImage: presence.smallImage,
                smallText: presence.smallText
            },
            timestamps: {
                start: serverStats.lastActivity
            }
        }],
        status: 'online'
    });
    
    currentPresenceIndex = (currentPresenceIndex + 1) % presenceStates.length;
}

function parseDuration(duration) {
    const units = {
        's': 1000,
        'm': 1000 * 60,
        'h': 1000 * 60 * 60,
        'd': 1000 * 60 * 60 * 24,
        'w': 1000 * 60 * 60 * 24 * 7
    };
    
    if (duration.toLowerCase() === 'permanent') {
        return null;
    }
    
    const match = duration.match(/^(\d+)([smhdw])$/);
    if (!match) {
        throw new Error('Invalid duration format. Use: 1s, 5m, 2h, 7d, 1w, or "permanent"');
    }
    
    const amount = parseInt(match[1]);
    const unit = match[2];
    
    return amount * units[unit];
}

function formatDuration(ms) {
    if (ms === null) return 'Permanent';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day(s)`;
    if (hours > 0) return `${hours} hour(s)`;
    if (minutes > 0) return `${minutes} minute(s)`;
    return `${seconds} second(s)`;
}

// API Response Processors
function processRedditResponse(data) {
    if (!data.data || !data.data.children) {
        throw new Error('Invalid Reddit response structure');
    }
    
    const posts = data.data.children.filter(post => 
        post.data && 
        post.data.post_hint === 'image' && 
        !post.data.over_18 &&
        post.data.url &&
        (post.data.url.includes('.jpg') || post.data.url.includes('.png') || post.data.url.includes('.gif'))
    );
    
    if (posts.length === 0) {
        throw new Error('No valid meme posts found');
    }
    
    const randomPost = posts[Math.floor(Math.random() * posts.length)].data;
    return {
        title: randomPost.title || 'Funny Meme',
        url: randomPost.url,
        subreddit: randomPost.subreddit || 'memes',
        upvotes: randomPost.ups || 1000,
        source: 'Reddit'
    };
}

function processMemeAPIResponse(data) {
    if (!data.url) {
        throw new Error('Invalid MemeAPI response');
    }
    
    return {
        title: data.title || 'Random Meme',
        url: data.url,
        subreddit: data.subreddit || 'memes',
        upvotes: data.ups || 5000,
        source: 'MemeAPI'
    };
}

function processSomeRandomAPIResponse(data) {
    if (!data.image) {
        throw new Error('Invalid SomeRandomAPI response');
    }
    
    return {
        title: data.caption || 'Funny Meme',
        url: data.image,
        subreddit: 'memes',
        upvotes: 3000,
        source: 'SomeRandomAPI'
    };
}

// Enhanced Meme Fetching System
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function fetchFromAPI(api, subreddit = 'memes') {
    // Rate limiting
    const now = Date.now();
    if (now - lastRequestTime < REQUEST_DELAY) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - (now - lastRequestTime)));
    }
    lastRequestTime = Date.now();
    
    try {
        const url = typeof api.url === 'function' ? api.url(subreddit) : api.url;
        const headers = {
            'User-Agent': 'HectusSMP-Discord-Bot/1.0',
            'Accept': 'application/json'
        };
        
        console.log(`Trying ${api.name} API...`);
        const response = await fetchWithTimeout(url, { headers });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        const meme = api.processor(data);
        
        // Track API usage
        serverStats.apiUsage[api.name] = (serverStats.apiUsage[api.name] || 0) + 1;
        console.log(`Successfully fetched from ${api.name}`);
        
        return meme;
    } catch (error) {
        console.log(`${api.name} API failed: ${error.message}`);
        throw error;
    }
}

async function fetchMemeFromAnyAPI(subreddit = 'memes') {
    for (const api of config.memeAPIs) {
        try {
            const meme = await fetchFromAPI(api, subreddit);
            if (meme && meme.url) {
                return meme;
            }
        } catch (error) {
            // Continue to next API
            continue;
        }
    }
    
    // All APIs failed, use fallback
    console.log('All APIs failed, using fallback meme');
    serverStats.apiUsage.Fallback++;
    return getFallbackMeme();
}

function getFallbackMeme() {
    const randomMeme = localMemes[Math.floor(Math.random() * localMemes.length)];
    return {
        ...randomMeme,
        source: 'Fallback'
    };
}

// Caching System
async function refillMemeCache() {
    if (memeCache.isRefilling || memeCache.data.length >= memeCache.size) {
        return;
    }
    
    memeCache.isRefilling = true;
    console.log('Refilling meme cache...');
    
    try {
        const memesToFetch = memeCache.size - memeCache.data.length;
        const fetchPromises = [];
        
        for (let i = 0; i < Math.min(memesToFetch, 5); i++) {
            fetchPromises.push(fetchMemeFromAnyAPI());
        }
        
        const newMemes = await Promise.allSettled(fetchPromises);
        
        for (const result of newMemes) {
            if (result.status === 'fulfilled' && result.value) {
                memeCache.data.push(result.value);
            }
        }
        
        memeCache.lastUpdated = Date.now();
        console.log(`Cache refilled. Now has ${memeCache.data.length} memes`);
    } catch (error) {
        console.error('Error refilling cache:', error);
    } finally {
        memeCache.isRefilling = false;
    }
}

function getMemeFromCache() {
    if (memeCache.data.length === 0) {
        return getFallbackMeme();
    }
    
    const meme = memeCache.data.shift();
    
    // Trigger background refill if cache is getting low
    if (memeCache.data.length < 5 && !memeCache.isRefilling) {
        setTimeout(refillMemeCache, 1000);
    }
    
    return meme;
}

async function getMeme() {
    // Try cache first
    if (memeCache.data.length > 0) {
        const cachedMeme = getMemeFromCache();
        if (cachedMeme) {
            return cachedMeme;
        }
    }
    
    // If cache is empty, fetch fresh
    return await fetchMemeFromAnyAPI();
}

// Moderation Functions
async function getMutedRole(guild) {
    let mutedRole = guild.roles.cache.find(role => role.name === config.mutedRoleName);
    
    if (!mutedRole) {
        try {
            mutedRole = await guild.roles.create({
                name: config.mutedRoleName,
                color: '#808080',
                permissions: []
            });
            
            guild.channels.cache.forEach(async (channel) => {
                try {
                    await channel.permissionOverwrites.create(mutedRole, {
                        SendMessages: false,
                        AddReactions: false,
                        Speak: false,
                        CreatePublicThreads: false,
                        CreatePrivateThreads: false,
                        SendMessagesInThreads: false
                    });
                } catch (error) {
                    console.error(`Error setting permissions in channel ${channel.name}:`, error);
                }
            });
        } catch (error) {
            console.error('Error creating muted role:', error);
            throw error;
        }
    }
    
    return mutedRole;
}

async function sendPunishmentDM(member, action, duration, reason, staffMember) {
    const embed = new EmbedBuilder()
        .setTitle(`You have been ${action} ${action === 'banned' ? 'from' : 'in'} ${member.guild.name}`)
        .setColor(action === 'banned' ? 0xFF0000 : 0xFFA500)
        .addFields(
            { name: 'Duration', value: formatDuration(duration), inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Staff Member', value: staffMember.tag, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `If you believe this is a mistake, please contact the staff team.` });
    
    try {
        await member.send({ embeds: [embed] });
        return true;
    } catch (error) {
        console.error(`Could not send DM to ${member.user.tag}:`, error);
        return false;
    }
}

// Ticket System
async function createTicketChannel(interaction, category) {
    try {
        const guild = interaction.guild;
        const user = interaction.user;
        
        const channelName = `ticket-${user.username}-${Date.now().toString().slice(-4)}`;
        
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: interaction.channel.parent,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory
                    ]
                }
            ]
        });

        if (process.env.STAFF_ROLE_ID) {
            await channel.permissionOverwrites.create(process.env.STAFF_ROLE_ID, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: true
            });
        }
        
        const ticketEmbed = new EmbedBuilder()
            .setTitle(`${category} Ticket`)
            .setDescription(`Hello ${user}! Support will be with you shortly.\nPlease describe your issue in detail.`)
            .addFields(
                { name: 'Category', value: category, inline: true },
                { name: 'Created By', value: user.tag, inline: true },
                { name: 'Created At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setColor(0x00AE86)
            .setTimestamp();
        
        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );
        
        await channel.send({
            content: process.env.STAFF_ROLE_ID ? `${user} <@&${process.env.STAFF_ROLE_ID}>` : `${user}`,
            embeds: [ticketEmbed],
            components: [closeButton]
        });
        
        activeTickets.set(channel.id, {
            userId: user.id,
            category: category,
            createdAt: Date.now()
        });
        
        serverStats.totalTickets++;
        serverStats.lastActivity = Date.now();
        
        await interaction.reply({
            content: `Your ${category.toLowerCase()} ticket has been created: ${channel}`,
            ephemeral: true
        });
        
    } catch (error) {
        console.error('Error creating ticket channel:', error);
        await interaction.reply({
            content: 'There was an error creating your ticket. Please try again.',
            ephemeral: true
        });
    }
}

async function closeTicket(interaction) {
    try {
        const channel = interaction.channel;
        const ticketData = activeTickets.get(channel.id);
        
        if (!ticketData) {
            await interaction.reply({
                content: 'This channel is not a valid ticket.',
                ephemeral: true
            });
            return;
        }
        
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages) && interaction.user.id !== ticketData.userId) {
            await interaction.reply({
                content: 'You do not have permission to close this ticket.',
                ephemeral: true
            });
            return;
        }
        
        const closeEmbed = new EmbedBuilder()
            .setTitle('Ticket Closed')
            .setDescription(`This ticket has been closed by ${interaction.user.tag}`)
            .setColor(0xFF0000)
            .setTimestamp();
        
        await interaction.reply({ embeds: [closeEmbed] });
        
        setTimeout(async () => {
            try {
                await channel.delete();
                activeTickets.delete(channel.id);
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 5000);
        
    } catch (error) {
        console.error('Error closing ticket:', error);
        await interaction.reply({
            content: 'There was an error closing the ticket.',
            ephemeral: true
        });
    }
}

function createTicketPanel() {
    const embed = new EmbedBuilder()
        .setTitle('Support Ticket System')
        .setDescription('Please select the type of ticket you would like to create:')
        .addFields(
            { name: '🎫 General Support', value: 'For general questions and support', inline: true },
            { name: '💳 Payment Support', value: 'For billing and payment issues', inline: true },
            { name: '👥 Report Players', value: 'To report player behavior', inline: true },
            { name: '🐛 Report Bugs', value: 'To report game bugs and issues', inline: true }
        )
        .setColor(0x00AE86)
        .setTimestamp();

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_general')
                .setLabel('General Support')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫'),
            new ButtonBuilder()
                .setCustomId('ticket_payment')
                .setLabel('Payment Support')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💳'),
            new ButtonBuilder()
                .setCustomId('ticket_report_players')
                .setLabel('Report Players')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('👥'),
            new ButtonBuilder()
                .setCustomId('ticket_report_bugs')
                .setLabel('Report Bugs')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🐛')
        );

    return { embeds: [embed], components: [buttons] };
}

// Bot Event Handlers
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Initialize cache
    await refillMemeCache();
    
    // Set up periodic cache refresh
    setInterval(refillMemeCache, 5 * 60 * 1000); // Refresh every 5 minutes
    
    updateRichPresence();
    setInterval(updateRichPresence, 120000);
    
    setInterval(() => {
        serverStats.lastActivity = Date.now();
    }, 60000);
    
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'ip') {
            await interaction.reply('IP: not released yet!');
            serverStats.lastActivity = Date.now();
            return;
        }

        if (interaction.commandName === 'meme') {
            if (config.memeCooldown.has(interaction.user.id)) {
                await interaction.reply({ content: 'Please wait a few seconds before requesting another meme!', ephemeral: true });
                return;
            }

            try {
                const meme = await getMeme();
                
                const memeEmbed = new EmbedBuilder()
                    .setTitle(meme.title)
                    .setImage(meme.url)
                    .setFooter({ 
                        text: `r/${meme.subreddit} • 👍 ${meme.upvotes.toLocaleString()} • Source: ${meme.source}` 
                    })
                    .setColor(0xFF4500);
                
                await interaction.reply({ embeds: [memeEmbed] });
                serverStats.memesServed++;
                serverStats.lastActivity = Date.now();
                
                console.log(`Served meme from ${meme.source}. Cache: ${memeCache.data.length} memes remaining`);
                
            } catch (error) {
                console.error('Error in meme command:', error);
                await interaction.reply({ 
                    content: 'Failed to fetch meme. Please try again later.', 
                    ephemeral: true 
                });
            }

            config.memeCooldown.add(interaction.user.id);
            setTimeout(() => {
                config.memeCooldown.delete(interaction.user.id);
            }, 5000);
            return;
        }

        if (interaction.commandName === 'stats') {
            const totalAPIUsage = Object.values(serverStats.apiUsage).reduce((a, b) => a + b, 0);
            const apiUsagePercentages = Object.entries(serverStats.apiUsage).map(([api, count]) => {
                const percentage = totalAPIUsage > 0 ? ((count / totalAPIUsage) * 100).toFixed(1) : 0;
                return `**${api}**: ${count} (${percentage}%)`;
            }).join('\n');

            const statsEmbed = new EmbedBuilder()
                .setTitle('Bot Statistics')
                .setColor(0x00AE86)
                .addFields(
                    { name: 'Memes Served', value: serverStats.memesServed.toString(), inline: true },
                    { name: 'Tickets Created', value: serverStats.totalTickets.toString(), inline: true },
                    { name: 'Cache Size', value: `${memeCache.data.length}/${memeCache.size}`, inline: true },
                    { name: 'API Usage', value: apiUsagePercentages, inline: false },
                    { name: 'Uptime', value: `<t:${Math.floor(serverStats.lastActivity / 1000)}:R>`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [statsEmbed] });
            return;
        }

        if (interaction.commandName === 'ticketpanel') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                await interaction.reply({ content: 'You do not have permission to create ticket panels.', ephemeral: true });
                return;
            }

            const panel = createTicketPanel();
            await interaction.reply({ content: 'Ticket panel created!', ephemeral: true });
            await interaction.channel.send(panel);
            serverStats.lastActivity = Date.now();
            return;
        }

        if (interaction.commandName === 'ban') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                await interaction.reply({ content: 'You do not have permission to ban members.', ephemeral: true });
                return;
            }

            const member = interaction.options.getMember('member');
            const durationStr = interaction.options.getString('duration');
            const reason = interaction.options.getString('reason');

            if (!member) {
                await interaction.reply({ content: 'Member not found.', ephemeral: true });
                return;
            }

            if (!member.bannable) {
                await interaction.reply({ content: 'I cannot ban this member.', ephemeral: true });
                return;
            }

            try {
                const durationMs = parseDuration(durationStr);
                const dmSent = await sendPunishmentDM(member, 'banned', durationMs, reason, interaction.user);
                await member.ban({ reason: `${reason} | Duration: ${durationStr} | By: ${interaction.user.tag}` });
                
                const replyEmbed = new EmbedBuilder()
                    .setTitle('Member Banned')
                    .setColor(0xFF0000)
                    .addFields(
                        { name: 'Member', value: `${member.user.tag} (${member.id})`, inline: true },
                        { name: 'Duration', value: formatDuration(durationMs), inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'DM Status', value: dmSent ? 'Sent' : 'Failed to send', inline: true }
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [replyEmbed] });
                serverStats.lastActivity = Date.now();
                
                if (durationMs !== null) {
                    setTimeout(async () => {
                        try {
                            await interaction.guild.members.unban(member.id, 'Temporary ban expired');
                        } catch (error) {
                            console.error('Error unbanning member:', error);
                        }
                    }, durationMs);
                }
                
            } catch (error) {
                console.error('Error banning member:', error);
                await interaction.reply({ content: `Error banning member: ${error.message}`, ephemeral: true });
            }
            return;
        }

        if (interaction.commandName === 'mute') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                await interaction.reply({ content: 'You do not have permission to mute members.', ephemeral: true });
                return;
            }

            const member = interaction.options.getMember('member');
            const durationStr = interaction.options.getString('duration');
            const reason = interaction.options.getString('reason');

            if (!member) {
                await interaction.reply({ content: 'Member not found.', ephemeral: true });
                return;
            }

            if (member.user.bot) {
                await interaction.reply({ content: 'Cannot mute bots.', ephemeral: true });
                return;
            }

            try {
                const durationMs = parseDuration(durationStr);
                if (durationMs === null) {
                    await interaction.reply({ content: 'Mute cannot be permanent. Please specify a duration.', ephemeral: true });
                    return;
                }

                const mutedRole = await getMutedRole(interaction.guild);
                const dmSent = await sendPunishmentDM(member, 'muted', durationMs, reason, interaction.user);
                await member.roles.add(mutedRole, `${reason} | Duration: ${durationStr} | By: ${interaction.user.tag}`);
                
                const replyEmbed = new EmbedBuilder()
                    .setTitle('Member Muted')
                    .setColor(0xFFA500)
                    .addFields(
                        { name: 'Member', value: `${member.user.tag} (${member.id})`, inline: true },
                        { name: 'Duration', value: formatDuration(durationMs), inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'DM Status', value: dmSent ? 'Sent' : 'Failed to send', inline: true }
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [replyEmbed] });
                serverStats.lastActivity = Date.now();
                
                const muteKey = `${interaction.guild.id}-${member.id}`;
                activeMutes.set(muteKey, {
                    memberId: member.id,
                    guildId: interaction.guild.id,
                    roleId: mutedRole.id,
                    timeout: setTimeout(async () => {
                        try {
                            const guild = client.guilds.cache.get(interaction.guild.id);
                            const targetMember = await guild.members.fetch(member.id);
                            await targetMember.roles.remove(mutedRole, 'Mute duration expired');
                            activeMutes.delete(muteKey);
                        } catch (error) {
                            console.error('Error unmuting member:', error);
                        }
                    }, durationMs)
                });
                
            } catch (error) {
                console.error('Error muting member:', error);
                await interaction.reply({ content: `Error muting member: ${error.message}`, ephemeral: true });
            }
            return;
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('ticket_')) {
            const ticketType = interaction.customId.split('_')[1];
            let category;
            
            switch (ticketType) {
                case 'general':
                    category = 'General Support';
                    break;
                case 'payment':
                    category = 'Payment Support';
                    break;
                case 'report':
                    category = interaction.customId.includes('players') ? 'Report Players' : 'Report Bugs';
                    break;
                default:
                    category = 'General Support';
            }
            
            await createTicketChannel(interaction, category);
            return;
        }
        
        if (interaction.customId === 'close_ticket') {
            await closeTicket(interaction);
            return;
        }
    }
});

client.login(process.env.TOKEN);
