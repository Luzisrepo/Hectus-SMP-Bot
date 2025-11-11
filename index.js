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
    redditSubreddits: ['memes', 'dankmemes', 'wholesomememes'],
    memeCooldown: new Set(),
    mutedRoleName: 'Muted'
};

const serverStats = {
    totalTickets: 0,
    memesServed: 0,
    lastActivity: Date.now()
};

const commands = [
    {
        name: 'ip',
        description: 'Get the server IP address'
    },
    {
        name: 'meme',
        description: 'Get a random meme from Reddit'
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

// Local meme fallback database
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
    }
];

async function fetchMeme(subreddit = 'memes') {
    try {
        // Try with proper headers first
        const headers = {
            'User-Agent': 'HectusSMP-Discord-Bot/1.0 (by /u/YourRedditUsername)',
            'Accept': 'application/json'
        };
        
        const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=50`, { 
            headers: headers,
            timeout: 10000 // 10 second timeout
        });
        
        if (!response.ok) {
            console.log(`Reddit API returned ${response.status}, using fallback memes`);
            return getFallbackMeme();
        }
        
        const data = await response.json();
        
        // Check if data structure is valid
        if (!data.data || !data.data.children) {
            console.log('Invalid Reddit API response, using fallback');
            return getFallbackMeme();
        }
        
        const posts = data.data.children.filter(post => 
            post.data && 
            post.data.post_hint === 'image' && 
            !post.data.over_18 &&
            post.data.url &&
            (post.data.url.includes('.jpg') || post.data.url.includes('.png') || post.data.url.includes('.gif'))
        );
        
        if (posts.length === 0) {
            console.log('No valid meme posts found, using fallback');
            return getFallbackMeme();
        }
        
        const randomPost = posts[Math.floor(Math.random() * posts.length)].data;
        return {
            title: randomPost.title || 'Funny Meme',
            url: randomPost.url,
            subreddit: randomPost.subreddit || 'memes',
            upvotes: randomPost.ups || 1000
        };
    } catch (error) {
        console.error('Error fetching meme from Reddit, using fallback:', error.message);
        return getFallbackMeme();
    }
}

function getFallbackMeme() {
    const randomMeme = localMemes[Math.floor(Math.random() * localMemes.length)];
    console.log('Using fallback meme:', randomMeme.title);
    return randomMeme;
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
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

            const subreddit = config.redditSubreddits[Math.floor(Math.random() * config.redditSubreddits.length)];
            const meme = await fetchMeme(subreddit);
            
            if (meme) {
                const memeEmbed = new EmbedBuilder()
                    .setTitle(meme.title)
                    .setImage(meme.url)
                    .setFooter({ text: `r/${meme.subreddit} • 👍 ${meme.upvotes.toLocaleString()}` })
                    .setColor(0xFF4500);
                
                await interaction.reply({ embeds: [memeEmbed] });
                serverStats.memesServed++;
                serverStats.lastActivity = Date.now();
            } else {
                await interaction.reply({ content: 'Failed to fetch meme. Please try again later.', ephemeral: true });
            }

            config.memeCooldown.add(interaction.user.id);
            setTimeout(() => {
                config.memeCooldown.delete(interaction.user.id);
            }, 5000);
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

client.login(process.env.TOKEN);