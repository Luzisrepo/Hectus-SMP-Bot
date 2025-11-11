# Hectus SMP Discord Bot

<div align="center">

![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

**A feature-rich Discord bot designed for Minecraft SMP communities, now available as a template for developers**

[Features](#features) • [Installation](#installation) • [Configuration](#configuration) • [Usage](#usage) • [Customization](#customization)

</div>

## 🚀 Overview

Originally developed by [._rayzz](https://github.com/luzisrepo) for the **Hectus SMP** Minecraft community, this Discord bot has evolved into a comprehensive template for developers needing robust community management tools. The bot combines essential moderation features with engaging community interactions.

## ✨ Features

### 🎫 Ticket System
- **Multi-category Support**: General, Payment, Player Reports, Bug Reports
- **Secure Channels**: Private ticket channels with role-based permissions
- **Auto-Close Functionality**: Cleanup with confirmation prompts
- **Staff Integration**: Automatic staff role mentions

### 🎭 Moderation Tools
- **Smart Ban System**: Temporary and permanent bans with auto-unban
- **Mute Management**: Time-based mutes with role permissions
- **DM Notifications**: Automated punishment notifications to users
- **Permission Checks**: Comprehensive role and permission validation

### 😄 Community Engagement
- **Reddit Meme Integration**: Fetches memes from multiple subreddits
- **Fallback System**: Local meme database when Reddit is unavailable
- **Cooldown Management**: Prevents spam with user cooldowns
- **Rich Embeds**: Beautiful, informative meme displays

### 🎮 Rich Presence
- **Dynamic Status**: Rotating presence showing server stats
- **Live Updates**: Real-time ticket and meme counters
- **Custom Assets**: Support for custom images and status messages

### ⚙️ Developer Friendly
- **Modular Structure**: Easy to extend and modify
- **Error Handling**: Comprehensive error catching and fallbacks
- **Environment Configuration**: Secure token and ID management
- **Template Ready**: Perfect starting point for custom bots

## 🛠️ Installation

### Prerequisites
- Node.js 16.9.0 or higher
- Discord Bot Token
- Discord Server with Manage Server permissions

### Step-by-Step Setup

1. **Clone the Repository**
```bash
git clone https://github.com/luzisrepo/hectus-smp-bot.git
cd hectus-smp-bot
```

2. **Install Dependencies**
```bash
npm install
```

3. **Environment Configuration**
Create a `.env` file:
```env
TOKEN=your_discord_bot_token_here
STAFF_ROLE_ID=your_staff_role_id_here
```

4. **Invite Bot to Server**
Use this invite link with appropriate permissions:
```bash
https://discord.com/oauth2/authorize?client_id=YOUR_BOT_ID&scope=bot&permissions=8
```

5. **Start the Bot**
```bash
node bot.js
```

## ⚙️ Configuration

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `TOKEN` | Discord Bot Token | ✅ |
| `STAFF_ROLE_ID` | Staff role ID for ticket access | ✅ |

### Customization Options

**Ticket Categories** - Modify in `config.ticketCategories`:
```javascript
ticketCategories: ['General Support', 'Technical Help', 'Player Reports', 'Suggestions']
```

**Subreddits for Memes** - Update in `config.redditSubreddits`:
```javascript
redditSubreddits: ['memes', 'dankmemes', 'ProgrammerHumor']
```

**Rich Presence** - Customize in `presenceStates` array:
```javascript
{
    name: 'Your Server Name',
    type: ActivityType.Playing,
    state: 'Custom status message',
    // ... more options
}
```

## 📋 Usage

### Slash Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/ip` | Get server connection details | Everyone |
| `/meme` | Fetch random meme from Reddit | Everyone |
| `/ticketpanel` | Create ticket selection panel | Manage Messages |
| `/ban` | Ban members with duration | Ban Members |
| `/mute` | Mute members with duration | Moderate Members |

### Ticket System Workflow
1. Use `/ticketpanel` to create the selection interface
2. Users click buttons to create categorized tickets
3. Staff receive notifications and can manage tickets
4. Tickets can be closed with the 🔒 button

### Moderation Features
- **Temporary Bans**: Specify duration (1h, 7d, 30d, etc.)
- **Smart Mutes**: Automatic role management and timeout
- **DM Notifications**: Users receive punishment details
- **Audit Logs**: All actions are logged with reasons

## 🎨 Customization Guide

### For Minecraft Servers
- Update server IP in `/ip` command response
- Modify presence to reflect your server name
- Customize ticket categories for your needs
- Add server-specific commands

### For General Communities
- Replace Minecraft-specific features
- Add custom commands for your community
- Modify meme subreddits to match interests
- Customize ticket categories

### Adding New Features
1. **New Slash Commands**:
```javascript
{
    name: 'newcommand',
    description: 'Description of new command',
    options: [/* command options */]
}
```

2. **Event Handlers**:
```javascript
client.on('interactionCreate', async interaction => {
    // Add new interaction handlers
});
```

## 🐛 Troubleshooting

### Common Issues

**Bot won't start:**
- Check Node.js version (requires 16.9.0+)
- Verify .env file exists with correct token
- Ensure all dependencies are installed

**Slash commands not appearing:**
- Bot may need time to register commands globally
- Check bot permissions in server
- Verify intent configuration

**Meme command not working:**
- Reddit API may be temporarily unavailable
- Bot uses fallback memes as backup
- Check internet connection

## 🤝 Contributing

This project is open for contributions! Feel free to:
- Report bugs and issues
- Suggest new features
- Submit pull requests
- Improve documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Credits

**Developed by:** [._rayzz](https://github.com/luzisrepo)  
**Originally for:** [Hectus SMP](https://discord.gg/YHpDanCRWt)  
**Current Purpose:** Template for Discord bot development

---

<div align="center">

### 💬 Support

For support using this template, create an issue or contact [._rayzz](https://github.com/luzisrepo)

### ⭐ Show Your Support

If this template helped you, give it a star! ⭐

**Happy Coding!** 🚀

</div>
